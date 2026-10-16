import type {Rng} from './rng.ts';

export type PlatformType = 'start' | 'normal' | 'moving' | 'fragile' | 'spring';
export type PatternName =
  | 'start'
  | 'stairs'
  | 'tower'
  | 'wide'
  | 'scatter'
  | 'fork'
  | 'movers'
  | 'zigzag'
  | 'springPad'
  | 'breakables';

export type Platform = {
  id: number;
  x: number;
  y: number;
  w: number;
  type: PlatformType;
  /** Só plataformas móveis: fase, velocidade angular (rad/s) e amplitude (un.). */
  phase: number;
  speed: number;
  shift: number;
  broken: boolean;
  /** Padrão que gerou a plataforma (telemetria e testes de distribuição). */
  pattern: PatternName;
};

export type Item = {
  id: number;
  kind: 'tape';
  x: number;
  y: number;
  phase: number;
  hit: boolean;
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Posição do passo anterior, para interpolar o desenho. */
  px: number;
  py: number;
  /** Tempo restante da animação de pouso (s). */
  landTimer: number;
  /** 1 = direita, -1 = esquerda (orientação lógica, independente da arte). */
  facing: 1 | -1;
};

export type SimEvent =
  | {t: 'land'; plat: PlatformType; x: number; y: number}
  | {t: 'collect'; kind: 'tape'; x: number; y: number; combo: number}
  | {t: 'break'; x: number; y: number}
  | {t: 'level'; level: number}
  | {t: 'over'};

export type Gen = {
  rng: Rng;
  /** Topo atual da cadeia gerada. */
  x: number;
  y: number;
  /** Quantos padrões já foram gerados. */
  count: number;
  last: PatternName;
  /** Quantos degraus seguidos o último padrão repetiu (evita monotonia). */
  repeat: number;
  /** Padrões desde o último "respiro" (wide/fork/springPad). */
  sinceWide: number;
  nextId: number;
};

export type Mode = 'playing' | 'over';

export type Sim = {
  seed: number;
  tick: number;
  /** Tempo de simulação em segundos (tick * STEP). */
  time: number;
  mode: Mode;
  player: Player;
  camera: number;
  prevCamera: number;
  /** Altura visível (un.). Só afeta câmera e quanto mundo é gerado à frente. */
  viewH: number;
  platforms: Platform[];
  items: Item[];
  gen: Gen;
  score: number;
  maxY: number;
  tapes: number;
  combo: number;
  comboTime: number;
  level: number;
  /** Eventos do último `step`/`advance` (o chamador consome e limpa). */
  events: SimEvent[];
};

/** Entrada do jogador: eixo horizontal analógico em [-1, 1] (toque = -1/0/1; inclinação = contínuo). */
export type Input = {axis: number};
