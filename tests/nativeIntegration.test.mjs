import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePlaylistForTrack, nativeRadioQueue, nativeTrackFromId} from '../native/src/music/nativeIntegration.js';
const a = {id:'a',title:'A',uri:'file:///A.mp3',source:'file'};
const b = {id:'b',title:'B',uri:'file:///B.mp3',source:'file'};
const c = {id:'c',title:'C',uri:'file:///C.mp3',source:'file'};
const station = {id:'radio:x',title:'Radio X',uri:'https://example.org/live.mp3',source:'radio'};
test('temporary all-tapes queue wins over the selected bag', () => {
  const x = nativePlaylistForTrack(b,[a,b,c],{id:'bag',ids:['b']},[b]);
  assert.deepEqual(x.map(x=>x.id), ['a','b','c']);
});
test('a bag follows the saved order without mutating it', () => {
  const bag = {id:'bag',ids:['c','missing','b','a']};
  const before = JSON.stringify(bag);
  const x = nativePlaylistForTrack(b,null,bag,[a,b,c]);
  assert.deepEqual(x.map(x=>x.id), ['c','b','a']);
  assert.equal(JSON.stringify(bag),before);
});
test('standalone track does not inherit previous bag', () => {
  assert.deepEqual(nativePlaylistForTrack(c,null,{id:'bag',ids:['a','b']},[a,b,c]),[c]);
});
test('radio solo never inherits a music playlist', () => {
  assert.deepEqual(nativeRadioQueue(station),[station]);
  assert.throws(()=>nativeRadioQueue(a));
});
test('native ID is resolved from recent queue or saved references', () => {
  assert.deepEqual(nativeTrackFromId('c',[c],[a,b]),c);
  assert.deepEqual(nativeTrackFromId('b',[],[a,b]),b);
  assert.equal(nativeTrackFromId('x',[c],[a,b]),null);
});
