'use client';
import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react';
import type {galleryPets} from '../lib/gallery';
import {artBackground} from '../lib/art-resolution';
import {ChudikMotion} from './chudik-motion';
import {PetActionMotion} from './pet-action-motion';
import {actionSource, loadArt, loadPetMotion} from '../lib/client-art';
import {reactionDuration} from '../lib/pet-motion';

type PetId = typeof galleryPets[number]['id'];
export type Reaction = 0 | 1 | 2 | 3 | 4 | 5;
// Existing game action codes: idle, food, play, rest, affection, celebration.
const columns = [0, 1, 2, 3, 0, 0];
async function preload(petId: PetId, stage: number, reaction = 0) {
  try {
    if (petId === 'chudik' && (reaction === 0 || reaction === 4)) {
      await Promise.all([loadArt(`/art/motion/chudik-${Math.min(2, Math.max(0, stage))}.webp`), loadArt('/art/motion/island.webp')]);
    } else await loadPetMotion(petId, stage);
  } catch {
    await loadArt(`/art/reactions/${petId}.webp`);
  }
}

export function usePetReaction(petId: PetId, stage = 0) {
  const [state, setState] = useState({petId, reaction: 0 as Reaction, sequence: 0, loading: false, failed: false});
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function reset() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setState(previous => ({...previous, petId, reaction: 0, loading: false, failed: false}));
  }
  useEffect(() => {
    reset();
    return () => {generation.current++; if (timer.current) clearTimeout(timer.current);};
  }, [petId]);
  useEffect(() => {
    // Prefetch only the selected age; a level-up must not cancel its new reaction.
    void preload(petId, stage).catch(() => {});
  }, [petId, stage]);
  function trigger(reaction: Reaction, stageOverride = stage) {
    const ticket = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    setState(previous => ({...previous, petId, loading: true, failed: false}));
    void preload(petId, stageOverride, reaction).then(() => {
      if (ticket !== generation.current) return;
      setState(previous => ({petId, reaction, sequence: previous.sequence + 1, loading: false, failed: false}));
      // Start the hold after loading, so slow networks cannot consume the reaction.
      timer.current = setTimeout(() => {
        if (ticket === generation.current) setState(previous => ({...previous, reaction: 0}));
      }, reactionDuration(reaction));
    }).catch(() => {
      if (ticket === generation.current) setState(previous => ({...previous, reaction: 0, loading: false, failed: true}));
    });
  }
  return {...state, reaction: state.petId === petId ? state.reaction : 0 as Reaction, trigger, reset};
}

/** All pets animate separately from the stationary island. */
export function PetVisual({petId, stage, reaction, sequence, idleStyle}: {
  petId: PetId; stage: number; reaction: Reaction; sequence: number; idleStyle: CSSProperties;
}) {
  const [readySource, setReadySource] = useState('');
  const [chudikReadySource, setChudikReadySource] = useState('');
  const onChudikReady = useCallback((source: string) => setChudikReadySource(source), []);
  const onReady = useCallback((source: string) => setReadySource(source), []);
  const motionReady = petId === 'chudik' && (reaction === 0 || reaction === 4) ? chudikReadySource === `/art/motion/chudik-${stage}.webp` : readySource === actionSource(petId, stage);
  const symbols = reaction === 4 ? ['♥', '♥', '♥', '♥'] : reaction === 3 ? ['☾', '✧', '✧', '☾'] : ['✦', '✧', '✦', '✧'];
  return <span className="pet-visual" aria-hidden="true">
    {!motionReady && <span className="pet-frame pet-idle-frame" style={idleStyle}/>}
    {reaction !== 0 && !motionReady && <span className="pet-frame pet-reaction-frame is-visible" style={{
      backgroundImage: artBackground(`/art/reactions/${petId}.webp`),
      backgroundSize: '400% 300%',
      backgroundPosition: `${columns[reaction] * 100 / 3}% ${Math.min(2, Math.max(0, stage)) * 50}%`,
    }}/>}
    <PetActionMotion petId={petId} stage={stage} reaction={reaction} sequence={sequence} onReady={onReady}/>
    {petId === 'chudik' && <ChudikMotion stage={stage} reaction={reaction} sequence={sequence} onReady={onChudikReady}/>}
    {reaction !== 0 && <span key={`${petId}-${sequence}`} className={`pet-emotion-particles emotion-${reaction}`}>
      {symbols.map((symbol, index) => <i key={index} style={{left: `${25 + index * 17}%`, animationDelay: `${index * .18}s`}}>{symbol}</i>)}
    </span>}
  </span>;
}
