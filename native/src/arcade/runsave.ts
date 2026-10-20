/**
 * Partida em andamento guardada no aparelho (chave `arcade.run.v1`): se o app fechar ou o sistema matar o processo,
 * o jogador volta de onde parou (pelo botão CONTINUAR do menu). Puro: sem React nem RN. A simulação é só dados
 * (sem funções), então vai e volta por JSON sem perder nada e continua idêntica (mesma semente + mesmo estado).
 */
import type {Sim} from './core/types.ts';
import type {Hero} from './save.ts';

export const RUN_KEY = 'arcade.run.v1';
const MAX_CHARS = 600_000;

export type RunSnapshot = {v: 1; hero: Hero; savedAt: number; meters: number; sim: Sim};

export function snapshotOf(sim: Sim, hero: Hero, meters: number, savedAt: number): string | null {
  if (sim.mode !== 'playing') return null;
  try {
    const raw = JSON.stringify({v: 1, hero, savedAt, meters, sim: {...sim, events: []}} satisfies RunSnapshot);
    return raw.length > MAX_CHARS ? null : raw;
  } catch { return null; }
}

const isArr = (v: unknown) => Array.isArray(v);
const fin = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Lê o que veio do disco; devolve null se estiver incompleto ou estranho (nunca lança). */
export function parseSnapshot(raw: string | null | undefined): RunSnapshot | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    const s = r?.sim;
    if (r?.v !== 1 || (r.hero !== 'josperd' && r.hero !== 'camila') || !s || typeof s !== 'object') return null;
    if (s.mode !== 'playing' || !fin(s.tick) || !fin(s.time) || !fin(s.viewH) || !fin(s.camera) || !fin(s.maxY) || !fin(s.score)) return null;
    if (!s.player || !fin(s.player.x) || !fin(s.player.y) || !fin(s.player.vy)) return null;
    if (!isArr(s.platforms) || !s.platforms.length || !isArr(s.items) || !isArr(s.enemies) || !isArr(s.bullets)) return null;
    if (!s.gen || typeof s.gen !== 'object' || !s.prng || typeof s.prng !== 'object') return null;
    return {v: 1, hero: r.hero, savedAt: fin(r.savedAt) ? r.savedAt : 0, meters: fin(r.meters) ? Math.max(0, Math.floor(r.meters)) : 0, sim: {...s, events: []} as Sim};
  } catch { return null; }
}
