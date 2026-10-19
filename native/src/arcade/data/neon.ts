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
  RAMP_M: 240,
  CYCLE: 5000,
  /** Fração do ciclo (0..1) em que a intensidade cai para o respiro. */
  CALM_FLOOR: 0.8,
  MARGIN_X: 30,
  GAP_MIN: 74,
  GAP_MIN_HARD: 100,
  GAP_MAX: 116,
  GAP_MAX_HARD: 168,
  /** Nenhum degrau passa disto (≈ 85 % do ápice): a folga que o validador exige. */
  GAP_CAP: 168,
  /** Espessura mínima entre plataformas para não sobrepor desenhos. */
  CLEARANCE_Y: 34,
  WIDTH_NORMAL: [96, 38],
  WIDTH_MOVING: [80, 38],
  WIDTH_FRAGILE: [84, 40],
  WIDTH_SPRING: [80, 56],
  WIDTH_WIDE: [136, 80],
  /** Primeiros metros: só degraus fáceis. */
  WARMUP_M: 14,
  TAPE_CHANCE: 0.17,
  /** Quanto à frente da tela o mundo é gerado. */
  LOOKAHEAD: 480,
  /** Quanto atrás da câmera é descartado. */
  KEEP_BEHIND: 220,
} as const;

/**
 * Tipos de plataforma por altitude: peso = lerp(fácil, difícil, intensidade) a partir de `from` (m).
 * O resto do peso é plataforma comum (peso 1). Mais difícil = mais tipos traiçoeiros.
 */
export const TYPE_TABLE = {
  moving: {from: 12, w: [0.42, 0.55]},
  fragile: {from: 20, w: [0.3, 0.48]},
  spring: {from: 34, w: [0.12, 0.08]},
} as const;

/** Padrões (agora são "humores" do acaso, não escadinhas): [peso fácil, peso difícil, a partir da intensidade]. */
export const PATTERN_TABLE = {
  chaos: [6, 7, 0],
  cluster: [1, 1.6, 0.08],
  drought: [0, 1.3, 0.2],
  springPad: [0.45, 0.8, 0.12],
  ladder: [0.7, 0.1, 0],
} as const;

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
  /** Ímã: puxa as fitas num raio por este tempo (s). */
  MAGNET_TIME: 9,
  MAGNET_R: 170,
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

export const SCORE_M2 = {KILL: 60, GUARDIAN: 240, HEART: 40, FLAG: 40, POWER: 20, PORTAL: 150, STAR: 150} as const;

/** Inimigos: caixa de colisão (meia-largura/altura = size), vida e movimento. */
export const ENEMIES = {
  drone: {size: 20, hp: 1, shoots: true},
  zigzag: {size: 18, hp: 1, shoots: false},
  turret: {size: 24, hp: 2, shoots: true},
  orb: {size: 18, hp: 1, shoots: false},
  guardian: {size: 27, hp: 3, shoots: true},
  /** Cosmos: disco voador (2 vidas, tiro em leque), meteoro que cai em laço, buraco negro (puxa; indestrutível). */
  ufo: {size: 22, hp: 2, shoots: true},
  meteor: {size: 17, hp: 1, shoots: false},
  blackhole: {size: 20, hp: 99, shoots: false},
  /** Papel: clipe de papel que sobe e desce. */
  clip: {size: 17, hp: 1, shoots: false},
  /** Fundo do Mar: água-viva que sobe e desce balançando (2 vidas, atira bolhas). */
  jelly: {size: 20, hp: 2, shoots: true},
  /** Vulcão: fagulha de lava que salta do chão em arco. */
  ember: {size: 16, hp: 1, shoots: false},
} as const;

/** Buraco negro: raio da atração e força (un./s² somadas ao empurrão lateral). */
export const BLACKHOLE = {PULL_R: 120, PULL: 380} as const;
/** Meteoro: altura do laço (un.) e quanto leva uma volta (s). */
export const METEOR = {SPAN: 760, LOOP: 3.6} as const;

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
  neon: [['drone', 3, 0], ['zigzag', 2, 40], ['turret', 1.5, 70], ['blackhole', 0.6, 160]],
  crystal: [['zigzag', 3, 0], ['orb', 3, 0], ['drone', 2, 20], ['blackhole', 0.5, 140]],
  clock: [['turret', 3, 0], ['drone', 2, 0], ['orb', 1.5, 30], ['blackhole', 0.6, 140]],
  cosmos: [['meteor', 3, 0], ['ufo', 2.4, 10], ['orb', 1.5, 0], ['blackhole', 1.4, 60], ['drone', 1, 30]],
  paper: [['clip', 3, 0], ['drone', 1.6, 10], ['zigzag', 2, 20]],
  ocean: [['jelly', 3, 0], ['zigzag', 2.4, 0], ['orb', 1.6, 20], ['blackhole', 0.5, 120]],
  volcano: [['ember', 3, 0], ['turret', 2, 10], ['drone', 1.6, 0], ['guardian', 0.4, 60]],
  inverse: [['ufo', 2, 0], ['orb', 2.4, 0], ['zigzag', 2.4, 0], ['drone', 1.6, 0]],
  sketch: [['clip', 2.4, 0], ['zigzag', 2.2, 0], ['drone', 1.8, 0], ['orb', 1.4, 20]],
} as const;

export const POWER_TABLE = [['shield', 4], ['boost', 3], ['jet', 2], ['heart', 1.2], ['magnet', 2.4]] as const;

export type WorldId = 'neon' | 'crystal' | 'clock' | 'cosmos' | 'paper' | 'ocean' | 'volcano' | 'inverse' | 'sketch';
/** Mundos-desvio: têm portal próprio, tamanho fixo e voltam ao mundo de origem por um portal VOLTAR. */
export const DETOURS: readonly WorldId[] = ['paper', 'sketch', 'inverse'];
/** Ordem dos portais comuns. O Papel é um desvio especial (portal próprio) e fica fora do ciclo. */
export const WORLD_ORDER: readonly WorldId[] = ['neon', 'crystal', 'clock', 'cosmos', 'ocean', 'volcano'];

export const WORLDS = {
  neon: {name: 'CIDADE NEON'},
  crystal: {name: 'DIMENSÃO CRISTAL'},
  clock: {name: 'MUNDO MECÂNICO'},
  cosmos: {name: 'COSMOS'},
  paper: {name: 'UNIVERSO DE PAPEL'},
  ocean: {name: 'FUNDO DO MAR'},
  volcano: {name: 'VULCÃO'},
  inverse: {name: 'QUEDA LIVRE'},
  sketch: {name: 'RASCUNHO'},
} as const;

/** Universo de Papel: faixa jogável (x) à esquerda da dobra; o outro herói é o espelho (W − x). */
export const PAPER = {LANE_MIN: 44, LANE_MAX: 168, WALL_MIN: 34, WALL_MAX: 176, LENGTH_M: 260} as const;

export const PORTAL = {
  /** Primeiro portal (m de altitude): bem longe; sorteado entre os dois valores. */
  FIRST_M: [700, 1000],
  /** Entre um portal e o próximo (m): sorteado. Nunca dois por perto. */
  GAP_M: [750, 1250],
  /** Depois de um portal perdido, o próximo vem tantos metros adiante. */
  MISS_RETRY_M: 420,
  /** Caixa de contato (igual ao protótipo). */
  HALF_W: 34,
  HALF_H: 47,
  /** Altura do centro do portal sobre a plataforma de apoio e afastamento lateral. */
  ABOVE: 74,
  SIDE: 82,
  /** Tipos de portal e peso (o do Papel só depois do primeiro portal e fora do próprio Papel). */
  KINDS: [['world', 5], ['paper', 2.2], ['bonus', 1.6], ['warp', 1.6], ['time', 1.5], ['leap', 1.1], ['flip', 1.7]],
  /** Fase bônus: comprimento (m) e atalho: segundos de voo e velocidade. */
  BONUS_M: 90,
  WARP_TIME: 2.6,
  WARP_SPEED: 900,
  /** Cronos: segundos de câmera lenta (inimigos e tiros) e a fração da velocidade. */
  TIME_SECONDS: 8,
  TIME_SCALE: 0.35,
} as const;

/**
 * Rascunho: a dobra do Papel se rasgou. As DUAS personagens continuam em cena (uma em x, a outra espelhada em W − x) e o campo
 * inteiro é jogável: o gerador cria só a metade esquerda (LANE) e CLONA tudo espelhado na direita, então o mundo é simétrico.
 * Quem pousa do lado direito da dobra fica com o controle invertido; a personagem do lado esquerdo tem o controle normal.
 */
export const SKETCH = {LENGTH_M: 150, WALL: 34, FOLD: 210, LANE_MIN: 44, LANE_MAX: 160, OFFER_AT_M: 110} as const;
/**
 * Queda livre: descida de verdade. O herói continua de pé, mas o mundo desce: a gravidade puxa para baixo, cada
 * pouso é só um saltinho (HOP) e o objetivo é cair de plataforma em plataforma. Um teto desce sozinho atrás de você
 * (SCROLL) e esmaga quem fica parado; a hélice vira mergulho.
 */
export const INVERSE = {LENGTH_M: 180} as const;
export const DESC = {HOP: 330, TERMINAL: 900, SCROLL: 44, SCROLL_PER_LEVEL: 3, TOP_FRAC: 0.36, CRUSH: 90, GAP: [80, 215]} as const;
/** Sala do portal: botão (plataforma) → portal azul trancado → barreira → portal laranja lá em cima. */
export const LAB = {FIRST_M: [300, 480], GAP_M: [450, 760], GATE_ABOVE: 170, EXIT_ABOVE_GATE: 130, HEAD: 84} as const;

/** Vulcão: a lava sobe sozinha; encostar nela machuca (e ela recua). */
export const LAVA = {SPEED: 92, GAP: 130, RESET_GAP: 220} as const;

/** Efeitos de mundo na horizontal. */
export const WORLD_FX = {
  /** Cristal: vento que alterna (un./s somadas ao alvo horizontal). */
  CRYSTAL_WIND: 46,
  CRYSTAL_PERIOD: 3.3,
  /** Mecânico: esteira empurra no pouso e o empurrão decai. */
  CLOCK_DRIFT: 150,
  CLOCK_DECAY: 1.5,
  CLOCK_CONVEYOR_CHANCE: 0.32,
  /** Fundo do Mar: correnteza que alterna (un./s somadas ao alvo horizontal). */
  OCEAN_CURRENT: 62,
  OCEAN_PERIOD: 4.6,
} as const;
