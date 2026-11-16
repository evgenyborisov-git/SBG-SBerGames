import {identify} from './game/auth';
import {getState} from './game/store';
import {GameError} from './game/rules';
import {clientErrorCodes,isPilotAdmin,metricsEnabled,readPilotReport,recordDiagnostic,type PilotEnv,type ClientErrorCode} from './pilot';

type Env=PilotEnv&{TELEGRAM_BOT_TOKEN?:string;TELEGRAM_BOT_ID?:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handlePilot(request:Request,env:Env,now=Date.now()){
 if(!isPilotAdmin(request,env))return json({error:'forbidden',message:'Сводка доступна только владельцу после входа через ChatGPT'},403);
 if(!metricsEnabled(env)||!env.DB)return json({error:'not_configured',message:'Статистика пилота пока не включена'},503);
 const query=new URL(request.url).searchParams,days=Number(query.get('days')??14),channel=query.get('channel')??'telegram';
 if(![7,14,30].includes(days)||!['telegram','browser'].includes(channel))return json({error:'invalid_filter',message:'Выбери период 7, 14 или 30 дней и канал'},400);
 try{return json(await readPilotReport(env.DB,days as 7|14|30,channel as 'telegram'|'browser',now));}
 catch{const requestId=crypto.randomUUID();console.error(JSON.stringify({kind:'pilot_report_failed',code:'unavailable',requestId}));return json({error:'unavailable',message:'Не удалось загрузить сводку. Попробуй ещё раз',requestId},503);}
}
export async function handleDiagnostic(request:Request,env:Env,now=Date.now()){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new GameError('bad_origin','Недопустимый источник запроса',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new GameError('bad_body','Ожидается JSON',415);
  if(Number(request.headers.get('content-length'))>512)throw new GameError('bad_body','Слишком большой запрос',413);
  const identity=await identify(request,env);
  const text=await request.text();if(text.length>512)throw new GameError('bad_body','Слишком большой запрос',413);
  let body;try{body=JSON.parse(text);}catch{throw new GameError('bad_body','Неверный JSON',400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['code','eventId'].includes(k))||!clientErrorCodes.includes(body.code)||typeof body.eventId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.eventId))throw new GameError('invalid_diagnostic','Неверная диагностика',400);
  if(!metricsEnabled(env)||!env.DB)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  await getState(env.DB,identity.id,now,true);
  await recordDiagnostic(env.DB,identity.id,body.eventId,body.code as ClientErrorCode,'client',now);
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof GameError)return json({error:e.code,message:e.message},e.status);return json({error:'unavailable'},503);}
}
