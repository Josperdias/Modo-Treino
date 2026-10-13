import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRestorePlan} from '../native/src/music/nativeRestore.js';

const lib = [
  {id: 'a', uri: 'content://audio/1', title: 'A', source: 'device'},
  {id: 'b', uri: 'file:///b.mp3', title: 'B', source: 'file'},
  {id: 'r', uri: 'https://radio.example/live', title: 'Rádio', source: 'radio'},
];
const now = 1_700_000_000_000;

test('restaura fila e posição, ignorando faixas que sumiram', () => {
  const plan = buildRestorePlan({ids: ['a', 'gone', 'b'], currentId: 'b', positionMs: 12345.9, savedAt: now - 1000}, lib, now);
  assert.deepEqual(plan.items.map((t) => t.id), ['a', 'b']);
  assert.equal(plan.index, 1);
  assert.equal(plan.positionMs, 12345);
});
test('nunca restaura rádio ao vivo', () => {
  assert.equal(buildRestorePlan({ids: ['r'], currentId: 'r', positionMs: 0, savedAt: now}, lib, now), null);
  const plan = buildRestorePlan({ids: ['a', 'r'], currentId: 'a', positionMs: 0, savedAt: now}, lib, now);
  assert.deepEqual(plan.items.map((t) => t.id), ['a']);
});
test('descarta sessão velha, inválida ou sem a faixa atual', () => {
  assert.equal(buildRestorePlan(null, lib, now), null);
  assert.equal(buildRestorePlan({ids: 'a', currentId: 'a', savedAt: now}, lib, now), null);
  assert.equal(buildRestorePlan({ids: ['a'], currentId: 'a', savedAt: now - 31 * 24 * 3600 * 1000}, lib, now), null);
  assert.equal(buildRestorePlan({ids: ['a'], currentId: 'b', savedAt: now}, lib, now), null);
  assert.equal(buildRestorePlan({ids: ['a'], currentId: 'a', savedAt: 'ontem'}, lib, now), null);
});
test('posição inválida ou negativa vira 0', () => {
  assert.equal(buildRestorePlan({ids: ['a'], currentId: 'a', positionMs: -5, savedAt: now}, lib, now).positionMs, 0);
  assert.equal(buildRestorePlan({ids: ['a'], currentId: 'a', positionMs: NaN, savedAt: now}, lib, now).positionMs, 0);
});
