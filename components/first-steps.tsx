import {Check,Heart,Gift,Volleyball,Sparkles,ChevronRight} from 'lucide-react';
import {careStats} from '../lib/game/abilities';
import {petStage,type State} from '../lib/game/rules';

export function FirstSteps({state,disabled,onPet,onPlay,onGift,onDismiss}:{state:State;disabled:boolean;onPet:()=>void;onPlay:()=>void;onGift:()=>void;onDismiss:(collection:boolean)=>void}){
 const intro=state.intro;
 if(!state.petId||!intro||intro.done)return null;
 const cost=careStats(state.petId,petStage(state)>=2).playEnergy;
 const steps=[{done:intro.petted,icon:Heart,title:'Погладь друга',note:'Он ответит улыбкой · без расхода ресурсов',action:onPet,blocked:false},
  {done:intro.played,icon:Volleyball,title:'Поиграйте вместе',note:`Обычная игра · ${cost} энергии`,action:onPlay,blocked:state.energy<cost},
  {done:intro.gift,icon:Gift,title:'Забери подарок острова',note:'+20 монет и +5 кристаллов · раз в день',action:onGift,blocked:false}];
 const count=steps.filter(s=>s.done).length;
 return <section className="first-steps panel" aria-labelledby="first-steps-title"><p className="eyebrow"><Sparkles size={14}/> ВАША ИСТОРИЯ НАЧИНАЕТСЯ</p><div className="intro-title"><h2 id="first-steps-title">{count===3?'Вы уже подружились!':'Первые минуты вместе'}</h2><span aria-label={`Выполнено ${count} из 3 шагов`}>{count}/3</span></div><p className="muted">{count===3?'Теперь выполняйте задания дня и копите кристаллы: следующего друга можно пригласить за 30.':'Три маленьких шага помогут освоиться. Их можно делать в любом порядке или пропустить знакомство.'}</p><ol className="intro-steps">{steps.map(({done,icon:Icon,title,note,action,blocked})=><li key={title}><button onClick={action} disabled={disabled||done||blocked} className={done?'is-done':''}><span className="intro-icon">{done?<Check size={22}/>:<Icon size={22}/>}</span><span><strong>{title}</strong><small>{done?'Готово — прогресс сохранён':blocked?`Нужно ${cost} энергии — она восстановится со временем`:note}</small></span>{!done&&<ChevronRight size={18}/>}</button></li>)}</ol><div className="intro-actions">{count===3?<button className="evolution-confirm" disabled={disabled} onClick={()=>onDismiss(true)}>Посмотреть путь к следующему другу <ChevronRight size={17}/></button>:<button className="quiet-button" disabled={disabled} onClick={()=>onDismiss(false)}>Продолжить самостоятельно</button>}<p className="muted">Подсказки можно закрыть — остров, подарки и коллекция всегда рядом.</p></div></section>;
}
