/**
 * Pixel art do jogo (inimigos, poderes, balas, ícones). Puro: só dados e uma função de expansão,
 * sem Skia, para poder ser conferido por testes e por uma prévia em PNG (scripts/prever-pixelart.mjs).
 * Cada quadro é uma grade de letras; a letra aponta a cor na paleta do sprite; '.' é transparente.
 * `sym: true` = as linhas descrevem só a metade esquerda e o desenho é espelhado.
 */

export type PixelSprite = {
  pal: Record<string, string>;
  rows: string[];
  sym?: boolean;
};

const INK = '#10091f';

/** Expande para a grade completa (com espelho, se for simétrico). */
export function expand(s: PixelSprite): string[] {
  if (!s.sym) return s.rows;
  return s.rows.map((r) => r + [...r].reverse().join(''));
}

export const sizeOf = (s: PixelSprite) => {
  const g = expand(s);
  return {w: g[0].length, h: g.length};
};


/** Esfera pixelada com sombreamento (luz no canto superior esquerdo) e brilho; devolve só as linhas. */
function sphereRows(d: number, spikes: number): string[] {
  const size = d + spikes * 2;
  const c = (size - 1) / 2;
  const R = d / 2;
  const g: string[][] = Array.from({length: size}, () => Array.from({length: size}, () => '.'));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c, dist = Math.hypot(dx, dy);
      if (dist > R) continue;
      if (dist > R - 1.1) { g[y][x] = 'k'; continue; }
      const lit = (-dx - dy) / (2 * R); // -1 (sombra) … 1 (luz)
      g[y][x] = lit > 0.55 ? 'C' : lit > 0.05 ? 'c' : lit > -0.45 ? 'b' : 'n';
    }
  }
  // brilho
  const hx = Math.round(c - R * 0.38), hy = Math.round(c - R * 0.38);
  g[hy][hx] = 'w'; g[hy][hx + 1] = 'w'; g[hy + 1][hx] = 'w';
  // espinhos nos 4 pontos cardeais (2 de largura) e miolo roxo
  for (let i = 0; i < spikes; i++) {
    for (const o of [0, 1]) {
      g[i][Math.floor(c) + o] = i === 0 ? 'k' : 'v';
      g[size - 1 - i][Math.floor(c) + o] = i === 0 ? 'k' : 'v';
      g[Math.floor(c) + o][i] = i === 0 ? 'k' : 'v';
      g[Math.floor(c) + o][size - 1 - i] = i === 0 ? 'k' : 'v';
    }
  }
  const mid = Math.floor(c);
  for (const [x, y] of [[mid, mid], [mid + 1, mid], [mid, mid + 1], [mid + 1, mid + 1], [mid - 1, mid], [mid + 2, mid], [mid, mid - 1], [mid + 1, mid + 2]]) if (g[y]?.[x] && g[y][x] !== 'k') g[y][x] = 'v';
  return g.map((r) => r.join(''));
}

/* ---------- inimigos ---------- */

const DRONE_PAL = {k: INK, p: '#a63ce7', P: '#d889ff', d: '#2a1745', r: '#ff5470', R: '#ffd0d8', c: '#4fe9f2', C: '#c4fbff', m: '#ff4fb2', y: '#ffe38f'};
/** Drone: cúpula roxa, olho vermelho, hélices laterais que batem (2 quadros), luz de baixo rosa. */
export const DRONE: PixelSprite[] = [
  {
    pal: DRONE_PAL, sym: true,
    rows: [
      '..........kkkkk',
      '........kkPPPPP',
      '......kkPPppppp',
      '.....kPppppdddd',
      'kCCCckpppdddddd',
      'kcccckppddrrrrr',
      '.kkkkkppddrRRrr',
      '......kmpddrrrr',
      '.......kmpppppp',
      '........kmmmmpp',
      '.........kkkkkk',
    ],
  },
  {
    pal: DRONE_PAL, sym: true,
    rows: [
      '..........kkkkk',
      '........kkPPPPP',
      'kCCCCk..kPPppppp',
      '.kcccckkPppppddd',
      '..kkkkkkpppddddd',
      '......kppddrrrrr',
      '......kppddrRRrr',
      '......kmpddrrrrr',
      '.......kmpppppp.',
      '........kmmmmpp.',
      '.........kkkkkk.',
    ].map((r) => r.slice(0, 15).padEnd(15, '.')),
  },
];

const ZIG_PAL = {k: INK, b: '#3b5bdc', B: '#7aa0ff', d: '#1d2a66', e: '#fff59c', E: '#ffffff', g: '#55ebf6', G: '#c9ffff', v: '#7c4dff'};
/** Zigue-zague: morcego de cristal com asas pontudas e olho amarelo; asas sobem/descem. */
export const ZIGZAG: PixelSprite[] = [
  {
    pal: ZIG_PAL, sym: true,
    rows: [
      'k..........kkkk',
      'kk.......kkBBBB',
      'kbk....kkBBbbbb',
      'kbbk..kBbbbdddd',
      'kgbbkkbbbdddeee',
      '.kgbbbbbddddeEe',
      '..kgbbbbdddddee',
      '...kkbbbbbvvvvv',
      '.....kkkbbbbvvv',
      '.......kkkkkkkk',
    ],
  },
  {
    pal: ZIG_PAL, sym: true,
    rows: [
      '...............',
      '...........kkkk',
      '..........kkBBB',
      'kkkk.....kBbbbb',
      'kggbkkkkkbbbddd',
      'kGgbbbbbbbdddee',
      '.kgbbbbbbddddeE',
      '..kkbbbbbbvvvve',
      '....kkkkbbbbvvv',
      '........kkkkkkk',
    ],
  },
];

const TUR_PAL = {k: INK, m: '#5b4670', M: '#9a7cc0', d: '#2a1f3a', o: '#f5b15e', O: '#ffe0a8', t: '#deb47c', g: '#73fff0', r: '#ff4167', R: '#ffb3c2'};
/** Torre: base larga, corpo roxo, cano laranja; no segundo quadro o "olho" fica vermelho (vai atirar). */
export const TURRET: PixelSprite[] = [
  {
    pal: TUR_PAL, sym: true,
    rows: [
      '.........kkkkkk',
      '.........kggggg',
      '.......kkkkkkkk',
      '.....kkmmMMMMMM',
      '....kmMMmmmmmmm',
      '....kmMmmddddoo',
      '....kmMmmdoOOOO',
      '....kmMmmdoOOOO',
      '....kmmmmddddoo',
      '..kkkmmmmmmmmmm',
      '.ktttttttttttkk',
      '.kttOOOOOOOOtkk',
      '.kkkkkkkkkkkkkk',
    ],
  },
  {
    pal: TUR_PAL, sym: true,
    rows: [
      '.........kkkkkk',
      '.........krrRRR',
      '.......kkkkkkkk',
      '.....kkmmMMMMMM',
      '....kmMMmmmmmmm',
      '....kmMmmddddoo',
      '....kmMmmdoOOOO',
      '....kmMmmdoOOOO',
      '....kmmmmddddoo',
      '..kkkmmmmmmmmmm',
      '.ktttttttttttkk',
      '.kttOOOOOOOOtkk',
      '.kkkkkkkkkkkkkk',
    ],
  },
];

const ORB_PAL = {k: INK, c: '#28d8fd', C: '#b9f7ff', b: '#1a8fd0', n: '#14589c', v: '#7b3fd8', w: '#ffffff'};
/** Orbe: esfera de energia com espinhos em cruz; os espinhos crescem e encolhem (2 quadros). */
export const ORB: PixelSprite[] = [{pal: ORB_PAL, rows: sphereRows(18, 3)}, {pal: ORB_PAL, rows: sphereRows(18, 5)}].map((o) => ({...o, rows: o.rows.map((r) => r.padStart(0))}));

const GUA_PAL = {k: INK, m: '#4b2859', n: '#6c3a86', M: '#d94ea6', L: '#ff9bd6', d: '#211634', c: '#72e7ff', C: '#d8fbff', o: '#ffc267', O: '#fff0c4', r: '#ff4167', y: '#ffe36c'};
const guardianRows = (eye: 'c' | 'r') => [
  '.......kkkkk',
  '.......kyyOO',
  '.......kkkkk',
  '.....kkkMMMM',
  '...kkMMMMMLL',
  '..kMMMMMMMML',
  '..kMkkkkkkkk',
  '.kMMkdddddd'+'d',
  '.kMMkdd'+eye+eye+'CCC',
  '.kMMkdd'+eye+eye+'CCC',
  '.kMMkddddddd',
  '.kMMkkkkkkkk',
  '..kmMMMMMMMM',
  '..kmmkkkkkkk',
  '..kmmkmkmkmk',
  'kookmmmmmmmm',
  'kOokkkmmnnnn',
  'kookmmmmmmmm',
  '.kk.kmmmmmmm',
  '.....kkkkkkk',
];
/** Guardião (chefe de 3 vidas): cabeça grande com visor, punhos laranja; no 2º quadro o visor fica vermelho. */
export const GUARDIAN: PixelSprite[] = [{pal: GUA_PAL, sym: true, rows: guardianRows('c')}, {pal: GUA_PAL, sym: true, rows: guardianRows('r')}];

const UFO_PAL = {k: INK, g: '#7a86c8', G: '#b9c4ff', d: '#3a3f7a', c: '#7ff6ff', C: '#e6ffff', y: '#ffe36c', r: '#ff4f6d', m: '#ff7ad9'};
const ufoRows = (lights: [string, string]) => [
  '........kkkkkk',
  '......kkcccCCC',
  '.....kcccCCCCC',
  '....kccccccCCC',
  '..kkkkkkkkkkkk',
  '.kGGGGGgggggdd',
  'kGggggggggdddd',
  'k' + 'gg' + lights[0] + 'gggg' + lights[1] + 'gg' + 'dd',
  '.kdddddddddddd',
  '..kkkddddkkkkk',
  '.....kkkk.....',
];
/** Disco voador (Cosmos): cúpula azul, casco metálico e luzes que alternam (2 quadros). */
export const UFO: PixelSprite[] = [{pal: UFO_PAL, sym: true, rows: ufoRows(['y', 'm'])}, {pal: UFO_PAL, sym: true, rows: ufoRows(['m', 'y'])}];

const JELLY_PAL = {k: INK, p: '#ff7ad9', P: '#ffc4ef', d: '#b03a9a', w: '#ffffff', e: '#4fe9f2'};
const jellyRows = (wave: number) => [
  '.....kkkkkkk',
  '...kkkPPPPPP',
  '..kPPPPPPPPP',
  '.kPPwwPPPPPP',
  '.kPPwPPPPPpp',
  'kPPPPPPPPppp',
  'kPPPPkkPPppp',
  'kPPPPkePpppp',
  'kpppPPPpppdd',
  'kppppppppddd',
  '.kkpppppdddd',
  '..kkkkkkkkkk',
  ...(wave ? ['..kpk.kpk.kp', '...kpk.kpk.k', '..kpk.kpk.kp', '...kpk.kpk.k'] : ['...kpk.kpk.k', '..kpk.kpk.kp', '...kpk.kpk.k', '..kpk.kpk.kp']),
];
/** Água-viva (Fundo do Mar): cúpula rosa com brilho, olhos azuis e tentáculos que ondulam (2 quadros). */
export const JELLY: PixelSprite[] = [{pal: JELLY_PAL, sym: true, rows: jellyRows(0)}, {pal: JELLY_PAL, sym: true, rows: jellyRows(1)}];

const EMBER_PAL = {k: INK, Y: '#fff3a0', o: '#ffb347', r: '#ff5a2a', R: '#c4221a', w: '#ffffff'};
const emberRows = (flick: number) => [
  flick ? '......kk' : '.......k',
  flick ? '.....krr' : '......kr',
  '.....krr',
  '....kroo',
  '...krooY',
  '..kroooY',
  '.kroooYY',
  '.krooYYY',
  'krooYYYw',
  'krooYYYY',
  'krooYYYY',
  'kroooYYY',
  '.krooooY',
  '.kRrrooo',
  '..kRRrro',
  '...kkkkk',
];
/** Fagulha de lava (Vulcão): gota de fogo que salta do chão (2 quadros). */
export const EMBER: PixelSprite[] = [{pal: EMBER_PAL, sym: true, rows: emberRows(0)}, {pal: EMBER_PAL, sym: true, rows: emberRows(1)}];

const ROCK_PAL = {k: INK, C: '#e0cdb3', c: '#b09a82', b: '#76655a', n: '#4a3f3d', v: '#2d2522', w: '#fff3d6'};
/** Meteoro: rocha com crateras (a cauda de fogo é desenhada por cima). */
const rockRows = (() => {
  const g = sphereRows(15, 0).map((r) => r.split(''));
  for (const [x, y] of [[5, 8], [6, 8], [9, 5], [10, 5], [8, 10], [9, 10], [6, 11]]) if (g[y]?.[x] && g[y][x] !== 'k') g[y][x] = 'v';
  return g.map((r) => r.join(''));
})();
export const METEOR_SPRITE: PixelSprite = {pal: ROCK_PAL, rows: rockRows};

const MAGNET_PAL = {k: INK, r: '#ff3d5a', R: '#ff9aa8', w: '#ffffff', s: '#cfd6ee', d: '#8c95b8'};
/** Ímã em U com pontas brancas. */
export const MAGNET: PixelSprite = {
  pal: MAGNET_PAL,
  rows: [
    '..kkkkkkkkkk..',
    '.krrrrrrrrrrk.',
    'krRRrrrrrrrrrk',
    'krRrrkkkkrrrrk',
    'krRrk....krrrk',
    'krrrk....krrrk',
    'krrrk....krrrk',
    'kwwwk....kwwwk',
    'kwswk....kwswk',
    'kdddk....kdddk',
    '.kkk......kkk.',
  ],
};

const STAR_PAL = {k: INK, y: '#ffe36c', Y: '#fff7b8', o: '#ffa83d'};
const starRows = (big: boolean) => [
  '......kk......',
  '.....kYYk.....',
  '.....kYyk.....',
  '....kYyyyk....',
  'kkkkkYyyyykkkk',
  'kYYyyyyyyyyYYk',
  '.kYyyyyyyyyyk.',
  '..kyyyyyyyyk..',
  '...kyyoooyk...',
  '..kyyoyyoyyk..',
  '..kyoyk.kyok..',
  '..kkk....kkk..',
].map((r) => (big ? r : r));
/** Estrela de pontos (150 pts), brilha em 2 quadros. */
export const STAR: PixelSprite[] = [{pal: STAR_PAL, rows: starRows(true)}, {pal: {...STAR_PAL, y: '#fff0a0', Y: '#ffffff'}, rows: starRows(false)}];

/* ---------- itens ---------- */

const SHIELD_PAL = {k: INK, c: '#51ecff', C: '#d4ffff', b: '#2a8fb3', w: '#ffffff'};
/** Escudo: brasão com cruz clara no meio. */
export const SHIELD: PixelSprite = {
  pal: SHIELD_PAL, sym: true,
  rows: [
    'kkkkkkkk',
    'kCCCCCCC',
    'kCcccccw',
    'kCcccccw',
    'kCwwwwww',
    'kCwwwwww',
    'kCcccccw',
    'kcbccccw',
    '.kcbcccw',
    '.kcbbccw',
    '..kcbbcw',
    '...kcbbb',
    '....kkcb',
    '......kk',
  ],
};

const BOOT_PAL = {k: INK, y: '#ffe36c', Y: '#fff9c5', o: '#ff9b3d', m: '#632b59', p: '#fe76ad', s: '#9aa3c9', S: '#e9eeff'};
/** Sapatos de mola: tênis amarelo com mola de aço embaixo. */
export const BOOST: PixelSprite = {
  pal: BOOT_PAL,
  rows: [
    '.....kkkkk......',
    '....kYYYYYk.....',
    '....kYyyyyk.....',
    '....kyyyyyk.....',
    '....kyyyyykkkk..',
    '....kyyyyyyyyyk.',
    '....kooooooooyk.',
    '....kppppppppk..',
    '....kkkkkkkkkk..',
    '.....kSsSsSsk...',
    '....kSsSsSsSk...',
    '.....ksSsSsSk...',
    '....kSsSsSsSk...',
    '...kkkkkkkkkkk..',
  ],
};

const JET_PAL = {k: INK, r: '#ff4f6d', R: '#ff9fb0', y: '#ffe36c', c: '#51ecff', C: '#d4ffff', b: '#2a6fe0', w: '#ffffff'};
/** Boné de hélice (poder de subir). */
export const JET: PixelSprite[] = [
  {
    pal: JET_PAL, sym: true,
    rows: [
      'kCCCCCCCCCk',
      '.kkkkkkkkkkk'.slice(0, 11),
      '.........ky',
      '......kkkkk',
      '....kkrrRRR',
      '...krrrrrrr',
      '..krrrbbbbb',
      '..krrbbbwww',
      '..kkkkkkkkk',
    ],
  },
  {
    pal: JET_PAL, sym: true,
    rows: [
      '.....kCCCCC',
      '..kkkkkkkkk',
      '.........ky',
      '......kkkkk',
      '....kkrrRRR',
      '...krrrrrrr',
      '..krrrbbbbb',
      '..krrbbbwww',
      '..kkkkkkkkk',
    ],
  },
];

const HEART_PAL = {k: INK, r: '#ff3d6e', R: '#ff9db6', d: '#b01e4a'};
export const HEART: PixelSprite = {
  pal: HEART_PAL, sym: true,
  rows: [
    '..kkk..',
    '.kRRrrk',
    'kRRrrrr',
    'kRrrrrr',
    'kRrrrrr',
    '.krrrrr',
    '..krrrd',
    '...krdd',
    '....kdd',
    '.....kd',
  ].map((r) => r.padEnd(7, '.').slice(0, 7)),
};
export const HEART_EMPTY: PixelSprite = {
  pal: {k: '#3b2d57', e: '#241a3a'}, sym: true,
  rows: [
    '..kkk..',
    '.keeeek',
    'keeeeee',
    'keeeeee',
    'keeeeee',
    '.keeeee',
    '..keeee',
    '...keee',
    '....kee',
    '.....ke',
  ].map((r) => r.padEnd(7, '.').slice(0, 7)),
};

const FLAG_PAL = {k: INK, p: '#ffffff', f: '#ffe36c', F: '#fff6b8', g: '#ff4dac', G: '#ff9bd6', s: '#b9b9d8', t: '#8a6fd6'};
/** Bandeira de checkpoint: mastro, pano que ondula (2 quadros). */
export const FLAG: PixelSprite[] = [
  {
    pal: FLAG_PAL,
    rows: [
      '.kkkkkkkkkk.',
      '.kFFffGGggk.',
      '.kFfffGggk..',
      '.kFffGGgk...',
      '.kFfffGggk..',
      '.kFffGGggk..',
      '.kkkkkkkk...',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      'kkpkk.......',
      'ktttk.......',
      'kkkkk.......',
    ],
  },
  {
    pal: FLAG_PAL,
    rows: [
      '.kkkkkkkkkk.',
      '.kFFffGGgggk',
      '.kFfffGGggk.',
      '.kFffGGggk..',
      '.kFfffGGgk..',
      '.kFffGGgggk.',
      '.kkkkkkkkk..',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      '.kpk........',
      'kkpkk.......',
      'ktttk.......',
      'kkkkk.......',
    ],
  },
];

/* ---------- balas ---------- */
export const BULLET_ENEMY: PixelSprite = {
  pal: {k: INK, o: '#ffcd6e', O: '#fff3c4', r: '#ff6a3d'}, sym: true,
  rows: ['..kk', '.koO', 'kroO', 'kroO', '.kro', '..kk'].map((r) => r.padEnd(4, '.')),
};
export const BULLET_OWN: PixelSprite = {
  pal: {k: INK, c: '#62fff1', C: '#e6fffd'}, sym: true,
  rows: ['..k', '.kC', 'kcC', 'kcC', 'kcC', '.kc', '..k'].map((r) => r.padEnd(3, '.')),
};

/** Seta para cima do botão de tiro. */
export const ARROW_UP: PixelSprite = {
  pal: {k: INK, c: '#62fff1', C: '#e6fffd'}, sym: true,
  rows: ['...k', '..kC', '.kCc', 'kCcc', 'kkCc', '.kCc', '.kCc', '.kkk'].map((r) => r.padEnd(4, '.')),
};

export const ENEMY_SPRITES = {drone: DRONE, zigzag: ZIGZAG, turret: TURRET, orb: ORB, guardian: GUARDIAN, ufo: UFO, meteor: [METEOR_SPRITE, METEOR_SPRITE], jelly: JELLY, ember: EMBER} as const;
