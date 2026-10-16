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
  RAMP_M: 300,
  CYCLE: 5000,
  /** Fração do ciclo (0..1) em que a intensidade cai para o respiro. */
  CALM_FLOOR: 0.55,
  MARGIN_X: 52,
  GAP_MIN: 82,
  GAP_MIN_HARD: 102,
  GAP_MAX: 108,
  GAP_MAX_HARD: 146,
  /** Espessura mínima entre plataformas para não sobrepor desenhos. */
  CLEARANCE_Y: 34,
  WIDTH_NORMAL: [100, 64],
  WIDTH_MOVING: [84, 62],
  WIDTH_FRAGILE: [92, 70],
  WIDTH_SPRING: [88, 74],
  WIDTH_WIDE: [150, 118],
  /** Primeiros metros: só degraus fáceis. */
  WARMUP_M: 28,
  TAPE_CHANCE: 0.2,
  /** Quanto à frente da tela o mundo é gerado. */
  LOOKAHEAD: 480,
  /** Quanto atrás da câmera é descartado. */
  KEEP_BEHIND: 220,
} as const;

/** Pesos de padrões por intensidade (0..1). O valor é [fácil, difícil] e interpola. */
export const PATTERN_WEIGHTS = {
  stairs: [3, 1.6],
  tower: [2.2, 1],
  wide: [1.2, 0.6],
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
  {pattern: 'fork', m: 28},
  {pattern: 'movers', m: 52},
  {pattern: 'breakables', m: 82},
  {pattern: 'springPad', m: 112},
  {pattern: 'zigzag', m: 150},
] as const;
