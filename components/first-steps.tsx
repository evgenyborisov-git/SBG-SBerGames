import {Heart,Gift,Volleyball,ChevronRight} from 'lucide-react';
import {careStats} from '../lib/game/abilities';
import {petStage,type State} from '../lib/game/rules';

export function FirstSteps({state,disabled,onPet,onPlay,onGift,onDismiss}:{state:State;disabled:boolean;onPet:()=>void;onPlay:()=>void;onGift:()=>void;onDismiss:(collection:boolean)=>void}){
 const intro=state.intro;if(!state.petId||!intro||intro.done)return null;
 const cost=careStats(state.petId,petStage(state)>=2).playEnergy;
 const steps=[{done:intro.petted,icon:Heart,title:'Погладь друга',note:'Коснись питомца — он ответит улыбкой.',label:'Погладить',action:onPet,blocked:false},
  {done:intro.played,icon:Volleyball,title:'Поиграйте вместе',note:`Игра принесёт опыт и потратит ${cost} энергии.`,label:'Поиграть',action:onPlay,blocked:state.energy<cost},
  {done:intro.gift,icon:Gift,title:'Забери первый подарок',note:'На острове тебя ждут 20 монет и 5 кристаллов.',label:'Получить подарок',action:onGift,blocked:false}];
 const count=steps.filter(s=>s.done).length,next=steps.find(s=>!s.done);
 return <section className="first-steps panel intro-compact" aria-labelledby="first-steps-title"><div className="intro-title"><h2 id="first-steps-title">{next?'Первые минуты вместе':'Вы уже подружились!'}</h2><span aria-label={`Выполнено ${count} из 3 шагов`}>{count}/3</span></div>{next?<><div className="intro-current"><next.icon size={24}/><div><strong>{next.title}</strong><p>{next.blocked?`Нужно ${cost} энергии — она восстановится со временем.`:next.note}</p></div></div><button className="evolution-confirm" disabled={disabled||next.blocked} onClick={next.action}>{next.label}</button><button className="quiet-button" disabled={disabled} onClick={()=>onDismiss(false)}>Продолжить самостоятельно</button></>:<><p>Следующих друзей ты будешь собирать по мере игры. Посмотрим, что нужно для новой встречи?</p><button className="evolution-confirm" disabled={disabled} onClick={()=>onDismiss(true)}>Посмотреть путь к следующему другу <ChevronRight size={17}/></button></>}</section>;
}
