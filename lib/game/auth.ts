import { GameError } from './rules';
const enc=new TextEncoder();
const bytes=(hex:string)=>Uint8Array.from(hex.match(/.{2}/g)??[],x=>parseInt(x,16));
async function hmac(key:Uint8Array,value:string){const k=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)));}
export async function telegramUser(raw:string,config:{TELEGRAM_BOT_TOKEN?:string;TELEGRAM_BOT_ID?:string},now=Date.now()){
 if(raw.length>12000)throw new GameError('invalid_auth','Некорректные данные входа',401);
 const p=new URLSearchParams(raw);
 if(new Set(p.keys()).size!==[...p.keys()].length)throw new GameError('invalid_auth','Повторяющиеся поля входа',401);
 const authDate=Number(p.get('auth_date'));
 if(!Number.isSafeInteger(authDate)||authDate<1||now/1000-authDate>3600||authDate-now/1000>30)throw new GameError('auth_expired','Вход устарел. Открой приложение заново из Telegram',401);
 let valid=false;
 if(config.TELEGRAM_BOT_TOKEN){
  const hash=p.get('hash')??'';
  const check=[...p.entries()].filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const expected=await hmac(await hmac(enc.encode('WebAppData'),config.TELEGRAM_BOT_TOKEN),check);
  if(/^[a-f0-9]{64}$/.test(hash)){const supplied=bytes(hash);let diff=0;for(let i=0;i<32;i++)diff|=supplied[i]^expected[i];valid=diff===0;}
 }else if(config.TELEGRAM_BOT_ID){
  const sig=p.get('signature')??'';
  const check=[...p.entries()].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  try{
   const key=await crypto.subtle.importKey('raw',bytes('e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d'),{name:'Ed25519'},false,['verify']);
   const decoded=Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(sig.length/4)*4,'=')),c=>c.charCodeAt(0));
   valid=await crypto.subtle.verify('Ed25519',key,decoded,enc.encode(`${config.TELEGRAM_BOT_ID}:WebAppData\n${check}`));
  }catch{valid=false;}
 }else throw new GameError('telegram_not_configured','Telegram-вход ещё не подключён к боту',503);
 if(!valid)throw new GameError('invalid_auth','Не удалось проверить подпись Telegram',401);
 let user;try{user=JSON.parse(p.get('user')??'null')}catch{}
 if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw new GameError('invalid_auth','Нет пользователя Telegram',401);
 return `tg:${user.id}`;
}
export async function identify(request:Request,config:{TELEGRAM_BOT_TOKEN?:string;TELEGRAM_BOT_ID?:string}){
 const raw=request.headers.get('x-telegram-init-data');
 if(raw)return {id:await telegramUser(raw,config),mode:'telegram'};
 // Sites dispatch validates and injects this header; never accept a browser-supplied ID.
 const owner=request.headers.get('oai-authenticated-user-id');
 if(owner)return {id:`web:${owner}`,mode:'browser'};
 throw new GameError('unauthorized','Войди через ChatGPT или открой приложение из Telegram',401);
}
