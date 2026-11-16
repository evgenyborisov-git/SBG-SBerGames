'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ChevronRight, Sparkles, X, Heart, Carrot, Volleyball, Moon} from 'lucide-react';
import {petPortrait, petThumbnail} from '../lib/pet-portraits';
import {unlockStatus,type State} from '../lib/game/rules';
import type {PetId} from '../lib/game/pets';
import {galleryBiomes, galleryPets} from '../lib/gallery';
import {PetVisual, usePetReaction, type Reaction} from './pet-reactions';

const forms = ['baby', 'grown', 'guardian'] as const;
const formLabels = ['Малыш', 'Подросший', 'Хранитель'];
const portrait = (index: number, stage: number) => petPortrait(galleryPets[index].id, stage);
type GalleryActions = {state?:State;disabled:boolean;onUnlock:(id:PetId,cost:number)=>void;onVisit:(id:PetId)=>void;currentPetId: PetId; onVisitPet: () => void;};

function PetDetails({initialIndex, onClose, currentPetId, onVisitPet, state,disabled,onUnlock,onVisit}: GalleryActions & {
  initialIndex: number; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [stage, setStage] = useState(0);
  const [confirmUnlock,setConfirmUnlock]=useState<number|null>(null);
  const pet = galleryPets[index];
  const owned=state?.journey?.owned[pet.id];
  const status=state?unlockStatus(state):null;
  const emotion = usePetReaction(pet.id, stage);
  const actions = [
    {reaction: 4 as Reaction, label: 'Погладить', icon: Heart},
    {reaction: 1 as Reaction, label: 'Угостить', icon: Carrot},
    {reaction: 2 as Reaction, label: 'Поиграть', icon: Volleyball},
    {reaction: 3 as Reaction, label: 'Отдых', icon: Moon},
  ];
  const mood = ['Коснись питомца — он почувствует твою заботу.', 'Хрум-хрум! Вот это угощение!', 'Лови! Давай ещё раз!', 'Тс-с… пусть приснится что-нибудь чудесное.', 'М-м-м… как же хорошо рядом с тобой!', 'Ура! Маленькое чудо случилось!'][emotion.reaction];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const element = dialog.current!;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({preventScroll: true});
    };
  }, []);
  function browse(step: number) {
    emotion.reset();setConfirmUnlock(null);
    setIndex(current => (current + step + galleryPets.length) % galleryPets.length);
    setStage(0);
    dialog.current?.scrollTo({top: 0});
  }
  return <dialog ref={dialog} className="guardian-dialog" aria-labelledby="guardian-title"
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="guardian-detail">
      <div className="guardian-art">
        <button className="guardian-touch" onClick={() => emotion.trigger(4)} aria-label={`Погладить: ${pet.forms[forms[stage]]}`}>
          <PetVisual petId={pet.id} stage={stage} reaction={emotion.reaction} sequence={emotion.sequence} idleStyle={portrait(index, stage)}/>
        </button>
        <span className="guardian-location">{pet.biome}</span>
        <button className="guardian-close" onClick={onClose} aria-label="Закрыть и вернуться к питомцам" autoFocus><X size={20}/></button>
        <span className="guardian-art-caption">{pet.forms[forms[stage]]}</span>
      </div>
      <div className="guardian-copy">
        <div className="guardian-forms" role="group" aria-label="Посмотреть облик">
          {forms.map((form, i) => <button key={form} aria-pressed={stage === i} onClick={() => {emotion.reset(); setStage(i);}}>{formLabels[i]}</button>)}
        </div>
        <div className="guardian-reactions" role="group" aria-label="Попробовать реакции питомца">
          {actions.map(({reaction, label, icon: Icon}) => <button key={reaction} aria-pressed={emotion.reaction === reaction} onClick={() => emotion.trigger(reaction)}><Icon size={19}/><span>{label}</span></button>)}
        </div>
        <p className="guardian-mood" role="status">{emotion.loading ? 'Готовим маленькое чудо…' : emotion.failed ? 'Не удалось загрузить реакцию. Нажми ещё раз.' : mood}</p>
        <div className="guardian-title-row"><div><p className="eyebrow">{pet.species}</p><h2 id="guardian-title">{pet.name}</h2></div><Sparkles size={26} aria-hidden="true"/></div>
        <p className="guardian-personality">{pet.personality}</p>
        <p className="guardian-note">Здесь можно посмотреть облики и попробовать реакции без расхода ресурсов. Первый друг выбран однажды. Новых хранителей приглашают за заработанные кристаллы; развитие каждого сохраняется отдельно.</p>
        <div className="guardian-unlock"><p>{owned?`Уже на острове · уровень ${owned.level}`:status?.count===12?'Коллекция уже собрана':`Приглашение: ${status?.cost??30} кристаллов`}</p>{!owned&&<p className="muted">{status?.reasons.join('. ')||'Все условия выполнены — можно пригласить!'}</p>}<button className="guardian-visit" disabled={disabled||!state||(!owned&&!status?.available)} onClick={()=>{if(!owned&&confirmUnlock===null){setConfirmUnlock(status!.cost);return;}onClose();if(currentPetId===pet.id)onVisitPet();else if(owned)onVisit(pet.id);else onUnlock(pet.id,confirmUnlock!);}}>{currentPetId===pet.id?'На остров к другу':owned?'Посетить друга':confirmUnlock!==null?`Подтвердить · ${confirmUnlock} кристаллов`:'Пригласить в коллекцию'} <ChevronRight size={17}/></button></div>
        <div className="guardian-browse"><button onClick={() => browse(-1)} aria-label="Предыдущий питомец"><ArrowLeft size={18}/><span>Назад</span></button><span aria-live="polite">{index + 1} / {galleryPets.length}</span><button onClick={() => browse(1)} aria-label="Следующий питомец"><span>Дальше</span><ArrowRight size={18}/></button></div>
      </div>
    </div>
  </dialog>;
}

export function PetGallery(actions: GalleryActions) {
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  return <section className="guardian-gallery" aria-labelledby="gallery-title">
    <div className="section-heading"><p className="eyebrow">АТЛАС ЧУДОЗВЕРЕЙ · 12 ДРУЗЕЙ · 36 ОБЛИКОВ</p><h2 id="gallery-title">Большой мир маленьких чудес</h2><p className="muted">От лесной поляны до небесных островов. Познакомься с друзьями и посмотри, какими хранителями они станут.</p></div>
    <div className="biome-filters" role="group" aria-label="Локации питомцев">{galleryBiomes.map((name, i) => <button key={name} aria-pressed={chapter === i} onClick={() => setChapter(i)}>{name}<span>{i === 0 ? 12 : 3}</span></button>)}</div>
    <p className="gallery-note">Все 12 хранителей доступны для знакомства. Первого друга выбирают один раз. Здесь можно пригласить следующих: 30 кристаллов за второго друга, затем каждое приглашение дороже на 30, до 330 за двенадцатого. Все полученные друзья должны достичь уровня 2. Для четвёртого друга нужна 1 форма хранителя, для седьмого — 4, для двенадцатого — 9. Точное условие следующего приглашения — в карточке.</p>
    <div className="creature-grid">{galleryPets.map((pet, index) => (chapter === 0 || pet.chapter === chapter) && <button className="creature-card guardian-card" key={pet.id} onClick={() => setSelected(index)} aria-label={`${pet.name}, ${pet.species} — посмотреть три облика`}>
      <span className="creature-portrait guardian-portrait" style={petThumbnail(pet.id)}><span className="guardian-card-number">{String(index + 1).padStart(2, '0')}</span><span className="guardian-card-badge">3 облика <Sparkles size={11}/></span></span>
      <span className="creature-caption"><small>{pet.biome}</small><strong>{pet.name}</strong><span className="guardian-species">{pet.species}</span><span className="guardian-card-link">{actions.state?.journey?.owned[pet.id]?"Уже в коллекции · посмотреть":"Условия открытия"} <ChevronRight size={13}/></span></span>
    </button>)}</div>
    {selected !== null && <PetDetails initialIndex={selected} onClose={() => setSelected(null)} {...actions}/>}
  </section>;
}
