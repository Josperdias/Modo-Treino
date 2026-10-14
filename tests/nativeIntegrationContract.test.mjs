import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const provider = fs.readFileSync('native/src/music/MusicProvider.tsx','utf8');
const bridge = fs.readFileSync('native/modules/modo-playback/index.ts','utf8');
const kt = fs.readFileSync('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/ModoPlaybackModule.kt','utf8');
const manifest = fs.readFileSync('native/modules/modo-playback/android/src/main/AndroidManifest.xml','utf8');
test('1.4.2: Media3 é o padrão quando o módulo existe; =0 volta ao motor antigo',()=>{
  assert.match(provider,/EXPO_PUBLIC_MODO_NATIVE_AUDIO !== '0' && ModoPlayback\.available/);
});
test('legacy visual notification is never updated in Media3 test mode',()=>{
  assert.match(provider,/if \(nativeActive\) return; \/\/ Media3/);
  assert.match(provider,/ModoNotif\.musicStop\(\);/);
});
test('native load sends the queue without starting expo player',()=>{
  assert.match(provider,/cancelFade\(\); one\.pause\(\); two\.pause\(\); ModoNotif\.musicStop\(\);/);
  assert.match(provider,/await ModoPlayback\.loadQueue\(items, index, true\)/);
});
test('media3 can accept insertNext without restarting playback',()=>{
  assert.match(bridge,/insertNext\(item: NativeTrack\)/);
  assert.match(kt,/player\.addMediaItem\(/);
  assert.doesNotMatch(kt.slice(kt.indexOf('AsyncFunction("insertNext")'),kt.indexOf('AsyncFunction("play")')),/\.prepare\(/);
});
test('native session is declared as a foreground media service',()=>{
  assert.match(manifest,/FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
  assert.match(manifest,/android:foregroundServiceType="mediaPlayback"/);
});

import {buildNativeQueue as _bnq} from '../native/src/music/nativePilotQueue.js';
test('capa da notificação: índice da fita igual ao de tapeIndex.ts e rádio usa a capa do planeta', async () => {
  const {readFileSync} = await import('node:fs');
  const src = readFileSync(new URL('../native/src/music/tapeIndex.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function tapeIndex')).replace('export function tapeIndex(id: string): number', 'function tapeIndex(id)').replace(/const TAPE_COUNT[^;]*;/, '');
  const ref = new Function(`const TAPE_COUNT = 8; ${body}; return tapeIndex;`)();
  const ids = ['a', 'content://media/external/audio/media/42', 'Lose Yourself', 'x'.repeat(40)];
  const {items} = _bnq([...ids.map((id) => ({id, uri: 'content://x/' + id, title: id, source: 'device'})), {id: 'r1', uri: 'https://r/x', title: 'R', source: 'radio'}], 'a');
  ids.forEach((id, i) => assert.equal(items[i].art, ref(id)));
  assert.equal(items[ids.length].art, 'radio');
});

test('Media3: capa do app e botão ♥ no player do sistema (contrato Kotlin ↔ JS)', () => {
  const svc = fs.readFileSync('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/TapePlaybackService.kt', 'utf8');
  assert.match(svc, /setBitmapLoader\(CapaLoader\(this\)\)/);
  assert.match(svc, /ICON_HEART_FILLED/); assert.match(svc, /setCustomLayout/);
  assert.match(kt, /Events\("onState", "onAction"\)/); assert.match(kt, /AsyncFunction\("setFavorite"\)/); assert.match(kt, /capa:\/\//);
  assert.match(bridge, /setFavorite/); assert.match(bridge, /onAction/);
  assert.match(provider, /ModoPlayback\.onAction/);
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) assert.ok(fs.existsSync(`native/modules/modo-playback/android/src/main/res/drawable-nodpi/capa_fita_${n}.png`), `capa_fita_${n}.png`);
  assert.ok(fs.existsSync('native/modules/modo-playback/android/src/main/res/drawable-nodpi/capa_radio.png'));
});

test('Media3: timer de sono no serviço (fade e pausa) e título ICY da rádio chegam ao JS', () => {
  const svc = fs.readFileSync('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/TapePlaybackService.kt', 'utf8');
  assert.match(svc, /ACTION_SLEEP/); assert.match(svc, /FADE_MS/);
  assert.match(kt, /AsyncFunction\("setSleepTimer"\)/); assert.match(kt, /"streamTitle"/);
  assert.match(bridge, /setSleepTimer/);
  assert.match(provider, /ModoPlayback\.setSleepTimer/); assert.match(provider, /state\.streamTitle/);
});

test('Media3: estilo da notificação (cartão ilustrado ou player do sistema) com escolha em Ajustes', () => {
  const dir = 'native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/';
  const svc = fs.readFileSync(dir + 'TapePlaybackService.kt', 'utf8');
  const prov = fs.readFileSync(dir + 'NotificationStyleProvider.kt', 'utf8');
  assert.match(svc, /setMediaNotificationProvider\(styleProvider\)/); assert.match(svc, /ACTION_STYLE/); assert.match(svc, /cardTicker/);
  // o cartão usa os layouts do módulo modo-notif pelo nome, sem depender do código dele
  for (const n of ['card_music_big', 'card_music_small', 'card_radio_big', 'card_radio_small']) {
    assert.match(prov, new RegExp(n)); assert.ok(fs.existsSync(`native/modules/modo-notif/android/src/main/res/layout/${n}.xml`), n);
  }
  assert.match(prov, /DecoratedCustomViewStyle/); assert.match(prov, /createMediaActionPendingIntent/); assert.match(prov, /createCustomActionPendingIntent/);
  assert.match(kt, /AsyncFunction\("setNotificationStyle"\)/); assert.match(kt, /AsyncFunction\("getNotificationStyle"\)/);
  assert.match(bridge, /setNotificationStyle/); assert.match(fs.readFileSync('native/src/screens/Sheets.tsx', 'utf8'), /Notificação da música/);
  // padrão = cartão ilustrado
  assert.match(svc, /getString\(KEY_STYLE, "card"\)/);
});
