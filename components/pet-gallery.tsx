'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ChevronRight, Sparkles, X, Heart, Carrot, Volleyball, Moon} from 'lucide-react';
import {artBackground} from '../lib/art-resolution';
import {galleryBiomes, galleryPets} from '../lib/gallery';
import {PetVisual, usePetReaction, type Reaction} from './pet-reactions';

const forms = ['baby', 'grown', 'guardian'] as const;
const formLabels = ['Малыш', 'Подросший', 'Хранитель'];
function portrait(index: number, stage: number) {
  return {
    backgroundImage: artBackground(`/art/guardians-chapter-${galleryPets[index].chapter}.webp`),
    backgroundSize: '300% 300%',
    backgroundPosition: `${stage * 50}% ${index % 3 * 50}%`,
  };
}

function PetDetails({initialIndex, onClose, onVisitChudik}: {
  initialIndex: number; onClose: () => void; onVisitChudik: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [stage, setStage] = useState(0);
  const pet = galleryPets[index];
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
    emotion.reset();
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
        <p className="guardian-note">Здесь можно попробовать реакции без расхода ресурсов. {index === 0 ? 'Расти вместе с Чудиком на острове.' : 'Выращивание этого друга появится позже.'}</p>
        {index === 0 && <button className="guardian-visit" onClick={() => {onClose(); onVisitChudik();}}>На остров к Чудику <ChevronRight size={17}/></button>}
        <div className="guardian-browse"><button onClick={() => browse(-1)} aria-label="Предыдущий питомец"><ArrowLeft size={18}/><span>Назад</span></button><span aria-live="polite">{index + 1} / {galleryPets.length}</span><button onClick={() => browse(1)} aria-label="Следующий питомец"><span>Дальше</span><ArrowRight size={18}/></button></div>
      </div>
    </div>
  </dialog>;
}

export function PetGallery({onVisitChudik}: {onVisitChudik: () => void}) {
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  return <section className="guardian-gallery" aria-labelledby="gallery-title">
    <div className="section-heading"><p className="eyebrow">АТЛАС ЧУДОЗВЕРЕЙ · 12 ДРУЗЕЙ · 36 ОБЛИКОВ</p><h2 id="gallery-title">Большой мир маленьких чудес</h2><p className="muted">От лесной поляны до небесных островов. Выбери друга и посмотри, каким хранителем он станет.</p></div>
    <div className="biome-filters" role="group" aria-label="Локации питомцев">{galleryBiomes.map((name, i) => <button key={name} aria-pressed={chapter === i} onClick={() => setChapter(i)}>{name}<span>{i === 0 ? 12 : 3}</span></button>)}</div>
    <p className="gallery-note">Галерея для знакомства. Сейчас растить можно Чудика.</p>
    <div className="creature-grid">{galleryPets.map((pet, index) => (chapter === 0 || pet.chapter === chapter) && <button className="creature-card guardian-card" key={pet.id} onClick={() => setSelected(index)} aria-label={`${pet.name}, ${pet.species} — посмотреть три облика`}>
      <span className="creature-portrait guardian-portrait" style={portrait(index, 0)}><span className="guardian-card-number">{String(index + 1).padStart(2, '0')}</span><span className="guardian-card-badge">3 облика <Sparkles size={11}/></span></span>
      <span className="creature-caption"><small>{pet.biome}</small><strong>{pet.name}</strong><span className="guardian-species">{pet.species}</span><span className="guardian-card-link">Познакомиться <ChevronRight size={13}/></span></span>
    </button>)}</div>
    {selected !== null && <PetDetails initialIndex={selected} onClose={() => setSelected(null)} onVisitChudik={onVisitChudik}/>}
  </section>;
}
