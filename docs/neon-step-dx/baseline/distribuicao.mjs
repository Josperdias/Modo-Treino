// Compara a DISTRIBUIÇÃO DE PLATAFORMAS do protótipo (addPlatform) com a do motor novo.
// Uso: servir arcade/fonte/legado-web (python3 -m http.server 8766 -d arcade/fonte/legado-web) e rodar
//   node docs/neon-step-dx/baseline/distribuicao.mjs http://localhost:8766/index.html > resultado-distribuicao.json
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const url = process.argv[2] || 'http://localhost:8766/index.html';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SEEDS = 40, PER_SEED = 1500;

// ---- protótipo
const b = await chromium.launch();
const pg = await b.newPage();
await pg.goto(url);
await pg.waitForTimeout(600);
const legacy = await pg.evaluate(({SEEDS, PER_SEED}) => {
  window.requestAnimationFrame = () => 0;
  const seed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const runs = [];
  for (let sd = 1; sd <= SEEDS; sd++) {
    Math.random = seed(sd); prepare();
    state.time = 1e4; state.worldStartTime = 0; // sem a trava de tempo: mede só a altitude
    state.platforms = [state.platforms[0]]; state.lastY = 90; state.lastX = 210;
    for (let i = 0; i < PER_SEED; i++) addPlatform();
    runs.push(state.platforms.map(p => ({x: p.x, y: p.y, w: p.w, t: p.type})));
  }
  return runs;
}, {SEEDS, PER_SEED});
await b.close();

// ---- motor novo
const {makeGen, generateUntil} = await import(join(ROOT, 'native/src/arcade/core/worldgen.ts'));
const fresh = [];
for (let sd = 1; sd <= SEEDS; sd++) {
  const g = makeGen(sd);
  const out = {platforms: [], items: []};
  generateUntil(g, out, 90 + 12000 * 10); // bem acima de PER_SEED plataformas
  fresh.push([{x: 210, y: 90, w: 118, t: 'start'}, ...out.platforms.map(p => ({x: p.x, y: p.y, w: p.w, t: p.type, pat: p.pattern}))]);
}

const BANDS = [[0, 70], [70, 145], [145, 245], [245, 360], [360, 1e9]];
function stats(rs) {
  const rows = BANDS.map(([a, z]) => {
    const dx = [], gap = [], w = [], types = {}, flips = [], runs = [];
    let n = 0;
    for (const r of rs) {
      const s = [...r].sort((p, q) => p.y - q.y);
      let run = 0, dir = 0;
      for (let i = 1; i < s.length; i++) {
        const m = (s[i].y - 90) / 10;
        if (m < a || m >= z) continue;
        n++;
        const ddx = s[i].x - s[i - 1].x, ddy = s[i].y - s[i - 1].y;
        if (ddy > 0) { dx.push(Math.abs(ddx)); gap.push(ddy); }
        w.push(s[i].w);
        types[s[i].t] = (types[s[i].t] || 0) + 1;
        if (ddy > 0 && ddx !== 0) { const d = Math.sign(ddx); if (d === dir) run++; else { if (run) runs.push(run); run = 1; dir = d; } }
        if (i > 1) { const pdx = s[i - 1].x - s[i - 2].x; if (ddx * pdx !== 0) flips.push(ddx * pdx < 0 ? 1 : 0); }
      }
    }
    const mean = v => v.reduce((x, y) => x + y, 0) / (v.length || 1);
    const sd = v => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); };
    const pct = (v, f) => +(100 * v.filter(f).length / (v.length || 1)).toFixed(1);
    return {
      faixa_m: `${a}-${z > 1e6 ? '∞' : z}`, plataformas: n,
      degrau_medio: +mean(gap).toFixed(1), degrau_dp: +sd(gap).toFixed(1), degrau_max: +Math.max(...gap).toFixed(0),
      desvio_lateral_medio: +mean(dx).toFixed(1), lateral_dp: +sd(dx).toFixed(1),
      pct_lateral_maior_120: pct(dx, v => v > 120),
      pct_inversao_de_lado: +(100 * mean(flips)).toFixed(1),
      sequencia_media_mesmo_lado: +mean(runs).toFixed(2),
      pct_sequencias_3_ou_mais: pct(runs, v => v >= 3),
      largura_media: +mean(w).toFixed(1), largura_min: Math.min(...w),
      tipos_pct: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, +(100 * v / n).toFixed(1)])),
    };
  });
  return rows;
}
console.log(JSON.stringify({sementes: SEEDS, protótipo: stats(legacy), novo: stats(fresh)}, null, 1));
