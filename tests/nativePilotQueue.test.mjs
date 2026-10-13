import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildNativeQueue} from '../native/src/music/nativePilotQueue.js';

test('mantém IDs, nomes, fonte e ordem em bags com rádio', () => {
  const q=buildNativeQueue([
    {id:'a',uri:'content://audio/1',title:'Fita 1',source:'device'},
    {id:'r',uri:'https://radio.example/live.mp3',title:'Rádio',source:'radio'},
    {id:'b',uri:'file:///music/b.mp3',title:'Fita 2',source:'file'}
  ],'r');
  assert.equal(q.index,1);
  assert.deepEqual(q.items.map(t=>t.id),['a','r','b']);
});
test('ignora URIs inválidas sem sair do escopo da bag', () => {
  const q=buildNativeQueue([{id:'x',uri:'javascript:bad',source:'file'},{id:'a',uri:'file:///a.mp3',title:'A',source:'file'}],'a');
  assert.deepEqual(q.items.map(t=>t.id),['a']);
});
test('falha explicitamente quando faltam permissões ou faixa', () => {
  assert.throws(()=>buildNativeQueue([{id:'x',uri:'',source:'device'}],'x'),/acessível/);
  assert.throws(()=>buildNativeQueue([], 'x'),/acessível/);
});
