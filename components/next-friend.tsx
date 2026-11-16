import {Check,Sparkles,ChevronRight} from 'lucide-react';
import {petStage,unlockStatus,type State} from '../lib/game/rules';
import type {PetId} from '../lib/game/pets';

export function NextFriend({state,onCollection}:{state:State;onCollection:()=>void}){
 const status=unlockStatus(state),crystals=state.journey?.crystals??0,owned=Object.entries(state.journey?.owned??{});
 const grown=owned.filter(([,p])=>p.level>=2).length,guardians=owned.filter(([id])=>petStage(state,id as PetId)>=2).length,needed=Math.max(0,status.count-2);
 const goals=[{title:'Кристаллы для приглашения',value:Math.min(crystals,status.cost),max:status.cost,note:crystals>=status.cost?'Нужная сумма собрана':`Осталось ${status.cost-crystals} · подарок, игры и задания дня`},
  {title:'Полученные друзья уровня 2',value:grown,max:status.count,note:grown===status.count?'Все готовы к новой встрече':'Посещай друзей в альбоме и играй с ними'},
  ...(needed?[{title:'Открытые формы хранителей',value:Math.min(guardians,needed),max:needed,note:guardians>=needed?'Магия хранителей открыта':'Уровень 3 и подтверждение эволюции за 30 кристаллов'}]:[])];
 return <section className="collection-journey panel"><p className="eyebrow"><Sparkles size={14}/> {status.count<3?'ПЕРВАЯ ГЛАВА':status.count<6?'ВТОРАЯ ГЛАВА':'ТРЕТЬЯ ГЛАВА'}</p><h2>{status.count}<small> / 12 хранителей</small></h2><p className="crystal-balance">✦ {crystals} кристаллов</p>{status.count===12?<p>Все 12 друзей дома! Развивай их формы и наслаждайся вашей дружбой.</p>:<><p className="next-friend-title">{status.available?'Всё готово к новой встрече!':`Следующий друг · ${status.cost} кристаллов`}</p><ul className="next-friend-goals">{goals.map(g=><li key={g.title}><div><strong>{g.title}</strong><span>{g.value===g.max&&<Check size={14}/>} {g.value}/{g.max}</span></div><progress aria-label={g.title} value={g.value} max={g.max}/><small>{g.note}</small></li>)}</ul></>}<button className="text-link" onClick={onCollection}>{status.available?'Выбрать следующего друга':'Открыть коллекцию'} <ChevronRight size={16}/></button></section>;
}
