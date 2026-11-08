import {artPreloadUrl} from './art-resolution';

const loaded = new Map<string, Promise<void>>();
export function loadArt(source: string) {
  const src = artPreloadUrl(source);
  const cached = loaded.get(src);
  if (cached) return cached;
  const task = new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('art timeout')), 15000);
    function finish(error?: Error) {
      clearTimeout(timeout); image.onload = image.onerror = null;
      if (error) reject(error); else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('art unavailable'));
    image.src = src;
  });
  loaded.set(src, task);
  void task.catch(() => {if (loaded.get(src) === task) loaded.delete(src);});
  return task;
}
export const actionSource = (petId: string, stage: number) => `/art/actions/${petId}-${Math.min(2, Math.max(0, stage))}.webp`;
export const stageSource = (petId: string) => ['whale', 'lynx', 'griffin'].includes(petId) ? '/art/motion/sky-island.webp' : '/art/motion/island.webp';
export async function loadPetMotion(petId: string, stage: number) {
  await Promise.all([loadArt(actionSource(petId, stage)), loadArt(stageSource(petId))]);
}
