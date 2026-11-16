import {day} from './game/rules';
import {APP_RELEASE} from './release';

export type PilotEnv={DB?:D1Database;PILOT_METRICS_ENABLED?:string;PILOT_ADMIN_EMAIL?:string};
export type PilotChannel='telegram'|'browser';
export const clientErrorCodes=['sdk_unavailable','network_timeout','network_error','invalid_response','art_load_failed'] as const;
export type ClientErrorCode=typeof clientErrorCodes[number];
export const serverErrorCodes=['unavailable','busy'] as const;
export type DiagnosticCode=ClientErrorCode|typeof serverErrorCodes[number];
const channelOf=(id:string):PilotChannel=>id.startsWith('tg:')?'telegram':'browser';
const plusDays=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const metricsEnabled=(env:PilotEnv)=>env.PILOT_METRICS_ENABLED==='1';
/** Dispatch authenticates and strips/replaces these headers before the Worker. */
export function isPilotAdmin(request:Request,env:PilotEnv){
 const configured=env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
 return !!configured&&!request.headers.has('x-telegram-init-data')&&!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()===configured;
}
/** Optional telemetry must never turn a committed game operation into an error. */
export async function observePlayer(db:D1Database,id:string,created:boolean,now:number){
 try{
  await db.batch([
   db.prepare(`INSERT INTO pilot_profiles (player_id,first_seen,first_day,channel,is_new) VALUES (?,?,?,?,?)
    ON CONFLICT(player_id) DO UPDATE SET is_new=MAX(pilot_profiles.is_new,excluded.is_new),first_seen=MIN(pilot_profiles.first_seen,excluded.first_seen),first_day=MIN(pilot_profiles.first_day,excluded.first_day)`).bind(id,now,day(now),channelOf(id),created?1:0),
   db.prepare(`INSERT INTO pilot_visits (player_id,day,first_at) VALUES (?,?,?)
    ON CONFLICT(player_id,day) DO UPDATE SET first_at=MIN(pilot_visits.first_at,excluded.first_at)`).bind(id,day(now),now),
  ]);
 }catch{console.warn(JSON.stringify({kind:'pilot_capture_failed',code:'visit_storage'}));}
}
export async function recordDiagnostic(db:D1Database,id:string,requestId:string,code:DiagnosticCode,source:'server'|'client',now:number){
 if(!/^[a-f0-9-]{36}$/.test(requestId)||![...clientErrorCodes,...serverErrorCodes].includes(code))return;
 try{
  // Count and insertion run in one statement: concurrent reports cannot exceed the cap.
  await db.prepare(`INSERT OR IGNORE INTO pilot_errors (request_id,player_id,day,channel,code,source,occurred_at)
   SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM players WHERE id=?)
   AND (SELECT COUNT(*) FROM pilot_errors WHERE player_id=? AND day=?)<20`).bind(requestId,id,day(now),channelOf(id),code,source,now,id,id,day(now)).run();
 }catch{console.warn(JSON.stringify({kind:'pilot_capture_failed',code:'diagnostic_storage',requestId}));}
}
export type PilotReport={
 release:string;generatedAt:number;channel:PilotChannel;since:string;through:string;observedSince:number|null;
 visitors:number;newProfiles:number;existingProfiles:number;
 milestones:{selected:number;played:number;gift:number;secondPet:number};
 retention:{eligible:number;returned:number;percent:number|null};
 daily:{day:string;active:number;newProfiles:number}[];
 errors:{code:string;source:string;count:number}[];
 recentErrors:{requestId:string;code:string;source:string;occurredAt:number}[];
};
export async function readPilotReport(db:D1Database,days:7|14|30,channel:PilotChannel,now=Date.now()):Promise<PilotReport>{
 const through=day(now),since=plusDays(through,1-days),cutoff=plusDays(through,-35);
 // Keep 35 days of visit/diagnostic detail. Game receipts and progression are never pruned.
 await db.batch([db.prepare('DELETE FROM pilot_errors WHERE day<?').bind(cutoff),db.prepare('DELETE FROM pilot_visits WHERE day<?').bind(cutoff)]);
 const [coverage,visitors,cohort,retention,daily,errors,recent]=await db.batch([
  db.prepare('SELECT MIN(first_seen) observedSince FROM pilot_profiles WHERE channel=?').bind(channel),
  db.prepare(`SELECT COUNT(DISTINCT v.player_id) visitors,COUNT(DISTINCT CASE WHEN p.is_new=0 THEN v.player_id END) existingProfiles
   FROM pilot_visits v JOIN pilot_profiles p ON p.player_id=v.player_id WHERE p.channel=? AND v.day BETWEEN ? AND ?`).bind(channel,since,through),
  db.prepare(`SELECT COUNT(*) newProfiles,
   COALESCE(SUM(EXISTS(SELECT 1 FROM operations o WHERE o.player_id=p.player_id AND o.action LIKE 'select:%')),0) selected,
   COALESCE(SUM(EXISTS(SELECT 1 FROM operations o WHERE o.player_id=p.player_id AND (o.action='play' OR o.action LIKE 'play:%' OR (o.action LIKE 'firefly_finish:%' AND substr(o.action,-1)<>':')))),0) played,
   COALESCE(SUM(EXISTS(SELECT 1 FROM operations o WHERE o.player_id=p.player_id AND o.action='daily')),0) gift,
   COALESCE(SUM(EXISTS(SELECT 1 FROM operations o WHERE o.player_id=p.player_id AND o.action LIKE 'unlock:%')),0) secondPet
   FROM pilot_profiles p WHERE p.channel=? AND p.is_new=1 AND p.first_day BETWEEN ? AND ?`).bind(channel,since,through),
  db.prepare(`SELECT COUNT(*) eligible,COALESCE(SUM(EXISTS(SELECT 1 FROM pilot_visits v WHERE v.player_id=p.player_id AND v.day=date(p.first_day,'+1 day'))),0) returned
   FROM pilot_profiles p WHERE p.channel=? AND p.is_new=1 AND p.first_day>=? AND p.first_day<?`).bind(channel,since,through),
  db.prepare(`SELECT v.day,COUNT(*) active,SUM(CASE WHEN p.is_new=1 AND p.first_day=v.day THEN 1 ELSE 0 END) newProfiles
   FROM pilot_visits v JOIN pilot_profiles p ON p.player_id=v.player_id WHERE p.channel=? AND v.day BETWEEN ? AND ? GROUP BY v.day ORDER BY v.day`).bind(channel,since,through),
  db.prepare('SELECT code,source,COUNT(*) count FROM pilot_errors WHERE channel=? AND day BETWEEN ? AND ? GROUP BY code,source ORDER BY count DESC,code').bind(channel,since,through),
  db.prepare('SELECT request_id requestId,code,source,occurred_at occurredAt FROM pilot_errors WHERE channel=? AND day BETWEEN ? AND ? ORDER BY occurred_at DESC,request_id LIMIT 20').bind(channel,since,through),
 ]);
 const c=cohort.results[0] as {newProfiles:number;selected:number;played:number;gift:number;secondPet:number};
 const r=retention.results[0] as {eligible:number;returned:number};
 const v=visitors.results[0] as {visitors:number;existingProfiles:number};
 return {release:APP_RELEASE,generatedAt:now,channel,since,through,observedSince:(coverage.results[0] as {observedSince:number|null}).observedSince,...v,newProfiles:c.newProfiles,
  milestones:{selected:c.selected,played:c.played,gift:c.gift,secondPet:c.secondPet},
  retention:{...r,percent:r.eligible?Math.round(r.returned/r.eligible*1000)/10:null},
  daily:daily.results as PilotReport['daily'],errors:errors.results as PilotReport['errors'],recentErrors:recent.results as PilotReport['recentErrors']};
}
