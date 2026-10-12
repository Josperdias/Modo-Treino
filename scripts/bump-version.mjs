// Sobe a versão do Modo Treino em TODOS os lugares de uma vez (o tests/verify.py confere que estão iguais).
//   node scripts/bump-version.mjs 1.2.0
// Depois: commit, PR e, ao dar merge, rode o workflow "Android - APK de teste" com "publicar" marcado.
// O app e o site só avisam de uma versão NOVA quando o número da release for MAIOR que o instalado.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || '')) { console.error('Uso: node scripts/bump-version.mjs 1.2.0  (formato X.Y.Z)'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const edit = (file, fn) => { const p = join(root, file); const a = readFileSync(p, 'utf8'); const b = fn(a); if (a === b) throw new Error(`nada mudou em ${file} (versão já é ${next}?)`); writeFileSync(p, b); console.log('ok  ', file); };
const json = (file, fn) => edit(file, (t) => { const o = JSON.parse(t); fn(o); return JSON.stringify(o, null, 2) + '\n'; });

json('package.json', (o) => { o.version = next; });
json('native/package.json', (o) => { o.version = next; });
json('native/app.json', (o) => { o.expo.version = next; });
edit('native/App.tsx', (t) => t.replace(/APP_VERSION='[^']+'/, `APP_VERSION='${next}'`));
edit('site/updates.js', (t) => t.replace(/APP_VERSION='[^']+'/, `APP_VERSION='${next}'`));
edit('site/sw.js', (t) => t.replace(/VERSION = '[^']+'/, `VERSION = '${next}'`));
console.log(`\nVersão ${next} aplicada. Rode: python3 tests/verify.py`);
