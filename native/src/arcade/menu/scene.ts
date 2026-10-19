import {BlendMode, ClipOp, FilterMode, MipmapMode, Skia, TileMode, createPicture, type SkCanvas, type SkColor, type SkColorFilter, type SkImage, type SkPaint, type SkShader} from '@shopify/react-native-skia';
import {boxes, clamp, mix, pose, splitLine, type Box, type Look, type Stage} from './pose';
import type {MenuImages} from './assets';

/**
 * Desenho do menu de seleção (V3.5 "Fluido" refeito em Skia). Ordem das camadas, como no protótipo:
 * fundo → painéis → padrões → brilhos → fantasmas → retrato de trás → raio → retrato da frente →
 * cartões de nome → moldura → logo → dicas/controles. Tudo é função de `t` (−1 Josperd … +1 Camila).
 */

export type MenuFrame = {
  /** −1 Josperd, 0 neutro, +1 Camila (já com a animação aplicada). */
  t: number;
  /** Segundos desde que o menu abriu (animações ambiente). */
  time: number;
  /** 0 → 1: entrada do menu. */
  intro: number;
  /** 0 → 1 durante o clarão de confirmação; < 0 = parado. */
  glint: number;
  W: number;
  H: number;
  stage: Stage;
  images: MenuImages;
  /** Reduzir movimento: nada de respiração, deriva nem brilhos piscando. */
  still: boolean;
};

const colors = new Map<string, SkColor>();
const col = (hex: string): SkColor => {
  let c = colors.get(hex);
  if (!c) { c = Skia.Color(hex); colors.set(hex, c); }
  return c;
};

let paint: SkPaint | null = null;
const P = (): SkPaint => {
  if (!paint) { paint = Skia.Paint(); paint.setAntiAlias(true); }
  paint.setShader(null);
  paint.setColorFilter(null);
  paint.setBlendMode(BlendMode.SrcOver);
  paint.setAlphaf(1);
  return paint;
};

const filters = new Map<string, SkColorFilter>();
/** Brilho e saturação como filtro de cor (os `filter: brightness() saturate()` do CSS). */
function look(bright: number, sat: number): SkColorFilter | null {
  if (Math.abs(bright - 1) < 0.005 && Math.abs(sat - 1) < 0.005) return null;
  const k = `${Math.round(bright * 100)}|${Math.round(sat * 100)}`;
  let f = filters.get(k);
  if (!f) {
    const lr = 0.2126, lg = 0.7152, lb = 0.0722, s = sat, b = bright;
    f = Skia.ColorFilter.MakeMatrix([
      b * ((1 - s) * lr + s), b * (1 - s) * lg, b * (1 - s) * lb, 0, 0,
      b * (1 - s) * lr, b * ((1 - s) * lg + s), b * (1 - s) * lb, 0, 0,
      b * (1 - s) * lr, b * (1 - s) * lg, b * ((1 - s) * lb + s), 0, 0,
      0, 0, 0, 1, 0,
    ]);
    filters.set(k, f);
  }
  return f;
}

function img(canvas: SkCanvas, im: SkImage | null, x: number, y: number, w: number, h: number, alpha = 1, f: SkColorFilter | null = null) {
  if (!im || alpha <= 0.003) return;
  const p = P();
  p.setAlphaf(alpha);
  if (f) p.setColorFilter(f);
  canvas.drawImageRectOptions(im, Skia.XYWHRect(0, 0, im.width(), im.height()), Skia.XYWHRect(x, y, w, h), FilterMode.Linear, MipmapMode.None, p);
}

/** Desenha `im` na caixa `b` com a "pose" do CSS (translate % do próprio tamanho, escala pelo centro). */
function posed(canvas: SkCanvas, im: SkImage | null, b: Box, lk: Look, extraAlpha = 1, rotDeg = 0, bob = 0) {
  if (!im) return;
  canvas.save();
  canvas.translate(b.x + b.w / 2 + (lk.dx / 100) * b.w, b.y + b.h / 2 + (lk.dy / 100) * b.h + bob * b.h);
  if (rotDeg) canvas.rotate(rotDeg, 0, 0);
  canvas.scale(lk.scale, lk.scale);
  img(canvas, im, -b.w / 2, -b.h / 2, b.w, b.h, lk.opacity * extraAlpha, look(lk.bright, lk.sat));
  canvas.restore();
}

function polygon(pts: number[][]) {
  const path = Skia.Path.Make();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.close();
  return path;
}

/** Máscara do lado esquerdo/direito da divisória inclinada, cobrindo a tela inteira. */
function lanePath(side: 'left' | 'right', topPct: number, bottomPct: number, f: MenuFrame) {
  const l = splitLine(topPct, bottomPct, f.stage, f.H);
  return side === 'left'
    ? polygon([[0, 0], [l.top, 0], [l.bottom, f.H], [0, f.H]])
    : polygon([[l.top, 0], [f.W, 0], [f.W, f.H], [l.bottom, f.H]]);
}

/* ---------- ladrilhos de padrão (criados uma vez) ---------- */
const tiles = new Map<string, SkShader>();
function tile(key: string, size: number, draw: (c: SkCanvas) => void): SkShader {
  let t = tiles.get(key);
  if (!t) {
    t = createPicture(draw, {x: 0, y: 0, width: size, height: size}).makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear);
    tiles.set(key, t);
  }
  return t;
}
function dotsTile(hex: string) {
  return tile('dots' + hex, 46, (c) => { const p = Skia.Paint(); p.setColor(col(hex)); c.drawCircle(6, 8, 1.2, p); c.drawCircle(29, 31, 1, p); });
}
function linesTile(hex: string, flip: boolean) {
  return tile('lines' + hex + flip, 80, (c) => {
    const p = Skia.Paint(); p.setColor(col(hex)); p.setStrokeWidth(1.5); p.setAntiAlias(true);
    flip ? c.drawLine(0, 80, 80, 0, p) : c.drawLine(0, 0, 80, 80, p);
  });
}
const scanTile = () => tile('scan', 4, (c) => { const p = Skia.Paint(); p.setColor(col('#03020b')); p.setAlphaf(0.09); c.drawRect(Skia.XYWHRect(0, 3, 4, 1), p); });

const gradients = new Map<string, SkShader>();
function vGrad(key: string, h: number, stops: [string, number][]): SkShader {
  const k = key + Math.round(h);
  let g = gradients.get(k);
  if (!g) {
    g = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: 0, y: h}, stops.map(([c]) => col(c)), stops.map(([, p]) => p), TileMode.Clamp);
    gradients.set(k, g);
  }
  return g;
}
function hGrad(key: string, w: number, stops: [string, number][]): SkShader {
  const k = 'h' + key + Math.round(w);
  let g = gradients.get(k);
  if (!g) {
    g = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: w, y: 0}, stops.map(([c]) => col(c)), stops.map(([, p]) => p), TileMode.Clamp);
    gradients.set(k, g);
  }
  return g;
}
const radials = new Map<string, SkShader>();
function radial(hex: string, r: number): SkShader {
  const k = hex + Math.round(r);
  let g = radials.get(k);
  if (!g) { g = Skia.Shader.MakeRadialGradient({x: 0, y: 0}, r, [col(hex), col(hex + '00')], null, TileMode.Clamp); radials.set(k, g); }
  return g;
}
function glow(canvas: SkCanvas, hex: string, r: number, x: number, y: number, alpha: number, sx = 1, sy = 1) {
  if (alpha <= 0.003) return;
  const p = P();
  p.setShader(radial(hex, r));
  p.setAlphaf(alpha);
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(sx, sy);
  canvas.drawCircle(0, 0, r, p);
  canvas.restore();
}

/** Keyframes do `ambientSparkle` do protótipo: (fase 0..1) → [opacidade, escala]. */
function sparkle(phase: number): [number, number] {
  const k: [number, number, number][] = [[0, 0.04, 0.6], [0.3, 0.04, 0.6], [0.44, 0.65, 1], [0.54, 0.65, 1], [0.68, 0.1, 0.7], [1, 0.04, 0.6]];
  for (let i = 1; i < k.length; i++) {
    if (phase <= k[i][0]) {
      const a = k[i - 1], b = k[i], u = (phase - a[0]) / (b[0] - a[0]);
      return [mix(a[1], b[1], u), mix(a[2], b[2], u)];
    }
  }
  return [0.04, 0.6];
}
const SPARKS: [number, number, number, string][] = [
  [0.11, 0.37, -1, '#ff36d6'], [0.4, 0.21, -3.3, '#ff36d6'], [0.75, 0.37, -2.1, '#00d7ff'], [0.86, 0.63, -4.2, '#06ffff'], [0.22, 0.66, -0.4, '#ff36d6'],
];

function drawPanels(canvas: SkCanvas, f: MenuFrame, p: ReturnType<typeof pose>, a: number) {
  const {stage: s, images: im} = f;
  for (const side of ['left', 'right'] as const) {
    const L = side === 'left';
    canvas.save();
    canvas.clipPath(lanePath(side, p.splitTop, p.splitBottom, f), ClipOp.Intersect, true);
    const pan = L ? p.panelL : p.panelR;
    img(canvas, L ? im.bgL : im.bgR, f.stage.x, 0, s.w, f.H, a, look(pan.bright, pan.sat));
    // Padrões à deriva (tela clara sobre o painel): bolinhas + traços diagonais + véu de cor.
    const drift = f.still ? 0 : Math.sin(f.time * (Math.PI * 2 / 46) + (L ? 0 : Math.PI)) * 0.004;
    const tint = L ? '#ff3fd7' : '#11ddff';
    const pp = P();
    pp.setBlendMode(BlendMode.Screen);
    pp.setAlphaf(0.28 * a);
    canvas.save();
    canvas.translate(drift * s.w, -drift * 0.5 * f.H);
    pp.setShader(dotsTile(tint));
    canvas.drawRect(Skia.XYWHRect(-s.w * 0.05, -f.H * 0.05, f.W + s.w * 0.1, f.H * 1.1), pp);
    pp.setShader(linesTile(L ? '#ff1b8f' : '#43b8ff', L));
    pp.setAlphaf(0.1 * a);
    canvas.drawRect(Skia.XYWHRect(-s.w * 0.05, -f.H * 0.05, f.W + s.w * 0.1, f.H * 1.1), pp);
    canvas.restore();
    const veil = P();
    veil.setBlendMode(BlendMode.Screen);
    veil.setShader(vGrad(L ? 'vl' : 'vr', f.H, [[L ? '#d607c500' : '#1199ee00', 0], [L ? '#d607c530' : '#1199ee28', 1]]));
    veil.setAlphaf(0.28 * a);
    canvas.drawRect(Skia.XYWHRect(0, 0, f.W, f.H), veil);
    // Linhas de varredura (edge-grain).
    const g = P();
    g.setShader(scanTile());
    g.setAlphaf(a);
    canvas.drawRect(Skia.XYWHRect(0, 0, f.W, f.H), g);
    canvas.restore();
  }
}

function drawSparkles(canvas: SkCanvas, f: MenuFrame, a: number) {
  const {stage: s} = f;
  for (const [fx, fy, delay, hex] of SPARKS) {
    const phase = f.still ? 0.5 : (((f.time - delay) / 6.8) % 1 + 1) % 1;
    const [op, sc] = sparkle(phase);
    const x = s.x + fx * s.w, y = s.y + fy * s.h;
    glow(canvas, hex, 12, x, y, op * 0.9 * a, sc, sc);
    const p = P();
    p.setColor(col('#ffffff'));
    p.setAlphaf(op * a);
    canvas.drawRect(Skia.XYWHRect(x - 1.5 * sc, y - 1.5 * sc, 3 * sc, 3 * sc), p);
  }
}

function drawRails(canvas: SkCanvas, f: MenuFrame, a: number) {
  const {stage: s} = f;
  const x = s.x + 0.022 * s.w, y = s.y + 0.017 * s.h, w = s.w * (1 - 0.044), h = s.h * (1 - 0.034);
  const frame = P();
  frame.setStyle(1); // stroke
  frame.setStrokeWidth(1);
  frame.setColor(col('#62caff'));
  frame.setAlphaf(0.1 * a);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), 6, 6), frame);
  const arm = (hex: string, ox: number, flipX: boolean) => {
    const q = P();
    q.setStyle(1);
    q.setStrokeWidth(1);
    q.setColor(col(hex));
    q.setAlphaf(0.38 * a);
    const aw = w * 0.14, ah = h * 0.1, dir = flipX ? -1 : 1;
    canvas.drawLine(ox, y, ox + dir * aw, y, q);
    canvas.drawLine(ox, y, ox, y + ah, q);
  };
  arm('#ec64ec', x, false);
  arm('#3bcff9', x + w, true);
}

function drawLogo(canvas: SkCanvas, f: MenuFrame, b: Box) {
  const i = f.intro;
  const breath = f.still ? 0.5 : 0.5 + 0.5 * Math.sin(f.time * (Math.PI * 2 / 6));
  const cy = b.y + b.h * 0.5 - (1 - i) * f.stage.h * 0.08;
  glow(canvas, '#ff07cb', b.w * 0.55, b.x + b.w / 2, cy, (0.1 + 0.2 * breath) * i, 1, b.h / b.w);
  // sombra suave embaixo
  glow(canvas, '#000000', b.w * 0.5, b.x + b.w / 2, cy + b.h * 0.18, 0.35 * i, 1, 0.55);
  img(canvas, f.images.logo, b.x, cy - b.h / 2, b.w, b.h, i);
}

export function drawMenu(canvas: SkCanvas, f: MenuFrame): void {
  const {W, H, stage: s, images: im, time} = f;
  const p = pose(f.t);
  const a = clamp(f.intro * 1.4, 0, 1);
  const bx = boxes(s);

  // Fundo ambiente (a "luz do fliperama" atrás do palco).
  const base = P(); base.setColor(col('#05040e')); canvas.drawRect(Skia.XYWHRect(0, 0, W, H), base);
  glow(canvas, '#6b0755', Math.max(W, H) * 0.6, W * 0.23, H * 0.42, 0.75);
  glow(canvas, '#063c80', Math.max(W, H) * 0.6, W * 0.8, H * 0.5, 0.75);

  drawPanels(canvas, f, p, a);
  drawSparkles(canvas, f, a);

  // Fantasmas dos rostos (bem fracos) atrás dos retratos.
  posed(canvas, im.ghostL, bx.ghostL, {dx: 0, dy: 0, scale: 1, opacity: 0.12, bright: 0.7, sat: 0.5}, a, -12);
  posed(canvas, im.ghostR, bx.ghostR, {dx: 0, dy: 0, scale: 1, opacity: 0.12, bright: 0.7, sat: 0.5}, a, 10);

  // Retratos: o NÃO escolhido fica atrás do raio; o escolhido passa por cima dele.
  const bob = (ph: number) => (f.still ? 0 : -0.0065 * (0.5 + 0.5 * Math.sin(((time + ph) * Math.PI * 2) / 6.8)));
  const enter = 1 - f.intro;
  const hl: Look = {...p.heroL, dx: p.heroL.dx - enter * 28};
  const hr: Look = {...p.heroR, dx: p.heroR.dx + enter * 28};
  const drawHeroL = () => {
    canvas.save();
    canvas.clipPath(lanePath('left', p.laneL.top, p.laneL.bottom, f), ClipOp.Intersect, true);
    posed(canvas, im.heroL, bx.heroL, hl, a, 0, bob(0));
    canvas.restore();
  };
  const drawHeroR = () => {
    canvas.save();
    canvas.clipPath(lanePath('right', p.laneR.top, p.laneR.bottom, f), ClipOp.Intersect, true);
    posed(canvas, im.heroR, bx.heroR, hr, a, 0, bob(3.4));
    canvas.restore();
  };
  const drawRay = () => {
    const dx = (p.rayShift / 100) * s.w;
    // brilho: duas cópias levemente deslocadas somadas
    const g = P(); g.setBlendMode(BlendMode.Plus);
    for (const o of [-3, 3]) img(canvas, im.ray, s.x + dx + o, 0, s.w, H, 0.22 * a);
    img(canvas, im.ray, s.x + dx, 0, s.w, H, a);
  };
  if (p.front === 'left') { drawHeroR(); drawRay(); drawHeroL(); }
  else if (p.front === 'right') { drawHeroL(); drawRay(); drawHeroR(); }
  else { drawHeroL(); drawHeroR(); drawRay(); }

  // Brilho de confirmação (varre o palco na diagonal, uma vez, ao trocar de personagem).
  if (f.glint >= 0 && f.glint <= 1) {
    const k = f.glint;
    const alpha = k < 0.25 ? (k / 0.25) * 0.48 : 0.48 * (1 - (k - 0.25) / 0.75);
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(s.x, s.y + s.h * 0.16, s.w, s.h * 0.64), ClipOp.Intersect, false);
    canvas.translate(s.x + mix(-1.1, 1.2, k) * s.w, s.y);
    canvas.skew(-0.14, 0);
    const gp = P();
    gp.setShader(hGrad('glint', s.w * 0.5, [['#ffffff00', 0.25], ['#ffffff55', 0.5], ['#ffffff00', 0.75]]));
    gp.setAlphaf(alpha);
    canvas.drawRect(Skia.XYWHRect(0, 0, s.w * 0.5, s.h), gp);
    canvas.restore();
  }

  drawRails(canvas, f, a);

  // Cartões de nome (rosto + nome + frases + retrato pixel já vêm na arte).
  const il: Look = {...p.infoL, dy: p.infoL.dy + enter * 22, opacity: p.infoL.opacity * a};
  const ir: Look = {...p.infoR, dy: p.infoR.dy + enter * 22, opacity: p.infoR.opacity * a};
  posed(canvas, im.infoL, bx.infoL, il);
  posed(canvas, im.infoR, bx.infoR, ir);

  // Degradê escuro no rodapé (onde ficam a dica e o botão JOGAR).
  const bt = P();
  bt.setShader(vGrad('bottom', bx.bottom.h, [['#02020e00', 0], ['#03041a86', 0.3], ['#02020ef5', 0.91]]));
  canvas.save();
  canvas.translate(0, bx.bottom.y);
  bt.setAlphaf(a);
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H - bx.bottom.y), bt);
  canvas.restore();

  // Linha de varredura lenta.
  if (!f.still) {
    const sy = (((time / 16) % 1) * 2 - 0.5) * H;
    const sp = P();
    sp.setShader(vGrad('scanband', 60, [['#ffffff00', 0], ['#ffffff', 0.5], ['#ffffff00', 1]]));
    sp.setAlphaf(0.055);
    canvas.save();
    canvas.translate(0, sy - 30);
    canvas.drawRect(Skia.XYWHRect(s.x, 0, s.w, 60), sp);
    canvas.restore();
  }

  drawLogo(canvas, f, bx.logo);

  // Botão de setas no centro (acompanha o raio) e dica de deslizar.
  const sz = bx.swapSize;
  img(canvas, im.swap, s.x + (p.swapX / 100) * s.w - sz / 2, bx.swapY - sz / 2, sz, sz, a);
  const hint = (1 - p.chosen) * a;
  if (hint > 0.01) {
    const sw = f.still ? 0 : Math.sin((time * Math.PI * 2) / 4.4) * 0.015 * s.w;
    img(canvas, im.swipe, bx.swipe.x + sw, bx.swipe.y + p.chosen * 0.3 * bx.swipe.h, bx.swipe.w, bx.swipe.h, hint);
  }
}
