'use client';
import {useRef,useState} from 'react';
import {feedbackOptions,type FeedbackBody} from '../lib/pilot-scenario';

export function PilotFeedback({getAuth}:{getAuth:()=>string}){
 const [clarity,setClarity]=useState(''),[liked,setLiked]=useState(''),[blocker,setBlocker]=useState(''),[comment,setComment]=useState('');
 const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[message,setMessage]=useState('');
 const pending=useRef<FeedbackBody|null>(null),lock=useRef(false);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(lock.current||sent)return;lock.current=true;setBusy(true);setMessage('');
  pending.current??={eventId:crypto.randomUUID(),clarity,liked,blocker,comment};
  try{
   const auth=getAuth(),response=await fetch('/api/pilot-feedback',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{'x-telegram-init-data':auth}:{})},body:JSON.stringify(pending.current),signal:AbortSignal.timeout(15000)});
   const body=await response.json() as {message?:string};
   if(!response.ok){if(response.status<500)pending.current=null;throw new Error(body.message||'Не удалось сохранить отзыв');}
   pending.current=null;setSent(true);setMessage(body.message||'Спасибо! Отзыв сохранён');
  }catch(e){setMessage(e instanceof Error&&e.name!=='TimeoutError'&&e.name!=='TypeError'?e.message:'Нет соединения. Нажми «Повторить отправку» — отзыв не задвоится');}
  finally{lock.current=false;setBusy(false);}
 }
 const frozen=busy||!!pending.current;
 const fields=[{name:'clarity',title:'Было понятно, что делать?',value:clarity,set:setClarity},{name:'liked',title:'Что понравилось больше всего?',value:liked,set:setLiked},{name:'blocker',title:'Что мешало играть?',value:blocker,set:setBlocker}] as const;
 return <section className="panel feedback-panel" aria-labelledby="feedback-title"><p className="eyebrow">ПОМОГИ ОСТРОВУ СТАТЬ ЛУЧШЕ</p><h2 id="feedback-title">Как тебе игра?</h2>{sent?<><p role="status">{message}</p><button className="quiet-button" onClick={()=>{setSent(false);setMessage('');setClarity('');setLiked('');setBlocker('');setComment('');}}>Оставить ещё один отзыв</button></>:<form onSubmit={submit}><p className="muted">Три коротких ответа. Отзыв увидит команда игры в сводке пилота.</p>{fields.map(field=><fieldset disabled={frozen} key={field.name}><legend>{field.title}</legend><div className="feedback-choices">{feedbackOptions[field.name].map(([value,label])=><label key={value}><input type="radio" required name={'feedback-'+field.name} value={value} checked={field.value===value} onChange={()=>field.set(value)}/><span>{label}</span></label>)}</div></fieldset>)}<label className="feedback-comment">Хочешь добавить подробности? <span>Необязательно · до 600 символов</span><textarea value={comment} disabled={frozen} maxLength={600} rows={4} onChange={event=>setComment(event.target.value)}/></label><p className="feedback-status" role="status">{message}</p><button className="evolution-confirm" disabled={busy||(!pending.current&&(!clarity||!liked||!blocker))} type="submit">{busy?'Сохраняем отзыв…':pending.current?'Повторить отправку':'Отправить отзыв'}</button></form>}</section>;
}
