// NEON STEP DX — testes do motor (native/src/arcade/core). Rode: node --test tests/
// O core é TypeScript puro; o Node 22.18+ executa .ts direto (sem build).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = p => import(join(ROOT, 'native/src/arcade/core', p));
const {createSim, step, hashSim, metersOf, levelAt} = await C('sim.ts');
const {advance, makeLoop} = await C('loop.ts');
const {apex, reach, vxMax, platformX} = await C('physics.ts');
const {generateUntil, makeGen, intensityAt, cycleAt, rampAt} = await C('worldgen.ts');
const {validate, canReach, SAFETY} = await C('validate.ts');
const {enemyAt, tri} = await C('enemies.ts');
const {makeBot, botInput, IDEAL, HUMAN} = await C('bot.ts');
const {PHYS, GEN, SCORE, LIFE, COMBAT, POWER, PORTAL, SPAWN, ENEMIES, WORLD_FX, SCORE_M2, PICKUP} = await import(join(ROOT, 'native/src/arcade/data/neon.ts'));

const STEP = PHYS.STEP;
const plat = (o = {}) => ({id: 1, x: 210, y: 300, w: 100, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'stairs', dir: 0, ...o});

/** Partida sem mundo gerado: só as plataformas que o teste colocar. */
function bare(platforms = [], seed = 1) {
  const s = createSim(seed);
  s.platforms.length = 0;
  s.items.length = 0;
  s.enemies.length = 0;
  s.gen.y = 1e9; // trava a geração
  for (const p of platforms) s.platforms.push(p);
  return s;
}

/* ---------- física ---------- */
test('física: ápice teórico do salto = v²/2g = 198,375 (e mola/impulso)', () => {
  assert.equal(apex(690), 198.375);
  assert.ok(Math.abs(apex(835) - 290.5104166) < 1e-6);
  assert.ok(Math.abs(apex(930) - 360.375) < 1e-9);
});

test('física: salto livre atinge o ápice exato (modelo Verlet, sem erro de dt)', () => {
  const s = bare();
  let max = -Infinity;
  for (let i = 0; i < 300; i++) { step(s, {axis: 0}); max = Math.max(max, s.player.y); }
  assert.ok(Math.abs(max - PHYS.START_Y - 198.375) < 1e-6, `ápice ${max - PHYS.START_Y}`);
});

test('física: o ápice depois do POUSO é 198,375 em qualquer altura de plataforma (sub-passo exato)', () => {
  for (const y of [90.3, 133.77, 201.5, 407.123, 1234.567]) {
    const s = bare([plat({y, x: 210, w: 400})]);
    s.player.y = y + 150; s.player.py = s.player.y; s.player.vy = 0; s.player.x = 210;
    let landed = false, max = -Infinity;
    for (let i = 0; i < 600 && max < y + 199; i++) {
      step(s, {axis: 0});
      if (s.events.some(e => e.t === 'land')) landed = true;
      if (landed) max = Math.max(max, s.player.y);
    }
    assert.ok(landed, 'deveria pousar');
    for (let i = 0; i < 200; i++) { step(s, {axis: 0}); max = Math.max(max, s.player.y); if (s.player.vy < 0) break; }
    assert.ok(Math.abs(max - y - 198.375) < 0.02, `plataforma em ${y}: ápice ${max - y}`);
  }
});

test('física: período do salto = 2v/g = 1,15 s', () => {
  const s = bare([plat({y: 90, x: 210, w: 400})]);
  s.player.y = 90; s.player.py = 90; s.player.vy = 690; s.player.landTimer = 0;
  s.events.length = 0;
  const landTicks = [];
  for (let i = 0; i < 1200; i++) {
    step(s, {axis: 0});
    if (s.events.some(e => e.t === 'land')) landTicks.push(s.tick);
    s.events.length = 0;
  }
  assert.ok(landTicks.length >= 2);
  const period = (landTicks[1] - landTicks[0]) * STEP;
  assert.ok(Math.abs(period - 1.15) < 2 * STEP, `período ${period}`);
});

test('física: velocidade horizontal converge ao alvo e volta a zero sem entrada', () => {
  const s = bare([plat({y: 90, x: 210, w: 2000})]);
  s.player.x = 100;
  for (let i = 0; i < 120 * 0.5; i++) step(s, {axis: 1});
  assert.ok(Math.abs(s.player.vx - vxMax(1)) < vxMax(1) * 0.01, `vx ${s.player.vx}`);
  for (let i = 0; i < 120 * 0.8; i++) step(s, {axis: 0});
  assert.ok(Math.abs(s.player.vx) < 1);
  // entrada analógica (inclinação): meio eixo = meia velocidade
  const t = bare([plat({y: 90, x: 210, w: 2000})]);
  for (let i = 0; i < 60; i++) step(t, {axis: 0.5});
  assert.ok(Math.abs(t.player.vx - vxMax(1) / 2) < 3);
});

test('física: dá a volta pela lateral (neon)', () => {
  const s = bare();
  s.player.x = 5;
  let max = 0;
  for (let i = 0; i < 120; i++) { step(s, {axis: -1}); max = Math.max(max, s.player.x); }
  assert.ok(max > 400, `não reapareceu do outro lado (máx ${max})`);
});

/* ---------- passo fixo ---------- */
test('passo fixo: o resultado não depende da taxa de quadros (30/60/120/144/240 Hz)', () => {
  const run = hz => {
    const s = createSim(42);
    const loop = makeLoop();
    const bot = makeBot(IDEAL, 1);
    // entrada fixa por quadro: o robô decide por passo, então usamos um padrão fixo simples
    let f = 0;
    while (s.tick < 1200 && s.mode === 'playing') {
      const input = {axis: Math.sin(Math.floor(s.tick / 40)) > 0 ? 1 : -1};
      advance(s, loop, input, 1 / hz);
      f++;
      assert.ok(f < 100000);
    }
    return hashSim(s);
  };
  const ref = run(120);
  for (const hz of [30, 60, 144, 240]) assert.equal(run(hz), ref, `${hz} Hz`);
});

test('passo fixo: quadro gigante (tranco) não vira espiral — no máximo 24 passos', () => {
  const s = createSim(3);
  const before = s.tick;
  advance(s, makeLoop(), {axis: 0}, 5);
  assert.ok(s.tick - before <= 24);
});

/* ---------- determinismo ---------- */
test('determinismo: mesma semente + mesmas entradas ⇒ mesmo estado; sementes diferentes ⇒ mundos diferentes', () => {
  const play = seed => {
    const s = createSim(seed);
    const bot = makeBot(HUMAN, 9);
    for (let i = 0; i < 5000 && s.mode === 'playing'; i++) step(s, botInput(s, bot));
    return hashSim(s);
  };
  assert.equal(play(7), play(7));
  assert.notEqual(play(7), play(8));
});

test('determinismo: o mundo não depende da altura da tela (viewH) nem da câmera', () => {
  const a = createSim(11, 690), b = createSim(11, 910);
  for (const s of [a, b]) generateUntil(s.gen, {platforms: s.platforms, items: s.items, enemies: s.enemies}, 6000);
  const n = Math.min(a.platforms.length, b.platforms.length);
  for (let i = 0; i < n; i++) {
    assert.equal(a.platforms[i].x, b.platforms[i].x);
    assert.equal(a.platforms[i].y, b.platforms[i].y);
    assert.equal(a.platforms[i].type, b.platforms[i].type);
  }
  const m = Math.min(a.enemies.length, b.enemies.length);
  assert.ok(m > 5, 'deveria haver inimigos');
  for (let i = 0; i < m; i++) assert.deepEqual([a.enemies[i].kind, a.enemies[i].x0, a.enemies[i].y0], [b.enemies[i].kind, b.enemies[i].x0, b.enemies[i].y0]);
});

/* ---------- geração do mundo ---------- */
function worldOf(seed, untilM = 3000) {
  const g = makeGen(seed);
  const out = {platforms: [plat({id: 0, x: 210, y: 90, w: 118, type: 'start', pattern: 'start'})], items: [], enemies: []};
  generateUntil(g, out, 90 + untilM * 10);
  return out;
}

test('mundo: TODA plataforma é alcançável com folga (300 sementes × 3000 m) e nada se sobrepõe', () => {
  let total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const w = worldOf(seed);
    const problems = validate(w.platforms);
    total += w.platforms.length;
    assert.deepEqual(problems.slice(0, 3), [], `semente ${seed}`);
  }
  assert.ok(total > 50000);
});

test('mundo: o validador pega salto impossível e plataformas sobrepostas; conta a volta pela lateral', () => {
  const a = plat({id: 1, y: 100, x: 100});
  assert.ok(!canReach(a, plat({id: 2, y: 100 + 190, x: 100})), 'subida de 190 passa de 86% do ápice');
  assert.ok(canReach(a, plat({id: 3, y: 100 + 100, x: 100 + 600})), 'dar a volta pela lateral: 600 de distância são 100 do outro lado');
  assert.ok(canReach(a, plat({id: 4, y: 100 + 110, x: 100 + 150})));
  assert.ok(validate([a, plat({id: 6, y: 110, x: 105})]).some(p => p.reason === 'sobreposta'));
  assert.equal(validate([a, plat({id: 5, y: 190, x: 100 + 400})]).length, 0, 'x longe mas alcançável pela volta');
  assert.equal(validate([a, plat({id: 5, y: 100 + 250, x: 100})]).length, 1, 'alto demais sem mola');
  // mola: alcança bem mais alto
  assert.ok(canReach(plat({type: 'spring', y: 100}), plat({id: 8, y: 100 + 260, x: 110})));
});

test('mundo: degraus respeitam os limites de projeto (nunca > 86 % do ápice)', () => {
  const limit = apex(PHYS.JUMP) * SAFETY.RISE;
  for (let seed = 1; seed <= 50; seed++) {
    const w = worldOf(seed, 2000);
    const sorted = [...w.platforms].sort((p, q) => p.y - q.y);
    for (let i = 1; i < sorted.length; i++) {
      const dy = sorted[i].y - sorted[i - 1].y;
      const prev = sorted[i - 1];
      // entre plataformas consecutivas (exceto da mola): subida segura
      if (prev.type !== 'spring' && dy > 0 && dy < 200) assert.ok(dy <= limit + 1e-9, `dy ${dy}`);
    }
  }
});

test('mundo: aquecimento — nada de móvel/quebrável/mola nos primeiros 14 m', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const w = worldOf(seed, 40);
    for (const p of w.platforms) if (p.y < 90 + GEN.WARMUP_M * 10) assert.ok(['start', 'normal'].includes(p.type), `${p.type} @${p.y}`);
  }
});

test('mundo: variedade — todos os "humores" aparecem e o mapa não repete fórmula', () => {
  const seen = {};
  for (let seed = 1; seed <= 60; seed++) {
    const g = makeGen(seed);
    const out = {platforms: [], items: [], enemies: []};
    for (let i = 0; i < 400; i++) { const before = out.platforms.length; generateUntil(g, out, g.y + 1); const pat = out.platforms[before]?.pattern; if (pat) seen[pat] = (seen[pat] || 0) + 1; }
  }
  for (const name of ['chaos', 'cluster', 'drought', 'springPad', 'ladder']) assert.ok(seen[name] > 15, `padrão ${name} quase não aparece: ${seen[name]}`);
});

test('mundo: estilo Doodle Jump — X aleatório no campo todo, vãos irregulares, sem escadinha previsível', () => {
  let n = 0, big = 0, sumDx = 0, sameDir = 0, trip = 0, gaps = [];
  for (let seed = 1; seed <= 60; seed++) {
    const w = worldOf(seed, 1500).platforms.filter(p => p.pattern === 'chaos').sort((p, q) => p.y - q.y);
    for (let i = 2; i < w.length; i++) {
      const dx1 = w[i - 1].x - w[i - 2].x, dx2 = w[i].x - w[i - 1].x;
      const d = Math.abs(dx2);
      n++; sumDx += d; if (d > 150) big++;
      trip++; if (Math.sign(dx1) === Math.sign(dx2)) sameDir++;
      gaps.push(w[i].y - w[i - 1].y);
    }
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  assert.ok(sumDx / n > 100, `salto lateral médio ${sumDx / n}`);
  assert.ok(big / n > 0.25, `saltos laterais > 150: ${big / n}`);
  assert.ok(Math.abs(sameDir / trip - 1 / 3) < 0.08, `sem tendência de direção (sorteio puro dá 1/3): ${sameDir / trip}`);
  assert.ok(sd > 22, `vãos irregulares (desvio ${sd})`);
  assert.ok(Math.min(...gaps) < 70 && Math.max(...gaps) > 150, 'há saltinhos curtos e esticões');
});

test('mundo: tipos por altitude — móvel a partir de 12 m, quebrável 20 m, mola 34 m, e todos aparecem cedo', () => {
  const first = {moving: Infinity, fragile: Infinity, spring: Infinity};
  let miss = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = worldOf(seed, 400);
    const f = {};
    for (const p of w.platforms) if (first[p.type] !== undefined) f[p.type] = Math.min(f[p.type] ?? Infinity, (p.y - 90) / 10);
    for (const t of Object.keys(first)) { first[t] = Math.min(first[t], f[t] ?? Infinity); if (t !== 'spring' && (f[t] ?? Infinity) > 160) miss++; }
  }
  assert.ok(first.moving >= 11 && first.fragile >= 19 && first.spring >= 33, JSON.stringify(first));
  assert.ok(miss <= 16, `tipo demorando a aparecer em ${miss} casos`);
});

test('mundo: ritmo — a intensidade cresce com a altitude e ainda oscila', () => {
  assert.ok(rampAt(90) === 0 && rampAt(90 + 5000) > 0.9);
  const samples = [];
  for (let y = 90 + 5000; y < 90 + 5000 + GEN.CYCLE; y += 100) samples.push(intensityAt(y));
  assert.ok(Math.max(...samples) > 0.9 && Math.min(...samples) < 0.9);
  assert.ok(cycleAt(90) < cycleAt(90 + GEN.CYCLE / 2));
});

test('mundo: distribuição lateral equilibrada (sem encostar sempre numa borda) e fitas presentes', () => {
  let left = 0, right = 0, n = 0, tapes = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const w = worldOf(seed, 1500);
    for (const p of w.platforms) { n++; if (p.x < 210) left++; else right++; }
    tapes += w.items.filter(i => i.kind === 'tape').length;
  }
  assert.ok(Math.abs(left - right) / n < 0.06, `${left} × ${right}`);
  assert.ok(tapes / n > 0.12 && tapes / n < 0.6, `fitas/plataforma ${tapes / n}`);
});

/* ---------- jogabilidade provada por robôs ---------- */
test('robô IDEAL nunca cai em 25 sementes × 240 s (o jogo é sempre possível); no máximo 2 morrem por dano', () => {
  let byDamage = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const s = createSim(seed), bot = makeBot(IDEAL, seed);
    let cause = '';
    while (s.mode === 'playing' && s.tick < 120 * 240) { step(s, botInput(s, bot)); for (const e of s.events) if (e.t === 'over') cause = e.cause; s.events.length = 0; }
    assert.notEqual(cause, 'fall', `semente ${seed} caiu aos ${s.time.toFixed(1)} s (${metersOf(s)} m)`);
    if (s.mode === 'over') byDamage++;
    else assert.ok(metersOf(s) > 150, `só ${metersOf(s)} m`);
  }
  assert.ok(byDamage <= 3, `${byDamage}/25 morreram por dano`);
});

test('robô HUMANO (150 ms de reação, erro de ~14 un.) progride bem e às vezes cai: o jogo é difícil mas justo', () => {
  let died = 0; const med = [];
  for (let seed = 1; seed <= 25; seed++) {
    const s = createSim(seed), bot = makeBot(HUMAN, seed);
    while (s.mode === 'playing' && s.tick < 120 * 240) step(s, botInput(s, bot));
    if (s.mode === 'over') died++;
    med.push(metersOf(s));
  }
  med.sort((a, b) => a - b);
  assert.ok(died <= 22, `${died}/25 caíram`);
  assert.ok(med[12] > 800, `mediana ${med[12]} m`);
});

test('robô DESCUIDADO (250 ms, erro de ~30 un.) quase sempre cai: há desafio real, mas dá para progredir', () => {
  let died = 0, med = [];
  for (let seed = 1; seed <= 30; seed++) {
    const s = createSim(seed), bot = makeBot({every: 30, noise: 30, lapse: 0.1}, seed);
    while (s.mode === 'playing' && s.tick < 120 * 300) step(s, botInput(s, bot));
    if (s.mode === 'over') died++;
    med.push(metersOf(s));
  }
  assert.ok(died >= 20, `${died}/30 caíram`);
  med.sort((a, b) => a - b);
  assert.ok(med[15] > 150, `mediana ${med[15]} m`);
});

/* ---------- regras ---------- */
test('mola lança a 930; plataforma quebrável some depois do pouso e emite evento', () => {
  const s = bare([plat({type: 'spring', y: 200, w: 300})]);
  s.player.y = 210; s.player.py = 210; s.player.vy = -10;
  let e;
  for (let i = 0; i < 20 && !e; i++) { step(s, {axis: 0}); e = s.events.find(x => x.t === 'land'); }
  assert.equal(e.plat, 'spring');
  assert.ok(s.player.vy > 900 && s.player.vy <= 930);

  const f = bare([plat({type: 'fragile', y: 200, w: 300})]);
  f.player.y = 210; f.player.py = 210; f.player.vy = -10;
  for (let i = 0; i < 20; i++) step(f, {axis: 0});
  assert.ok(f.events.some(x => x.t === 'break'));
  assert.ok(f.platforms[0].broken);
});

test('fitas: coleta, combo até x5 e fórmula de pontos do protótipo', () => {
  const s = bare([plat({y: 90, w: 600})]);
  for (let k = 0; k < 6; k++) s.items.push({id: 10 + k, kind: 'tape', x: 210, y: 90 + 60 + k * 5, phase: 0, hit: false});
  s.player.y = 90; s.player.py = 90; s.player.vy = 300;
  for (let i = 0; i < 6; i++) step(s, {axis: 0});
  assert.equal(s.tapes, 6);
  assert.equal(s.combo, SCORE.COMBO_MAX);
  const base = Math.floor((s.maxY - 90) / SCORE.HEIGHT_DIV);
  assert.equal(s.score, base + 6 * SCORE.TAPE + (SCORE.COMBO_MAX - 1) * SCORE.COMBO_STEP);
});

test('fim de jogo: cair abaixo da câmera encerra e o motor para de avançar', () => {
  const s = bare();
  s.player.vy = -200;
  let guard = 0;
  while (s.mode === 'playing' && guard++ < 5000) step(s, {axis: 0});
  assert.equal(s.mode, 'over');
  assert.ok(s.events.some(e => e.t === 'over'));
  const tick = s.tick;
  step(s, {axis: 0});
  assert.equal(s.tick, tick);
});

test('níveis por altitude (igual ao protótipo)', () => {
  assert.deepEqual([0, 69, 70, 145, 245, 360, 999].map(levelAt), [1, 1, 2, 3, 4, 5, 5]);
});

test('plataforma móvel: posição é função pura do tempo', () => {
  const p = plat({type: 'moving', x: 200, shift: 40, speed: 1.5, phase: 0.3});
  assert.equal(platformX(p, 1.25), platformX(p, 1.25));
  assert.ok(Math.abs(platformX(p, 0) - (200 + Math.sin(0.3) * 40)) < 1e-12);
  assert.equal(platformX(plat({x: 99}), 5), 99);
});

test('alcance físico: a 140 un. de altura o herói cobre > 200 un. na horizontal', () => {
  assert.ok(reach(140, 690, 1) > 200);
  assert.equal(reach(250, 690, 1), -1); // passa do ápice
});

/* ---------- sprites (metadados sem tocar nos originais) ---------- */
test('sprites: cópias do app são idênticas byte a byte às originais e o atlas confere', () => {
  const src = join(ROOT, 'arcade/fonte/legado-web/assets/sprites');
  const dst = join(ROOT, 'native/assets/arcade/sprites');
  const meta = JSON.parse(readFileSync(join(ROOT, 'native/src/arcade/data/sprites.json'), 'utf8'));
  assert.equal(readdirSync(dst).length, 16);
  for (const who of ['josperd', 'camila']) {
    const frames = meta.characters[who].frames;
    assert.equal(frames.length, 8);
    for (const f of frames) {
      const a = readFileSync(join(src, f.file)), b = readFileSync(join(dst, f.file));
      assert.ok(a.equals(b), `${f.file} difere do original`);
      assert.equal(createHash('sha256').update(b).digest('hex'), f.sha256);
      assert.ok(f.pivotX > 0 && f.pivotX < f.w && f.pivotY === f.bbox[3] && f.pivotY <= f.h);
    }
  }
  assert.deepEqual(meta.nativeFacing, {josperd: 1, camila: -1});
});
