// Baseline do protótipo web do NEON STEP DX (Fase 0). Só LÊ o protótipo; não altera nada.
// Uso: servir a pasta projeto_web/ (python3 -m http.server 8765) e rodar:
//   node docs/neon-step-dx/baseline/baseline-web.mjs http://localhost:8765/index.html > resultado.json
// Um robô simples joga o protótipo com passo fixo (30/60/120 Hz) e semente fixa, sem áudio.
import {chromium} from 'playwright';
const url = process.argv[2] || 'http://localhost:8765/index.html';
const b = await chromium.launch();
const pg = await b.newPage({viewport: {width: 393, height: 852}});
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(url);
await pg.waitForTimeout(800);
const out = await pg.evaluate(() => {
  window.requestAnimationFrame = () => 0; // desliga o laço real: simulação síncrona
  const seed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function run(sd, hz, maxSec) {
    Math.random = seed(sd); prepare(); state.mode = 'playing'; state.player.vy = 690;
    const dt = 1 / hz, ev = []; let lastW = 'neon', lastRev = 0;
    for (let i = 0; i < hz * maxSec && state.mode === 'playing'; i++) {
      const p = state.player, rem = p.vy > 0 ? p.vy * p.vy / 2400 : 0; let best = null;
      for (const pl of state.platforms) {
        if (pl.broken || pl.y > p.y + rem - 4 || pl.y < p.y - 240 || Math.abs(platformX(pl) - p.x) > 170) continue;
        if (!best || pl.y > best.y) best = pl;
      }
      let tx = best ? platformX(best) : 210; if (isPaper()) tx = Math.min(151, Math.max(38, tx));
      if (state.portal && state.portal.y > p.y - 20 && state.portal.y < p.y + 230 && Math.abs(state.portal.x - tx) < 110) tx = state.portal.x;
      movement.left = tx < p.x - 6; movement.right = tx > p.x + 6;
      update(dt);
      if (state.world !== lastW) { ev.push(['mundo', state.world, Math.round(state.time)]); lastW = state.world; }
      if (state.revives !== lastRev) { ev.push(['checkpoint', Math.round(state.time)]); lastRev = state.revives; }
    }
    return {semente: sd, hz, fim: state.mode, segundos: Math.round(state.time), metros: Math.floor((state.maxY - 90) / 10), pontos: state.score, nivel: state.level, eventos: ev};
  }
  const corridas = [];
  for (const hz of [30, 60, 120]) for (const sd of [1, 2, 3]) corridas.push(run(sd, hz, 420));
  // Altura do 1º salto por frequência (mesma física, só muda o dt)
  const salto = {};
  for (const hz of [30, 60, 120, 240]) {
    prepare(); state.mode = 'playing'; const p = state.player; p.vy = 690; p.y = 90; let max = 90;
    state.platforms = []; state.lastY = 1e9; // sem plataformas: salto livre
    for (let i = 0; i < hz * 2; i++) { p.vy -= 1200 / hz; p.y += p.vy / hz; max = Math.max(max, p.y); }
    salto[hz] = +(max - 90).toFixed(1);
  }
  Math.random = seed(5); prepare(); state.mode = 'playing'; state.player.vy = 690;
  let tu = 0, tr = 0, fr = 0;
  for (let i = 0; i < 1500 && state.mode === 'playing'; i++) {
    const p = state.player; let best = null; for (const pl of state.platforms) { if (pl.y <= p.y) continue; if (!best || pl.y < best.y) best = pl; }
    movement.left = best && platformX(best) < p.x - 6; movement.right = best && platformX(best) > p.x + 6;
    let t0 = performance.now(); update(1 / 60); tu += performance.now() - t0; fr++;
    t0 = performance.now(); render(); tr += performance.now() - t0;
  }
  return {corridas, apice_do_salto_por_hz: salto, custo_por_quadro_ms_desktop: {update: +(tu / fr).toFixed(3), render: +(tr / fr).toFixed(3), quadros: fr}};
});
console.log(JSON.stringify({...out, erros_js: errs}, null, 1));
await b.close();
