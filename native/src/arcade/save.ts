import {isDiscovery} from './discovery.ts';

/** Salvamento local do NEON STEP DX (chave `arcade.v1` no AsyncStorage). Puro: sem React nem RN. */
export type Hero = 'josperd' | 'camila';
export type Control = 'touch' | 'tilt';

export type ArcadeSettings = {
  hero: Hero;
  control: Control;
  /** Inverte o sentido da inclinação (o eixo do acelerômetro varia entre aparelhos). */
  tiltInvert: boolean;
  /** Vibração leve ao coletar/cair. Desligada por padrão. */
  haptics: boolean;
  /** Medidor de desempenho na tela (FPS, tempo de quadro). */
  perf: boolean;
  /** Efeitos sonoros e trilhas do jogo (originais, gerados por código). Desligados por padrão. */
  sfx: boolean;
  music: boolean;
  /** Volume do som do jogo: 1 baixo, 2 médio (padrão), 3 alto. */
  volume: 1 | 2 | 3;
  /** Modo leve (aparelho fraco): desenho simples e a 30 quadros/s desde o começo. Desligado: o jogo decide sozinho conforme o aparelho aguenta. */
  lite: boolean;
};

export type ArcadeSave = {
  v: 1;
  unlocked: boolean;
  /** Recorde de pontos e de metros por personagem. */
  best: Record<Hero, number>;
  bestMeters: Record<Hero, number>;
  plays: number;
  /** Diário: id da descoberta → número da partida em que foi vista pela primeira vez (veja `discovery.ts`). */
  found: Record<string, number>;
  /** Personagens com que já jogou (a descoberta "A dupla"). */
  played: Hero[];
  settings: ArcadeSettings;
};

export const SAVE_KEY = 'arcade.v1';

export const DEFAULT_SAVE: ArcadeSave = {
  v: 1,
  unlocked: false,
  best: {josperd: 0, camila: 0},
  bestMeters: {josperd: 0, camila: 0},
  plays: 0,
  found: {},
  played: [],
  settings: {hero: 'josperd', control: 'touch', tiltInvert: false, haptics: false, perf: false, sfx: false, music: false, volume: 2, lite: false},
};

const num = (v: unknown, max = 1e9) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
};

/** Aceita qualquer coisa vinda do disco e devolve um save válido (nunca lança). */
export function normalizeSave(raw: unknown): ArcadeSave {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const s = r.settings && typeof r.settings === 'object' ? r.settings : {};
  const b = r.best && typeof r.best === 'object' ? r.best : {};
  const m = r.bestMeters && typeof r.bestMeters === 'object' ? r.bestMeters : {};
  const f = r.found && typeof r.found === 'object' ? r.found : {};
  const found: Record<string, number> = {};
  for (const k of Object.keys(f)) if (isDiscovery(k)) found[k] = num(f[k], 1e7);
  const played = Array.isArray(r.played) ? (['josperd', 'camila'] as Hero[]).filter((h) => r.played.includes(h)) : [];
  return {
    v: 1,
    unlocked: r.unlocked === true,
    found,
    played,
    best: {josperd: num(b.josperd), camila: num(b.camila)},
    bestMeters: {josperd: num(m.josperd, 100000), camila: num(m.camila, 100000)},
    plays: num(r.plays, 1e7),
    settings: {
      hero: s.hero === 'camila' ? 'camila' : 'josperd',
      control: s.control === 'tilt' ? 'tilt' : 'touch',
      tiltInvert: s.tiltInvert === true,
      haptics: s.haptics === true,
      perf: s.perf === true,
      sfx: s.sfx === true,
      music: s.music === true,
      volume: s.volume === 1 ? 1 : s.volume === 3 ? 3 : 2,
      lite: s.lite === true,
    },
  };
}

export type RunResult = {hero: Hero; score: number; meters: number};

/** Aplica o resultado de uma partida; devolve o novo save e se bateu o recorde. */
export function recordRun(save: ArcadeSave, run: RunResult): {save: ArcadeSave; record: boolean} {
  const record = run.score > save.best[run.hero];
  return {
    record,
    save: {
      ...save,
      plays: save.plays + 1,
      best: {...save.best, [run.hero]: Math.max(save.best[run.hero], num(run.score))},
      bestMeters: {...save.bestMeters, [run.hero]: Math.max(save.bestMeters[run.hero], num(run.meters, 100000))},
    },
  };
}

/** Registra descobertas novas (e o personagem usado). Devolve o mesmo objeto se nada mudou, para não regravar à toa. */
export function addFound(save: ArcadeSave, ids: readonly string[], hero?: Hero): ArcadeSave {
  const found = {...save.found};
  let changed = false;
  for (const id of ids) {
    if (isDiscovery(id) && found[id] === undefined) { found[id] = save.plays + 1; changed = true; }
  }
  let played = save.played;
  if (hero && !played.includes(hero)) { played = [...played, hero]; changed = true; }
  if (played.length >= 2 && found['feat:both'] === undefined) { found['feat:both'] = save.plays + 1; changed = true; }
  return changed ? {...save, found, played} : save;
}
