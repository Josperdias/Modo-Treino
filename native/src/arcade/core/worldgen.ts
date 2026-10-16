import {FIELD_W, GEN, PATTERN_MIN_INTENSITY, PATTERN_WEIGHTS, PHYS, PICKUP} from '../data/neon.ts';
import {chance, int, makeRng, next, range, weighted} from './rng.ts';
import type {Gen, Item, PatternName, Platform, PlatformType} from './types.ts';

/**
 * Gerador do mundo por PADRÕES (substitui o sorteio plataforma a plataforma do protótipo, que
 * produzia zigue-zague aleatório sem ritmo). Cada padrão é uma frase curta e legível:
 * degraus, torre, plataforma larga de respiro, bifurcação, móveis, zigue-zague, mola e quebráveis.
 *
 * Garantias (provadas em `validate.ts` + testes):
 * - toda plataforma é alcançável de alguma anterior com folga (nunca exige o limite físico);
 * - o mundo depende só da semente e da ordem dos padrões, nunca do tempo, da câmera ou do dt.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const clampX = (x: number) => clamp(x, GEN.MARGIN_X, FIELD_W - GEN.MARGIN_X);

export type Out = {platforms: Platform[]; items: Item[]};

export function makeGen(seed: number): Gen {
  return {
    rng: makeRng(seed ^ 0x5bd1e995),
    x: PHYS.START_X,
    y: PHYS.START_Y,
    count: 0,
    last: 'start',
    repeat: 0,
    sinceWide: 0,
    nextId: 1,
  };
}

/** Altitude em metros (mesma conta do protótipo). */
export function metersAt(y: number): number {
  return Math.max(0, (y - PHYS.START_Y) / 10);
}

/** Rampa de dificuldade 0..1 por altitude (determinística, independe do tempo). */
export function rampAt(y: number): number {
  return clamp(metersAt(y) / GEN.RAMP_M, 0, 1);
}

/** Ritmo: 0 = respiro, 1 = pico. Começa no respiro e oscila com período GEN.CYCLE. */
export function cycleAt(y: number): number {
  const phase = ((y - PHYS.START_Y) / GEN.CYCLE) * Math.PI * 2 + Math.PI;
  const wave = 0.5 + 0.5 * Math.cos(phase);
  return GEN.CALM_FLOOR + (1 - GEN.CALM_FLOOR) * wave;
}

/** Intensidade que decide padrões e tamanhos (rampa × ritmo). */
export function intensityAt(y: number): number {
  return rampAt(y) * cycleAt(y);
}

function gapFor(g: Gen, d: number, scale = 1): number {
  const lo = lerp(GEN.GAP_MIN, GEN.GAP_MIN_HARD, d);
  const hi = lerp(GEN.GAP_MAX, GEN.GAP_MAX_HARD, d);
  return range(g.rng, lo, hi) * scale;
}

function widthFor(g: Gen, span: readonly number[], d: number): number {
  return Math.round(lerp(span[0], span[1], d) + range(g.rng, -5, 5));
}

function put(
  g: Gen,
  out: Out,
  pattern: PatternName,
  x: number,
  y: number,
  w: number,
  type: PlatformType,
  moving?: {shift: number; speed: number},
): Platform {
  const p: Platform = {
    id: g.nextId++,
    x,
    y,
    w,
    type,
    phase: moving ? range(g.rng, 0, Math.PI * 2) : 0,
    speed: moving ? moving.speed : 0,
    shift: moving ? moving.shift : 0,
    broken: false,
    pattern,
  };
  out.platforms.push(p);
  return p;
}

function tape(g: Gen, out: Out, x: number, y: number) {
  out.items.push({id: g.nextId++, kind: 'tape', x, y, phase: range(g.rng, 0, Math.PI * 2), hit: false});
}

function maybeTape(g: Gen, out: Out, p: Platform, prob: number = GEN.TAPE_CHANCE) {
  if (p.type === 'moving' || p.type === 'fragile') return;
  if (chance(g.rng, prob)) tape(g, out, p.x, p.y + PICKUP.ABOVE);
}

/** Direção lateral que afasta da borda (evita encurralar o herói num canto). */
function awayFromEdge(g: Gen): 1 | -1 {
  if (g.x < 130) return 1;
  if (g.x > FIELD_W - 130) return -1;
  return next(g.rng) < 0.5 ? -1 : 1;
}

type PatternFn = (g: Gen, d: number, out: Out) => void;

const stairs: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 5);
  let dir = awayFromEdge(g);
  const step = range(g.rng, 48, 92) * (0.85 + 0.3 * d);
  for (let i = 0; i < n; i++) {
    let nx = g.x + dir * step;
    if (nx < GEN.MARGIN_X || nx > FIELD_W - GEN.MARGIN_X) {
      dir = (dir * -1) as 1 | -1;
      nx = g.x + dir * step;
    }
    g.x = clampX(nx);
    g.y += gapFor(g, d);
    maybeTape(g, out, put(g, out, 'stairs', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal'));
  }
};

const tower: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 5);
  for (let i = 0; i < n; i++) {
    g.x = clampX(g.x + range(g.rng, -34, 34));
    g.y += gapFor(g, d, 1.04);
    maybeTape(g, out, put(g, out, 'tower', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal'), 0.3);
  }
};

const wide: PatternFn = (g, d, out) => {
  g.x = clampX(lerp(g.x, FIELD_W / 2, 0.5) + range(g.rng, -26, 26));
  g.y += gapFor(g, 0, 1);
  const p = put(g, out, 'wide', g.x, g.y, widthFor(g, GEN.WIDTH_WIDE, d), 'normal');
  tape(g, out, p.x - 30, p.y + PICKUP.ABOVE);
  tape(g, out, p.x + 30, p.y + PICKUP.ABOVE);
};

const scatter: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 6);
  let vel = 0;
  const lat = 92 * (0.85 + 0.45 * d);
  for (let i = 0; i < n; i++) {
    vel = vel * 0.5 + range(g.rng, -1, 1) * lat;
    vel = clamp(vel, -(105 + 25 * d), 105 + 25 * d);
    let nx = g.x + vel;
    if (nx < GEN.MARGIN_X || nx > FIELD_W - GEN.MARGIN_X) {
      vel = -vel;
      nx = g.x + vel;
    }
    g.x = clampX(nx);
    g.y += gapFor(g, d);
    maybeTape(g, out, put(g, out, 'scatter', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal'));
  }
};

const fork: PatternFn = (g, d, out) => {
  const y = g.y + gapFor(g, d);
  let s = range(g.rng, 92, 122);
  let xl = g.x - s;
  let xr = g.x + s;
  if (xl < GEN.MARGIN_X) { xr += GEN.MARGIN_X - xl; xl = GEN.MARGIN_X; }
  if (xr > FIELD_W - GEN.MARGIN_X) { xl -= xr - (FIELD_W - GEN.MARGIN_X); xr = FIELD_W - GEN.MARGIN_X; }
  xl = clampX(xl);
  s = xr - xl;
  const w = widthFor(g, GEN.WIDTH_NORMAL, d);
  const a = put(g, out, 'fork', xl, y, w, 'normal');
  const b = put(g, out, 'fork', xr, y, w, 'normal');
  // A "estrada de cima" tem fitas; a outra é só caminho: escolha do jogador.
  const rich = chance(g.rng, 0.5) ? a : b;
  tape(g, out, rich.x - 14, rich.y + PICKUP.ABOVE);
  tape(g, out, rich.x + 14, rich.y + PICKUP.ABOVE);
  // Reencontro no meio.
  g.x = clampX((xl + xr) / 2 + range(g.rng, -22, 22));
  g.y = y + gapFor(g, d);
  put(g, out, 'fork', g.x, g.y, widthFor(g, GEN.WIDTH_WIDE, d * 0.5), 'normal');
};

const movers: PatternFn = (g, d, out) => {
  const n = int(g.rng, 2, 3);
  for (let i = 0; i < n; i++) {
    const shift = Math.round(range(g.rng, 36, 58) * (0.85 + 0.45 * d));
    const cx = clamp(g.x + range(g.rng, -90, 90), GEN.MARGIN_X + shift, FIELD_W - GEN.MARGIN_X - shift);
    g.x = cx;
    g.y += gapFor(g, d, 0.97);
    put(g, out, 'movers', cx, g.y, widthFor(g, GEN.WIDTH_MOVING, d), 'moving', {
      shift,
      speed: range(g.rng, 1.1, 1.7) + 0.3 * d,
    });
  }
  // Depois dos móveis, um chão firme.
  g.x = clampX(g.x + range(g.rng, -50, 50));
  g.y += gapFor(g, d, 0.95);
  put(g, out, 'movers', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal');
};

const zigzag: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 5);
  let dir = awayFromEdge(g);
  for (let i = 0; i < n; i++) {
    const dx = range(g.rng, 118, 160);
    let nx = g.x + dir * dx;
    if (nx < GEN.MARGIN_X || nx > FIELD_W - GEN.MARGIN_X) {
      dir = (dir * -1) as 1 | -1;
      nx = g.x + dir * dx;
    }
    g.x = clampX(nx);
    g.y += gapFor(g, d, 0.94);
    maybeTape(g, out, put(g, out, 'zigzag', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal'), 0.28);
    dir = (dir * -1) as 1 | -1;
  }
};

const springPad: PatternFn = (g, d, out) => {
  // 1) chão de aproximação; 2) mola; 3) pouso largo bem acima; fitas no ar, no caminho da mola.
  g.x = clampX(g.x + range(g.rng, -40, 40));
  g.y += gapFor(g, d, 0.95);
  put(g, out, 'springPad', g.x, g.y, widthFor(g, GEN.WIDTH_NORMAL, d), 'normal');
  const sx = clampX(g.x + range(g.rng, -46, 46));
  const sy = g.y + gapFor(g, d, 0.92);
  put(g, out, 'springPad', sx, sy, widthFor(g, GEN.WIDTH_SPRING, d), 'spring');
  const rise = range(g.rng, 225, 268);
  const lx = clampX(sx + range(g.rng, -100, 100));
  const ly = sy + rise;
  for (const f of [0.3, 0.55, 0.8]) tape(g, out, sx + (lx - sx) * f * 0.5, sy + rise * f);
  g.x = lx;
  g.y = ly;
  put(g, out, 'springPad', lx, ly, widthFor(g, GEN.WIDTH_WIDE, d * 0.6), 'normal');
};

const breakables: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 4);
  for (let i = 0; i < n; i++) {
    g.x = clampX(g.x + range(g.rng, -110, 110));
    g.y += gapFor(g, d, 0.96);
    const type: PlatformType = i % 2 === 0 ? 'fragile' : 'normal';
    const p = put(g, out, 'breakables', g.x, g.y, widthFor(g, type === 'fragile' ? GEN.WIDTH_FRAGILE : GEN.WIDTH_NORMAL, d), type);
    // Isca: fita sobre a quebrável.
    if (type === 'fragile' && chance(g.rng, 0.55)) tape(g, out, p.x, p.y + PICKUP.ABOVE);
  }
};

const PATTERNS: Record<Exclude<PatternName, 'start'>, PatternFn> = {
  stairs,
  tower,
  wide,
  scatter,
  fork,
  movers,
  zigzag,
  springPad,
  breakables,
};

const NAMES = Object.keys(PATTERNS) as Exclude<PatternName, 'start'>[];

function choosePattern(g: Gen, d: number): PatternName {
  const m = metersAt(g.y);
  if (m < GEN.WARMUP_M) return weighted(g.rng, [['stairs', 3], ['tower', 2], ['wide', 1]] as const);
  // Respiro garantido: depois de vários padrões tensos, entra um pouso largo.
  if (g.sinceWide >= 6 && g.last !== 'wide') return 'wide';
  const calm = cycleAt(g.y) < 0.55;
  const table: [PatternName, number][] = NAMES.map(name => {
    const [easy, hard] = PATTERN_WEIGHTS[name];
    let w = d < PATTERN_MIN_INTENSITY[name] ? 0 : lerp(easy, hard, d);
    if (name === g.last) w *= g.last === 'stairs' && g.repeat < 2 ? 0.7 : 0.08;
    if (calm && (name === 'wide' || name === 'stairs' || name === 'tower')) w *= 2.2;
    return [name, w];
  });
  return weighted(g.rng, table);
}

/** Gera UM padrão acima do topo atual. */
export function generatePattern(g: Gen, out: Out): PatternName {
  const d = intensityAt(g.y);
  const name = choosePattern(g, d) as Exclude<PatternName, 'start'>;
  PATTERNS[name](g, d, out);
  g.repeat = name === g.last ? g.repeat + 1 : 0;
  g.last = name;
  g.sinceWide = name === 'wide' || name === 'fork' || name === 'springPad' ? 0 : g.sinceWide + 1;
  g.count++;
  return name;
}

/** Gera padrões até cobrir `untilY`. Ordem determinística, independente de quantas vezes é chamada. */
export function generateUntil(g: Gen, out: Out, untilY: number) {
  while (g.y < untilY) generatePattern(g, out);
}
