// Medições do motor novo (M1) no Node: custo por passo e consumo de memória numa sessão longa.
//   node --expose-gc docs/neon-step-dx/baseline/medicoes-m1.mjs > resultado-medicoes-m1.json
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const core = p => import(join(ROOT, 'native/src/arcade/core', p));
const {createSim, step, metersOf} = await core('sim.ts');
const {makeBot, botInput, IDEAL} = await core('bot.ts');
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const mb = () => +(process.memoryUsage().heapUsed / 1048576).toFixed(2);

// 1) custo por passo (robô ideal, 5 sementes)
let steps = 0, t = process.hrtime.bigint();
for (let seed = 1; seed <= 5; seed++) {
  const s = createSim(seed), b = makeBot(IDEAL, seed);
  for (let i = 0; i < 120 * 120 && s.mode === 'playing'; i++) { step(s, botInput(s, b)); steps++; }
}
const ns = Number(process.hrtime.bigint() - t) / steps;
// 2) sessão longa: 30 min de jogo (216 000 passos a 120 Hz), memória e tamanho das listas
const s = createSim(2026), b = makeBot(IDEAL, 2026);
gc(); const heap0 = mb();
const marks = {}; let maxPlat = 0, maxItems = 0;
for (let i = 1; i <= 120 * 60 * 30 && s.mode === 'playing'; i++) {
  step(s, botInput(s, b));
  s.events.length = 0; // o app consome os eventos a cada quadro
  maxPlat = Math.max(maxPlat, s.platforms.length); maxItems = Math.max(maxItems, s.items.length);
  if (i % (120 * 60 * 5) === 0) { gc(); marks[`${i / (120 * 60)} min`] = {heapMB: mb(), metros: metersOf(s), plataformas: s.platforms.length}; }
}
console.log(JSON.stringify({
  node: process.version,
  passo_us_por_passo: +(ns / 1000).toFixed(2),
  custo_por_quadro_60hz_us: +(2 * ns / 1000).toFixed(2),
  sessao_30min: {fim: s.mode, metros: metersOf(s), heap_inicial_MB: heap0, marcas: marks, max_plataformas_vivas: maxPlat, max_itens_vivos: maxItems},
}, null, 1));
