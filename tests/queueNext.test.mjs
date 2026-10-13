import test from 'node:test';
import assert from 'node:assert/strict';
import {insertNextInQueue} from '../native/src/music/queueNext.js';
const tr = (id) => ({id, title: id});

test('Tocar a seguir reordena a fila temporária sem duplicar faixa', () => {
  const a=[tr('a'),tr('b'),tr('c')];
  const next=insertNextInQueue(a,'a',a[2]);
  assert.deepEqual(next.map(x=>x.id),['a','c','b']);
  assert.deepEqual(a.map(x=>x.id),['a','b','c']);
});
test('adiciona faixa fora da fila e respeita o item atual', () => {
  assert.deepEqual(insertNextInQueue([tr('a'),tr('b')],'a',tr('z')).map(x=>x.id), ['a','z','b']);
  assert.deepEqual(insertNextInQueue([tr('a'),tr('b')],'ausente',tr('z')).map(x=>x.id),['z','a','b']);
});
test('remover e inserir a faixa atual não a duplica', () => {
  assert.deepEqual(insertNextInQueue([tr('a'),tr('b')],'a',tr('a')).map(x=>x.id),['a','b']);
});
