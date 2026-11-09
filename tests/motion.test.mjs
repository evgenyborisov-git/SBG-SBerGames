import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affectionMotion, idleMotion, sampleMotion} from '../lib/chudik-motion.ts';

test('idle blinking loops without timing drift after tab suspension', () => {
  const duration = idleMotion.reduce((total, [, ms]) => total + ms, 0);
  assert.equal(sampleMotion(idleMotion, 0, true).frame, 0);
  assert.equal(sampleMotion(idleMotion, 2700, true).frame, 2);
  assert.deepEqual(sampleMotion(idleMotion, duration * 1000 + 2700, true), sampleMotion(idleMotion, 2700, true));
  assert.equal(sampleMotion(idleMotion, duration, true).frame, 0);
});

test('affection settles before the six-second reaction expires and never loops', () => {
  for (const sequence of [1, 2, 3, 4, 99]) {
    const steps = affectionMotion(sequence);
    assert.equal(sampleMotion(steps, 0, false).frame, 4);
    assert.equal(sampleMotion(steps, 1000, false).frame, 8);
    assert.equal(sampleMotion(steps, 5900, false).frame, 0);
    assert.deepEqual(sampleMotion(steps, 6000, false), {frame: 0, wait: 0, done: true});
    assert.deepEqual(sampleMotion(steps, 60000, false), {frame: 0, wait: 0, done: true});
    for (let ms = 0; ms < 6000; ms += 37) {
      const next = sampleMotion(steps, ms, false);
      assert.ok(Number.isInteger(next.frame) && next.frame >= 0 && next.frame < 16);
      assert.ok(next.wait > 0);
    }
  }
});

test('repeat petting alternates nuzzle direction and adds a wink on every third response', () => {
  assert.notEqual(sampleMotion(affectionMotion(1), 1900, false).frame, sampleMotion(affectionMotion(2), 1900, false).frame);
  assert.equal(sampleMotion(affectionMotion(3), 4400, false).frame, 15);
  assert.notEqual(sampleMotion(affectionMotion(2), 4400, false).frame, 15);
});
