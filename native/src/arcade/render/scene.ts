import {ClipOp, FilterMode, MipmapMode, Skia, TileMode, createPicture, type SkCanvas, type SkColor, type SkPaint, type SkShader} from '@shopify/react-native-skia';
import {FIELD_W, PHYS} from '../data/neon.ts';
import SPRITES from '../data/sprites.json';
import {platformX} from '../core/physics.ts';
import type {Platform, Player} from '../core/types.ts';
import type {Session} from '../session.ts';
import type {Hero} from '../save';
import type {SpriteSet} from './assets';

/**
 * Desenho da Cidade Neon. Recebe o estado e pinta numa `SkCanvas`; não guarda nada além de caches.
 * Coordenadas lógicas: 420 de largura (escala = largura da tela / 420). Tudo é retângulo de pixel
 * art, como no protótipo, mais o céu em camadas (skyline → estrelas conforme a altitude).
 */

const colors = new Map<string, SkColor>();
function col(hex: string): SkColor {
  let c = colors.get(hex);
  if (!c) { c = Skia.Color(hex); colors.set(hex, c); }
  return c;
}

let paint: SkPaint | null = null;
function P(): SkPaint {
  if (!paint) { paint = Skia.Paint(); paint.setAntiAlias(false); }
  return paint;
}
/** Pincel dos sprites: sempre opaco (o de retângulos muda a transparência a cada desenho). */
let spritePaint: SkPaint | null = null;
function SP(): SkPaint {
  if (!spritePaint) { spritePaint = Skia.Paint(); spritePaint.setAntiAlias(false); spritePaint.setAlphaf(1); }
  return spritePaint;
}

function rect(canvas: SkCanvas, color: string, x: number, y: number, w: number, h: number, alpha = 1) {
  const p = P();
  p.setShader(null);
  p.setColor(col(color));
  p.setAlphaf(alpha);
  canvas.drawRect(Skia.XYWHRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)), p);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

let bgShader: SkShader | null = null;
let bgFor = 0;
function bg(viewH: number): SkShader {
  if (!bgShader || bgFor !== viewH) {
    bgShader = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: 0, y: viewH}, [col('#251438'), col('#160c29')], null, TileMode.Clamp);
    bgFor = viewH;
  }
  return bgShader;
}

export type SceneInput = {
  session: Session;
  hero: Hero;
  width: number;
  height: number;
  sprites: SpriteSet;
};

/** Quadro da animação a partir da fase do salto (mesmo mapeamento do protótipo, sem faixas duplicadas). */
export function frameIndex(p: Pick<Player, 'landTimer' | 'vy'>, over: boolean): number {
  if (over) return 7;
  if (p.landTimer > 0.105) return 1; // impacto / agachar
  if (p.landTimer > 0.08) return 0; // compressão
  if (p.landTimer > 0.045) return 2; // impulso
  if (p.vy > 520) return 3; // subida rápida
  if (p.vy > 40) return 4; // subindo
  if (p.vy > -140) return 5; // topo
  if (p.vy > -425) return 6; // caindo
  return 7; // queda longa
}


/** Padrões em ladrilho (bolinhas, listras, xadrez): um único retângulo com shader desenha a tela inteira. */
const tiles = new Map<string, SkShader>();
function tile(key: string, size: number, draw: (c: SkCanvas) => void): SkShader {
  let t = tiles.get(key);
  if (!t) {
    t = createPicture(draw, {x: 0, y: 0, width: size, height: size}).makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Nearest);
    tiles.set(key, t);
  }
  return t;
}
const halftone = () => tile('dots', 16, (c) => { rect(c, '#ffffff', 3, 3, 4, 4); rect(c, '#ffffff', 11, 11, 4, 4); });
const stripes = () => tile('stripes', 24, (c) => { for (let y = 0; y < 24; y++) { rect(c, '#ffffff', y, y, 6, 1); rect(c, '#ffffff', y - 24, y, 6, 1); } });
const checker = () => tile('checker', 16, (c) => { rect(c, '#ffffff', 0, 0, 8, 8); rect(c, '#ffffff', 8, 8, 8, 8); });

/** Preenche um retângulo com um padrão (deslocado por `ox/oy` para dar parallax). */
function fillPattern(canvas: SkCanvas, shader: SkShader, color: string, alpha: number, x: number, y: number, w: number, h: number, ox = 0, oy = 0) {
  const p = P();
  p.setShader(shader);
  p.setColor(col(color));
  p.setAlphaf(alpha);
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, false);
  canvas.translate(ox, oy);
  canvas.drawRect(Skia.XYWHRect(x - ox, y - oy, w, h), p);
  canvas.restore();
  p.setShader(null);
}

const glows = new Map<string, SkShader>();
/** Brilho circular centrado na origem (use com translate): gradiente radial de `hex` até transparente. */
function glow(hex: string, r: number): SkShader {
  const k = hex + r;
  let g = glows.get(k);
  if (!g) {
    g = Skia.Shader.MakeRadialGradient({x: 0, y: 0}, r, [col(hex), col(hex + '00')], null, TileMode.Clamp);
    glows.set(k, g);
  }
  return g;
}
function drawGlow(canvas: SkCanvas, hex: string, r: number, x: number, y: number, alpha: number) {
  const p = P();
  p.setShader(glow(hex, r));
  p.setAlphaf(alpha);
  canvas.save();
  canvas.translate(x, y);
  canvas.drawCircle(0, 0, r, p);
  canvas.restore();
  p.setShader(null);
}

/** Estrela ✦ e flor ✿ em pixel (identidade de Josperd e Camila) flutuando no fundo. */
function pixelStar(canvas: SkCanvas, color: string, x: number, y: number, k: number, a: number) {
  rect(canvas, color, x - k, y - 1.5 * k, k * 2, k * 3, a);
  rect(canvas, color, x - 1.5 * k, y - k, k * 3, k * 2, a);
}
function pixelFlower(canvas: SkCanvas, petal: string, center: string, x: number, y: number, k: number, a: number) {
  for (const [dx, dy] of [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]]) rect(canvas, petal, x + dx * k - k / 2, y + dy * k - k / 2, k, k, a);
  rect(canvas, center, x - k / 2, y - k / 2, k, k, a);
}

function drawBackground(canvas: SkCanvas, cam: number, viewH: number, meters: number) {
  const p = P();
  p.setShader(bg(viewH));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Quanto mais alto, mais fundo e frio o céu.
  rect(canvas, '#07041a', 0, 0, FIELD_W, viewH, clamp(meters / 600, 0, 0.55));

  // Skyline distante (some com a altitude): prédios e janelas acesas, parallax lento.
  const city = clamp(1 - meters / 140, 0, 1);
  if (city > 0.02) {
    const base = viewH + cam * 0.32 - 40;
    for (let i = 0; i < 14; i++) {
      const w = 26 + ((i * 37) % 34);
      const h = 70 + ((i * 53) % 170);
      const x = i * 31 - 8;
      rect(canvas, '#1b0f33', x, base - h, w, h + 400, 0.9 * city);
      rect(canvas, '#2a1650', x, base - h, w, 3, 0.9 * city);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          if (((i * 7 + r * 5 + c * 3) & 3) === 0) rect(canvas, i % 2 ? '#ff4dac' : '#49e6ff', x + 5 + c * 9, base - h + 12 + r * 18, 4, 5, 0.55 * city);
        }
      }
    }
    // Brilho do horizonte
    rect(canvas, '#ff4dac', 0, base - 6, FIELD_W, 3, 0.35 * city);
  }

  // Grade de pixels
  for (let x = 0; x <= FIELD_W; x += 42) rect(canvas, '#d89af9', x, 0, 1, viewH, 0.065);
  for (let y = (cam * 0.22) % 42 - 42; y < viewH; y += 42) rect(canvas, '#d89af9', 0, y, FIELD_W, 1, 0.065);
  // Tiras de neon nas bordas
  rect(canvas, '#f74192', 0, 250, 8, 90, 0.085);
  rect(canvas, '#f74192', FIELD_W - 8, 400, 8, 120, 0.085);
  // Meio-tom (bolinhas) rosa embaixo e roxo em cima: o mesmo pontilhado dos cartões do app.
  fillPattern(canvas, halftone(), '#ff4dac', 0.07, 0, viewH * 0.55, FIELD_W, viewH * 0.45, 0, (cam * 0.1) % 16);
  fillPattern(canvas, halftone(), '#8e6bff', 0.05, 0, 0, FIELD_W, viewH * 0.4, 0, (cam * 0.05) % 16);
  // Faixas diagonais de obra nas bordas laterais + xadrez de fita.
  fillPattern(canvas, stripes(), '#ffd369', 0.07, 0, 0, 10, viewH, 0, (cam * 0.3) % 24);
  fillPattern(canvas, stripes(), '#ffd369', 0.07, FIELD_W - 10, 0, 10, viewH, 0, (cam * 0.3) % 24);
  fillPattern(canvas, checker(), '#ffffff', 0.1, 10, 0, 6, viewH, 0, (cam * 0.3) % 16);
  fillPattern(canvas, checker(), '#ffffff', 0.1, FIELD_W - 16, 0, 6, viewH, 0, (cam * 0.3) % 16);
  // Estrelas ✦ e flores ✿ à deriva (parallax lento).
  for (let i = 0; i < 7; i++) {
    const x = (i * 131 + 47) % (FIELD_W - 60) + 30;
    const y = ((((i * 211) + cam * (0.12 + (i % 3) * 0.05)) % (viewH + 80)) + viewH + 80) % (viewH + 80) - 40;
    const tw = 0.16 + 0.1 * Math.sin(cam * 0.01 + i);
    if (i % 2 === 0) pixelStar(canvas, i % 4 === 0 ? '#ffd369' : '#ff4dac', x, y, 3, tw);
    else pixelFlower(canvas, '#49e6ff', '#ffd369', x, y, 4, tw);
  }
  // Estrelas em três profundidades
  for (let i = 0; i < 46; i++) {
    const x = (i * 79 + 23) % FIELD_W;
    const y = ((((i * 177 + Math.floor(i / 4) * 73) + cam * (0.08 + (i % 4) * 0.04)) % viewH) + viewH) % viewH;
    const big = i % 9 === 0;
    rect(canvas, i % 5 === 0 ? '#5a425e' : '#433452', x, y, big ? 4 : 2, big ? 4 : 2);
  }
}

function platformColors(t: Platform['type']): string {
  switch (t) {
    case 'moving': return '#59dcd6';
    case 'fragile': return '#ff5896';
    case 'spring': return '#f5b967';
    case 'start': return '#bba0fe';
    default: return '#b594fc';
  }
}

const ACCENT: Record<Platform['type'], string> = {normal: '#ff4dac', moving: '#49e6ff', fragile: '#ff5896', spring: '#ffd369', start: '#8e6bff'};

/** Plataforma "adesivo neon": contorno de tinta, chapa colorida, brilho por baixo e um padrão por tipo. */
function drawPlatform(canvas: SkCanvas, pl: Platform, x: number, y: number, time: number) {
  const w = pl.w;
  const left = x - w / 2;
  const acc = ACCENT[pl.type];
  rect(canvas, acc, left + 6, y + 15, w - 12, 5, 0.22); // brilho neon
  rect(canvas, '#0a0518', left + 4, y + 19, w - 6, 3, 0.5); // sombra dura
  rect(canvas, '#10091f', left - 3, y - 3, w + 6, 21); // contorno de tinta
  rect(canvas, '#3d265e', left, y, w, 14);
  rect(canvas, '#2e1b4a', left, y + 9, w, 5);
  rect(canvas, platformColors(pl.type), left, y - 3, w, 7);
  rect(canvas, '#ffffff', left + 2, y - 3, w - 4, 1, 0.35); // reflexo
  rect(canvas, '#f0ceff', left + 10, y - 1, 9, 2);
  rect(canvas, '#f0ceff', left + w - 21, y - 1, 9, 2);
  switch (pl.type) {
    case 'normal':
      for (let dx = left + 12; dx < left + w - 8; dx += 14) rect(canvas, '#ff9bd6', dx, y + 6, 3, 3);
      break;
    case 'start':
      // Xadrez de largada.
      for (let i = 0, dx = left + 3; dx < left + w - 6; dx += 6, i++) {
        rect(canvas, i % 2 ? '#ffffff' : '#10091f', dx, y + 5, 6, 4);
        rect(canvas, i % 2 ? '#10091f' : '#ffffff', dx, y + 9, 6, 4);
      }
      break;
    case 'moving': {
      const off = Math.floor(time * 9) % 16;
      for (let dx = left + 8 + off; dx < left + w - 14; dx += 16) {
        rect(canvas, '#66f5e7', dx, y + 5, 2, 2);
        rect(canvas, '#66f5e7', dx + 2, y + 7, 2, 2);
        rect(canvas, '#66f5e7', dx, y + 9, 2, 2);
      }
      break;
    }
    case 'fragile':
      for (let i = 0; i < 4; i++) {
        const cx = x - 21 + i * 14;
        rect(canvas, '#ff8ac0', cx, y + 4, 2, 4);
        rect(canvas, '#ff8ac0', cx + 2, y + 7, 3, 2);
        rect(canvas, '#ff8ac0', cx, y + 9, 2, 3);
      }
      break;
    case 'spring':
      rect(canvas, '#873d83', x - 18, y - 11, 36, 9);
      rect(canvas, '#fbd76e', x - 17, y - 17, 34, 7);
      rect(canvas, '#fff3bf', x - 12, y - 15, 24, 3);
      for (let dx = -12; dx <= 8; dx += 10) rect(canvas, '#e0a040', x + dx, y - 10, 4, 9);
      break;
  }
}

function drawTape(canvas: SkCanvas, x: number, y: number, time: number) {
  drawGlow(canvas, '#ffd369', 30, x, y, 0.22 + 0.08 * Math.sin(time * 5));
  rect(canvas, '#160e22', x - 14, y - 10, 28, 20);
  rect(canvas, '#ff5caa', x - 12, y - 10, 24, 17);
  rect(canvas, '#ffd57c', x - 9, y - 8, 18, 8);
  rect(canvas, '#5b225c', x - 7, y - 6, 4, 4);
  rect(canvas, '#5b225c', x + 4, y - 6, 4, 4);
  rect(canvas, '#7c316d', x - 7, y + 3, 14, 3);
  rect(canvas, '#842769', x - 14, y + 7, 28, 3);
  // Brilho que pisca no canto.
  if (Math.sin(time * 6 + x) > 0.3) pixelStar(canvas, '#ffffff', x + 15, y - 12, 1.5, 0.9);
}

type Meta = {file: string; w: number; h: number; pivotX: number; pivotY: number};
const META = SPRITES.characters as Record<Hero, {frames: Meta[]}>;
const NATIVE = SPRITES.nativeFacing as Record<Hero, 1 | -1>;

function drawHero(canvas: SkCanvas, S: SceneInput, x: number, footY: number, fi: number, alpha = 1) {
  const img = S.sprites[S.hero][fi];
  const m = META[S.hero].frames[fi];
  if (!img || !m) return;
  const flip = S.session.sim.player.facing * NATIVE[S.hero] === -1;
  canvas.save();
  canvas.translate(Math.round(x), Math.round(footY));
  if (flip) canvas.scale(-1, 1);
  SP().setAlphaf(alpha);
  // O pivô (centro de massa) fica sobre `x` e a base opaca sobre o chão, qualquer que seja o quadro.
  canvas.drawImageRectOptions(
    img,
    Skia.XYWHRect(0, 0, m.w, m.h),
    Skia.XYWHRect(-Math.round(m.pivotX), -m.pivotY, m.w, m.h),
    FilterMode.Nearest,
    MipmapMode.None,
    SP(),
  );
  SP().setAlphaf(1);
  canvas.restore();
}

const HERO_COLOR: Record<Hero, string> = {josperd: '#ff4dac', camila: '#49e6ff'};

/** Sombra elíptica sobre a plataforma que está embaixo do herói (diminui e some com a altura). */
function drawShadow(canvas: SkCanvas, S: SceneInput, x: number, py: number, time: number, sy: (y: number) => number) {
  let under: Platform | null = null;
  for (const pl of S.session.sim.platforms) {
    if (pl.broken || pl.y > py + 2 || pl.y < py - 420) continue;
    if (Math.abs(x - platformX(pl, time)) < pl.w / 2 + 10 && (!under || pl.y > under.y)) under = pl;
  }
  if (!under) return;
  const d = Math.min(1, Math.max(0, (py - under.y) / 320));
  const w = 74 * (1 - 0.55 * d);
  const p = P();
  p.setShader(null);
  p.setColor(col('#0a0518'));
  p.setAlphaf(0.42 * (1 - d));
  canvas.drawOval(Skia.XYWHRect(x - w / 2, sy(under.y) + 1, w, 9 * (1 - 0.5 * d)), p);
}

/** Pinta o quadro. Devolve o tempo gasto (ms) só para o medidor de desempenho. */
export function drawScene(canvas: SkCanvas, S: SceneInput, nowMs: () => number): number {
  const t0 = nowMs();
  const {session} = S;
  const sim = session.sim;
  const a = session.alpha;
  const scale = S.width / FIELD_W;
  const viewH = S.height / scale;
  const cam = lerp(sim.prevCamera, sim.camera, a);
  const sy = (y: number) => viewH - (y - cam);
  const meters = Math.max(0, (sim.maxY - PHYS.START_Y) / 10);

  canvas.save();
  canvas.scale(scale, scale);
  const sh = session.fx.shake;
  if (sh > 0) canvas.translate((Math.sin(sim.tick * 7.3) * sh * 22) | 0, (Math.cos(sim.tick * 5.1) * sh * 14) | 0);

  drawBackground(canvas, cam, viewH, meters);

  const time = sim.time + a * PHYS.STEP;
  for (const pl of sim.platforms) {
    if (pl.broken) continue;
    const y = sy(pl.y);
    if (y < -40 || y > viewH + 45) continue;
    drawPlatform(canvas, pl, platformX(pl, time), y, time);
  }

  for (const it of sim.items) {
    if (it.hit) continue;
    const y = sy(it.y) + Math.sin(time * 4 + it.phase) * 3;
    if (y < -50 || y > viewH + 50) continue;
    drawTape(canvas, it.x, y, time);
  }

  for (const p of session.fx.list) {
    const f = Math.max(0, Math.min(1, p.life / p.max));
    if (p.size > 4) pixelStar(canvas, p.color, p.x, sy(p.y), 1.4, f);
    else rect(canvas, p.color, p.x, sy(p.y), p.size, p.size, f);
  }

  // Herói (interpolado entre o passo anterior e o atual; sem interpolar ao atravessar a lateral).
  const pl = sim.player;
  const jump = Math.abs(pl.x - pl.px) > 200;
  const px = jump ? pl.x : lerp(pl.px, pl.x, a);
  const py = lerp(pl.py, pl.y, a);
  const fi = frameIndex(pl, sim.mode === 'over');
  const foot = sy(py) + 6;
  drawShadow(canvas, S, px, py, time, sy);
  // Aura na cor do personagem (cresce com o combo) e rastro quando a velocidade é alta.
  drawGlow(canvas, HERO_COLOR[S.hero], 66, px, foot - 52, 0.24 + Math.min(4, sim.combo) * 0.035);
  if (Math.abs(pl.vy) > 520 && sim.mode === 'playing') {
    for (let k = 2; k >= 1; k--) drawHero(canvas, S, px - pl.vx * 0.012 * k, foot + pl.vy * 0.03 * k, fi, 0.2 / k);
  }
  drawHero(canvas, S, px, foot, fi);
  const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
  if (px < 50) drawHero(canvas, S, px + span, foot, fi);
  else if (px > FIELD_W - 50) drawHero(canvas, S, px - span, foot, fi);

  if (session.fx.flash > 0) rect(canvas, session.fx.flashColor, 0, 0, FIELD_W, viewH, Math.min(0.26, session.fx.flash * 0.5));
  canvas.restore();
  return nowMs() - t0;
}

