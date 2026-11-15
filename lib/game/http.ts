import { identify } from './auth';
import { act, getState } from './store';
import { GameError, messages, type Action, type EconomyAction } from './rules';
import {isPetId} from './pets';
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export async function handleGame(request:Request,env:{DB?:D1Database;TELEGRAM_BOT_TOKEN?:string;TELEGRAM_BOT_ID?:string},write=false){
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
  if(!body||typeof body!=='object'||!['feed','play','daily','offer','select_pet','unlock_pet','visit_pet','claim_quest'].includes(body.action))throw new GameError('invalid_action','Неизвестное действие',400);
  if(['select_pet','unlock_pet','visit_pet'].includes(body.action)&&!isPetId(body.petId))throw new GameError('invalid_pet','Выбери питомца из атласа',400);
  if(['feed','play'].includes(body.action)&&body.petId!==undefined&&!isPetId(body.petId))throw new GameError('invalid_pet','Неизвестный питомец',400);
  if(body.action==='claim_quest'&&(!['play','care','xp'].includes(body.questId)||typeof body.questDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.questDay)))throw new GameError('invalid_quest','Неизвестное задание',400);
  const key=request.headers.get('idempotency-key')??'';
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw new GameError('invalid_key','Нужен уникальный ключ запроса',400);
  // Include the selected pet in the receipt identity: a retry key cannot be
  // reused to select a different pet, and an old retry never reverts a new choice.
  const action:Action=body.action==='select_pet'?`select:${body.petId}`:body.action==='unlock_pet'?`unlock:${body.petId}`:body.action==='visit_pet'?`visit:${body.petId}`:body.action==='claim_quest'?`quest:${body.questDay}:${body.questId}`:['feed','play'].includes(body.action)&&body.petId?`${body.action}:${body.petId}` as Action:body.action;
  const result=await act(env.DB,identity.id,key,action);
  return json({...result,mode:identity.mode,serverTime:Date.now(),message:result.replayed?'Запрос уже сохранён; профиль обновлён':body.action==='select_pet'?'Друг уже ждёт тебя на острове':messages[body.action as EconomyAction]??(body.action==='unlock_pet'?'Новый друг в коллекции! Открой его остров в альбоме':body.action==='visit_pet'?'Друг ждёт тебя на острове':'Кристаллы за задание получены!')});
 }catch(e){
  if(e instanceof GameError)return json({error:e.code,message:e.message},e.status);
  console.error('game_request_failed',e instanceof Error?e.message:'unknown');
  return json({error:'unavailable',message:'Сервер временно недоступен. Повтори запрос'},503);
 }
}
