'use client';
import {useEffect, useRef, useState, type CSSProperties} from 'react';
import type {galleryPets} from '../lib/gallery';
import {ChudikMotion} from './chudik-motion';

type PetId = typeof galleryPets[number]['id'];
export type Reaction = 0 | 1 | 2 | 3 | 4 | 5;
// Existing game action codes: idle, food, play, rest, affection, celebration.
const columns = [0, 1, 2, 3, 0, 0];
const cached = new Map<PetId, Promise<void>>();
function preload(petId: PetId) {
  const existing = cached.get(petId);
  if (existing) return existing;
  const task = new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('image timeout')), 15000);
    function finish(error?: Error) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (error) reject(error); else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('image unavailable'));
    image.src = `/art/reactions/${petId}.webp`;
  });
  cached.set(petId, task);
  void task.catch(() => {if (cached.get(petId) === task) cached.delete(petId);});
  return task;
}

export function usePetReaction(petId: PetId) {
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
    // Only the currently displayed pet is prefetched, never all twelve atlases.
    void preload(petId).catch(() => {});
    return () => {generation.current++; if (timer.current) clearTimeout(timer.current);};
  }, [petId]);
  function trigger(reaction: Reaction) {
    const ticket = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    setState(previous => ({...previous, petId, loading: true, failed: false}));
    void preload(petId).then(() => {
      if (ticket !== generation.current) return;
      setState(previous => ({petId, reaction, sequence: previous.sequence + 1, loading: false, failed: false}));
      // Start the hold after loading, so slow networks cannot consume the reaction.
      timer.current = setTimeout(() => {
        if (ticket === generation.current) setState(previous => ({...previous, reaction: 0}));
      }, reaction === 3 ? 8500 : 6000);
    }).catch(() => {
      if (ticket === generation.current) setState(previous => ({...previous, reaction: 0, loading: false, failed: true}));
    });
  }
  return {...state, reaction: state.petId === petId ? state.reaction : 0 as Reaction, trigger, reset};
}

/** Scene backgrounds stay fixed; Chudik uses a separate transparent actor. */
export function PetVisual({petId, stage, reaction, sequence, idleStyle}: {
  petId: PetId; stage: number; reaction: Reaction; sequence: number; idleStyle: CSSProperties;
}) {
  const symbols = reaction === 4 ? ['♥', '♥', '♥', '♥'] : reaction === 3 ? ['☾', '✧', '✧', '☾'] : ['✦', '✧', '✦', '✧'];
  return <span className="pet-visual" aria-hidden="true">
    <span className="pet-frame pet-idle-frame" style={idleStyle}/>
    {[0, 1, 2, 3].map(column => <span key={column} className={'pet-frame pet-reaction-frame' + (reaction !== 0 && columns[reaction] === column ? ' is-visible' : '')} style={{
      backgroundImage: `url('/art/reactions/${petId}.webp')`,
      backgroundSize: '400% 300%',
      backgroundPosition: `${column * 100 / 3}% ${Math.min(2, Math.max(0, stage)) * 50}%`,
    }}/>)}
    {petId === 'chudik' && <ChudikMotion stage={stage} reaction={reaction} sequence={sequence}/>}
    {reaction !== 0 && <span key={`${petId}-${sequence}`} className={`pet-emotion-particles emotion-${reaction}`}>
      {symbols.map((symbol, index) => <i key={index} style={{left: `${25 + index * 17}%`, animationDelay: `${index * .18}s`}}>{symbol}</i>)}
    </span>}
  </span>;
}
