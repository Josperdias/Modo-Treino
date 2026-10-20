/** Decide QUAL som toca (puro: sem React, sem expo-audio). Os nomes batem com os arquivos de `assets/arcade/audio/`. */
import type {SimEvent} from '../core/types.ts';

export type Cue = {id: string; gain: number};

/** Trilha de cada parte do jogo. `menu` na seleção; `bonus` na chuva de fitas; o resto vem do mundo atual. */
export type MusicCtx = {
  phase: 'select' | 'play' | 'pause' | 'over';
  world: string;
  /** Altitude do herói e faixa da fase bônus (bonusY1 <= 0: não há). */
  y: number;
  bonusY0: number;
  bonusY1: number;
  /** Qual das faixas do mundo toca (rodízio; veja `pickVariant`). 0 = a original. */
  variant?: number;
};

/**
 * Faixas de cada parte do jogo (menu, bônus e cada mundo): QUATRO músicas diferentes entre si, de gêneros, andamentos e melodias distintos.
 * A primeira é a original; o rodízio (`pickVariant`) toca a próxima ao entrar na parte, para não repetir sempre a mesma. Todas precisam existir em `assets/arcade/audio/musica/`.
 */
export const WORLD_TRACKS: Record<string, string[]> = {
  menu: ['menu', 'menu2', 'menu3', 'menu4'], bonus: ['bonus', 'bonus2', 'bonus3', 'bonus4'],
  neon: ['neon', 'neon2', 'neon3', 'neon4'], crystal: ['crystal', 'crystal2', 'crystal3', 'crystal4'],
  clock: ['clock', 'clock2', 'clock3', 'clock4'], cosmos: ['cosmos', 'cosmos2', 'cosmos3', 'cosmos4'],
  ocean: ['ocean', 'ocean2', 'ocean3', 'ocean4'], volcano: ['volcano', 'volcano2', 'volcano3', 'volcano4'],
  paper: ['paper', 'paper2', 'paper3', 'paper4'], sketch: ['sketch', 'sketch2', 'sketch3', 'sketch4'],
  inverse: ['inverse', 'inverse2', 'inverse3', 'inverse4'],
};

/**
 * Escolhe a faixa (índice) ao ENTRAR num mundo. A primeira escolha depende da semente da partida; as seguintes seguem em rodízio a partir
 * da última usada naquele mundo (`prev`), então duas entradas seguidas nunca repetem a mesma faixa.
 */
export function pickVariant(world: string, seed: number, prev?: number): number {
  const n = WORLD_TRACKS[world]?.length ?? 1;
  if (n <= 1) return 0;
  if (prev !== undefined && prev >= 0) return (prev + 1) % n;
  let h = Math.imul((seed ^ (world.length * 0x9e3779b1)) >>> 0, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h % n;
}

/** Parte do jogo que está tocando: 'menu', 'bonus' ou o mundo (`null` = silêncio). É a chave de `WORLD_TRACKS`. */
export function partOf(c: MusicCtx): string | null {
  if (c.phase === 'select') return 'menu';
  if (c.phase === 'over') return null;
  if (c.bonusY1 > 0 && c.y >= c.bonusY0 && c.y < c.bonusY1) return 'bonus';
  return WORLD_TRACKS[c.world] ? c.world : 'neon';
}

export function musicFor(c: MusicCtx): string | null {
  const part = partOf(c);
  if (!part) return null;
  const list = WORLD_TRACKS[part];
  return list[(c.variant ?? 0) % list.length];
}

const LAND: Record<string, string> = {
  start: 'land_normal', normal: 'land_normal', switch: 'land_normal', moving: 'land_moving',
  fragile: 'land_fragile', spring: 'land_spring', conveyor: 'land_conveyor', ghost: 'land_ghost',
};

const PICKUP: Record<string, string> = {
  shield: 'shield', boost: 'boost', jet: 'jet', heart: 'heart', flag: 'flag', magnet: 'magnet', star: 'star',
};

const BIG = new Set(['guardian', 'blackhole']);

/** Portal `exit` (saída da sala do portal) soa como o teletransporte. */
const portalId = (v: string) => `portal_${v === 'exit' ? 'tele' : v}`;

/** Sons de um evento da simulação. Pousos de passeio são suaves; o resto é pleno. */
export function cuesFor(e: SimEvent): Cue[] {
  switch (e.t) {
    case 'land': return [{id: LAND[e.plat] ?? 'land_normal', gain: e.plat === 'normal' || e.plat === 'start' ? 0.55 : 0.8}];
    case 'collect': return [{id: `tape${Math.max(1, Math.min(5, Math.floor(e.combo) || 1))}`, gain: 0.8}];
    case 'break': return [{id: 'land_fragile', gain: 0.8}];
    case 'pickup': {
      const id = PICKUP[e.kind];
      return id ? [{id, gain: 0.9}] : [];
    }
    case 'hit': {
      const out: Cue[] = [{id: e.blocked ? 'shield_block' : 'hit', gain: 1}];
      if (!e.blocked && e.lives === 1) out.push({id: 'life_low', gain: 0.8});
      return out;
    }
    case 'kill': {
      const out: Cue[] = [{id: BIG.has(e.kind) ? 'kill_big' : 'kill', gain: 0.95}];
      if (e.by === 'stomp') out.push({id: 'stomp', gain: 0.8});
      return out;
    }
    case 'shoot': return [{id: e.own ? 'shoot' : 'enemy_shoot', gain: e.own ? 0.6 : 0.7}];
    case 'warn': return [{id: 'enemy_warn', gain: 0.7}];
    case 'portal': return [{id: portalId(e.variant), gain: 1}];
    case 'swap': return [{id: 'swap', gain: 0.9}];
    case 'press': return [{id: 'press', gain: 0.95}];
    case 'bonk': return [{id: 'bonk', gain: 0.9}];
    case 'revive': return [{id: 'revive', gain: 1}];
    case 'over': return e.cause === 'crush' ? [{id: 'crush', gain: 1}] : e.cause === 'fall' ? [{id: 'fall', gain: 0.9}] : [{id: 'tape_stop', gain: 0.8}];
  }
}

/** Fim de partida: vinheta de recorde ou de derrota (depois do som da causa). */
export const stingerFor = (record: boolean): string => (record ? 'record' : 'over');

/** Aviso da lava: quando o herói está perto dela (volcano). */
export function lavaClose(world: string, y: number, lava: number, gap = 150): boolean {
  return world === 'volcano' && lava > 0 && y - lava < gap;
}

/**
 * Limita sons repetidos: o mesmo som só toca de novo depois de `minGap` ms e no máximo `maxPerFrame`
 * sons por chamada (uma rajada de eventos não vira estouro).
 */
export class Limiter {
  private last = new Map<string, number>();
  private minGap: Record<string, number>;
  private defGap: number;
  private maxPerCall: number;
  constructor(minGap: Record<string, number> = {}, defGap = 45, maxPerCall = 5) {
    this.minGap = minGap;
    this.defGap = defGap;
    this.maxPerCall = maxPerCall;
  }
  filter(cues: Cue[], now: number): Cue[] {
    const out: Cue[] = [];
    for (const c of cues) {
      if (out.length >= this.maxPerCall) break;
      const gap = this.minGap[c.id] ?? this.defGap;
      const prev = this.last.get(c.id);
      if (prev !== undefined && now - prev < gap) continue;
      this.last.set(c.id, now);
      out.push(c);
    }
    return out;
  }
  reset() { this.last.clear(); }
}

export const GAPS: Record<string, number> = {
  land_normal: 90, life_low: 900, lava_warn: 1800, enemy_warn: 400, shoot: 110, enemy_shoot: 120, jet: 600,
};
