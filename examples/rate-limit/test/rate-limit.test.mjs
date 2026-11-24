import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/rate-limit.mjs';

test('the sixth call in one window is refused', () => {
  let t = 0;
  const allow = createLimiter({ limit: 5, windowMs: 1000, now: () => t });
  for (let i = 0; i < 5; i++) assert.equal(allow('ip-1'), true, `call ${i + 1} should pass`);
  assert.equal(allow('ip-1'), false, 'call 6 must be refused');
});

test('a new window starts fresh', () => {
  let t = 0;
  const allow = createLimiter({ limit: 1, windowMs: 1000, now: () => t });
  assert.equal(allow('ip-1'), true);
  assert.equal(allow('ip-1'), false);
  t = 1000;
  assert.equal(allow('ip-1'), true);
});
