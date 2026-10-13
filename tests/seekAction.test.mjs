import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSeekAction} from '../native/src/music/seekAction.js';

test('converte posição da MediaSession de ms em segundos', () => {
  assert.equal(parseSeekAction('seek:90500', 180), 90.5);
  assert.equal(parseSeekAction('seek:0', 180), 0);
});
test('limita a duração e rejeita duração desconhecida', () => {
  assert.equal(parseSeekAction('seek:99999999', 240), 240);
  assert.equal(parseSeekAction('seek:10000', 0), null);
  assert.equal(parseSeekAction('seek:10000', Number.NaN), null);
});
test('rejeita comandos inválidos ou malformados', () => {
  for (const x of ['pause', 'seek:-1', 'seek:3.4', 'seek:Infinity', 'seek:01ms', 'seek:', 'seek:999999999999999999999']) {
    assert.equal(parseSeekAction(x, 180), null, x);
  }
});
