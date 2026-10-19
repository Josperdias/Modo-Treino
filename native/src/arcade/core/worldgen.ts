import {ENEMIES, ENEMY_TABLE, FIELD_W, GEN, PAPER, PATTERN_TABLE, PHYS, PICKUP, PORTAL, POWER_TABLE, SPAWN, TYPE_TABLE, WORLD_FX, WORLD_ORDER, type WorldId} from '../data/neon.ts';
import {apex} from './physics.ts';
import {canReach, SAFETY} from './validate.ts';
import {chance, int, makeRng, next, range, weighted} from './rng.ts';
import type {Enemy, EnemyKind, Gen, Item, ItemKind, PatternName, Platform, PlatformType, PortalVariant} from './types.ts';

/**
 * Gerador do mundo ao estilo Doodle Jump de verdade: plataformas em lugares ALEATÓRIOS do campo inteiro
 * (o herói dá a volta pela lateral), vãos irregulares, tipos misturados e "humores" do acaso
 * (calmo/normal/tenso) em vez de escadinhas e torres. Nada de padrão previsível.
 *
 * Garantias (provadas em `validate.ts` + testes):
 * - toda plataforma é alcançável da anterior com folga (nunca exige o limite físico), contando a volta pela lateral;
 * - o mundo depende só da semente e da ordem de geração, nunca do tempo, da câmera ou do dt.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const clampX = (x: number) => clamp(x, GEN.MARGIN_X, FIELD_W - GEN.MARGIN_X);

export type Out = {platforms: Platform[]; items: Item[]; enemies: Enemy[]};

export function makeGen(seed: number): Gen {
  const rng = makeRng(seed ^ 0x5bd1e995);
  return {
    rng,
    x: PHYS.START_X,
    y: PHYS.START_Y,
    count: 0,
    last: 'start',
    repeat: 0,
    mood: 1,
    nextId: 1,
    world: 'neon',
    worldY0: PHYS.START_Y,
    nextEnemyY: PHYS.START_Y + SPAWN.FROM_M * 10,
    nextPowerY: PHYS.START_Y + SPAWN.POWER_FROM_M * 10,
    nextFlagY: PHYS.START_Y + SPAWN.FLAG_FROM_M * 10,
    portalY: PHYS.START_Y + range(rng, PORTAL.FIRST_M[0], PORTAL.FIRST_M[1]) * 10,
    portalPlaced: false,
    lane: null,
    returnWorld: null,
    paperExitY: 0,
    bonusEndY: 0,
    portalsMade: 0,
  };
}

export const nextWorld = (w: WorldId): WorldId => WORLD_ORDER[(WORLD_ORDER.indexOf(w) + 1) % WORLD_ORDER.length] ?? WORLD_ORDER[0];

/** Faixa de X onde as plataformas e inimigos podem nascer (Papel: estreita). */
const laneOf = (g: Gen): [number, number] => g.lane ?? [GEN.MARGIN_X, FIELD_W - GEN.MARGIN_X];

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

function widthFor(g: Gen, span: readonly number[], d: number): number {
  return Math.round(lerp(span[0], span[1], d) + range(g.rng, -8, 10));
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
  let dir = 0;
  if (type === 'normal' && g.world === 'clock' && pattern !== 'ladder' && pattern !== 'portalPad' && chance(g.rng, WORLD_FX.CLOCK_CONVEYOR_CHANCE)) {
    type = 'conveyor';
    dir = chance(g.rng, 0.5) ? 1 : -1;
  }
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
    dir,
  };
  out.platforms.push(p);
  g.x = x;
  g.y = y;
  return p;
}

function tape(g: Gen, out: Out, x: number, y: number) {
  out.items.push({id: g.nextId++, kind: 'tape', x, y, phase: range(g.rng, 0, Math.PI * 2), hit: false});
}

function maybeTape(g: Gen, out: Out, p: Platform, prob: number = GEN.TAPE_CHANCE) {
  if (p.type === 'moving' || p.type === 'fragile') return;
  if (chance(g.rng, prob)) tape(g, out, p.x, p.y + PICKUP.ABOVE);
}

/* ---------- colocação ao acaso com alcance garantido ---------- */

const SPAN = FIELD_W + 2 * PHYS.WRAP_MARGIN;

/** Escolhe o tipo da plataforma: pesos por altitude/intensidade (o resto é plataforma comum). */
function pickType(g: Gen, d: number, prev: Platform | null): PlatformType {
  const m = metersAt(g.y);
  const w = (k: keyof typeof TYPE_TABLE) => (m >= TYPE_TABLE[k].from ? lerp(TYPE_TABLE[k].w[0], TYPE_TABLE[k].w[1], d) * (g.mood === 2 ? 1.3 : g.mood === 0 ? 0.6 : 1) : 0);
  // depois de uma quebrável o chão firme é mais provável (senão o jogo vira só armadilha)
  const fragileW = prev?.type === 'fragile' ? w('fragile') * 0.45 : w('fragile');
  return weighted(g.rng, [['normal', 0.8], ['moving', w('moving')], ['fragile', fragileW], ['spring', w('spring')]] as const);
}

/** Vão vertical até a próxima: irregular, com saltinhos curtos e esticões perto do limite. */
function gapSample(g: Gen, d: number, prev: Platform | null): number {
  if (prev?.type === 'spring') return range(g.rng, 170, Math.min(300, apex(PHYS.SPRING) * SAFETY.RISE * 0.96));
  const lo = lerp(GEN.GAP_MIN, GEN.GAP_MIN_HARD, d);
  const hi = lerp(GEN.GAP_MAX, GEN.GAP_MAX_HARD, d);
  const u = next(g.rng);
  const bias = g.mood === 0 ? u * u : g.mood === 2 ? 1 - (1 - u) * (1 - u) : u;
  let dy = lo + (hi - lo) * bias;
  if (chance(g.rng, 0.1)) dy = range(g.rng, 50, 76); // saltinho curto no meio da bagunça
  return Math.min(GEN.GAP_CAP, dy);
}

function widthForType(g: Gen, type: PlatformType, d: number): number {
  const span = type === 'moving' ? GEN.WIDTH_MOVING : type === 'fragile' ? GEN.WIDTH_FRAGILE : type === 'spring' ? GEN.WIDTH_SPRING : GEN.WIDTH_NORMAL;
  return Math.max(34, widthFor(g, span, d));
}

/** A plataforma candidata invade o espaço de alguma das últimas? (mesma regra do validador) */
function collides(out: Out, c: {x: number; y: number; w: number; shift: number}): boolean {
  const list = out.platforms;
  for (let i = list.length - 1; i >= 0 && i >= list.length - 10; i--) {
    const a = list[i];
    if (Math.abs(a.y - c.y) >= GEN.CLEARANCE_Y) continue;
    const overlap = Math.min(a.x + a.shift + a.w / 2, c.x + c.shift + c.w / 2) - Math.max(a.x - a.shift - a.w / 2, c.x - c.shift - c.w / 2);
    if (overlap > -14) return true;
  }
  return false;
}

/**
 * Próxima plataforma da corrente: X aleatório em TODO o campo, com tentativas até ser alcançável da anterior
 * (contando a volta pela lateral). Nunca devolve algo impossível: se o sorteio falha, cai num degrau seguro.
 */
function nextPlatform(g: Gen, d: number, out: Out, pattern: PatternName, force?: {type?: PlatformType; dy?: number}): Platform {
  const prev = out.platforms.length ? out.platforms[out.platforms.length - 1] : null;
  // O tipo é sorteado UMA vez (senão o sorteio de posição favorece só o comum, que é o mais fácil de aceitar).
  const wantType = force?.type ?? pickType(g, d, prev);
  for (let attempt = 0; attempt < 24; attempt++) {
    const type = attempt < 16 ? wantType : 'normal';
    const dy = force?.dy ?? gapSample(g, d, prev);
    const w = Math.min(widthForType(g, type, d), g.lane ? 84 : 999);
    let shift = 0, speed = 0;
    const [laneLo, laneHi] = laneOf(g);
    if (type === 'moving') { shift = Math.round(range(g.rng, 30, 56 + 34 * d)); speed = range(g.rng, 0.9, 1.5) + 0.8 * d; if (g.lane) shift = Math.min(shift, 28); }
    const lo = laneLo + shift, hi = laneHi - shift;
    if (hi <= lo) continue;
    const x = Math.round(range(g.rng, lo, hi));
    const cand: Platform = {id: -1, x, y: g.y + dy, w, type, phase: 0, speed, shift, broken: false, pattern, dir: 0};
    if (prev && !canReach(prev, cand)) continue;
    if (collides(out, cand)) continue;
    return put(g, out, pattern, x, cand.y, w, type, type === 'moving' ? {shift, speed} : undefined);
  }
  // Fallback: degrau comum, curto e do lado oposto (sempre alcançável).
  const [fLo, fHi] = laneOf(g);
  const dx = (g.x < (fLo + fHi) / 2 ? 1 : -1) * Math.min(70, (fHi - fLo) / 2);
  const y = g.y + GEN.GAP_MIN;
  return put(g, out, pattern, clamp(g.x + dx, fLo, fHi), y, widthForType(g, 'normal', Math.min(d, 0.5)), 'normal');
}

type PatternFn = (g: Gen, d: number, out: Out) => void;

/** Corrente de plataformas ao acaso (o miolo do jogo). */
const chaos: PatternFn = (g, d, out) => {
  const n = int(g.rng, 3, 7);
  for (let i = 0; i < n; i++) {
    const prev = out.platforms[out.platforms.length - 1];
    const p = nextPlatform(g, d, out, 'chaos');
    maybeTape(g, out, p, 0.16);
    // fitas no caminho de saltos longos: convite para arriscar
    if (prev && p.y - prev.y > 120 && chance(g.rng, 0.35) && Math.abs(p.x - prev.x) < 200) {
      for (const f of [0.35, 0.65]) tape(g, out, prev.x + (p.x - prev.x) * f, prev.y + (p.y - prev.y) * f + 20);
      if (p.y - prev.y > 140 && chance(g.rng, 0.3)) out.items.push({id: g.nextId++, kind: 'star', x: prev.x + (p.x - prev.x) * 0.5, y: prev.y + (p.y - prev.y) * 0.5 + 20, phase: 0, hit: false});
    }
  }
};

/** Duas ou três plataformas quase na mesma altura, espalhadas: escolha de qual pegar (e uma pode ser armadilha). */
const cluster: PatternFn = (g, d, out) => {
  const base = nextPlatform(g, d, out, 'cluster');
  maybeTape(g, out, base, 0.25);
  const n = int(g.rng, 1, 2);
  const before = out.platforms.length - 2 >= 0 ? out.platforms[out.platforms.length - 2] : null;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 8; t++) {
      const ghostly = d > 0.25 && chance(g.rng, 0.3);
      const type: PlatformType = ghostly ? 'ghost' : chance(g.rng, 0.3 + 0.3 * d) ? 'fragile' : pickType(g, d, base);
      const w = Math.min(widthForType(g, type === 'spring' || type === 'ghost' ? 'normal' : type, d), g.lane ? 84 : 999);
      const [cLo, cHi] = laneOf(g);
      const x = Math.round(range(g.rng, cLo, cHi));
      const y = base.y + range(g.rng, -22, 22);
      const cand: Platform = {id: -1, x, y, w, type: type === 'spring' ? 'normal' : type, phase: ghostly ? range(g.rng, 0, Math.PI * 2) : 0, speed: ghostly ? range(g.rng, 0.9, 1.4) : 0, shift: 0, broken: false, pattern: 'cluster', dir: 0};
      if (Math.abs(x - base.x) < (w + base.w) / 2 + 20) continue;
      if (before && !canReach(before, cand)) continue;
      if (collides(out, cand)) continue;
      // o X novo não vira o "topo" da corrente: quem manda é a primeira plataforma
      const keepX = g.x, keepY = g.y;
      const added = put(g, out, 'cluster', x, y, w, cand.type);
      if (ghostly) { added.phase = cand.phase; added.speed = cand.speed; }
      // A ponta da corrente continua sendo a plataforma-base (a próxima é garantida a partir dela, nunca de um enfeite/armadilha).
      out.platforms.pop();
      out.platforms.splice(out.platforms.length - 1, 0, added);
      g.x = keepX; g.y = keepY;
      break;
    }
  }
};

/** Seca: um vão grande com plataforma estreita do outro lado (e fitas de isca no caminho). */
const drought: PatternFn = (g, d, out) => {
  const p = nextPlatform(g, d, out, 'drought', {dy: GEN.GAP_CAP * range(g.rng, 0.86, 1), type: 'normal'});
  maybeTape(g, out, p, 0.4);
  nextPlatform(g, d, out, 'drought');
};

/** Mola num lugar qualquer e pouso bem lá em cima, em outro lugar qualquer. */
const springPad: PatternFn = (g, d, out) => {
  const prev = nextPlatform(g, d, out, 'springPad', {type: 'normal'});
  const sp = nextPlatform(g, d, out, 'springPad', {type: 'spring', dy: range(g.rng, GEN.GAP_MIN, 110)});
  const up = nextPlatform(g, d, out, 'springPad', {type: 'normal'});
  for (const f of [0.3, 0.55, 0.8]) tape(g, out, sp.x + (up.x - sp.x) * f * 0.4, sp.y + (up.y - sp.y) * f);
  void prev;
};

/** Trecho fácil de verdade (começo e respiros raros): vãos pequenos e plataformas largas, mas ainda espalhadas. */
const ladder: PatternFn = (g, d, out) => {
  const n = int(g.rng, 2, 4);
  for (let i = 0; i < n; i++) {
    const w = Math.round(range(g.rng, 92, 130));
    const dy = range(g.rng, GEN.GAP_MIN, 96);
    let x = g.x;
    for (let t = 0; t < 10; t++) {
      const [lLo, lHi] = laneOf(g);
      x = Math.round(range(g.rng, lLo, lHi));
      const prev = out.platforms[out.platforms.length - 1];
      const cand: Platform = {id: -1, x, y: g.y + dy, w, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'ladder', dir: 0};
      if ((!prev || canReach(prev, cand)) && !collides(out, cand)) break;
    }
    const p = put(g, out, 'ladder', x, g.y + dy, w, 'normal');
    maybeTape(g, out, p, 0.34);
  }
};

/** Que portal vem agora: o de volta do Papel, ou um sorteado (o do Papel só depois do primeiro portal). */
function pickPortal(g: Gen): {variant: PortalVariant; target: WorldId} {
  if (g.world === 'paper') return {variant: 'back', target: g.returnWorld ?? 'neon'};
  const table = PORTAL.KINDS.map(([k, w]) => [k as PortalVariant, k === 'paper' && g.portalsMade < 1 ? 0 : w] as const);
  const variant = weighted(g.rng, table);
  return {variant, target: variant === 'world' ? nextWorld(g.world) : variant === 'paper' ? 'paper' : g.world};
}

const portalPad: PatternFn = (g, _d, out) => {
  // Plataforma larga de apoio e, ao lado dela, o portal; o caminho segue para o lado oposto: desviar é só não encostar.
  const pad = nextPlatform(g, 0, out, 'portalPad', {type: 'normal', dy: range(g.rng, 80, 96)});
  pad.w = g.lane ? 84 : 132;
  const [lo, hi] = laneOf(g);
  const side = pad.x < (lo + hi) / 2 ? 1 : -1;
  const {variant, target} = pickPortal(g);
  const px = g.lane ? clamp(pad.x + side * 40, lo, hi) : clamp(pad.x + side * PORTAL.SIDE, 62, FIELD_W - 62);
  out.items.push({id: g.nextId++, kind: 'portal', x: px, y: pad.y + PORTAL.ABOVE, phase: range(g.rng, 0, Math.PI * 2), hit: false, target, variant});
  g.portalPlaced = true;
  for (let i = 0; i < 2; i++) nextPlatform(g, 0.3, out, 'portalPad', {type: 'normal'});
};

/** Fase bônus: plataformas largas, vãos curtos e fitas/estrelas por todo lado (sem inimigos). */
const bonus: PatternFn = (g, _d, out) => {
  const n = int(g.rng, 3, 5);
  for (let i = 0; i < n; i++) {
    const prev = out.platforms[out.platforms.length - 1];
    const [lo, hi] = laneOf(g);
    let x = Math.round(range(g.rng, lo, hi)), w = Math.round(range(g.rng, 110, 150)), dy = range(g.rng, 68, 92);
    for (let t = 0; t < 12; t++) {
      x = Math.round(range(g.rng, lo, hi));
      const cand: Platform = {id: -1, x, y: g.y + dy, w, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'bonus', dir: 0};
      if ((!prev || canReach(prev, cand)) && !collides(out, cand)) break;
    }
    const p = put(g, out, 'bonus', x, g.y + dy, w, 'normal');
    for (const k of [-34, 0, 34]) tape(g, out, p.x + k, p.y + PICKUP.ABOVE);
    if (chance(g.rng, 0.4)) out.items.push({id: g.nextId++, kind: 'star', x: p.x, y: p.y + 100, phase: range(g.rng, 0, Math.PI * 2), hit: false});
  }
};

const PATTERNS: Record<Exclude<PatternName, 'start'>, PatternFn> = {portalPad, bonus, chaos, cluster, drought, springPad, ladder};
const NAMES = Object.keys(PATTERN_TABLE) as (keyof typeof PATTERN_TABLE)[];

function choosePattern(g: Gen, d: number): PatternName {
  const m = metersAt(g.y);
  if (!g.portalPlaced && g.y >= g.portalY && g.last !== 'portalPad' && g.bonusEndY === 0) return 'portalPad';
  if (g.bonusEndY > 0) { if (g.y < g.bonusEndY) return 'bonus'; g.bonusEndY = 0; }
  if (m < GEN.WARMUP_M) return 'ladder';
  const table = NAMES.map(name => {
    const [easy, hard, from] = PATTERN_TABLE[name];
    let w = d < from ? 0 : lerp(easy, hard, d);
    if (name === g.last && name !== 'chaos') w *= 0.1;
    return [name as PatternName, w] as const;
  });
  return weighted(g.rng, table);
}

/* ---------- inimigos, poderes e bandeiras (depois de cada padrão) ---------- */

/** X do caminho (cadeia de plataformas) na altura y, por interpolação entre plataformas vizinhas. */
function routeX(list: Platform[], y: number): number {
  let lo: Platform | null = null, hi: Platform | null = null;
  for (const p of list) {
    if (p.y <= y && (!lo || p.y > lo.y)) lo = p;
    if (p.y >= y && (!hi || p.y < hi.y)) hi = p;
  }
  if (lo && hi && hi.y > lo.y) return lo.x + ((hi.x - lo.x) * (y - lo.y)) / (hi.y - lo.y);
  return (lo ?? hi)?.x ?? FIELD_W / 2;
}

function pickEnemyKind(g: Gen, d: number): EnemyKind {
  const wm = metersAt(g.y) - metersAt(g.worldY0);
  if (metersAt(g.y) >= SPAWN.GUARDIAN_FROM_M && chance(g.rng, SPAWN.GUARDIAN_CHANCE)) return 'guardian';
  const table = ENEMY_TABLE[g.world].map(([k, w, from]) => [k as EnemyKind, wm >= from ? w : 0] as const);
  const any = table.some(([, w]) => w > 0);
  return weighted(g.rng, any ? table : [[table[0][0], 1] as const]);
}

/** O caminho percorrido pelo inimigo (âncora ± alcance) cruza alguma plataforma? */
function crossesPlatform(list: Platform[], x0: number, y: number, rangeX: number, size: number): boolean {
  for (const p of list) {
    if (Math.abs(p.y - y) > size + 16) continue;
    const reach = p.w / 2 + p.shift;
    if (x0 - rangeX - size < p.x + reach && x0 + rangeX + size > p.x - reach) return true;
  }
  return false;
}

function placeEnemy(g: Gen, out: Out, from: number, d: number) {
  const list = out.platforms.slice(Math.max(0, from - 2));
  // Para não atravessar plataformas, olha também os últimos do padrão anterior (a bifurcação tem duas no mesmo y).
  const near = out.platforms.slice(Math.max(0, from - 8));
  if (list.length < 2) return;
  const kind = pickEnemyKind(g, d);
  const spec = ENEMIES[kind];
  const block = chance(g.rng, lerp(SPAWN.BLOCK[0], SPAWN.BLOCK[1], d));
  const ys = list.map(p => p.y).sort((a, b) => a - b);
  let range0 = 0, speed = 0;
  if (kind === 'drone') { range0 = range(g.rng, 40, 80) + 30 * d; speed = range(g.rng, 0.6, 1.1) + 0.5 * d; }
  else if (kind === 'zigzag') { range0 = range(g.rng, 58, 100); speed = range(g.rng, 1.3, 2) + 0.4 * d; }
  else if (kind === 'orb') { range0 = range(g.rng, 32, 50); speed = range(g.rng, 1.1, 1.7); }
  else if (kind === 'guardian') { range0 = 52; speed = 0.5; }
  else if (kind === 'ufo') { range0 = range(g.rng, 60, 100); speed = range(g.rng, 0.5, 0.9); }
  else if (kind === 'meteor') { range0 = range(g.rng, 50, 110) * (chance(g.rng, 0.5) ? 1 : -1); speed = 1; }
  else if (kind === 'clip') { range0 = range(g.rng, 40, 70); speed = range(g.rng, 1.1, 2); }
  const [laneLo, laneHi] = laneOf(g);
  if (g.lane) range0 = Math.min(range0, kind === 'clip' ? range0 : 22);
  // Até 6 tentativas de achar um lugar onde o caminho do inimigo não atravessa uma plataforma.
  for (let k = 0; k < 6; k++) {
    // y: no vão entre duas plataformas do padrão (bloqueio) ou em qualquer ponto da faixa (ao lado).
    const i = int(g.rng, 0, ys.length - 2);
    const y = block ? (ys[i] + ys[i + 1]) / 2 + range(g.rng, -8, 8) : range(g.rng, ys[0] + 25, ys[ys.length - 1] + 10);
    if (y < PHYS.START_Y + SPAWN.FROM_M * 10) continue; // nada antes da altitude de estreia
    const rx = routeX(list, y);
    const sideDir = rx < (laneLo + laneHi) / 2 ? 1 : -1;
    const off = block ? range(g.rng, -16, 16) : sideDir * range(g.rng, 100, 150);
    const lim = (kind === 'meteor' ? 0 : kind === 'clip' ? 0 : Math.abs(range0)) + spec.size + (g.lane ? 4 : 22);
    const x0 = laneLo + lim > laneHi - lim ? (laneLo + laneHi) / 2 : clamp(rx + off, laneLo + lim, laneHi - lim);
    // meteoros caem por cima de tudo (sem checar plataforma); os demais não podem atravessar uma
    if (kind !== 'meteor' && crossesPlatform(near, x0, y, kind === 'clip' ? 4 : Math.abs(range0), spec.size + (kind === 'clip' ? range0 : 0))) continue;
    out.enemies.push({
      id: g.nextId++, kind, x0, y0: y, x: x0, y, phase: range(g.rng, 0, Math.PI * 2), speed, range: range0,
      size: spec.size, hp: spec.hp, maxHp: spec.hp,
      cooldown: kind === 'turret' ? range(g.rng, 2.4, 4.2) : range(g.rng, 3.4, 6),
      warn: false, alive: true,
    });
    return;
  }
}

function powerItem(g: Gen, out: Out, from: number) {
  const p = [...out.platforms.slice(from)].reverse().find(q => q.type === 'normal' && q.pattern !== 'portalPad');
  if (!p) return false;
  const kind = weighted(g.rng, POWER_TABLE.map(([k, w]) => [k as ItemKind, w] as const));
  out.items.push({id: g.nextId++, kind, x: p.x, y: p.y + 54, phase: range(g.rng, 0, Math.PI * 2), hit: false});
  return true;
}

function flagItem(g: Gen, out: Out, from: number) {
  const p = [...out.platforms.slice(from)].reverse().find(q => (q.type === 'normal' || q.type === 'conveyor') && q.w >= 40 && q.pattern !== 'portalPad');
  if (!p) return false;
  out.items.push({id: g.nextId++, kind: 'flag', x: p.x, y: p.y + 38, phase: 0, hit: false});
  return true;
}

function decorate(g: Gen, out: Out, from: number, name: PatternName, d: number) {
  const m = metersAt(g.y);
  if (name === 'portalPad' || name === 'bonus') return; // o portal e a fase bônus têm o palco só para eles
  if (g.y >= g.nextFlagY && flagItem(g, out, from)) g.nextFlagY = g.y + SPAWN.FLAG_GAP_M * 10 + range(g.rng, 0, 400);
  if (g.y >= g.nextPowerY && powerItem(g, out, from)) g.nextPowerY = g.y + range(g.rng, SPAWN.POWER_GAP_M[0], SPAWN.POWER_GAP_M[1]) * 10;
  if (m >= SPAWN.FROM_M && g.y >= g.nextEnemyY && name !== 'ladder' && name !== 'springPad') {
    placeEnemy(g, out, from, d);
    g.nextEnemyY = g.y + range(g.rng, 0.8, 1.2) * lerp(SPAWN.GAP_M[0], SPAWN.GAP_M[1], d) * 10;
  }
}

/** Gera UM padrão acima do topo atual. */
export function generatePattern(g: Gen, out: Out): PatternName {
  const d = intensityAt(g.y);
  // Humor do acaso: mais tenso quanto mais difícil.
  g.mood = weighted(g.rng, [[0, 1.4 - d], [1, 1], [2, 0.3 + 1.3 * d]] as const);
  const name = choosePattern(g, d) as Exclude<PatternName, 'start'>;
  const from = out.platforms.length;
  PATTERNS[name](g, d, out);
  g.repeat = name === g.last ? g.repeat + 1 : 0;
  g.last = name;
  g.count++;
  decorate(g, out, from, name, d);
  return name;
}

/** Gera padrões até cobrir `untilY`. Ordem determinística, independente de quantas vezes é chamada. */
export function generateUntil(g: Gen, out: Out, untilY: number) {
  while (g.y < untilY) generatePattern(g, out);
}
