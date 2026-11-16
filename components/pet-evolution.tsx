'use client';
import {useState} from 'react';
import {Sparkles,ArrowRight} from 'lucide-react';
import {evolutionStatus,petStage,type State} from '../lib/game/rules';
import type {PetId} from '../lib/game/pets';
import {petPortrait} from '../lib/pet-portraits';

export function PetEvolution({state,disabled,onEvolve}:{state:State;disabled:boolean;onEvolve:(id:PetId,stage:number,cost:number)=>void}){
 const [quote,setQuote]=useState<{stage:number;cost:number}|null>(null);
 const status=evolutionStatus(state),stage=petStage(state);
 if(!state.petId)return null;
 return <section className="evolution-card panel" aria-label="Эволюция питомца"><p className="eyebrow"><Sparkles size={14}/> МАГИЯ ПРЕВРАЩЕНИЯ</p><h2>{stage>=2?'Хранитель рядом с тобой':'Пора раскрыть новую магию'}</h2>{stage>=2?<p className="ability-note">Способность хранителя: +5 опыта за каждую игру. Кристаллы и награды дня общие для всех друзей.</p>:<><div className="evolution-preview"><div><span style={petPortrait(state.petId,stage)}/><small>{stage===0?'Малыш':'Подросший'}</small></div><ArrowRight aria-hidden="true"/><div><span style={petPortrait(state.petId,2)}/><small>Хранитель</small></div></div><p>Уровень 3 · 30 кристаллов · игры дают +5 опыта после превращения.</p><p className="muted">{status.reasons.join('. ')||'Всё готово — можно стать хранителем!'}</p><button className="evolution-confirm" disabled={disabled||!status.available} onClick={()=>{if(!quote){setQuote({stage:status.stage,cost:status.cost});return;}onEvolve(state.petId!,quote.stage,quote.cost);setQuote(null);}}>{quote?'Подтвердить · 30 кристаллов':'Стать хранителем · 30 ✦'}</button>{quote&&<button className="quiet-button" disabled={disabled} onClick={()=>setQuote(null)}>Пока подождать</button>}</> }</section>;
}
