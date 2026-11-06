import { env } from 'cloudflare:workers';
import { identify } from '../../../lib/game/auth';
import { act, getState } from '../../../lib/game/store';
import { GameError, messages, type Action } from '../../../lib/game/rules';
export const dynamic='force-dynamic';
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
async function handle(request:Request,write=false){
 try{
  if(write){
   const origin=request.headers.get('origin');
   if(origin!==new URL(request.url).origin)throw new GameError('bad_origin','Недопустимый источник запроса',403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new GameError('bad_body','Ожидается JSON',415);
   if(Number(request.headers.get('content-length'))>2048)throw new GameError('bad_body','Слишком большой запрос',413);
  }
  const identity=await identify(request,env);
  if(!env.DB)throw new Error('database_unavailable');
  if(!write)return json({...await getState(env.DB,identity.id),mode:identity.mode,serverTime:Date.now()});
  const text=await request.text();if(text.length>2048)throw new GameError('bad_body','Слишком большой запрос',413);
  let body;try{body=JSON.parse(text)}catch{throw new GameError('bad_body','Неверный JSON',400)}
  if(!body||typeof body!=='object'||!['feed','play','daily','offer'].includes(body.action))throw new GameError('invalid_action','Неизвестное действие',400);
  const key=request.headers.get('idempotency-key')??'';
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw new GameError('invalid_key','Нужен уникальный ключ запроса',400);
  const result=await act(env.DB,identity.id,key,body.action as Action);
  return json({...result,mode:identity.mode,serverTime:Date.now(),message:result.replayed?'Запрос уже сохранён; баланс обновлён':messages[body.action as Action]});
 }catch(e){
  if(e instanceof GameError)return json({error:e.code,message:e.message},e.status);
  console.error('game_request_failed',e instanceof Error?e.message:'unknown');
  return json({error:'unavailable',message:'Сервер временно недоступен. Повтори запрос'},503);
 }
}
export const GET=(r:Request)=>handle(r);
export const POST=(r:Request)=>handle(r,true);
