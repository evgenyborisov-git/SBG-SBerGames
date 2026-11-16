'use client';
import {Check,ChevronRight} from 'lucide-react';
import {CollectionProgress} from './collection-progress';
import {PetEvolution} from './pet-evolution';
import {PetGallery} from './pet-gallery';
import {NextFriend} from './next-friend';
import {galleryPets} from '../lib/gallery';
import {petPortrait,petThumbnail} from '../lib/pet-portraits';
import {petStage,type State} from '../lib/game/rules';
import type {PetId} from '../lib/game/pets';

export type CollectionView='friends'|'atlas'|'growth';
export function CollectionScreen({state,view,onView,disabled,onVisit,onHome,onUnlock,onEvolve}:{state:State;view:CollectionView;onView:(view:CollectionView)=>void;disabled:boolean;onVisit:(id:PetId)=>void;onHome:()=>void;onUnlock:(id:PetId,cost:number)=>void;onEvolve:(id:PetId,stage:number,cost:number)=>void}){
 const current=galleryPets.find(p=>p.id===state.petId)??galleryPets[0],stage=petStage(state),owned=galleryPets.filter(p=>state.journey?.owned[p.id]);
 return <section className="collection-screen"><div className="section-tabs" role="group" aria-label="Питомцы">{[{id:'friends',label:'Мои друзья'},{id:'atlas',label:'Атлас'},{id:'growth',label:'Развитие'}].map(item=><button key={item.id} aria-pressed={view===item.id} onClick={()=>onView(item.id as CollectionView)}>{item.label}</button>)}</div>
 {view==='friends'&&<div className="collection-overview"><section className="panel owned-friends"><p className="eyebrow">ВАША КОЛЛЕКЦИЯ · {owned.length}/12</p><h2>К кому заглянем?</h2><div className="owned-grid">{owned.map(p=><button key={p.id} disabled={disabled} onClick={()=>p.id===state.petId?onHome():onVisit(p.id)}><span className="owned-portrait" style={petThumbnail(p.id)}/><span><strong>{p.name}</strong><small>{p.id===state.petId?'Сейчас на острове':`Уровень ${state.journey!.owned[p.id]!.level}`}</small></span><ChevronRight size={17}/></button>)}</div></section><NextFriend state={state} onCollection={()=>onView('atlas')}/><details className="panel secondary-details"><summary>Рубежи коллекции · 3, 6 и 12 друзей</summary><CollectionProgress state={state}/></details></div>}
 {view==='atlas'&&<PetGallery state={state} disabled={disabled} onUnlock={onUnlock} onVisit={onVisit} currentPetId={state.petId??'chudik'} onVisitPet={onHome}/>}
 {view==='growth'&&<div className="content-column"><p className="muted growth-intro">Развивается {current.name}. Чтобы заботиться о другом питомце, сначала посети его во вкладке «Мои друзья».</p><PetEvolution key={`${state.petId}-${stage}`} state={state} disabled={disabled} onEvolve={onEvolve}/><details className="panel secondary-details"><summary>Три облика · {current.name}</summary><div className="album-grid">{['Малыш','Подросший','Хранитель'].map((name,i)=><article className={'album-card '+(stage>=i?'':'locked')} key={name}><div className="album-art" style={petPortrait(current.id,i)}/><div><small>ЭТАП 0{i+1}</small><h3>{name}</h3><p>{stage>=i?<><Check size={12}/> Уже открыт</>:i===2?'Уровень 3 и эволюция за 30 кристаллов':`Откроется на уровне ${i+1}`}</p></div></article>)}</div></details></div>}
 </section>;
}
