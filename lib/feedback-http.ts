import {identify} from './game/auth';
import {getState} from './game/store';
import {day,GameError} from './game/rules';
import {metricsEnabled,type PilotEnv} from './pilot';
import {feedbackOptions,type FeedbackBody} from './pilot-scenario';
import {APP_RELEASE} from './release';
type Env=PilotEnv&{TELEGRAM_BOT_TOKEN?:string;TELEGRAM_BOT_ID?:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validChoice=(key:keyof typeof feedbackOptions,value:unknown)=>(feedbackOptions[key] as readonly (readonly [string,string])[]).some(option=>option[0]===value);
export async function handleFeedback(request:Request,env:Env,now=Date.now()){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new GameError('bad_origin','Недопустимый источник запроса',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new GameError('bad_body','Ожидается JSON',415);
  if(Number(request.headers.get('content-length'))>4096)throw new GameError('bad_body','Слишком большой отзыв',413);
  const identity=await identify(request,env);
  const text=await request.text();if(text.length>2048)throw new GameError('bad_body','Слишком большой отзыв',413);
  let body:FeedbackBody;try{body=JSON.parse(text);}catch{throw new GameError('bad_body','Неверный JSON',400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['eventId','clarity','liked','blocker','comment'].includes(k))||typeof body.eventId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.eventId)||typeof body.comment!=='string'||body.comment.length>600||!(['clarity','liked','blocker'] as const).every(key=>validChoice(key,body[key])))throw new GameError('invalid_feedback','Выбери ответы и оставь комментарий до 600 символов',400);
  if(!metricsEnabled(env)||!env.DB)throw new GameError('not_configured','Отзывы пилота пока недоступны',503);
  const snapshot=await getState(env.DB,identity.id,now,true);if(!snapshot.state.petId)throw new GameError('choose_first','Сначала познакомься с питомцем',409);
  const comment=body.comment.trim();
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO pilot_feedback (request_id,player_id,day,occurred_at,clarity,liked,blocker,comment)
   SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM pilot_feedback WHERE player_id=? AND day=?)<3`).bind(body.eventId,identity.id,day(now),now,body.clarity,body.liked,body.blocker,comment,identity.id,day(now)).run();
  const saved=await env.DB.prepare('SELECT player_id,clarity,liked,blocker,comment FROM pilot_feedback WHERE request_id=?').bind(body.eventId).first<{player_id:string;clarity:string;liked:string;blocker:string;comment:string}>();
  if(saved){
   if(saved.player_id!==identity.id||saved.clarity!==body.clarity||saved.liked!==body.liked||saved.blocker!==body.blocker||saved.comment!==comment)throw new GameError('key_conflict','Этот отзыв уже сохранён. Начни новый отзыв',409);
   return json({ok:true,replayed:result.meta.changes===0,release:APP_RELEASE,message:'Спасибо! Отзыв сохранён и доступен команде игры'});
  }
  throw new GameError('feedback_limit','На сегодня уже сохранены три отзыва. Можно написать снова завтра',429);
 }catch(e){if(e instanceof GameError)return json({error:e.code,message:e.message},e.status);console.error(JSON.stringify({kind:'pilot_feedback_failed',code:'unavailable'}));return json({error:'unavailable',message:'Отзыв пока не сохранён. Повтори отправку'},503);}
}
