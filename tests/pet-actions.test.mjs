import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionMotion, reactionDuration, restingFrame} from '../lib/pet-motion.ts';
import {sampleMotion} from '../lib/chudik-motion.ts';

test('every action completes in its display window and settles after tab suspension', () => {
  for (const action of [1, 2, 3, 4, 5]) {
    const steps = actionMotion(action);
    const duration = reactionDuration(action);
    assert.equal(steps.reduce((total, [, ms]) => total + ms, 0), duration);
    assert.deepEqual(sampleMotion(steps, duration * 20, false), {frame: 0, wait: 0, done: true});
    assert.ok(steps.some(([frame]) => frame === restingFrame(action)));
    for (let elapsed = 0; elapsed < duration; elapsed += 71) {
      const result = sampleMotion(steps, elapsed, false);
      assert.ok(result.frame >= 0 && result.frame < 16);
      assert.ok(result.wait > 0);
    }
  }
});

test('feeding, playing and sleeping use distinct drawn poses, including a long sleep', () => {
  assert.deepEqual([...new Set(actionMotion(1).map(([frame]) => frame))].filter(Boolean).sort(), [4, 5, 6, 7]);
  assert.deepEqual([...new Set(actionMotion(2).map(([frame]) => frame))].filter(Boolean).sort((a, b) => a-b), [8, 9, 10, 11]);
  assert.equal(sampleMotion(actionMotion(3), 3000, false).frame, 14);
  assert.equal(sampleMotion(actionMotion(3), 6000, false).frame, 14);
  assert.equal(sampleMotion(actionMotion(3), 7500, false).frame, 15);
});
