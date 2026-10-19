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
};

const WORLD_TRACK: Record<string, string> = {
  neon: 'neon', crystal: 'crystal', clock: 'clock', cosmos: 'cosmos', ocean: 'ocean', volcano: 'volcano',
  paper: 'paper', sketch: 'sketch', inverse: 'inverse',
};

export function musicFor(c: MusicCtx): string | null {
  if (c.phase === 'select') return 'menu';
  if (c.phase === 'over') return null;
  if (c.bonusY1 > 0 && c.y >= c.bonusY0 && c.y < c.bonusY1) return 'bonus';
  return WORLD_TRACK[c.world] ?? 'neon';
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
