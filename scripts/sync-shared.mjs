// Copia shared/logic.js para site/ e native/. Use --check no CI para falhar se as cópias divergirem.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'shared/logic.js'), 'utf8');
const targets = ['site/logic.js', 'native/logic.js'];
const check = process.argv.includes('--check');
let bad = 0;
for (const t of targets) {
  const path = join(root, t);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === source) { console.log(`ok     ${t}`); continue; }
  if (check) { console.error(`DIVERGE ${t} — rode: node scripts/sync-shared.mjs`); bad++; }
  else { writeFileSync(path, source); console.log(`gravado ${t}`); }
}
process.exit(bad ? 1 : 0);
