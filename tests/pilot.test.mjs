import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
rmSync('.sites-runtime/pilot-test-build',{recursive:true,force:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','lib/pilot-http.ts','lib/client-diagnostics.ts','lib/game/http.ts','--rootDir','lib','--outDir','.sites-runtime/pilot-test-build','--module','commonjs','--target','es2022','--skipLibCheck','--types','@cloudflare/workers-types,node']);
writeFileSync('.sites-runtime/pilot-test-build/package.json','{"type":"commonjs"}');
const require=createRequire(import.meta.url);
const {getState,act}=require('../.sites-runtime/pilot-test-build/game/store.js');
const {observePlayer,readPilotReport,recordDiagnostic}=require('../.sites-runtime/pilot-test-build/pilot.js');
const {handlePilot,handleDiagnostic}=require('../.sites-runtime/pilot-test-build/pilot-http.js');
const {handleGame}=require('../.sites-runtime/pilot-test-build/game/http.js');
const {day}=require('../.sites-runtime/pilot-test-build/game/rules.js');
const time=Date.UTC(2026,10,16,20,59);
async function withDb(run){
 const {Miniflare}=await import('miniflare');const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
 try{const db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql.trim()).run();await run(db);}finally{await mf.dispose();}
}
test('pilot counts confirmed first actions once, separates legacy/browser profiles and measures Moscow D1',async()=>withDb(async db=>{
 await getState(db,'tg:old',time-86400000);await act(db,'tg:old','old-choice','select:chudik',time-86400000);
 await Promise.all(Array.from({length:8},()=>getState(db,'tg:101',time,true)));
 await getState(db,'tg:102',time,true);await getState(db,'web:tester',time,true);await getState(db,'tg:old',time,true);
 let s=await act(db,'tg:101','first-choice','select:owl',time);
 await act(db,'tg:101','daily-gift','daily',time);
 for(let n=0;n<4;n++)await act(db,'tg:101','play-'+n,'play:owl',time+n*2000);
 for(const q of ['play','xp'])await act(db,'tg:101','quest-'+q,`quest:${day(time)}:${q}`,time+10000);
 await act(db,'tg:101','second-friend','unlock:luna:30',time+10000);
 await act(db,'tg:101','second-friend','unlock:luna:30',time+10000);
 await act(db,'tg:101','first-choice','select:owl',time+10000);
 await act(db,'web:tester','browser-choice','select:deer',time);
 let report=await readPilotReport(db,14,'telegram',time+15000);
 assert.equal(report.visitors,3);assert.equal(report.newProfiles,2);assert.equal(report.existingProfiles,1);
 assert.deepEqual(report.milestones,{selected:1,played:1,gift:1,secondPet:1});assert.deepEqual(report.retention,{eligible:0,returned:0,percent:null});
 await getState(db,'tg:101',time+60000,true);await getState(db,'tg:old',time+60000,true);await getState(db,'tg:103',time+60000,true);
 report=await readPilotReport(db,14,'telegram',time+60000);
 assert.equal(report.visitors,4);assert.equal(report.newProfiles,3);assert.equal(report.existingProfiles,1);assert.deepEqual(report.retention,{eligible:2,returned:1,percent:50});
 assert.deepEqual(report.daily,[{day:'2026-11-16',active:3,newProfiles:2},{day:'2026-11-17',active:3,newProfiles:1}]);
 const browser=await readPilotReport(db,14,'browser',time+60000);assert.equal(browser.visitors,1);assert.equal(browser.newProfiles,1);assert.equal(browser.milestones.selected,1);assert.equal(browser.milestones.played,0);
 const current=(await getState(db,'tg:101',time+60000)).state;assert.equal(current.petId,'owl');assert.equal(Object.keys(current.journey.owned).length,2);assert.equal(current.journey.crystals,4);
 assert.ok(!JSON.stringify(report).includes('tg:'));assert.ok(!JSON.stringify(report).includes('web:'));
}));
test('visit capture tolerates reversed completion order and telemetry failures do not break progression',async t=>withDb(async db=>{
 await getState(db,'tg:race',time);
 await observePlayer(db,'tg:race',false,time+1);await observePlayer(db,'tg:race',true,time);
 const row=await db.prepare('SELECT * FROM pilot_profiles WHERE player_id=?').bind('tg:race').first();assert.equal(row.is_new,1);assert.equal(row.first_seen,time);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM pilot_visits WHERE player_id=?').bind('tg:race').first()).n,1);
 const logs=[];t.mock.method(console,'warn',message=>logs.push(message));
 const broken={prepare:db.prepare.bind(db),batch:async()=>{throw new Error('private-provider-payload-do-not-log');}};
 const state=await getState(broken,'tg:unaffected',time,true);assert.equal(state.state.coins,50);
 const saved=await act(db,'tg:unaffected','ordinary-play','play',time);assert.equal(saved.state.coins,53);
 assert.ok(logs.some(line=>line.includes('pilot_capture_failed')));assert.ok(logs.every(line=>!line.includes('private-provider')));
}));
test('pilot report denies public, foreign and Telegram callers before reading the database',async()=>withDb(async db=>{
 const env={DB:db,PILOT_METRICS_ENABLED:'1',PILOT_ADMIN_EMAIL:'owner@example.test'};
 const owner={'oai-authenticated-user-id':'owner-site-id','oai-authenticated-user-email':'OWNER@example.test'};
 const request=(headers={},query='')=>new Request('https://game.test/api/pilot'+query,{headers});
 for(const headers of [{},{'oai-authenticated-user-email':'owner@example.test'},{'oai-authenticated-user-id':'owner-site-id'},{...owner,'oai-authenticated-user-email':'other@example.test'},{...owner,'x-telegram-init-data':'signed-data'}]){
  const response=await handlePilot(request(headers),{...env,DB:{batch(){throw new Error('must not read');}}},time);assert.equal(response.status,403);
 }
 assert.equal((await handlePilot(request({},'?email=owner@example.test'),env,time)).status,403);
 assert.equal((await handlePilot(request(owner),{...env,PILOT_ADMIN_EMAIL:undefined},time)).status,403);
 assert.equal((await handlePilot(request(owner),{...env,PILOT_METRICS_ENABLED:'0'},time)).status,503);
 for(const query of ['?days=31','?days=1;DROP TABLE players','?channel=all'])assert.equal((await handlePilot(request(owner,query),env,time)).status,400);
 const response=await handlePilot(request(owner,'?days=7&channel=browser'),env,time);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const report=await response.json();assert.equal(report.visitors,0);assert.equal(report.observedSince,null);assert.equal(report.retention.percent,null);assert.ok(!JSON.stringify(report).includes('owner@example'));
}));
test('diagnostics require authentication, deduplicate, cap concurrent reports, prune old detail and redact server errors',async t=>withDb(async db=>{
 const env={DB:db,PILOT_METRICS_ENABLED:'1'};
 const headers={origin:'https://game.test','content-type':'application/json','oai-authenticated-user-id':'client'};
 const call=(body,extra={},target=env)=>handleDiagnostic(new Request('https://game.test/api/diagnostics',{method:'POST',headers:{...headers,...extra},body:typeof body==='string'?body:JSON.stringify(body)}),target,time);
 const valid={code:'network_timeout',eventId:crypto.randomUUID()};
 assert.equal((await call(valid,{'oai-authenticated-user-id':''})).status,401);
 assert.equal((await call(valid,{origin:'https://other.test'})).status,403);
 assert.equal((await call(valid,{'content-type':'text/plain'})).status,415);
 for(const body of [{...valid,initData:'never store this'},{...valid,code:'arbitrary-message'},{...valid,eventId:'bad'},[],null,'{'])assert.equal((await call(body)).status,400);
 assert.equal((await call(' '.repeat(513))).status,413);
 assert.equal((await call(valid)).status,204);assert.equal((await call(valid)).status,204);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM pilot_errors').first()).n,1);
 const reports=await Promise.all(Array.from({length:35},()=>call({...valid,eventId:crypto.randomUUID()})));assert.ok(reports.every(r=>r.status===204));assert.equal((await db.prepare('SELECT COUNT(*) n FROM pilot_errors WHERE player_id=?').bind('web:client').first()).n,20);
 const warnings=[];t.mock.method(console,'warn',line=>warnings.push(line));t.mock.method(console,'error',line=>warnings.push(line));
 const broken={prepare(sql){if(sql.startsWith('SELECT action FROM operations'))throw new Error('secret-initData-and-provider-message');return db.prepare(sql);},batch:db.batch.bind(db)};
 const game=await handleGame(new Request('https://game.test/api/game',{method:'POST',headers:{...headers,'oai-authenticated-user-id':'server-failure','idempotency-key':'server-operation-0001'},body:JSON.stringify({action:'offer',initData:'secret-initData-and-provider-message'})}),{...env,DB:broken},true);
 assert.equal(game.status,503);const failure=await game.json();assert.equal(failure.requestId,game.headers.get('x-request-id'));assert.equal(failure.error,'unavailable');assert.ok(warnings.some(line=>line.includes(failure.requestId)));assert.ok(warnings.every(line=>!line.includes('secret-initData')));
 const stored=await db.prepare('SELECT * FROM pilot_errors WHERE request_id=?').bind(failure.requestId).first();assert.equal(stored.source,'server');assert.equal(stored.code,'unavailable');assert.ok(!JSON.stringify(stored).includes('secret-initData'));
 assert.equal((await getState(db,'web:server-failure',time)).state.coins,50);
 await getState(db,'tg:old-detail',time-40*86400000,true);await recordDiagnostic(db,'tg:old-detail',crypto.randomUUID(),'network_error','client',time-40*86400000);
 await readPilotReport(db,30,'telegram',time);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM pilot_visits WHERE player_id=?').bind('tg:old-detail').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM pilot_errors WHERE player_id=?').bind('tg:old-detail').first()).n,0);assert.equal((await getState(db,'tg:old-detail',time)).state.coins,50);
}));
test('client diagnostics keep only bounded codes/IDs, retry offline events and produce redacted support text',async t=>{
 const {queueDiagnostic,flushDiagnostics,supportText}=require('../.sites-runtime/pilot-test-build/client-diagnostics.js');const events=[];let offline=true;
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'/api/diagnostics');const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body).sort(),['code','eventId']);assert.ok(!options.body.includes('private-auth'));events.push(body);if(offline)throw new TypeError('offline');return new Response(null,{status:204});});
 const eventId=crypto.randomUUID();queueDiagnostic('network_error',eventId);queueDiagnostic('network_error',eventId);await flushDiagnostics('private-auth');offline=false;await flushDiagnostics('private-auth');assert.equal(events.length,2);assert.equal(events[0].eventId,events[1].eventId);
 events.length=0;for(let i=0;i<15;i++)queueDiagnostic('art_load_failed',crypto.randomUUID());await flushDiagnostics('private-auth');assert.equal(events.length,10);
 const copy=supportText('network_error',eventId,true,false);assert.match(copy,/Канал: Telegram/);assert.match(copy,/SDK: не доступен/);assert.ok(!copy.includes('private-auth'));assert.ok(!copy.includes('initData'));
});
