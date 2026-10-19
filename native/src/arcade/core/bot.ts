import {FIELD_W, PHYS} from '../data/neon.ts';
import {horizontalTravel, landHalfWidth, platformX} from './physics.ts';
import {enemyAt} from './enemies.ts';
import {makeRng, next, type Rng} from './rng.ts';
import type {Input, Sim} from './types.ts';

/**
 * Robôs de teste (não vão para o app). Servem para provar jogabilidade e medir dificuldade:
 * - `ideal`: mira sempre a plataforma mais alta que o salto atual alcança (limite superior de habilidade);
 * - `human`: o mesmo, com atraso de reação, ruído de mira e erros ocasionais (aproxima um jogador médio).
 */
export type BotSkill = {
  /** Intervalo (passos) entre decisões. 1 = reage a cada passo. */
  every: number;
  /** Desvio padrão do erro de mira (un.). */
  noise: number;
  /** Probabilidade, por decisão, de ignorar a mira e manter o último comando. */
  lapse: number;
  /** Entrada por toque: só -1, 0 ou +1 (sem meio-termo), como no celular. */
  digital?: boolean;
  /** Chance de notar um tiro inimigo e desviar (0 = nunca, 1 = sempre). */
  dodge?: number;
};

export const IDEAL: BotSkill = {every: 6, noise: 0, lapse: 0, dodge: 1};
/** ~150 ms de reação, erro de ~14 un. e 6 % de descuido. */
export const HUMAN: BotSkill = {every: 18, noise: 14, lapse: 0.06, dodge: 0.7};

export type Bot = {skill: BotSkill; rng: Rng; held: number; target: number; fire: boolean; dodge: number};

export function makeBot(skill: BotSkill, seed = 1): Bot {
  return {skill, rng: makeRng(seed), held: 0, target: PHYS.START_X, fire: false, dodge: 0};
}

function gauss(r: Rng): number {
  const u = Math.max(1e-9, next(r));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next(r));
}

/** Melhor alvo X agora: plataforma mais alta alcançável pelo salto em curso (considera atravessar a lateral). */
/** Algum inimigo vivo cruza a reta herói → destino na hora em que o herói passa pela altura dele? */
function routeBlocked(sim: Sim, x0: number, y0: number, x1: number, y1: number, tEnd: number): boolean {
  for (const e of sim.enemies) {
    if (!e.alive || e.y < y0 - 20 || e.y > y1 + 40) continue;
    const f = y1 > y0 ? Math.min(1, Math.max(0, (e.y - y0) / (y1 - y0))) : 1;
    const at = enemyAt(e, sim.time + tEnd * f);
    const px = x0 + (x1 - x0) * f;
    if (Math.abs(at.x - px) < e.size + 30) return true;
  }
  return false;
}

export function aim(sim: Sim): number {
  const p = sim.player;
  const rise = p.vy > 0 ? (p.vy * p.vy) / (2 * PHYS.G) : 0;
  let best: {y: number; x: number; d: number} | null = null;
  for (const pl of sim.platforms) {
    if (pl.broken) continue;
    if (pl.y > p.y + rise - 6 || pl.y < p.y - 260) continue;
    // Quando o herói chegar a essa altura (na descida), onde estará a plataforma?
    const disc = p.vy * p.vy + 2 * PHYS.G * (p.y - pl.y);
    const t = (p.vy + Math.sqrt(Math.max(0, disc))) / PHYS.G;
    const px = platformX(pl, sim.time + t);
    // Caminho mais curto, contando a volta pela lateral.
    let dx = px - p.x;
    const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
    if (dx > span / 2) dx -= span;
    else if (dx < -span / 2) dx += span;
    const d = Math.abs(dx);
    // Só vale a plataforma que dá para alcançar durante a queda até ela (física, não um número fixo).
    if (d > horizontalTravel(t, sim.level) * 0.97 + landHalfWidth(pl) - 6) continue;
    // Penaliza rotas onde um inimigo vivo estará no caminho quando o herói passar por ali.
    const blocked = routeBlocked(sim, p.x, p.y, p.x + dx, pl.y, t);
    const score = pl.y - (blocked ? 400 : 0);
    if (!best || score > best.y || (score === best.y && d < best.d)) best = {y: score, x: p.x + dx, d};
  }
  return best ? best.x : p.x;
}

/** Direção para fugir de um tiro inimigo que vai cruzar o corpo do herói em breve (0 = nenhum). */
function dodgeDir(sim: Sim): number {
  const p = sim.player;
  const by = p.y + 42;
  let best = 0, bestT = 0.7;
  for (const b of sim.bullets) {
    if (!b.alive || b.own) continue;
    const t = b.vy !== 0 ? (by - b.y) / b.vy : Infinity;
    if (t < 0 || t > bestT) continue;
    const bx = b.x + b.vx * t;
    if (Math.abs(bx - p.x) < 46) { best = p.x <= bx ? -1 : 1; bestT = t; }
  }
  return best;
}

/** Há inimigo vivo acima, quase alinhado, ao alcance do tiro? */
function shouldFire(sim: Sim): boolean {
  const p = sim.player;
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    const dy = e.y - (p.y + 72);
    if (dy > 0 && dy < 420 && Math.abs(e.x - p.x) < e.size + 4) return true;
  }
  return false;
}

export function botInput(sim: Sim, bot: Bot): Input {
  if (sim.tick % bot.skill.every === 0) {
    bot.fire = shouldFire(sim) && next(bot.rng) >= bot.skill.lapse;
    bot.dodge = bot.skill.dodge && next(bot.rng) < bot.skill.dodge ? dodgeDir(sim) : 0;
    if (next(bot.rng) >= bot.skill.lapse) {
      bot.target = aim(sim) + (bot.skill.noise ? gauss(bot.rng) * bot.skill.noise : 0);
    }
  }
  let dx = bot.target - sim.player.x;
  // O alvo guardado pode estar do outro lado da lateral depois de atravessá-la.
  const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
  if (dx > span / 2) dx -= span;
  else if (dx < -span / 2) dx += span;
  bot.held = Math.max(-1, Math.min(1, dx / 36));
  let axis = Math.abs(dx) < 6 ? 0 : bot.held;
  if (bot.dodge) axis = bot.dodge;
  return {axis: bot.skill.digital ? Math.sign(axis) : axis, fire: bot.fire};
}
