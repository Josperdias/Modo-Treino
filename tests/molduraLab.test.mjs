import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const wf = fs.readFileSync('.github/workflows/android-moldura-lab.yml', 'utf8');

test('laboratório moldura: nunca publica release, pacote isolado e targetSdk 30 conferido no APK', () => {
  assert.ok(!/action-gh-release|gh release|softprops/.test(wf), 'não pode criar release');
  assert.match(wf, /configure_moldura_pilot\.py/);
  assert.match(wf, /art\.josperd\.modotreino\.moldura/);
  assert.match(wf, /targetSdkVersion:'30'/);
  assert.match(wf, /workflow_dispatch:/);
});

test('laboratório moldura: o script é idempotente e baixa o targetSdk', () => {
  const py = String.raw`import sys; sys.path.insert(0, 'scripts'); from configure_moldura_pilot import apply_gradle, apply_properties
g = "android {\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n"
o = apply_gradle(g); assert apply_gradle(o) == o
assert 'applicationIdSuffix ".moldura"' in o and 'checkReleaseBuilds false' in o
assert apply_properties('x=1\n').endswith('android.targetSdkVersion=30\n')
assert apply_properties('android.targetSdkVersion=36\n') == 'android.targetSdkVersion=30\n'
print('ok')`;
  assert.equal(execFileSync('python3', ['-c', py]).toString().trim(), 'ok');
});

test('estilo "full" (sem moldura) só desativa o DecoratedCustomViewStyle; o padrão continua o cartão com moldura', () => {
  const prov = fs.readFileSync('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/NotificationStyleProvider.kt', 'utf8');
  assert.match(prov, /if \(framed\(\)\) setStyle\(NotificationCompat\.DecoratedCustomViewStyle\(\)\)/);
  assert.match(prov, /style\(\) != "full"/);
  const svc = fs.readFileSync('native/modules/modo-playback/android/src/main/java/art/josperd/modotreino/playback/TapePlaybackService.kt', 'utf8');
  assert.match(svc, /getString\(KEY_STYLE, "card"\)/);
});
