/**
 * NEON STEP DX — parâmetros da Cidade Neon (dados, não lógica).
 * Rebalancear = mexer AQUI; a física e o gerador só leem estes números.
 * Unidades do mundo: 1 un. = 1 px do protótipo (campo de 420 de largura, y cresce para cima).
 * Os valores de física vêm do protótipo aprovado (g 1200, salto 690, mola 930, impulso 835).
 */
export const FIELD_W = 420;

export const PHYS = {
  /** Passo fixo da simulação (s). O desenho interpola na taxa da tela. */
  STEP: 1 / 120,
  G: 1200,
  JUMP: 690,
  BOOST: 835,
  SPRING: 930,
  /** Velocidade horizontal-alvo: base + nível*por-nível (limitado). */
  VX_BASE: 282,
  VX_PER_LEVEL: 8,
  VX_LEVEL_CAP: 38,
  /** Resposta horizontal: vx → alvo com constante k (1/s). Era `min(1, dt*14)` no protótipo. */
  ACCEL_K: 14,
  /** Folga horizontal para pousar além da borda da plataforma. */
  LAND_TOL: 19,
  /** Atravessar a lateral reaparece do outro lado depois desta margem. */
  WRAP_MARGIN: 40,
  START_X: 210,
  START_Y: 90,
  START_W: 118,
  /** Fração da altura da tela, a partir de baixo, onde o herói é mantido. */
  FOLLOW: 0.6,
  /** Queda abaixo da câmera que encerra a partida. */
  FALL_MARGIN: 70,
  /** Tempo da animação de pouso (s). */
  LAND_TIME: 0.12,
} as const;

export const SCORE = {
  /** Metros = (altura-90)/10; pontos de altura = (altura-90)/8 (igual ao protótipo). */
  HEIGHT_DIV: 8,
  METER_DIV: 10,
  TAPE: 75,
  COMBO_STEP: 18,
  COMBO_MAX: 5,
  COMBO_TIME: 7,
} as const;

/** Colisões do item "fita" (iguais ao protótipo; viram caixas por sprite nos próximos marcos). */
export const PICKUP = {
  HALF_W: 39,
  HALF_H: 64,
  /** Altura do centro da coleta em relação aos pés. */
  BODY_Y: 64,
  /** A fita flutua acima da plataforma. */
  ABOVE: 39,
} as const;

/** Níveis por altitude (metros), como no protótipo. */
export const LEVELS = [
  {from: 0, name: 'AQUECIMENTO'},
  {from: 70, name: 'TURBO'},
  {from: 145, name: 'ELETRIZANTE'},
  {from: 245, name: 'NEON HARD'},
  {from: 360, name: 'CAOS DX'},
] as const;

/**
 * Geração do mundo.
 * - `RAMP_M`: metros até a dificuldade máxima (d = 1).
 * - Ritmo: a intensidade oscila (tensão/respiro) com período `CYCLE` em unidades de altura
 *   (~57 s de jogo, como o `rhythmCycle` de 62 s do protótipo).
 * - Alcance: nenhum degrau passa de `GAP_MAX_FRAC` do ápice do salto normal.
 */
export const GEN = {
  RAMP_M: 220,
  CYCLE: 5000,
  /** Fração do ciclo (0..1) em que a intensidade cai para o respiro. */
  CALM_FLOOR: 0.68,
  MARGIN_X: 52,
  GAP_MIN: 86,
  GAP_MIN_HARD: 118,
  GAP_MAX: 118,
  GAP_MAX_HARD: 166,
  /** Nenhum degrau passa disto (≈ 85 % do ápice): a folga que o validador exige. */
  GAP_CAP: 168,
  /** Espessura mínima entre plataformas para não sobrepor desenhos. */
  CLEARANCE_Y: 34,
  WIDTH_NORMAL: [88, 44],
  WIDTH_MOVING: [74, 42],
  WIDTH_FRAGILE: [80, 46],
  WIDTH_SPRING: [82, 60],
  WIDTH_WIDE: [136, 92],
  /** Primeiros metros: só degraus fáceis. */
  WARMUP_M: 18,
  TAPE_CHANCE: 0.17,
  /** Quanto à frente da tela o mundo é gerado. */
  LOOKAHEAD: 480,
  /** Quanto atrás da câmera é descartado. */
  KEEP_BEHIND: 220,
} as const;

/** Pesos de padrões por intensidade (0..1). O valor é [fácil, difícil] e interpola. */
export const PATTERN_WEIGHTS = {
  stairs: [3, 1.6],
  tower: [2.2, 1],
  wide: [1.1, 0.45],
  scatter: [1.4, 1.6],
  fork: [0.4, 1.5],
  movers: [0.5, 2.2],
  zigzag: [0.3, 1.8],
  springPad: [0.35, 1.1],
  breakables: [0.35, 1.7],
} as const;

/** Ao entrar em cada padrão, a partir de qual intensidade ele é permitido. */
export const PATTERN_MIN_INTENSITY = {
  stairs: 0,
  tower: 0,
  wide: 0,
  scatter: 0.08,
  fork: 0.13,
  movers: 0.16,
  zigzag: 0.22,
  springPad: 0.2,
  breakables: 0.26,
} as const;

/**
 * Apresentação de novidades: cada padrão novo é FORÇADO uma vez nesta altitude (metros), para o jogador
 * conhecer plataformas móveis, quebráveis e mola cedo, em vez de esperar o sorteio.
 */
export const INTRO = [
  {pattern: 'fork', m: 18},
  {pattern: 'movers', m: 34},
  {pattern: 'breakables', m: 54},
  {pattern: 'springPad', m: 76},
  {pattern: 'zigzag', m: 100},
] as const;

/* ------------------------------------------------------------------ */
/* M2: vidas, combate, poderes, mundos                                 */
/* ------------------------------------------------------------------ */

export const LIFE = {
  START: 2,
  MAX: 3,
  SHIELD_MAX: 2,
  /** Invencibilidade depois de levar dano / de bloquear com escudo / ao entrar num mundo ou reviver (s). */
  AFTER_HIT: 1.8,
  AFTER_SHIELD: 1.2,
  AFTER_WORLD: 2.5,
  AFTER_REVIVE: 3,
} as const;

export const POWER = {
  /** Sapatos de mola: pulos com BOOST durante este tempo (s). */
  BOOST_TIME: 9,
  /** Hélice: sobe sozinho e destrói o que tocar (s). */
  JET_TIME: 2.1,
  JET_SPEED: 640,
} as const;

export const COMBAT = {
  FIRE_COOLDOWN: 0.38,
  BULLET_SPEED: 600,
  /** Quicada ao pisar num inimigo. */
  STOMP_SPEED: 770,
  /** Tiros inimigos: velocidade = BASE + nível * PER_LEVEL (limitada). */
  ENEMY_BULLET_BASE: 104,
  ENEMY_BULLET_PER_LEVEL: 13,
  ENEMY_BULLET_CAP: 196,
  ENEMY_BULLETS_MAX: 4,
  /** Aviso (s) antes do tiro: o inimigo pisca. */
  TELEGRAPH: 0.72,
  /** Só atiram a partir desta altitude (m), para a abertura ser limpa. */
  SHOOT_FROM_M: 50,
  KNOCKBACK_VY: 420,
  KNOCKBACK_VX: 170,
} as const;

export const SCORE_M2 = {KILL: 60, GUARDIAN: 240, HEART: 40, FLAG: 40, POWER: 20, PORTAL: 150} as const;

/** Inimigos: caixa de colisão (meia-largura/altura = size), vida e movimento. */
export const ENEMIES = {
  drone: {size: 20, hp: 1, shoots: true},
  zigzag: {size: 18, hp: 1, shoots: false},
  turret: {size: 24, hp: 2, shoots: true},
  orb: {size: 18, hp: 1, shoots: false},
  guardian: {size: 27, hp: 3, shoots: true},
} as const;

export const SPAWN = {
  /** Primeiro inimigo (m) e espaçamento médio (m) no começo e no fim da rampa. */
  FROM_M: 38,
  GAP_M: [46, 22],
  /** Chance de o inimigo ficar NO caminho (bloqueio) em vez de ao lado, por intensidade. */
  BLOCK: [0.15, 0.5],
  GUARDIAN_FROM_M: 200,
  GUARDIAN_CHANCE: 0.08,
  /** Poderes: primeiro (m) e espaçamento (m). */
  POWER_FROM_M: 75,
  POWER_GAP_M: [150, 230],
  /** Bandeira de checkpoint: primeira (m) e espaçamento (m). */
  FLAG_FROM_M: 95,
  FLAG_GAP_M: 220,
} as const;

/** Pesos por mundo: [tipo, peso, a partir de que altitude no mundo (m)]. */
export const ENEMY_TABLE = {
  neon: [['drone', 3, 0], ['zigzag', 2, 40], ['turret', 1.5, 70]],
  crystal: [['zigzag', 3, 0], ['orb', 3, 0], ['drone', 2, 20]],
  clock: [['turret', 3, 0], ['drone', 2, 0], ['orb', 1.5, 30]],
} as const;

export const POWER_TABLE = [['shield', 4], ['boost', 3], ['jet', 2], ['heart', 1.2]] as const;

export type WorldId = 'neon' | 'crystal' | 'clock';
export const WORLD_ORDER: readonly WorldId[] = ['neon', 'crystal', 'clock'];

export const WORLDS = {
  neon: {name: 'CIDADE NEON'},
  crystal: {name: 'DIMENSÃO CRISTAL'},
  clock: {name: 'MUNDO MECÂNICO'},
} as const;

export const PORTAL = {
  /** Primeiro portal (m de altitude) e distância mínima entre portais (m) dentro de cada mundo. */
  FIRST_M: 100,
  TRAVEL_M: 130,
  /** Depois de um portal perdido, o próximo vem tantos metros adiante. */
  MISS_RETRY_M: 90,
  /** Caixa de contato (igual ao protótipo). */
  HALF_W: 34,
  HALF_H: 47,
  /** Altura do centro do portal sobre a plataforma de apoio e afastamento lateral. */
  ABOVE: 74,
  SIDE: 82,
} as const;

/** Efeitos de mundo na horizontal. */
export const WORLD_FX = {
  /** Cristal: vento que alterna (un./s somadas ao alvo horizontal). */
  CRYSTAL_WIND: 46,
  CRYSTAL_PERIOD: 3.3,
  /** Mecânico: esteira empurra no pouso e o empurrão decai. */
  CLOCK_DRIFT: 150,
  CLOCK_DECAY: 1.5,
  CLOCK_CONVEYOR_CHANCE: 0.32,
} as const;
