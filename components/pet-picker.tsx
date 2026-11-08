'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Heart, Sparkles, X} from 'lucide-react';
import {galleryPets} from '../lib/gallery';
import type {PetId} from '../lib/game/pets';
import {petPortrait, petThumbnail} from '../lib/pet-portraits';
import {PetVisual, usePetReaction} from './pet-reactions';

export function PetPicker({initialPetId, stage, disabled, onConfirm, onCancel, errorMessage, onRetry}: {
  initialPetId: PetId; stage: number; disabled: boolean; onConfirm: (id: PetId) => void; onCancel?: () => void; errorMessage?: string; onRetry?: () => void;
}) {
  const [selected, setSelected] = useState(initialPetId);
  const heading = useRef<HTMLHeadingElement>(null);
  const pet = galleryPets.find(item => item.id === selected)!;
  const emotion = usePetReaction(selected, stage);
  useEffect(() => {heading.current?.focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'});}, []);
  return <section className="pet-picker" aria-labelledby="pet-picker-title" aria-busy={disabled}>
    <div className="picker-heading"><div><p className="eyebrow"><Sparkles size={14}/> {onCancel ? 'НА ОСТРОВЕ ВСЕМ ХВАТИТ МЕСТА' : 'ПЕРВАЯ ВСТРЕЧА'}</p><h1 ref={heading} tabIndex={-1} id="pet-picker-title">{onCancel ? 'Кто будет рядом сегодня?' : 'С кем начнётся твоё чудо?'}</h1><p>{onCancel ? 'Можно позвать другого друга. Ваш общий прогресс останется с тобой.' : 'Двенадцать маленьких характеров. Выбери того, кому хочется подарить заботу.'}</p></div>{onCancel && <button disabled={disabled} className="picker-close" onClick={onCancel} aria-label="Отменить смену питомца"><X size={22}/></button>}</div>
    <div className="picker-layout">
      <div className="picker-preview">
        <button className="picker-touch" onClick={() => emotion.trigger(4)} aria-label={`Погладить: ${pet.name}`}><PetVisual petId={selected} stage={stage} reaction={emotion.reaction} sequence={emotion.sequence} idleStyle={petPortrait(selected, stage)}/><span className="picker-touch-hint"><Heart size={13}/> Коснись — познакомьтесь поближе</span></button>
        <div className="picker-personality" aria-live="polite"><p className="eyebrow">{pet.species} · {pet.biome}</p><h2>{pet.name}</h2><p>{pet.personality}</p></div>
      </div>
      <div className="picker-options"><div className="picker-grid" role="group" aria-label="Выбери своего питомца">{galleryPets.map(item => <button disabled={disabled} key={item.id} aria-pressed={selected === item.id} onClick={() => {emotion.reset(); setSelected(item.id);}} className={'picker-option' + (selected === item.id ? ' selected' : '')}><span className="picker-thumbnail" style={petThumbnail(item.id)}/><strong>{item.name}</strong>{selected === item.id && <span className="picker-check"><Check size={13}/></span>}</button>)}</div>
        <div className="picker-confirm">{errorMessage && <p className="picker-error" role="alert">{errorMessage} {onRetry && <button onClick={onRetry}>Повторить сохранение</button>}</p>}<button className="picker-submit" disabled={disabled} onClick={() => onConfirm(selected)}><span>{disabled ? errorMessage ? 'Ожидаем повторной попытки' : 'Сохраняем выбор…' : `Выбрать: ${pet.name}`}</span><ArrowRight size={19}/></button><p>{onCancel ? 'Монеты, энергия, опыт и награды сохраняются. Смена бесплатна.' : 'Выбор сохранится в профиле. Позже друга можно будет сменить бесплатно.'}</p></div>
      </div>
    </div>
  </section>;
}
