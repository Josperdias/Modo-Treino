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
};

export type ArcadeSave = {
  v: 1;
  unlocked: boolean;
  /** Recorde de pontos e de metros por personagem. */
  best: Record<Hero, number>;
  bestMeters: Record<Hero, number>;
  plays: number;
  settings: ArcadeSettings;
};

export const SAVE_KEY = 'arcade.v1';

export const DEFAULT_SAVE: ArcadeSave = {
  v: 1,
  unlocked: false,
  best: {josperd: 0, camila: 0},
  bestMeters: {josperd: 0, camila: 0},
  plays: 0,
  settings: {hero: 'josperd', control: 'touch', tiltInvert: false, haptics: false, perf: false, sfx: false, music: false},
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
  return {
    v: 1,
    unlocked: r.unlocked === true,
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
