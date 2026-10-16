import {FIELD_W, PHYS} from '../data/neon.ts';
import {landHalfWidth, platformX} from './physics.ts';
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
};

export const IDEAL: BotSkill = {every: 1, noise: 0, lapse: 0};
/** ~150 ms de reação, erro de ~14 un. e 6 % de descuido. */
export const HUMAN: BotSkill = {every: 18, noise: 14, lapse: 0.06};

export type Bot = {skill: BotSkill; rng: Rng; held: number; target: number};

export function makeBot(skill: BotSkill, seed = 1): Bot {
  return {skill, rng: makeRng(seed), held: 0, target: PHYS.START_X};
}

function gauss(r: Rng): number {
  const u = Math.max(1e-9, next(r));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next(r));
}

/** Melhor alvo X agora: plataforma mais alta alcançável pelo salto em curso (considera atravessar a lateral). */
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
    if (dx > FIELD_W / 2) dx -= FIELD_W + 2 * PHYS.WRAP_MARGIN;
    else if (dx < -FIELD_W / 2) dx += FIELD_W + 2 * PHYS.WRAP_MARGIN;
    const d = Math.abs(dx);
    if (d > 230 + landHalfWidth(pl)) continue;
    if (!best || pl.y > best.y || (pl.y === best.y && d < best.d)) best = {y: pl.y, x: p.x + dx, d};
  }
  return best ? best.x : p.x;
}

export function botInput(sim: Sim, bot: Bot): Input {
  if (sim.tick % bot.skill.every === 0) {
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
  return {axis: Math.abs(dx) < 6 ? 0 : bot.held};
}
