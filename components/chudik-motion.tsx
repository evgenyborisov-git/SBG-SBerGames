'use client';
import {useEffect, useRef, useState} from 'react';
import {affectionMotion, idleMotion, sampleMotion} from '../lib/chudik-motion';

const loaded = new Map<string, Promise<void>>();
function loadImage(src: string) {
  const cached = loaded.get(src);
  if (cached) return cached;
  const task = new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('motion image timeout')), 15000);
    function finish(error?: Error) {
      clearTimeout(timeout); image.onload = image.onerror = null;
      if (error) reject(error); else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('motion image unavailable'));
    image.src = src;
  });
  loaded.set(src, task);
  void task.catch(() => {if (loaded.get(src) === task) loaded.delete(src);});
  return task;
}

export function ChudikMotion({stage, reaction, sequence}: {
  stage: number; reaction: number; sequence: number;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [readySrc, setReadySrc] = useState('');
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(true);
  const [frame, setFrame] = useState(0);
  const clock = useRef({key: '', start: 0});
  const safeStage = Math.min(2, Math.max(0, stage));
  const src = `/art/motion/chudik-${safeStage}.webp`;
  const ready = readySrc === src;
  useEffect(() => {
    let active = true;
    void Promise.all([loadImage(src), loadImage('/art/motion/island.webp')]).then(() => {
      if (active) setReadySrc(src);
    }).catch(() => {}); // Keep the existing illustrated reaction as fallback.
    return () => {active = false;};
  }, [src]);
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
    const key = `${safeStage}-${reaction}-${sequence}`;
    if (clock.current.key !== key) clock.current = {key, start: performance.now()};
    setFrame(reaction === 4 ? 12 : 0);
    if (!ready || reduced || !visible || !inView || (reaction !== 0 && reaction !== 4)) return;
    const steps = reaction === 4 ? affectionMotion(sequence) : idleMotion;
    const start = clock.current.start;
    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      const next = sampleMotion(steps, performance.now() - start, reaction === 0);
      setFrame(next.frame);
      if (!next.done) timeout = setTimeout(tick, Math.max(16, next.wait));
    }
    tick();
    return () => clearTimeout(timeout);
  }, [ready, reduced, visible, inView, reaction, sequence, safeStage]);
  const showing = ready && (reaction === 0 || reaction === 4);
  return <span ref={element} className={'chudik-motion' + (showing ? ' is-ready' : '') + (showing && visible && inView && !reduced ? ' is-running' : '')}>
    <span className="pet-frame chudik-backdrop"/>
    <span className="chudik-shadow"/>
    <span className={`chudik-actor age-${safeStage}`} style={{backgroundImage: `url('${src}')`, backgroundPosition: `${frame % 4 * 100 / 3}% ${Math.floor(frame / 4) * 100 / 3}%`}}/>
  </span>;
}
