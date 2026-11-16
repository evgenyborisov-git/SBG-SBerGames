'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Play,RotateCcw} from 'lucide-react';
import {ROUND_MS,ROUND_TARGETS,ROUND_TTL_MS,fireflyTarget,validateFireflyHits,type FireflyRound,type FireflyHit} from '../lib/game/fireflies';
import {petStage,type State} from '../lib/game/rules';
import {galleryPets} from '../lib/gallery';
import {petThumbnail} from '../lib/pet-portraits';

export function FireflyGame({state,serverTime,disabled,onStart,onFinish}:{state:State;serverTime:number;disabled:boolean;onStart:()=>void;onFinish:(roundId:string,hits:FireflyHit[])=>void}){
 const [practice,setPractice]=useState<FireflyRound|null>(null),[practiceDone,setPracticeDone]=useState(false);
 const round=practice??state.fireflies?.round;
 const [elapsed,setElapsed]=useState(0),[hits,setHits]=useState<FireflyHit[]>([]);
 const hitsRef=useRef<FireflyHit[]>([]),clock=useRef({base:0,at:0,id:''});
 const getElapsed=()=>Math.max(0,Math.floor(clock.current.base+performance.now()-clock.current.at));
 useEffect(()=>{if(practice&&clock.current.id===round?.id)return;clock.current={id:round?.id??'',base:practice?0:Math.max(0,serverTime-(round?.startedAt??serverTime)),at:performance.now()};setElapsed(getElapsed());},[round?.id,serverTime,practice]);
 useEffect(()=>{let saved:FireflyHit[]=[];try{const entry=JSON.parse(sessionStorage.getItem('chudo-firefly-hits')??'null');if(round&&!practice&&entry?.roundId===round.id&&Array.isArray(entry.hits)&&validateFireflyHits(round,entry.hits))saved=entry.hits;}catch{}hitsRef.current=saved;setHits(saved);setPracticeDone(false);},[round?.id]);
 useEffect(()=>{if(round?.settled){try{const entry=JSON.parse(sessionStorage.getItem('chudo-firefly-hits')??'null');if(entry?.roundId===round.id)sessionStorage.removeItem('chudo-firefly-hits');}catch{}}},[round?.id,round?.settled]);
 useEffect(()=>{if(!round||round.settled||practiceDone)return;const tick=()=>setElapsed(getElapsed());const timer=setInterval(tick,80);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[round?.id,round?.settled,practiceDone]);
 const expired=elapsed>ROUND_TTL_MS,finished=elapsed>=ROUND_MS;
 const running=!!round&&!round.settled&&!practiceDone&&!finished;
 const active=running?Array.from({length:ROUND_TARGETS},(_,i)=>fireflyTarget(round!,i)).find(t=>elapsed>=t.start&&elapsed<=t.end&&!hits.some(h=>h.target===t.index)):undefined;
 const next=round?.guardian&&round.petId==='owl'&&running?Array.from({length:ROUND_TARGETS},(_,i)=>fireflyTarget(round,i)).find(t=>t.start>elapsed):undefined;
 const attempts=state.fireflies?.attempts??0,cost=state.petId==='luna'&&petStage(state)>=2?7:10;
 const pet=galleryPets.find(p=>p.id===(round?.petId??state.petId))??galleryPets[0];
 function catchLight(cell:number){
  if(!round||disabled||!running)return;const at=getElapsed();const target=Array.from({length:ROUND_TARGETS},(_,i)=>fireflyTarget(round,i)).find(t=>at>=t.start&&at<=t.end&&t.cell===cell&&!hitsRef.current.some(h=>h.target===t.index));
  if(target){hitsRef.current=[...hitsRef.current,{target:target.index,at}];setHits(hitsRef.current);if(!practice){try{sessionStorage.setItem('chudo-firefly-hits',JSON.stringify({roundId:round.id,hits:hitsRef.current}));}catch{}}}
 }
 function train(){if(!state.petId)return;setPractice({id:crypto.randomUUID(),seed:crypto.getRandomValues(new Uint32Array(1))[0],petId:state.petId,guardian:petStage(state)>=2,startedAt:Date.now(),day:'practice',settled:false});}
 const showResult=round?.settled||practiceDone;
 return <section className="firefly-game panel" aria-labelledby="firefly-title"><div className="firefly-heading"><div><p className="eyebrow"><Sparkles size={14}/> ИГРАЙ ВМЕСТЕ</p><h2 id="firefly-title">Поляна светлячков</h2></div><span className="firefly-companion" style={petThumbnail(pet.id)}/></div><p className="muted">Коснись огонька, пока он светится. Поймай до 12 светлячков за 18 секунд.</p>
 {round&&!round.settled&&!practiceDone&&<><div className="firefly-score"><strong>{hits.length} / 12 поймано</strong><span>{Math.ceil(Math.max(0,ROUND_MS-elapsed)/1000)} сек.</span></div><div className="firefly-board" role="group" tabIndex={0} aria-label="Поляна, девять клеток. Нажимай цифры от 1 до 9" onKeyDown={event=>{if(/^[1-9]$/.test(event.key)){event.preventDefault();catchLight(Number(event.key)-1);}}}>{Array.from({length:9},(_,cell)=><button key={cell} type="button" className={(active?.cell===cell?'lit ':'')+(next?.cell===cell?'hint':'')} disabled={disabled||!running||active?.cell!==cell} aria-label={`Клетка ${cell+1}${active?.cell===cell?', поймать светлячка':''}`} onClick={()=>catchLight(cell)}><small className="firefly-cell-number">{cell+1}</small>{active?.cell===cell?<Sparkles size={34}/>:<span aria-hidden="true">✧</span>}</button>)}</div><p className="firefly-caption">{practice?'Тренировка — без наград и расхода энергии.':`Играешь с ${pet.name}. Раунд продолжает идти при сворачивании.`}</p>{finished&&!expired&&!disabled&&<button className="evolution-confirm" onClick={()=>practice?setPracticeDone(true):onFinish(round.id,hitsRef.current)}>{practice?'Посмотреть результат':'Сохранить результат и забрать награду'}</button>}{expired&&!practice&&<p role="status">Время сохранения истекло. Можно начать новую попытку.</p>}</>}
 {showResult&&<div className="firefly-result" role="status"><Sparkles size={24}/><strong>{practice?'Тренировка завершена':`${pet.name} радуется вашей игре!`}</strong><p>Поймано {practice?hits.length:round?.score??0} из 12.</p>{!practice&&round?.reward&&<p>+{round.reward.xp} опыта · +{round.reward.coins} монет · +{round.reward.crystals} кристаллов</p>}</div>}
 {(!round||showResult||expired)&&<div className="firefly-actions"><button className="evolution-confirm" disabled={disabled||!state.petId||attempts>=3||state.energy<cost} onClick={()=>{setPractice(null);onStart();}}><Play size={16}/> Наградная игра · {cost} энергии</button><button className="quiet-button" disabled={disabled||!state.petId} onClick={train}><RotateCcw size={15}/> Тренировка без награды</button></div>}
 <p className="muted">Наградные попытки сегодня: {attempts}/3.</p><details className="game-reward-rules"><summary>Награды и управление</summary><p>Попытка учитывается при старте. За 1/6/10 огоньков — 1/2/3 бонусных кристалла. Успешный раунд считается одной игрой для заданий; сохранение доступно 5 минут. Новый день — в 00:00 по Москве.</p><p>Касайся огонька или поставь фокус на поле и нажимай цифры 1–9.</p></details></section>;
}
