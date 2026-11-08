'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ChevronRight, Sparkles, X} from 'lucide-react';
import {galleryBiomes, galleryPets} from '../lib/gallery';

const forms = ['baby', 'grown', 'guardian'] as const;
const formLabels = ['Малыш', 'Подросший', 'Хранитель'];
function portrait(index: number, stage: number) {
  return {
    backgroundImage: `url('/art/guardians-chapter-${galleryPets[index].chapter}.webp')`,
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
    setIndex(current => (current + step + galleryPets.length) % galleryPets.length);
    setStage(0);
    dialog.current?.scrollTo({top: 0});
  }
  return <dialog ref={dialog} className="guardian-dialog" aria-labelledby="guardian-title"
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="guardian-detail">
      <div className="guardian-art" style={portrait(index, stage)}>
        <span role="img" aria-label={`${pet.name}: ${pet.forms[forms[stage]]}`}/>
        <span className="guardian-location">{pet.biome}</span>
        <button className="guardian-close" onClick={onClose} aria-label="Закрыть и вернуться к питомцам" autoFocus><X size={20}/></button>
        <span className="guardian-art-caption">{pet.forms[forms[stage]]}</span>
      </div>
      <div className="guardian-copy">
        <div className="guardian-forms" role="group" aria-label="Посмотреть облик">
          {forms.map((form, i) => <button key={form} aria-pressed={stage === i} onClick={() => setStage(i)}>{formLabels[i]}</button>)}
        </div>
        <div className="guardian-title-row"><div><p className="eyebrow">{pet.species}</p><h2 id="guardian-title">{pet.name}</h2></div><Sparkles size={26} aria-hidden="true"/></div>
        <p className="guardian-personality">{pet.personality}</p>
        <p className="guardian-note">{index === 0 ? 'Чудик уже ждёт тебя на острове. Здесь можно рассмотреть все его облики.' : 'Знакомство с будущим другом. Все три облика открыты для просмотра; выращивание появится позже.'}</p>
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
