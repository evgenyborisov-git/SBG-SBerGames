import {Check,Sparkles} from 'lucide-react';
import {collectionMilestones,type State} from '../lib/game/rules';

export function CollectionProgress({state}:{state:State}){
 const progress=collectionMilestones(state);
 return <section className={'collection-milestones panel'+(progress.complete?' is-complete':'')} aria-label="Рубежи коллекции"><p className="eyebrow"><Sparkles size={14}/> ТВОИ ХРАНИТЕЛИ ОСТРОВА</p><h2>{progress.complete?'Все 12 друзей дома!':`Следующая встреча ближе · ${progress.count}/12`}</h2><p>{progress.complete?'Коллекция видов собрана. Продолжай заботиться о друзьях и открывать формы хранителей.':`Ближайшая цель — ${progress.target}/12. Просмотр обликов и эволюция не увеличивают число собранных видов.`}</p><progress aria-label="Полученные виды хранителей" value={progress.count} max={12}/><div className="milestone-steps">{progress.steps.map(step=><div key={step.value} className={step.reached?'reached':''}><strong>{step.reached&&<Check size={16}/>} {step.value}/12</strong><small>{step.reached?'Рубеж достигнут':step.value===progress.target?'Следующая цель':'Впереди'}</small></div>)}</div><small className="muted">Игровые достижения. Реальные розыгрыши пока не запущены.</small></section>;
}
