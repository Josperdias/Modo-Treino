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
