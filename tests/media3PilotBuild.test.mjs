import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const root = new URL('..', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const svc = read('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/TapePlaybackService.kt');
const module = read('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/ModoPlaybackModule.kt');
const manifest = read('native/modules/modo-playback/android/src/main/AndroidManifest.xml');
const gradle = read('native/modules/modo-playback/android/build.gradle');
const provider = read('native/src/music/MusicProvider.tsx');
const workflow = read('.github/workflows/android-media3-pilot.yml');

test('sessão única e foreground service de reprodução', () => {
  assert.match(svc, /MediaSessionService/);
  assert.match(svc, /setWakeMode\(C\.WAKE_MODE_NETWORK\)/);
  assert.match(svc, /setAudioAttributes\(attributes, true\)/);
  assert.match(svc, /setHandleAudioBecomingNoisy\(true\)/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
  assert.match(manifest, /foregroundServiceType="mediaPlayback"/);
});

test('revisão Claude: rádio mantém Wi-Fi acordado e controlador velho é recriado', () => {
  assert.match(manifest, /ACCESS_WIFI_STATE/);
  assert.match(manifest, /android\.permission\.WAKE_LOCK/);
  assert.match(module, /!ready\.isConnected/);
  assert.match(module, /MediaController\.releaseFuture\(stale\)/);
});

test('fila e comandos nativos expostos pela ponte Expo', () => {
  for (const name of ['loadQueue','insertNext','play','pause','seekTo','next','previous','getState']) {
    assert.match(module, new RegExp(`AsyncFunction\\("${name}"\\)`));
  }
  assert.match(gradle, /media3-session/);
  assert.match(gradle, /media3-exoplayer-hls/);
});

test('modo Media3 permanece opt-in e a interface antiga está disponível', () => {
  assert.match(provider, /EXPO_PUBLIC_MODO_NATIVE_AUDIO/);
  assert.match(provider, /if \(nativeActive\)/);
  assert.match(provider, /ModoNotif\.musicStop\(\)/);
});

test('workflow só executa manualmente e nunca publica release', () => {
  assert.match(workflow, /workflow_dispatch:/);
  // Único push permitido: a branch de integração (temporário até a autorização do merge); nunca PR/tag/release.
  assert.doesNotMatch(workflow, /^\s*pull_request:|^\s*tags:|softprops\/action-gh-release|publish_release:/m);
  assert.match(workflow, /push:\s*\n\s*branches: \['feat\/sprint05-media3-pilot-apk'\]/);
  assert.match(workflow, /EXPO_PUBLIC_MODO_NATIVE_AUDIO: '1'/);
  assert.match(workflow, /configure_media3_pilot\.py/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('pacote piloto recebe applicationId diferente e aplicação é idempotente', () => {
  const template = `android {\n  buildTypes {\n    debug {\n    }\n    release {\n      signingConfig signingConfigs.debug\n    }\n  }\n}`;
  const py = String.raw`import sys; sys.path.insert(0, 'scripts'); from configure_media3_pilot import apply; text=sys.stdin.read(); once=apply(text); twice=apply(once); assert once==twice; print(once)`;
  const result = execFileSync('python3', ['-c',py], {input: template,cwd:new URL('.',root),encoding:'utf8'});
  assert.match(result, /applicationIdSuffix "\.pilot"/);
  assert.match(result, /versionNameSuffix "-media3-s05"/);
});
