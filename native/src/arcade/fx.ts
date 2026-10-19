import type {SimEvent, WorldId} from './core/types.ts';

/** Efeitos visuais (partículas, tremor, clarão). Só enfeite: nunca influencia a simulação. */
export type Particle = {x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number};

/** Anel que se abre (abate, portal, recuperação). */
export type Ring = {x: number; y: number; age: number; max: number; color: string; r: number};
/** Texto flutuante ("+60"). */
export type Pop = {x: number; y: number; age: number; max: number; color: string; text: string};

export type Fx = {
  list: Particle[];
  rings: Ring[];
  pops: Pop[];
  shake: number;
  flash: number;
  flashColor: string;
  rnd: number;
  /** Mundo anterior e quanto da transição (1 → 0) ainda falta: o fundo antigo some por cima do novo. */
  worldFrom: WorldId | null;
  worldFade: number;
};

export const MAX_PARTICLES = 160;
export const MAX_RINGS = 8;
export const MAX_POPS = 6;

export function makeFx(): Fx {
  return {list: [], rings: [], pops: [], shake: 0, flash: 0, flashColor: '#ffe59e', rnd: 123456789, worldFrom: null, worldFade: 0};
}

function r(fx: Fx): number {
  fx.rnd = (Math.imul(fx.rnd, 1664525) + 1013904223) >>> 0;
  return fx.rnd / 4294967296;
}

function burst(fx: Fx, x: number, y: number, color: string, count: number, spread = 115) {
  for (let i = 0; i < count && fx.list.length < MAX_PARTICLES; i++) {
    fx.list.push({
      x, y,
      vx: (r(fx) * 2 - 1) * spread,
      vy: -30 + r(fx) * 185,
      life: 0.28 + r(fx) * 0.37,
      max: 0.65,
      color,
      size: r(fx) < 0.5 ? 3 : 5,
    });
  }
}

const LAND_COLOR: Record<string, string> = {spring: '#ffdc7b', fragile: '#ff5b9e', moving: '#59dcd6'};

const KIND_COLOR: Record<string, string> = {shield: '#51ecff', boost: '#ffe36c', jet: '#ff7a95', heart: '#ff3d6e', flag: '#ffe36c', tape: '#ffe48a'};
const ENEMY_COLOR: Record<string, string> = {drone: '#d889ff', zigzag: '#7aa0ff', turret: '#f5b15e', orb: '#28d8fd', guardian: '#ff4dac'};

function ring(fx: Fx, x: number, y: number, color: string, r = 70, max = 0.5) {
  if (fx.rings.length < MAX_RINGS) fx.rings.push({x, y, age: 0, max, color, r});
}
function pop(fx: Fx, x: number, y: number, text: string, color: string) {
  if (fx.pops.length < MAX_POPS) fx.pops.push({x, y, age: 0, max: 0.9, color, text});
}

export function onEvents(fx: Fx, events: readonly SimEvent[], world?: WorldId) {
  for (const e of events) {
    if (e.t === 'land') {
      burst(fx, e.x, e.y, LAND_COLOR[e.plat] || '#aa8fff', e.plat === 'spring' ? 15 : 5);
      if (e.plat === 'spring') { fx.flash = 0.22; fx.flashColor = '#ffe59e'; }
    } else if (e.t === 'collect') {
      burst(fx, e.x, e.y, '#ffe48a', 10);
    } else if (e.t === 'break') {
      burst(fx, e.x, e.y, '#ff5b9e', 12, 90);
    } else if (e.t === 'pickup') {
      burst(fx, e.x, e.y, KIND_COLOR[e.kind] || '#ffffff', 14);
      ring(fx, e.x, e.y, KIND_COLOR[e.kind] || '#ffffff', 46, 0.4);
    } else if (e.t === 'hit') {
      if (e.blocked) { burst(fx, e.x, e.y, '#51ecff', 8); ring(fx, e.x, e.y, '#51ecff', 40, 0.3); }
      else { burst(fx, e.x, e.y, '#ff5470', 18); fx.shake = 0.24; fx.flash = 0.3; fx.flashColor = '#ff2d5a'; }
    } else if (e.t === 'kill') {
      burst(fx, e.x, e.y, ENEMY_COLOR[e.kind] || '#ffffff', e.kind === 'guardian' ? 26 : 14, 150);
      burst(fx, e.x, e.y, '#ffffff', 6, 90);
      ring(fx, e.x, e.y, ENEMY_COLOR[e.kind] || '#ffffff', e.kind === 'guardian' ? 120 : 64, 0.45);
      pop(fx, e.x, e.y + 24, e.kind === 'guardian' ? '+240' : '+60', '#ffe36c');
      if (e.kind === 'guardian') fx.shake = 0.3;
    } else if (e.t === 'shoot') {
      if (e.own) burst(fx, e.x, e.y - 6, '#62fff1', 3, 50);
    } else if (e.t === 'portal') {
      fx.flash = 0.5; fx.flashColor = '#9bfbff'; fx.shake = 0.2;
      ring(fx, e.x, e.y, '#88fffd', 220, 0.9);
      ring(fx, e.x, e.y, '#c58cff', 150, 0.7);
      burst(fx, e.x, e.y, '#88fffd', 28, 190);
      fx.worldFrom = world ?? null; fx.worldFade = 1;
      pop(fx, e.x, e.y + 40, '+150', '#9bfbff');
    } else if (e.t === 'revive') {
      fx.flash = 0.4; fx.flashColor = '#fff3b0';
      ring(fx, e.x, e.y + 40, '#ffe36c', 140, 0.7);
      burst(fx, e.x, e.y + 20, '#ffe36c', 22, 150);
    } else if (e.t === 'over') {
      fx.shake = 0.22;
    }
  }
}

export function updateFx(fx: Fx, dt: number) {
  let n = 0;
  for (let i = 0; i < fx.list.length; i++) {
    const p = fx.list[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 250 * dt;
    fx.list[n++] = p;
  }
  fx.list.length = n;
  fx.shake = Math.max(0, fx.shake - dt);
  fx.flash = Math.max(0, fx.flash - dt);
  n = 0;
  for (let i = 0; i < fx.rings.length; i++) { const r = fx.rings[i]; r.age += dt; if (r.age < r.max) fx.rings[n++] = r; }
  fx.rings.length = n;
  n = 0;
  for (let i = 0; i < fx.pops.length; i++) { const q = fx.pops[i]; q.age += dt; q.y += 38 * dt; if (q.age < q.max) fx.pops[n++] = q; }
  fx.pops.length = n;
  if (fx.worldFade > 0) fx.worldFade = Math.max(0, fx.worldFade - dt / 1.1);
}
