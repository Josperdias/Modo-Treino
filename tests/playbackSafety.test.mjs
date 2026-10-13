import test from 'node:test';
import assert from 'node:assert/strict';
import {clampFadeSeconds, shouldHandleFinish} from '../native/src/music/playbackSafety.js';

test('fade é limitado em 8 s e em meia duração da faixa', () => {
  assert.equal(clampFadeSeconds(12, 300), 8);
  assert.equal(clampFadeSeconds(8, 10), 5);
  assert.equal(clampFadeSeconds(5, 1), .5);
  assert.equal(clampFadeSeconds(-1, 250), 0);
});
test('fade não usa duração desconhecida ou valores não finitos', () => {
  for (const d of [undefined, -1, NaN, Infinity, 0]) assert.equal(clampFadeSeconds(4, d), 0);
  for (const f of [NaN, Infinity, undefined]) assert.equal(clampFadeSeconds(f, 200), 0);
});
test('evento de fim não é duplicado durante mudanças de estado', () => {
  const s = {didJustFinish: true, playing: true, changing: false, handledId: null, currentId: 't1'};
  assert.equal(shouldHandleFinish(s), true);
  assert.equal(shouldHandleFinish({...s, handledId: 't1'}), false);
  assert.equal(shouldHandleFinish({...s, changing: true}), false);
  assert.equal(shouldHandleFinish({...s, playing: false}), false);
  assert.equal(shouldHandleFinish({...s, didJustFinish: false}), false);
});
