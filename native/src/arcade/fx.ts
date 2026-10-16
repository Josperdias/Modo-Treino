import type {SimEvent} from './core/types.ts';

/** Efeitos visuais (partículas, tremor, clarão). Só enfeite: nunca influencia a simulação. */
export type Particle = {x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number};

export type Fx = {
  list: Particle[];
  shake: number;
  flash: number;
  flashColor: string;
  rnd: number;
};

export const MAX_PARTICLES = 160;

export function makeFx(): Fx {
  return {list: [], shake: 0, flash: 0, flashColor: '#ffe59e', rnd: 123456789};
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

export function onEvents(fx: Fx, events: readonly SimEvent[]) {
  for (const e of events) {
    if (e.t === 'land') {
      burst(fx, e.x, e.y, LAND_COLOR[e.plat] || '#aa8fff', e.plat === 'spring' ? 15 : 5);
      if (e.plat === 'spring') { fx.flash = 0.22; fx.flashColor = '#ffe59e'; }
    } else if (e.t === 'collect') {
      burst(fx, e.x, e.y, '#ffe48a', 10);
    } else if (e.t === 'break') {
      burst(fx, e.x, e.y, '#ff5b9e', 12, 90);
    } else if (e.t === 'level') {
      fx.flash = 0.3; fx.flashColor = '#5ef5e3';
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
}
