'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Heart, Sparkles} from 'lucide-react';
import {galleryPets} from '../lib/gallery';
import type {PetId} from '../lib/game/pets';
import {petPortrait, petThumbnail} from '../lib/pet-portraits';
import {PetVisual, usePetReaction} from './pet-reactions';

export function PetPicker({initialPetId, stage, disabled, onConfirm, errorMessage, onRetry}: {
  initialPetId: PetId; stage: number; disabled: boolean; onConfirm: (id: PetId) => void; errorMessage?: string; onRetry?: () => void;
}) {
  const [selected, setSelected] = useState(initialPetId);
  const heading = useRef<HTMLHeadingElement>(null);
  const pet = galleryPets.find(item => item.id === selected)!;
  const emotion = usePetReaction(selected, stage);
  useEffect(() => {heading.current?.focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'});}, []);
  return <section className="pet-picker" aria-labelledby="pet-picker-title" aria-busy={disabled}>
    <div className="picker-heading"><div><p className="eyebrow"><Sparkles size={14}/> ПЕРВАЯ ВСТРЕЧА</p><h1 ref={heading} tabIndex={-1} id="pet-picker-title">С кем начнётся твоё чудо?</h1><p>Выбери своего первого чудозверя. Он станет первым другом на твоём острове, а остальных ты будешь собирать по мере игры.</p></div></div>
    <div className="picker-layout">
      <div className="picker-preview">
        <button className="picker-touch" onClick={() => emotion.trigger(4)} aria-label={`Погладить: ${pet.name}`}><PetVisual petId={selected} stage={stage} reaction={emotion.reaction} sequence={emotion.sequence} idleStyle={petPortrait(selected, stage)}/><span className="picker-touch-hint"><Heart size={13}/> Коснись — познакомьтесь поближе</span></button>
        <div className="picker-personality" aria-live="polite"><p className="eyebrow">{pet.species} · {pet.biome}</p><h2>{pet.name}</h2><p>{pet.personality}</p></div>
      </div>
      <div className="picker-options"><div className="picker-grid" role="group" aria-label="Выбери своего питомца">{galleryPets.map(item => <button disabled={disabled} key={item.id} aria-pressed={selected === item.id} onClick={() => {emotion.reset(); setSelected(item.id);}} className={'picker-option' + (selected === item.id ? ' selected' : '')}><span className="picker-thumbnail" style={petThumbnail(item.id)}/><strong>{item.name}</strong>{selected === item.id && <span className="picker-check"><Check size={13}/></span>}</button>)}</div>
        <div className="picker-confirm">{errorMessage && <p className="picker-error" role="alert">{errorMessage} {onRetry && <button onClick={onRetry}>Повторить сохранение</button>}</p>}<button className="picker-submit" disabled={disabled} onClick={() => onConfirm(selected)}><span>{disabled ? errorMessage ? 'Ожидаем повторной попытки' : 'Сохраняем выбор…' : `Выбрать: ${pet.name}`}</span><ArrowRight size={19}/></button><p>Первого друга выбираешь один раз. Сбор остальных хранителей появится в следующих обновлениях.</p></div>
      </div>
    </div>
  </section>;
}
