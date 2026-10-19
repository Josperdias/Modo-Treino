import {ClipOp, FilterMode, MipmapMode, Skia, TileMode, createPicture, type SkCanvas, type SkColor, type SkPaint, type SkShader} from '@shopify/react-native-skia';
import {FIELD_W, PHYS} from '../data/neon.ts';
import SPRITES from '../data/sprites.json';
import {platformX} from '../core/physics.ts';
import {enemyAt} from '../core/enemies.ts';
import type {Enemy, Item, Platform, Player, WorldId} from '../core/types.ts';
import type {Session} from '../session.ts';
import type {Hero} from '../save';
import type {SpriteSet} from './assets';
import {drawPix} from './pixelbake.ts';
import {ARROW_UP, BOOST, BULLET_ENEMY, BULLET_OWN, ENEMY_SPRITES, FLAG, HEART, HEART_EMPTY, JET, SHIELD} from './pixelart.ts';
import {drawPixelText} from '../menu/pixelscene.ts';
import {HUD_ROW_Y, fireZone} from './layout.ts';

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

function drawNeonBackground(canvas: SkCanvas, cam: number, viewH: number, meters: number) {
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

/* ---------- cristal e mecânico ---------- */

const bgGrads = new Map<string, SkShader>();
function grad(key: string, h: number, a: string, b: string): SkShader {
  const k = key + h;
  let g = bgGrads.get(k);
  if (!g) { g = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: 0, y: h}, [col(a), col(b)], null, TileMode.Clamp); bgGrads.set(k, g); }
  return g;
}

/** Losango de cristal em pixels (4 degraus) com brilho na quina de cima. */
function crystalShard(canvas: SkCanvas, x: number, y: number, k: number, color: string, edge: string, a: number) {
  for (let r = -4; r <= 4; r++) {
    const w = 5 - Math.abs(r);
    rect(canvas, color, x - w * k, y + r * k * 1.6, w * 2 * k, k * 1.6, a);
    rect(canvas, edge, x - w * k, y + r * k * 1.6, k, k * 1.6, a * 1.4);
  }
  rect(canvas, '#ffffff', x - k, y - 3 * k * 1.6, k, k, a * 1.6);
}

function drawCrystalBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('crystal', viewH, '#16336b', '#0a1230'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Feixes de luz diagonais devagar.
  for (let i = 0; i < 4; i++) {
    const x = ((i * 137 + time * 9) % (FIELD_W + 200)) - 100;
    const path = Skia.Path.Make();
    path.moveTo(x, 0); path.lineTo(x + 46, 0); path.lineTo(x - 110, viewH); path.lineTo(x - 156, viewH); path.close();
    const q = P(); q.setShader(null); q.setColor(col('#7ff6ff')); q.setAlphaf(0.045 + 0.02 * Math.sin(time + i));
    canvas.drawPath(path, q);
  }
  // Cristais à deriva em três profundidades.
  for (let i = 0; i < 11; i++) {
    const depth = 0.12 + (i % 3) * 0.09;
    const x = (i * 83 + 40) % (FIELD_W - 40) + 20;
    const y = ((((i * 173) + cam * depth) % (viewH + 140)) + viewH + 140) % (viewH + 140) - 70;
    const k = 3 + (i % 3) * 1.5;
    crystalShard(canvas, x, viewH - y, k, i % 2 ? '#2f6fd0' : '#3fd4e6', i % 2 ? '#7fb0ff' : '#b9fbff', 0.32 + 0.1 * (i % 3));
  }
  for (let i = 0; i < 38; i++) {
    const x = (i * 71 + 17) % FIELD_W;
    const y = ((((i * 151) + cam * (0.06 + (i % 4) * 0.04)) % viewH) + viewH) % viewH;
    const tw = 0.25 + 0.5 * Math.abs(Math.sin(time * 1.6 + i));
    rect(canvas, i % 4 === 0 ? '#b9fbff' : '#5aa8e8', x, y, i % 9 === 0 ? 3 : 2, i % 9 === 0 ? 3 : 2, tw);
  }
  for (let x = 0; x <= FIELD_W; x += 42) rect(canvas, '#7fd8ff', x, 0, 1, viewH, 0.05);
}

/** Engrenagem: anel, dentes e miolo, girando. */
function gear(canvas: SkCanvas, x: number, y: number, r: number, rot: number, color: string, a: number) {
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate(rot, 0, 0);
  const p = P();
  p.setShader(null); p.setColor(col(color)); p.setAlphaf(a);
  for (let i = 0; i < 10; i++) {
    canvas.save();
    canvas.rotate(i * 36, 0, 0);
    canvas.drawRect(Skia.XYWHRect(-r * 0.12, -r * 1.22, r * 0.24, r * 0.32), p);
    canvas.restore();
  }
  p.setStyle(1); p.setStrokeWidth(r * 0.22);
  canvas.drawCircle(0, 0, r * 0.88, p);
  p.setStrokeWidth(r * 0.1);
  for (let i = 0; i < 3; i++) { canvas.save(); canvas.rotate(i * 60, 0, 0); canvas.drawLine(-r * 0.7, 0, r * 0.7, 0, p); canvas.restore(); }
  p.setStyle(0);
  canvas.drawCircle(0, 0, r * 0.18, p);
  canvas.restore();
}

function drawClockBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('clock', viewH, '#33293f', '#19172b'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Engrenagens grandes, bem escuras, em duas profundidades (giram em sentidos opostos).
  for (let i = 0; i < 8; i++) {
    const depth = 0.1 + (i % 2) * 0.12;
    const x = (i * 97 + 31) % FIELD_W;
    const y = viewH - (((((i * 197) + cam * depth) % (viewH + 200)) + viewH + 200) % (viewH + 200) - 100);
    const r = 34 + (i % 3) * 16;
    gear(canvas, x, y, r, time * (i % 2 ? -14 : 17) + i * 11, i % 2 ? '#8a6a46' : '#6c5a7a', 0.2 + (i % 2) * 0.07);
  }
  // Canos nas laterais com rebites.
  for (const sx of [0, FIELD_W - 16]) {
    rect(canvas, '#241d33', sx, 0, 16, viewH);
    rect(canvas, '#3d3252', sx + (sx ? 0 : 10), 0, 6, viewH);
    for (let y = ((cam * 0.4) % 52) - 52; y < viewH; y += 52) {
      rect(canvas, '#8a6a46', sx - (sx ? 2 : -2), y, 20, 6, 0.8);
      rect(canvas, '#d9a964', sx + 4, y + 2, 2, 2);
      rect(canvas, '#d9a964', sx + 10, y + 2, 2, 2);
    }
  }
  // Vapor subindo.
  for (let i = 0; i < 6; i++) {
    const x = (i * 131 + 60) % (FIELD_W - 60) + 30;
    const t = (time * 0.18 + i * 0.37) % 1;
    const y = viewH - t * viewH;
    rect(canvas, '#cdbfe0', x - 6 - t * 6, y, 12 + t * 12, 8 + t * 8, 0.12 * (1 - t));
  }
  for (let y = (cam * 0.22) % 42 - 42; y < viewH; y += 42) rect(canvas, '#d0b890', 0, y, FIELD_W, 1, 0.05);
}

function drawWorldBackground(canvas: SkCanvas, world: WorldId, cam: number, viewH: number, meters: number, time: number) {
  if (world === 'crystal') drawCrystalBackground(canvas, cam, viewH, time);
  else if (world === 'clock') drawClockBackground(canvas, cam, viewH, time);
  else drawNeonBackground(canvas, cam, viewH, meters);
}

type Skin = {
  top: Record<Platform['type'], string>;
  accent: Record<Platform['type'], string>;
  body: string;
  bodyDark: string;
  ink: string;
  glint: string;
  dots: string;
  glass: boolean;
};

const SKINS: Record<WorldId, Skin> = {
  neon: {
    top: {normal: '#b594fc', moving: '#59dcd6', fragile: '#ff5896', spring: '#f5b967', start: '#bba0fe', conveyor: '#b594fc'},
    accent: {normal: '#ff4dac', moving: '#49e6ff', fragile: '#ff5896', spring: '#ffd369', start: '#8e6bff', conveyor: '#ff4dac'},
    body: '#3d265e', bodyDark: '#2e1b4a', ink: '#10091f', glint: '#f0ceff', dots: '#ff9bd6', glass: false,
  },
  crystal: {
    top: {normal: '#9ff6ff', moving: '#6bf5d6', fragile: '#ff9ccb', spring: '#ffe08a', start: '#b9d8ff', conveyor: '#9ff6ff'},
    accent: {normal: '#49e6ff', moving: '#6bf5d6', fragile: '#ff9ccb', spring: '#ffe08a', start: '#7fb0ff', conveyor: '#49e6ff'},
    body: '#2c6fb8', bodyDark: '#1d4a8c', ink: '#08142e', glint: '#e8ffff', dots: '#b9fbff', glass: true,
  },
  clock: {
    top: {normal: '#e0b070', moving: '#7be0d8', fragile: '#ff7b8a', spring: '#ffd070', start: '#e8c890', conveyor: '#c9d0e8'},
    accent: {normal: '#ffbf65', moving: '#7be0d8', fragile: '#ff7b8a', spring: '#ffd070', start: '#ffbf65', conveyor: '#8cf0ff'},
    body: '#6a4a3a', bodyDark: '#3f2c2a', ink: '#120c14', glint: '#fff0d0', dots: '#ffd9a0', glass: false,
  },
};

/** Plataforma "adesivo": contorno de tinta, chapa colorida, brilho por baixo e um padrão por tipo (e por mundo). */
function drawPlatform(canvas: SkCanvas, pl: Platform, x: number, y: number, time: number, world: WorldId) {
  const sk = SKINS[world];
  const w = pl.w;
  const left = x - w / 2;
  const acc = sk.accent[pl.type];
  const ga = sk.glass ? 0.86 : 1;
  rect(canvas, acc, left + 6, y + 15, w - 12, 5, 0.22); // brilho
  rect(canvas, '#0a0518', left + 4, y + 19, w - 6, 3, 0.5); // sombra dura
  rect(canvas, sk.ink, left - 3, y - 3, w + 6, 21, ga); // contorno de tinta
  rect(canvas, sk.body, left, y, w, 14, ga);
  rect(canvas, sk.bodyDark, left, y + 9, w, 5, ga);
  rect(canvas, sk.top[pl.type], left, y - 3, w, 7, ga);
  rect(canvas, '#ffffff', left + 2, y - 3, w - 4, 1, 0.35); // reflexo
  rect(canvas, sk.glint, left + 10, y - 1, 9, 2);
  rect(canvas, sk.glint, left + w - 21, y - 1, 9, 2);
  if (sk.glass) {
    // facetas de vidro: diagonais claras
    for (let dx = left + 6; dx < left + w - 10; dx += 18) { rect(canvas, '#ffffff', dx, y + 4, 2, 2, 0.35); rect(canvas, '#ffffff', dx + 2, y + 6, 2, 2, 0.25); rect(canvas, '#ffffff', dx + 4, y + 8, 2, 2, 0.15); }
  } else if (world === 'clock' && pl.type !== 'conveyor') {
    rect(canvas, '#ffd9a0', left + 4, y + 5, 3, 3); rect(canvas, '#ffd9a0', left + w - 7, y + 5, 3, 3);
  }
  switch (pl.type) {
    case 'normal':
      if (!sk.glass) for (let dx = left + 12; dx < left + w - 8; dx += 14) rect(canvas, sk.dots, dx, y + 6, 3, 3);
      break;
    case 'start':
      for (let i = 0, dx = left + 3; dx < left + w - 6; dx += 6, i++) {
        rect(canvas, i % 2 ? '#ffffff' : sk.ink, dx, y + 5, 6, 4);
        rect(canvas, i % 2 ? sk.ink : '#ffffff', dx, y + 9, 6, 4);
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
    case 'conveyor': {
      // Esteira: faixa escura com setas que correm no sentido do empurrão.
      rect(canvas, '#1a1424', left + 3, y + 4, w - 6, 8);
      const dir = pl.dir >= 0 ? 1 : -1;
      const off = ((time * 26 * dir) % 14 + 14) % 14;
      for (let dx = left + 4 - 14 + off; dx < left + w - 10; dx += 14) {
        if (dx < left + 3 || dx + 8 > left + w - 3) continue;
        const f = dir > 0;
        rect(canvas, '#8cf0ff', dx + (f ? 0 : 4), y + 5, 2, 6);
        rect(canvas, '#8cf0ff', dx + (f ? 2 : 2), y + 6, 2, 4);
        rect(canvas, '#8cf0ff', dx + (f ? 4 : 0), y + 7, 2, 2);
      }
      rect(canvas, '#ffbf65', left + 2, y + 3, 3, 10); rect(canvas, '#ffbf65', left + w - 5, y + 3, 3, 10);
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

/* ---------- inimigos, itens, portais, balas ---------- */

const ENEMY_GLOW: Record<Enemy['kind'], string> = {drone: '#c46bff', zigzag: '#5b8cff', turret: '#ffb35e', orb: '#28d8fd', guardian: '#ff4dac'};

function drawEnemy(canvas: SkCanvas, e: Enemy, time: number, sy: (y: number) => number) {
  const pos = enemyAt(e, time);
  const x = pos.x;
  const y = sy(pos.y);
  const frames = ENEMY_SPRITES[e.kind];
  const warn = e.warn && Math.floor(time * 10) % 2 === 0;
  const fr = e.kind === 'turret' || e.kind === 'guardian' ? (warn ? 1 : 0) : Math.floor(time * (e.kind === 'orb' ? 4 : 9)) % 2;
  const flip = e.kind === 'drone' || e.kind === 'zigzag' ? enemyAt(e, time + 0.05).x < pos.x : false;
  drawGlow(canvas, ENEMY_GLOW[e.kind], e.size * 2.2, x, y, 0.2 + (e.warn ? 0.2 : 0));
  drawPix(canvas, frames[fr], x, y, e.kind === 'guardian' ? 2.4 : 2, {flip});
  if (e.maxHp > 1) {
    for (let i = 0; i < e.maxHp; i++) {
      const px = x - (e.maxHp * 9) / 2 + i * 9 + 1;
      rect(canvas, '#10091f', px - 1, y - e.size - 16, 9, 8);
      rect(canvas, i < e.hp ? '#8cf9ee' : '#43223d', px, y - e.size - 15, 7, 6);
    }
  }
  if (e.warn) drawPixelText(canvas, '!', x, y - e.size - (e.maxHp > 1 ? 30 : 20), 3, {top: '#fff1a5', low: '#ffd36b', shadow: '#ff4167'});
}

const PORTAL_COLOR: Record<WorldId, [string, string]> = {neon: ['#ff7ad9', '#ffd0f2'], crystal: ['#5ceef4', '#d4ffff'], clock: ['#ffbf65', '#fff0cc']};
const PORTAL_NAME: Record<WorldId, string> = {neon: 'NEON', crystal: 'CRISTAL', clock: 'MECANICO'};

function drawPortal(canvas: SkCanvas, it: Item, x: number, y: number, time: number) {
  const [c1, c2] = PORTAL_COLOR[it.target ?? 'neon'];
  const pulse = 1 + 0.06 * Math.sin(time * 7);
  const rx = 24 * pulse, ry = 40 * pulse;
  drawGlow(canvas, c1, 90, x, y, 0.35 + 0.1 * Math.sin(time * 5));
  const p = P();
  p.setShader(null); p.setColor(col('#2a0f5e')); p.setAlphaf(0.78);
  canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), p);
  p.setColor(col('#8846cd')); p.setAlphaf(0.55);
  canvas.drawOval(Skia.XYWHRect(x - rx * 0.72, y - ry * 0.72, rx * 1.44, ry * 1.44), p);
  // Redemoinho em pixels, girando para dentro.
  for (let j = 0; j < 16; j++) {
    const t = j / 16;
    const ang = time * 3.2 + t * 11;
    rect(canvas, j % 2 ? c2 : '#ffffff', x + Math.cos(ang) * rx * 0.78 * (1 - t * 0.9) - 2, y + Math.sin(ang) * ry * 0.78 * (1 - t * 0.9) - 2, 4, 4, 0.9 - t * 0.5);
  }
  // Aro de pixels.
  const n = 56;
  const tick = Math.floor(time * 12);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + time * 1.1;
    const color = (i + tick) % 4 === 0 ? '#ffffff' : (i + tick) % 2 ? c1 : c2;
    rect(canvas, color, Math.round((x + Math.cos(a) * rx) / 2) * 2 - 3, Math.round((y + Math.sin(a) * ry) / 2) * 2 - 3, 6, 6);
  }
  drawPixelText(canvas, PORTAL_NAME[it.target ?? 'neon'], x, y + ry + 18, 2, {top: '#ffffff', low: c2, shadow: c1});
}

function drawItem(canvas: SkCanvas, it: Item, x: number, y: number, time: number) {
  const bob = Math.sin(time * 4 + it.phase) * 3;
  const yy = y + bob;
  switch (it.kind) {
    case 'tape': drawTape(canvas, x, yy, time); break;
    case 'shield': drawGlow(canvas, '#51ecff', 38, x, yy, 0.3); drawPix(canvas, SHIELD, x, yy, 2); break;
    case 'boost': drawGlow(canvas, '#ffe36c', 38, x, yy, 0.3); drawPix(canvas, BOOST, x, yy, 2); break;
    case 'jet': drawGlow(canvas, '#ff7a95', 40, x, yy, 0.32); drawPix(canvas, JET[Math.floor(time * 20) % 2], x, yy, 2); break;
    case 'heart': drawGlow(canvas, '#ff3d6e', 38, x, yy, 0.32); drawPix(canvas, HEART, x, yy, 2 + 0.2 * Math.sin(time * 6)); break;
    case 'flag': drawGlow(canvas, '#ffe36c', 44, x, y - 6, 0.22); drawPix(canvas, FLAG[Math.floor(time * 4) % 2], x - 6, y + 36, 2, {anchor: 'bottom'}); break;
    case 'portal': drawPortal(canvas, it, x, y, time); break;
  }
}

function drawBullets(canvas: SkCanvas, S: SceneInput, time: number, sy: (y: number) => number) {
  for (const b of S.session.sim.bullets) {
    const y = sy(b.y);
    if (y < -20 || y > S.height / (S.width / FIELD_W) + 20) continue;
    if (b.own) { drawGlow(canvas, '#62fff1', 20, b.x, y, 0.4); drawPix(canvas, BULLET_OWN, b.x, y, 2); }
    else { drawGlow(canvas, '#ff8a3d', 22, b.x, y, 0.4); drawPix(canvas, BULLET_ENEMY, b.x, y, 2, {flip: Math.floor(time * 16) % 2 === 0}); }
  }
}

function drawRingsAndPops(canvas: SkCanvas, S: SceneInput, sy: (y: number) => number) {
  const fx = S.session.fx;
  for (const r of fx.rings) {
    const t = r.age / r.max;
    const p = P();
    p.setShader(null); p.setColor(col(r.color)); p.setAlphaf(1 - t); p.setStyle(1); p.setStrokeWidth(4 * (1 - t) + 1);
    canvas.drawCircle(r.x, sy(r.y), r.r * (0.15 + 0.85 * Math.sqrt(t)), p);
    p.setStyle(0);
  }
  for (const q of fx.pops) {
    const t = q.age / q.max;
    drawPixelText(canvas, q.text, q.x, sy(q.y), 2, {top: '#ffffff', low: q.color, shadow: '#3b1a52', alpha: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3});
  }
}

/** Vidas, escudos, bandeira de recuperação e barras dos poderes (canto superior esquerdo, abaixo do cartão de pontos). */
function drawStatus(canvas: SkCanvas, S: SceneInput, scale: number, time: number) {
  const sim = S.session.sim;
  const x0 = 14 / scale;
  const y0 = HUD_ROW_Y / scale;
  let x = x0;
  for (let i = 0; i < 3; i++) {
    const on = i < sim.lives;
    const beat = on && sim.lives === 1 ? 1 + 0.1 * Math.abs(Math.sin(time * 6)) : 1;
    drawPix(canvas, on ? HEART : HEART_EMPTY, x + 14, y0 + 10, 1.8 * beat, {alpha: on ? 1 : 0.5});
    x += 31;
  }
  x += 4;
  for (let i = 0; i < sim.shields; i++) {
    drawPix(canvas, SHIELD, x + 14, y0 + 12, 1.6);
    x += 30;
  }
  if (sim.revive > 0) { drawPix(canvas, FLAG[Math.floor(time * 3) % 2], x + 8, y0 + 12, 1.4); x += 26; }
  const bar = (frac: number, color: string, at: number) => {
    rect(canvas, '#10091f', at, y0 + 25, 42, 6);
    rect(canvas, '#3b2d57', at + 1, y0 + 26, 40, 4);
    rect(canvas, color, at + 1, y0 + 26, 40 * frac, 4);
  };
  if (sim.boost > 0) { drawPix(canvas, BOOST, x + 12, y0 + 8, 1.3); bar(Math.min(1, sim.boost / 9), '#ffe36c', x); x += 48; }
  if (sim.jet > 0) { drawPix(canvas, JET[Math.floor(time * 20) % 2], x + 18, y0 + 8, 1.5); bar(Math.min(1, sim.jet / 2.1), '#ff7a95', x); x += 48; }
}

/** Botão de tiro (px de tela): círculo de neon com seta; mais claro enquanto o dedo está nele. */
function drawFireButton(canvas: SkCanvas, S: SceneInput, time: number) {
  const z = fireZone(S.width, S.height);
  const held = S.session.fire;
  drawGlow(canvas, '#62fff1', z.r * 1.7, z.cx, z.cy, held ? 0.5 : 0.22);
  const p = P();
  p.setShader(null); p.setColor(col('#0c0820')); p.setAlphaf(0.78);
  canvas.drawCircle(z.cx, z.cy, z.r, p);
  p.setColor(col(held ? '#e6fffd' : '#62fff1')); p.setAlphaf(held ? 1 : 0.75); p.setStyle(1); p.setStrokeWidth(3);
  canvas.drawCircle(z.cx, z.cy, z.r - 2, p);
  p.setStyle(0);
  const ready = S.session.sim.fireCd <= 0;
  drawPix(canvas, ARROW_UP, z.cx, z.cy + (held ? 2 : 0), Math.max(3, Math.round(z.r / 9)), {alpha: ready || held ? 1 : 0.45});
  void time;
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
  const time = sim.time + a * PHYS.STEP;
  const fx = session.fx;

  canvas.save();
  canvas.scale(scale, scale);
  canvas.save();
  const sh = fx.shake;
  if (sh > 0) canvas.translate((Math.sin(sim.tick * 7.3) * sh * 22) | 0, (Math.cos(sim.tick * 5.1) * sh * 14) | 0);

  drawWorldBackground(canvas, sim.world, cam, viewH, meters, time);
  if (fx.worldFade > 0 && fx.worldFrom && fx.worldFrom !== sim.world) {
    // Mundo anterior some por cima do novo (transição do portal).
    const lp = P();
    lp.setAlphaf(Math.min(1, fx.worldFade * 1.2));
    canvas.saveLayer(lp);
    drawWorldBackground(canvas, fx.worldFrom, cam, viewH, meters, time);
    canvas.restore();
  }

  for (const pl of sim.platforms) {
    if (pl.broken) continue;
    const y = sy(pl.y);
    if (y < -40 || y > viewH + 45) continue;
    drawPlatform(canvas, pl, platformX(pl, time), y, time, sim.world);
  }

  for (const it of sim.items) {
    if (it.hit) continue;
    const y = sy(it.y);
    if (y < -80 || y > viewH + 80) continue;
    drawItem(canvas, it, it.x, y, time);
  }

  for (const e of sim.enemies) {
    if (!e.alive) continue;
    const y = sy(e.y);
    if (y < -60 || y > viewH + 60) continue;
    drawEnemy(canvas, e, time, sy);
  }
  drawBullets(canvas, S, time, sy);

  for (const p of fx.list) {
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
  if (sim.boost > 0) drawGlow(canvas, '#ffe36c', 44, px, foot - 4, 0.3 + 0.1 * Math.sin(time * 14));
  if (Math.abs(pl.vy) > 520 && sim.mode === 'playing') {
    for (let k = 2; k >= 1; k--) drawHero(canvas, S, px - pl.vx * 0.012 * k, foot + pl.vy * 0.03 * k, fi, 0.2 / k);
  }
  // Invencível: pisca (exceto com a hélice).
  const blink = sim.invuln > 0 && sim.jet <= 0 && Math.floor(time * 14) % 2 === 0;
  const heroAlpha = blink ? 0.35 : 1;
  if (sim.jet > 0) {
    // Chama sob os pés.
    for (let i = 0; i < 4; i++) rect(canvas, i % 2 ? '#ffd36b' : '#ff6a3d', px - 6 + (i % 2) * 2 + ((Math.floor(time * 30) + i) % 3), foot + i * 5, 4 + (i % 2) * 2, 6, 0.9 - i * 0.18);
  }
  drawHero(canvas, S, px, foot, fi, heroAlpha);
  const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
  if (px < 50) drawHero(canvas, S, px + span, foot, fi, heroAlpha);
  else if (px > FIELD_W - 50) drawHero(canvas, S, px - span, foot, fi, heroAlpha);
  if (sim.jet > 0) drawPix(canvas, JET[Math.floor(time * 30) % 2], px, foot - 102, 2);
  if (sim.shields > 0) {
    // Bolha de escudo.
    const q = P();
    q.setShader(null); q.setColor(col('#51ecff')); q.setAlphaf(0.5 + 0.2 * Math.sin(time * 8)); q.setStyle(1); q.setStrokeWidth(3);
    canvas.drawCircle(px, foot - 50, 48, q);
    q.setStyle(0); q.setAlphaf(0.07);
    canvas.drawCircle(px, foot - 50, 48, q);
  }
  if (sim.boost > 0 && Math.floor(time * 12) % 2 === 0) { rect(canvas, '#ffe36c', px - 14, foot + 2, 4, 4); rect(canvas, '#fff9c5', px + 10, foot + 4, 4, 4); }

  drawRingsAndPops(canvas, S, sy);
  canvas.restore(); // fim do tremor

  if (fx.flash > 0) rect(canvas, fx.flashColor, 0, 0, FIELD_W, viewH, Math.min(0.3, fx.flash * 0.5));
  if (sim.mode === 'playing') drawStatus(canvas, S, scale, time);
  canvas.restore();
  if (sim.mode === 'playing') drawFireButton(canvas, S, time);
  return nowMs() - t0;
}
