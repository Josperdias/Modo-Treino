import {GEN, LEVELS, PHYS, PICKUP, SCORE} from '../data/neon.ts';
import {jumpSpeed, landHalfWidth, platformX, vxMax, wrapX} from './physics.ts';
import {generateUntil, makeGen, metersAt, type Out} from './worldgen.ts';
import type {Input, Item, Platform, Sim} from './types.ts';

/** Fração da altura da tela, a partir de baixo, onde fica a plataforma inicial. */
const START_SCREEN_FRAC = 0.14;

export function levelAt(meters: number): number {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) if (meters >= LEVELS[i].from) lv = i + 1;
  return lv;
}

export function levelName(level: number): string {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))].name;
}

/** Cria uma partida. `viewH` = altura visível em unidades (690 no protótipo; maior em telas altas). */
export function createSim(seed: number, viewH = 690): Sim {
  const gen = makeGen(seed);
  const start: Platform = {
    id: 0,
    x: PHYS.START_X,
    y: PHYS.START_Y,
    w: PHYS.START_W,
    type: 'start',
    phase: 0,
    speed: 0,
    shift: 0,
    broken: false,
    pattern: 'start',
  };
  const camera = PHYS.START_Y - START_SCREEN_FRAC * viewH;
  const sim: Sim = {
    seed,
    tick: 0,
    time: 0,
    mode: 'playing',
    player: {
      x: PHYS.START_X,
      y: PHYS.START_Y,
      vx: 0,
      // Como no protótipo: a partida começa com o primeiro salto já em curso.
      vy: PHYS.JUMP,
      px: PHYS.START_X,
      py: PHYS.START_Y,
      landTimer: PHYS.LAND_TIME,
      facing: 1,
    },
    camera,
    prevCamera: camera,
    viewH,
    platforms: [start],
    items: [],
    gen,
    score: 0,
    maxY: PHYS.START_Y,
    tapes: 0,
    combo: 0,
    comboTime: 0,
    level: 1,
    events: [],
  };
  ensureWorld(sim);
  return sim;
}

function ensureWorld(sim: Sim) {
  const out: Out = {platforms: sim.platforms, items: sim.items};
  generateUntil(sim.gen, out, sim.camera + sim.viewH + GEN.LOOKAHEAD);
}

function compact(sim: Sim) {
  const floor = sim.camera - GEN.KEEP_BEHIND;
  let n = 0;
  for (let i = 0; i < sim.platforms.length; i++) {
    const p = sim.platforms[i];
    if (!p.broken && p.y >= floor) sim.platforms[n++] = p;
  }
  sim.platforms.length = n;
  n = 0;
  for (let i = 0; i < sim.items.length; i++) {
    const it = sim.items[i];
    if (!it.hit && it.y >= floor) sim.items[n++] = it;
  }
  sim.items.length = n;
}

/** Um passo fixo (PHYS.STEP). Determinístico: mesmo estado + mesma entrada ⇒ mesmo resultado. */
export function step(sim: Sim, input: Input): void {
  if (sim.mode !== 'playing') return;
  const dt = PHYS.STEP;
  const p = sim.player;
  sim.tick++;
  sim.time = sim.tick * dt;
  p.px = p.x;
  p.py = p.y;
  sim.prevCamera = sim.camera;
  p.landTimer = Math.max(0, p.landTimer - dt);
  sim.comboTime = Math.max(0, sim.comboTime - dt);
  if (sim.comboTime === 0) sim.combo = 0;

  // Horizontal: resposta exponencial ao alvo (independente do dt).
  const axis = Math.max(-1, Math.min(1, input.axis));
  if (axis !== 0) p.facing = axis > 0 ? 1 : -1;
  const target = axis * vxMax(sim.level);
  p.vx += (target - p.vx) * (1 - Math.exp(-PHYS.ACCEL_K * dt));
  p.x = wrapX(p.x + p.vx * dt);

  // Vertical: integração exata para aceleração constante (a altura do salto não depende do dt).
  const y0 = p.y;
  const vy0 = p.vy;
  const y1 = y0 + vy0 * dt - 0.5 * PHYS.G * dt * dt;
  const vy1 = vy0 - PHYS.G * dt;
  p.y = y1;
  p.vy = vy1;

  if (vy1 <= 0) {
    let hit: Platform | null = null;
    for (let i = 0; i < sim.platforms.length; i++) {
      const pl = sim.platforms[i];
      if (pl.broken) continue;
      if (y0 >= pl.y && y1 <= pl.y && Math.abs(p.x - platformX(pl, sim.time)) < landHalfWidth(pl)) {
        if (!hit || pl.y > hit.y) hit = pl;
      }
    }
    if (hit) {
      const drop = y0 - y1;
      const frac = drop > 0 ? (y0 - hit.y) / drop : 1;
      const rem = dt * (1 - frac);
      const v = jumpSpeed(hit.type, false);
      p.y = hit.y + v * rem - 0.5 * PHYS.G * rem * rem;
      p.vy = v - PHYS.G * rem;
      p.landTimer = PHYS.LAND_TIME;
      if (hit.type === 'fragile') {
        hit.broken = true;
        sim.events.push({t: 'break', x: hit.x, y: hit.y});
      }
      sim.events.push({t: 'land', plat: hit.type, x: p.x, y: hit.y});
    }
  }

  // Fitas.
  for (let i = 0; i < sim.items.length; i++) {
    const it: Item = sim.items[i];
    if (it.hit) continue;
    if (Math.abs(p.x - it.x) < PICKUP.HALF_W && Math.abs(p.y + PICKUP.BODY_Y - it.y) < PICKUP.HALF_H) {
      it.hit = true;
      sim.tapes++;
      sim.combo = Math.min(SCORE.COMBO_MAX, sim.combo + 1);
      sim.comboTime = SCORE.COMBO_TIME;
      sim.events.push({t: 'collect', kind: 'tape', x: it.x, y: it.y, combo: sim.combo});
    }
  }

  // Altura, pontos, nível.
  if (p.y > sim.maxY) sim.maxY = p.y;
  const meters = metersAt(sim.maxY);
  sim.score =
    Math.max(0, Math.floor((sim.maxY - PHYS.START_Y) / SCORE.HEIGHT_DIV)) +
    sim.tapes * SCORE.TAPE +
    Math.max(0, sim.combo - 1) * SCORE.COMBO_STEP;
  const lv = levelAt(meters);
  if (lv > sim.level) {
    sim.level = lv;
    sim.events.push({t: 'level', level: lv});
  }

  // A câmera só sobe.
  sim.camera = Math.max(sim.camera, p.y - sim.viewH * PHYS.FOLLOW);
  ensureWorld(sim);
  if (sim.tick % 30 === 0) compact(sim);

  if (p.y < sim.camera - PHYS.FALL_MARGIN) {
    sim.mode = 'over';
    sim.events.push({t: 'over'});
  }
}

/** Metros alcançados (para HUD/recorde). */
export function metersOf(sim: Sim): number {
  return Math.floor(metersAt(sim.maxY));
}

/** Hash curto do estado: testes de determinismo e repetição (fantasma). */
export function hashSim(sim: Sim): string {
  let h = 2166136261;
  const mix = (n: number) => {
    const v = Math.round(n * 1e5) | 0;
    h = Math.imul(h ^ (v & 0xffff), 16777619);
    h = Math.imul(h ^ ((v >>> 16) & 0xffff), 16777619);
  };
  mix(sim.tick);
  mix(sim.player.x);
  mix(sim.player.y);
  mix(sim.player.vx);
  mix(sim.player.vy);
  mix(sim.camera);
  mix(sim.score);
  mix(sim.tapes);
  mix(sim.platforms.length);
  mix(sim.gen.count);
  for (const pl of sim.platforms) { mix(pl.x); mix(pl.y); mix(pl.w); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

