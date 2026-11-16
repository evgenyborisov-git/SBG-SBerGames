export type MotionStep = readonly [frame: number, duration: number];

// Stable sprite coordinates: 0–3 idle/blink; 4–14 affection; 15 wink.
export const idleMotion: readonly MotionStep[] = [
  [0, 2600], [1, 90], [2, 110], [1, 90], [0, 1700], [3, 450], [0, 1800],
];
export function affectionMotion(sequence: number): readonly MotionStep[] {
  const nuzzle = sequence % 2 === 0 ? [11, 10] : [10, 11];
  return [
    [4, 220], [5, 240], [6, 240], [7, 250], [8, 500], [9, 420],
    [nuzzle[0], 340], [12, 350], [nuzzle[1], 340], [12, 650],
    [8, 500], [13, 300], [sequence % 3 === 0 ? 15 : 14, 450], [0, 1200],
  ];
}

/** Sample by elapsed time: suspended tabs never queue a backlog of old frames. */
export function sampleMotion(steps: readonly MotionStep[], elapsed: number, loop: boolean) {
  const duration = steps.reduce((total, [, time]) => total + time, 0);
  let remaining = Math.max(0, elapsed);
  if (loop) remaining %= duration;
  else if (remaining >= duration) return {frame: 0, wait: 0, done: true};
  for (const [frame, time] of steps) {
    if (remaining < time) return {frame, wait: time - remaining, done: false};
    remaining -= time;
  }
  return {frame: 0, wait: 0, done: true};
}
