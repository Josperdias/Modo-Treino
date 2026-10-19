import {BlendMode, ClipOp, Skia, TileMode, type SkCanvas, type SkImage, type SkPaint, type SkPath} from '@shopify/react-native-skia';
import SPRITES from '../data/sprites.json';
import {clamp, mix, type Stage} from './pose';
import {glow, img, col} from './skutil';
import {pixelText, GLYPH_W} from './pixelfont';
import type {MenuImages} from './assets';

/**
 * Letreiros de pixel (estilo chiptune) e a tela de carregamento do menu, tudo desenhado em Skia.
 * Os textos usam a fonte 5×7 de `pixelfont.ts` (sem acento).
 */

export type Hero = 'josperd' | 'camila';
export const ACCENT: Record<Hero, {main: string; light: string}> = {
  josperd: {main: '#ff2fc8', light: '#ffa6ee'},
  camila: {main: '#2fd0ff', light: '#a6eeff'},
};

let pix: SkPaint | null = null;
/** Pincel sem suavização: pixel é quadrado. */
const Q = (hex: string, alpha = 1): SkPaint => {
  if (!pix) { pix = Skia.Paint(); pix.setAntiAlias(false); }
  pix.setShader(null);
  pix.setBlendMode(BlendMode.SrcOver);
  pix.setColor(col(hex));
  pix.setAlphaf(alpha);
  return pix;
};

type TextPaths = {cols: number; top: SkPath; low: SkPath; edge: SkPath};
const cache = new Map<string, TextPaths>();
/** Caminhos do texto em unidades de célula (1 = um pixel da fonte), criados uma vez por texto. */
function paths(text: string): TextPaths {
  let t = cache.get(text);
  if (t) return t;
  const {cells, cols} = pixelText(text);
  const top = Skia.Path.Make(), low = Skia.Path.Make(), edge = Skia.Path.Make();
  const lit = new Set(cells.map(([c, r]) => c + ',' + r));
  const ring = new Set<string>();
  for (const [c, r] of cells) {
    (r < 4 ? top : low).addRect(Skia.XYWHRect(c, r, 1, 1));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = c + dx + ',' + (r + dy);
      if (!lit.has(k) && !ring.has(k)) { ring.add(k); edge.addRect(Skia.XYWHRect(c + dx, r + dy, 1, 1)); }
    }
  }
  t = {cols, top, low, edge};
  cache.set(text, t);
  return t;
}

export type PixelStyle = {
  /** Cor do alto das letras e da metade de baixo (degradê em dois tons, como nos fliperamas). */
  top?: string;
  low?: string;
  /** Sombra dura (deslocada 1 célula para baixo/direita). */
  shadow?: string;
  alpha?: number;
  /** 0 → 1: quanto do texto já apareceu, da esquerda para a direita. */
  reveal?: number;
};

/** Texto de pixel centrado em (cx, cy); `cell` = tamanho do pixel da fonte na tela. */
export function drawPixelText(canvas: SkCanvas, text: string, cx: number, cy: number, cell: number, st: PixelStyle = {}) {
  const t = paths(text);
  const a = st.alpha ?? 1;
  const rv = st.reveal ?? 1;
  if (a <= 0.01 || rv <= 0) return;
  canvas.save();
  canvas.translate(Math.round(cx - (t.cols * cell) / 2), Math.round(cy - (7 * cell) / 2));
  canvas.scale(cell, cell);
  if (rv < 1) canvas.clipRect(Skia.XYWHRect(-2, -2, t.cols * rv + 2, 11), ClipOp.Intersect, false);
  if (st.shadow) {
    canvas.save(); canvas.translate(1, 1);
    canvas.drawPath(t.edge, Q('#07031a', a));
    canvas.drawPath(t.top, Q(st.shadow, a)); canvas.drawPath(t.low, Q(st.shadow, a));
    canvas.restore();
  }
  canvas.drawPath(t.edge, Q('#07031a', a));
  canvas.drawPath(t.top, Q(st.top ?? '#ffffff', a));
  canvas.drawPath(t.low, Q(st.low ?? st.top ?? '#ffffff', a));
  canvas.restore();
}

export const textWidth = (text: string, cell: number) => paths(text).cols * cell;

/** Ciclo do "PRESS START": aparece varrendo da esquerda, fica, pisca duas vezes e some. */
export function blinkCycle(time: number): {reveal: number; alpha: number} {
  const C = 1.9;
  const u = time % C;
  if (u < 0.32) return {reveal: u / 0.32, alpha: 1};
  if (u < 1.25) return {reveal: 1, alpha: 1};
  if (u < 1.31) return {reveal: 1, alpha: 0};
  if (u < 1.37) return {reveal: 1, alpha: 1};
  if (u < 1.43) return {reveal: 1, alpha: 0};
  if (u < 1.49) return {reveal: 1, alpha: 1};
  return {reveal: 1, alpha: 0};
}

/** PRESS START: letreiro de pixels no rodapé, com setas que piscam em contratempo. */
export function drawPressStart(canvas: SkCanvas, stage: Stage, hero: Hero, time: number, still: boolean, appear: number) {
  if (appear <= 0.01) return;
  const text = 'PRESS START';
  const cell = Math.max(2, Math.floor((0.84 * stage.w) / (11 * (GLYPH_W + 1) - 1 + 2 * (GLYPH_W + 3))));
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h * 0.925 + (1 - appear) * cell * 6;
  const ac = ACCENT[hero];
  const b = still ? {reveal: 1, alpha: 1} : blinkCycle(time);
  const a = appear * b.alpha;
  glow(canvas, ac.main, stage.w * 0.42, cx, cy, 0.32 * a * (still ? 1 : 0.6 + 0.4 * Math.sin(time * 5)), 1, 0.28);
  drawPixelText(canvas, text, cx, cy, cell, {top: '#ffffff', low: ac.light, shadow: ac.main, alpha: appear, reveal: b.alpha ? b.reveal : 1});
  // as setas piscam alternadas e "empurram" para dentro
  const tw = textWidth(text, cell);
  const step = still ? 0 : Math.floor(time * 4) % 2;
  const nudge = step * cell;
  const arrowA = still ? 1 : step === 0 ? 1 : 0.35;
  drawPixelText(canvas, '>', cx - tw / 2 - cell * 5 + nudge, cy, cell, {top: ac.light, low: ac.main, alpha: appear * arrowA * b.alpha});
  drawPixelText(canvas, '<', cx + tw / 2 + cell * 5 - nudge, cy, cell, {top: ac.light, low: ac.main, alpha: appear * arrowA * b.alpha});
}

/* ------------------------------------------------------------------ */
/* Tela de carregamento                                                */
/* ------------------------------------------------------------------ */

export type LoadFrame = {
  hero: Hero;
  /** Segundos desde que o carregando abriu. */
  time: number;
  /** 0 → 1 */
  progress: number;
  sprites: (SkImage | null)[] | null;
};

const TIPS = ['SEGURE OS LADOS DA TELA', 'PEGUE FITAS PARA O COMBO', 'SUBA O MAIS ALTO QUE PUDER', 'MOLAS DAO UM SUPER PULO'];
const BLOCKS = 16;

/** Estrelas de pixel: posições fixas por índice (sem aleatório), caindo devagar. */
const STARS = Array.from({length: 54}, (_, i) => {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  const g = Math.sin(i * 269.5 + 183.3) * 43758.5453;
  return {x: h - Math.floor(h), y: g - Math.floor(g), s: 1 + (i % 3), sp: 0.015 + 0.03 * (i % 4), ph: i * 0.7, tint: i % 5 === 0 ? '#ff7be8' : i % 5 === 1 ? '#6be7ff' : '#ffffff'};
});

export function drawLoading(canvas: SkCanvas, W: number, H: number, stage: Stage, im: MenuImages, f: LoadFrame, still: boolean) {
  const s = stage;
  const hero = f.hero;
  const ac = ACCENT[hero];
  const t = still ? 0 : f.time;
  const cell = Math.max(2, Math.floor(s.w / 110)); // "pixel de tela" dos detalhes
  const base = Q('#05021a'); canvas.drawRect(Skia.XYWHRect(0, 0, W, H), base);

  // Fundo do personagem, bem escurecido, esticado no palco.
  img(canvas, hero === 'josperd' ? im.bgL : im.bgR, s.x, 0, s.w, H, 0.5);
  const veil = Q('#07031f', 0.55); canvas.drawRect(Skia.XYWHRect(0, 0, W, H), veil);
  glow(canvas, ac.main, s.w * 0.9, s.x + s.w / 2, H * 0.55, 0.35, 1, 1.3);

  // Estrelas de pixel caindo (ou paradas com "reduzir movimento").
  for (const st of STARS) {
    const y = ((st.y + t * st.sp) % 1) * H;
    const tw = still ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + st.ph));
    const sz = st.s * cell * 0.7;
    canvas.drawRect(Skia.XYWHRect(Math.round(s.x + st.x * s.w), Math.round(y), sz, sz), Q(st.tint, tw));
  }

  // Piso de grade em perspectiva (rolando para o jogador).
  const horizon = H * 0.64, vx = s.x + s.w / 2;
  const g = Q(ac.main, 1);
  g.setStyle(1); g.setStrokeWidth(Math.max(1, cell * 0.45));
  const scroll = still ? 0 : (t * 0.6) % 1;
  for (let i = 0; i < 9; i++) {
    const k = (i + scroll) / 9;
    const y = mix(horizon, H, k * k);
    g.setAlphaf(0.15 + 0.5 * k);
    canvas.drawLine(s.x, y, s.x + s.w, y, g);
  }
  for (let i = -8; i <= 8; i++) {
    g.setAlphaf(0.32);
    canvas.drawLine(vx + i * s.w * 0.012, horizon, vx + i * s.w * 0.17, H, g);
  }
  g.setStyle(0);

  // Personagem grande, entrando e continuando a avançar (escala) com respiração.
  const e = clamp(t / 0.55, 0, 1), ease = 1 - Math.pow(1 - e, 3);
  const hi = hero === 'josperd' ? im.heroL : im.heroR;
  if (hi) {
    const aspect = hi.width() / hi.height();
    const w = s.w * 0.7 * (0.86 + 0.14 * ease + 0.06 * f.progress);
    const h = w / aspect;
    const bob = still ? 0 : Math.sin(t * 2.4) * h * 0.008;
    img(canvas, hi, s.x + s.w / 2 - w / 2, H * 0.745 - h + (1 - ease) * H * 0.07 + bob, w, h, ease);
  }

  // Logo no alto, respirando.
  const lg = im.logo;
  if (lg) {
    const w = s.w * 0.84, h = w * (lg.height() / lg.width());
    const sc = 1 + (still ? 0 : 0.025 * Math.sin(t * 4.2));
    glow(canvas, '#ff07cb', w * 0.5, s.x + s.w / 2, s.y + s.h * 0.15, 0.22, 1, 0.5);
    canvas.save();
    canvas.translate(s.x + s.w / 2, s.y + s.h * 0.15);
    canvas.scale(sc, sc);
    img(canvas, lg, -w / 2, -h / 2, w, h, ease);
    canvas.restore();
  }

  // Degradê escuro embaixo para o texto ler bem.
  const shade = Skia.Paint();
  shade.setShader(Skia.Shader.MakeLinearGradient({x: 0, y: H * 0.72}, {x: 0, y: H}, [col('#05021a00'), col('#05021af0')], null, TileMode.Clamp));
  canvas.drawRect(Skia.XYWHRect(0, H * 0.72, W, H * 0.28), shade);

  // "CARREGANDO..." em pixels, com pontinhos que contam.
  const bigCell = Math.max(2, Math.floor((0.7 * s.w) / 66));
  const dots = still ? 3 : Math.floor(t * 3) % 4;
  const label = 'CARREGANDO' + '.'.repeat(dots);
  const ly = s.y + s.h * 0.775;
  drawPixelText(canvas, label.padEnd(13, ' '), s.x + s.w / 2, ly, bigCell, {top: '#ffffff', low: ac.light, shadow: ac.main});

  // Barra de blocos + percentual.
  const bw = s.w * 0.74, bh = Math.max(16, s.h * 0.026);
  const bx = s.x + (s.w - bw) / 2, by = s.y + s.h * 0.865;
  canvas.drawRect(Skia.XYWHRect(bx - cell, by - cell, bw + cell * 2, bh + cell * 2), Q('#07031a'));
  const fr = Q(ac.light); fr.setStyle(1); fr.setStrokeWidth(cell);
  canvas.drawRect(Skia.XYWHRect(bx - cell / 2, by - cell / 2, bw + cell, bh + cell), fr);
  fr.setStyle(0);
  const bwBlock = bw / BLOCKS;
  const lit = Math.floor(f.progress * BLOCKS + 1e-6);
  for (let i = 0; i < BLOCKS; i++) {
    const x = bx + i * bwBlock + cell * 0.4, w = bwBlock - cell * 0.8;
    if (i < lit) {
      canvas.drawRect(Skia.XYWHRect(x, by + cell * 0.5, w, bh - cell), Q(ac.main));
      canvas.drawRect(Skia.XYWHRect(x, by + cell * 0.5, w, (bh - cell) * 0.35), Q('#ffffff', 0.55)); // brilho no alto
    } else canvas.drawRect(Skia.XYWHRect(x, by + cell * 0.5, w, bh - cell), Q('#ffffff', 0.07));
  }
  const pct = Math.min(100, Math.round(f.progress * 100)) + '%';
  const pc = Math.max(2, Math.floor(cell * 0.9));
  drawPixelText(canvas, pct, bx + bw - textWidth(pct, pc) / 2, by + bh + cell * 6, pc, {top: '#ffffff', low: ac.light, alpha: 0.95});

  // O personagem de pixel pula ao longo da barra.
  const set = f.sprites, frames = (SPRITES as any).characters[hero].frames as {w: number; h: number; pivotX: number; pivotY: number}[];
  const facing = (SPRITES as any).nativeFacing[hero] as number;
  const air = still ? 0 : Math.abs(Math.sin(f.progress * Math.PI * 11 + t * 6));
  const fi = air > 0.35 ? 1 : 0;
  const si = set ? set[fi] : null;
  if (si) {
    const fm = frames[fi];
    const k = (bh * 1.7) / fm.h;
    const px = bx + f.progress * bw;
    const py = by - cell * 1.2 - air * bh * 0.7;
    canvas.save();
    canvas.translate(px, py);
    canvas.scale(facing === 1 ? k : -k, k);
    const p = Q('#ffffff'); p.setAntiAlias(false);
    canvas.drawImageRect(si, Skia.XYWHRect(0, 0, si.width(), si.height()), Skia.XYWHRect(-fm.pivotX, -fm.pivotY, fm.w, fm.h), p);
    canvas.restore();
  }

  // Dica que troca a cada ~1,2 s.
  const tip = TIPS[Math.floor(t / 1.2) % TIPS.length];
  drawPixelText(canvas, tip, s.x + s.w / 2, s.y + s.h * 0.955, Math.max(2, Math.floor(cell * 0.75)), {top: '#e8eaff', alpha: 0.8});

  // Cortina de entrada: barras de pixel que abrem escalonadas (0 → 0,45 s).
  if (!still && t < 0.5) {
    const n = 14, bhh = H / n;
    for (let i = 0; i < n; i++) {
      const u = clamp((t - i * 0.018) / 0.28, 0, 1);
      if (u >= 1) continue;
      const w = W * (1 - u * u);
      const x = i % 2 ? 0 : W - w;
      canvas.drawRect(Skia.XYWHRect(x, i * bhh, w, bhh + 1), Q('#05021a'));
    }
  }

  // Linhas de varredura finas por cima (tela de tubo).
  const sc = Q('#000000', 0.07);
  for (let y = 0; y < H; y += cell * 2) canvas.drawRect(Skia.XYWHRect(0, y, W, Math.max(1, cell * 0.5)), sc);
}
