import type {ClientErrorCode} from './pilot';
import {APP_RELEASE} from './release';
type Event={code:ClientErrorCode;eventId:string};
const queue:Event[]=[];let sending=false;
/** Memory-only queue. Tokens, messages, names, URLs and profile state never enter it. */
export function queueDiagnostic(code:ClientErrorCode,eventId:string){
 if(!queue.some(event=>event.eventId===eventId)){if(queue.length===10)queue.shift();queue.push({code,eventId});}
}
export async function flushDiagnostics(initData:string){
 if(sending||!queue.length)return;sending=true;
 try{
  while(queue.length){
   const event=queue[0];
   const response=await fetch('/api/diagnostics',{method:'POST',headers:{'Content-Type':'application/json',...(initData?{'x-telegram-init-data':initData}:{})},body:JSON.stringify(event),signal:AbortSignal.timeout(2500)});
   if(response.status>=500||response.status===401)break;
   const index=queue.findIndex(item=>item.eventId===event.eventId);if(index>=0)queue.splice(index,1);
  }
 }catch{}finally{sending=false;}
}
export function supportText(code:string,requestId:string,telegram:boolean,sdkReady:boolean){
 return `Чудозвери · ${APP_RELEASE}\nКод: ${code}\nЗапрос: ${requestId}\nКанал: ${telegram?'Telegram':'браузер'}\nSDK: ${sdkReady?'доступен':'не доступен'}`;
}
