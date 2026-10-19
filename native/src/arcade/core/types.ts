import type {Rng} from './rng.ts';
import type {WorldId} from '../data/neon.ts';

export type {WorldId};

export type PlatformType = 'start' | 'normal' | 'moving' | 'fragile' | 'spring' | 'conveyor';
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
  | 'breakables'
  | 'portalPad';

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
  /** Só esteiras (mundo mecânico): sentido do empurrão (+1 direita, -1 esquerda); 0 nas demais. */
  dir: number;
};

export type ItemKind = 'tape' | 'shield' | 'boost' | 'jet' | 'heart' | 'flag' | 'portal';

export type Item = {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  phase: number;
  hit: boolean;
  /** Só portais: para onde levam. */
  target?: WorldId;
};

export type EnemyKind = 'drone' | 'zigzag' | 'turret' | 'orb' | 'guardian';

export type Enemy = {
  id: number;
  kind: EnemyKind;
  /** Âncora do movimento e posição atual (centro). */
  x0: number;
  y0: number;
  x: number;
  y: number;
  phase: number;
  speed: number;
  range: number;
  /** Meia-largura/altura da colisão. */
  size: number;
  hp: number;
  maxHp: number;
  /** Segundos até o próximo tiro (só quem atira). */
  cooldown: number;
  /** true nos instantes antes do tiro (o desenho pisca). */
  warn: boolean;
  alive: boolean;
};

export type Bullet = {id: number; x: number; y: number; vx: number; vy: number; own: boolean; alive: boolean};

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
  /** Empurrão lateral das esteiras (un./s), decai sozinho. */
  drift: number;
};

export type SimEvent =
  | {t: 'land'; plat: PlatformType; x: number; y: number}
  | {t: 'collect'; kind: 'tape'; x: number; y: number; combo: number}
  | {t: 'break'; x: number; y: number}
  | {t: 'pickup'; kind: ItemKind; x: number; y: number}
  | {t: 'hit'; x: number; y: number; blocked: boolean; lives: number}
  | {t: 'kill'; kind: EnemyKind; x: number; y: number; by: 'stomp' | 'shot' | 'jet'}
  | {t: 'shoot'; own: boolean; x: number; y: number}
  | {t: 'warn'; x: number; y: number}
  | {t: 'portal'; world: WorldId; x: number; y: number}
  | {t: 'revive'; x: number; y: number}
  | {t: 'over'; cause: 'fall' | 'damage'};

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
  /** Quantas apresentações de padrão novo (INTRO) já aconteceram. */
  intro: number;
  nextId: number;
  /** Mundo em que a geração está e altitude (y) onde ele começou. */
  world: WorldId;
  worldY0: number;
  /** Próximos marcos (y) para inimigo, poder, bandeira e portal. */
  nextEnemyY: number;
  nextPowerY: number;
  nextFlagY: number;
  portalY: number;
  portalPlaced: boolean;
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
  enemies: Enemy[];
  bullets: Bullet[];
  gen: Gen;
  /** Sorteio do jogo (tiros inimigos): separado do gerador, que só depende da semente e dos padrões. */
  prng: Rng;
  world: WorldId;
  lives: number;
  shields: number;
  /** Segundos restantes de sapatos de mola / hélice. */
  boost: number;
  jet: number;
  invuln: number;
  fireCd: number;
  /** 1 = há uma recuperação disponível (bandeira ou portal); gasta ao cair/morrer. */
  revive: number;
  kills: number;
  hits: number;
  portals: number;
  /** Pontos extras (abates, bandeiras, portais). */
  bonus: number;
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
export type Input = {axis: number; /** Atirar (segurar = repete no ritmo do cooldown). */ fire?: boolean};
