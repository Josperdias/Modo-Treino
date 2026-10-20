/**
 * Menu de seleção do NEON STEP DX — geometria e animação PURAS (sem React nem Skia).
 * Fonte: o menu V3.5 "Fluido" do dono (CSS em arcade/fonte/menu/). Todos os números abaixo vêm de lá;
 * aqui eles viram uma função `pose(t)`: t = -1 (Josperd), 0 (tela neutra), +1 (Camila).
 */

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** cubic-bezier(x1, y1, x2, y2) como no CSS (resolve x(t) por Newton + bisseção). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** A curva do protótipo (--motion-ease) e a duração (--motion = 760 ms). */
export const MOTION_EASE = cubicBezier(0.22, 1, 0.36, 1);
export const MOTION_MS = 760;

export type Stage = {x: number; y: number; w: number; h: number};

/** Palco 1:2 do protótipo. Em telas mais altas que 1:2 ele ocupa a tela toda; em telas mais largas fica centralizado. */
export function stageRect(W: number, H: number): Stage {
  if (H >= 2 * W) return {x: 0, y: 0, w: W, h: H};
  const w = H / 2;
  return {x: (W - w) / 2, y: 0, w, h: H};
}

export type Look = {dx: number; dy: number; scale: number; opacity: number; bright: number; sat: number};
const L = (dx: number, dy: number, scale: number, opacity: number, bright = 1, sat = 1): Look => ({dx, dy, scale, opacity, bright, sat});
const mixLook = (a: Look, b: Look, k: number): Look => ({
  dx: mix(a.dx, b.dx, k), dy: mix(a.dy, b.dy, k), scale: mix(a.scale, b.scale, k),
  opacity: mix(a.opacity, b.opacity, k), bright: mix(a.bright, b.bright, k), sat: mix(a.sat, b.sat, k),
});

// dx/dy em % do tamanho do PRÓPRIO elemento (como translate3d(%) no CSS).
const HERO_NEUTRAL = L(0, 0, 1, 0.99);
const HERO_L_SEL = L(5, 0, 1, 1, 1.05); // sem crescer (o protótipo usava 1.055; o dono pediu para não aumentar)
const HERO_L_OFF = L(-12, 1.1, 0.91, 0.74, 0.87, 0.84);
// Camila selecionada não cresce: a arte vai até a borda direita do quadro e o cabelo até a esquerda, então tudo precisa caber.
const HERO_R_SEL = L(-7, 0, 1, 1, 1.05);
const HERO_R_OFF = L(13, 1.1, 0.91, 0.74, 0.87, 0.84);
const INFO_NEUTRAL = L(0, 0, 1, 1);
const INFO_L_SEL = L(1, 0, 1.02, 1);
const INFO_L_OFF = L(-7, 1, 0.955, 0.76);
const INFO_R_SEL = L(-1, 0, 1.02, 1);
const INFO_R_OFF = L(7, 1, 0.955, 0.76);

export type Pose = {
  /** Linha divisória: x (em % da largura do palco) no topo e na base. */
  splitTop: number;
  splitBottom: number;
  /** Máscaras dos retratos (a do selecionado passa 6 % por cima do raio). */
  laneL: {top: number; bottom: number};
  laneR: {top: number; bottom: number};
  panelL: {bright: number; sat: number};
  panelR: {bright: number; sat: number};
  /** Deslocamento do raio (% da largura) e posição X do botão de setas (% da largura). */
  rayShift: number;
  swapX: number;
  heroL: Look; heroR: Look; infoL: Look; infoR: Look;
  /** Quem desenha por cima do raio (o selecionado). */
  front: 'left' | 'right' | null;
  /** 0 = tela neutra, 1 = alguém escolhido (mostra o botão JOGAR). */
  chosen: number;
};

export function pose(tIn: number): Pose {
  const t = clamp(tIn, -1, 1);
  const sj = clamp(-t, 0, 1); // peso de "Josperd escolhido"
  const sc = clamp(t, 0, 1); // peso de "Camila escolhida"
  const splitTop = 66 + sj * 7 - sc * 7;
  const splitBottom = 35 + sj * 8 - sc * 7;
  const dimmed = {bright: 0.74, sat: 0.83};
  const lit = {bright: 1.11, sat: 1};
  return {
    splitTop,
    splitBottom,
    laneL: {top: splitTop + 6 * sj, bottom: splitBottom + 6 * sj},
    laneR: {top: splitTop - 6 * sc, bottom: splitBottom - 6 * sc},
    panelL: {bright: mix(lit.bright, dimmed.bright, sc), sat: mix(lit.sat, dimmed.sat, sc)},
    panelR: {bright: mix(lit.bright, dimmed.bright, sj), sat: mix(lit.sat, dimmed.sat, sj)},
    rayShift: (0 - t) * 7,
    swapX: 50 + (0 - t) * 7,
    heroL: mixLook(mixLook(HERO_NEUTRAL, HERO_L_SEL, sj), HERO_L_OFF, sc),
    heroR: mixLook(mixLook(HERO_NEUTRAL, HERO_R_SEL, sc), HERO_R_OFF, sj),
    infoL: mixLook(mixLook(INFO_NEUTRAL, INFO_L_SEL, sj), INFO_L_OFF, sc),
    infoR: mixLook(mixLook(INFO_NEUTRAL, INFO_R_SEL, sc), INFO_R_OFF, sj),
    front: t < -0.001 ? 'left' : t > 0.001 ? 'right' : null,
    chosen: Math.max(sj, sc),
  };
}

export type Box = {x: number; y: number; w: number; h: number};

/** Caixas (em px da tela) das artes, a partir do palco. `aspect` = largura/altura da imagem. */
export function boxes(s: Stage) {
  const at = (wPct: number, leftPct: number, topPct: number, aspect: number): Box => {
    const w = wPct * s.w;
    return {x: s.x + leftPct * s.w, y: s.y + topPct * s.h, w, h: w / aspect};
  };
  const info = (leftPct: number): Box => {
    const w = 0.49 * s.w;
    const h = (w * 941) / 836;
    return {x: s.x + leftPct * s.w, y: s.y + s.h * 0.9 - h, w, h};
  };
  const bottomH = 0.105 * s.h;
  const swipeW = 0.76 * s.w;
  const swipeH = (swipeW * 245) / 740;
  return {
    heroL: at(0.75, -0.155, 0.221, 1024 / 1536),
    heroR: at(0.70, 0.30, 0.24, 941 / 1672), // cabe inteira no palco (neutro e selecionada)
    ghostL: at(0.7, -0.26, 0.12, 836 / 475),
    ghostR: at(0.7, 0.57, 0.13, 836 / 475),
    infoL: info(0.005),
    infoR: info(0.505),
    logo: at(0.72, 0.14, 0.017, 1518 / 1043),
    swipe: {x: s.x + 0.12 * s.w, y: s.y + s.h - bottomH * 0.27 - swipeH, w: swipeW, h: swipeH},
    bottom: {x: s.x, y: s.y + s.h - bottomH, w: s.w, h: bottomH},
    swapSize: 0.12 * s.w,
    swapY: s.y + 0.62 * s.h,
  };
}

/**
 * Onde a linha divisória (topo→base do palco, em %) cruza as bordas da TELA (y = 0 e y = H):
 * como o palco pode não cobrir a tela toda, a reta é prolongada.
 */
export function splitLine(topPct: number, bottomPct: number, s: Stage, H: number) {
  const x0 = s.x + (topPct / 100) * s.w;
  const x1 = s.x + (bottomPct / 100) * s.w;
  const slope = (x1 - x0) / s.h; // px de x por px de y
  return {top: x0 - slope * s.y, bottom: x0 + slope * (H - s.y)};
}

export type Choice = 'josperd' | 'camila';
export const targetOf = (c: Choice) => (c === 'josperd' ? -1 : 1);
export const choiceOf = (t: number): Choice | null => (t <= -0.5 ? 'josperd' : t >= 0.5 ? 'camila' : null);

/**
 * Soltou o dedo depois de arrastar `dx` px (positivo = para a direita) a partir de `t0`:
 * deslizar para a direita escolhe o Josperd (como no protótipo); pouco movimento volta ao ponto de partida.
 */
export function releaseTarget(t0: number, t: number, dx: number): number {
  if (Math.abs(dx) > 32) return dx > 0 ? -1 : 1;
  if (Math.abs(t - t0) < 0.15) return t0;
  return t < 0 ? -1 : 1;
}

/** Toque simples: metade esquerda escolhe Josperd, direita Camila. */
export function tapTarget(x: number, stage: Stage): number {
  return x < stage.x + stage.w / 2 ? -1 : 1;
}

/** Estado de uma animação de `t` guiada por tempo (o laço de quadros chama `at(now)`). */
export type Tween = {from: number; to: number; start: number; dur: number};
export function tweenAt(tw: Tween, now: number): number {
  if (tw.dur <= 0) return tw.to;
  const k = clamp((now - tw.start) / tw.dur, 0, 1);
  return mix(tw.from, tw.to, MOTION_EASE(k));
}
