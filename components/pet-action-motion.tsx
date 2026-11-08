'use client';
import {useEffect, useRef, useState} from 'react';
import {artBackground} from '../lib/art-resolution';
import {sampleMotion} from '../lib/chudik-motion';
import {actionSource, loadPetMotion, stageSource} from '../lib/client-art';
import {actionMotion, restingFrame} from '../lib/pet-motion';

/** The island never moves. Only a transparent character changes poses. */
export function PetActionMotion({petId, stage, reaction, sequence, onReady}: {
  petId: string; stage: number; reaction: number; sequence: number; onReady: (source: string) => void;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [readySource, setReadySource] = useState('');
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(true);
  const [frame, setFrame] = useState(0);
  const clock = useRef({key: '', start: 0});
  const safeStage = Math.min(2, Math.max(0, stage));
  const source = actionSource(petId, safeStage);
  const ready = readySource === source;
  const showing = ready && !(petId === 'chudik' && (reaction === 0 || reaction === 4));
  useEffect(() => {
    let active = true;
    void loadPetMotion(petId, safeStage).then(() => {
      if (active) {setReadySource(source); onReady(source);}
    }).catch(() => {});
    return () => {active = false;};
  }, [petId, safeStage, source, onReady, sequence]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {setReduced(media.matches); setVisible(document.visibilityState === 'visible');};
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (element.current) observer?.observe(element.current);
    return () => {media.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); observer?.disconnect();};
  }, []);
  useEffect(() => {
    const key = `${source}-${reaction}-${sequence}`;
    if (clock.current.key !== key) clock.current = {key, start: performance.now()};
    setFrame(restingFrame(reaction));
    if (!showing || reduced || !visible || !inView) return;
    const steps = actionMotion(reaction, sequence);
    const start = clock.current.start;
    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      const next = sampleMotion(steps, performance.now() - start, reaction === 0);
      setFrame(next.frame);
      if (!next.done) timeout = setTimeout(tick, Math.max(16, next.wait));
    }
    tick();
    return () => clearTimeout(timeout);
  }, [showing, reduced, visible, inView, reaction, sequence, source]);
  return <span ref={element} className={'pet-action-motion chudik-motion' + (showing ? ' is-ready' : '') + (showing && visible && inView && !reduced ? ' is-running' : '')}>
    <span className="pet-frame action-backdrop" style={{backgroundImage: artBackground(stageSource(petId))}}/>
    <span className="chudik-shadow"/>
    <span className={`chudik-actor age-${safeStage}`} style={{backgroundImage: artBackground(source), backgroundPosition: `${frame % 4 * 100 / 3}% ${Math.floor(frame / 4) * 100 / 3}%`}}/>
    {reaction === 2 && <span key={sequence} className="pet-play-ball"/>}
  </span>;
}
