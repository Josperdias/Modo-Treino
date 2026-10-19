import {ClipOp, FilterMode, MipmapMode, Skia, TileMode, createPicture, type SkCanvas, type SkColor, type SkPaint, type SkPicture, type SkShader} from '@shopify/react-native-skia';
import {BLACKHOLE, FIELD_W, PAPER, PHYS, PORTAL, POWER} from '../data/neon.ts';
import SPRITES from '../data/sprites.json';
import {platformX} from '../core/physics.ts';
import {enemyAt} from '../core/enemies.ts';
import type {Enemy, Item, Platform, Player, WorldId} from '../core/types.ts';
import {ghostSolid} from '../core/sim.ts';
import type {Session} from '../session.ts';
import type {Sim} from '../core/types.ts';
import type {Hero} from '../save';
import type {SpriteSet} from './assets';
import {drawPix} from './pixelbake.ts';
import {ARROW_UP, BOOST, BULLET_ENEMY, BULLET_OWN, ENEMY_SPRITES, FLAG, HEART, HEART_EMPTY, JET, MAGNET, SHIELD, STAR} from './pixelart.ts';
import {drawPixelText as drawPixelTextRaw} from '../menu/pixelscene.ts';
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

/** Queda livre: o mundo é desenhado de cabeça para baixo; o texto desvira (espelha de volta em torno da própria linha). */
let flipped = false;
function drawPixelText(canvas: SkCanvas, text: string, x: number, y: number, k: number, o: Parameters<typeof drawPixelTextRaw>[5]) {
  if (!flipped) { drawPixelTextRaw(canvas, text, x, y, k, o); return; }
  canvas.save();
  canvas.translate(0, y);
  canvas.scale(1, -1);
  canvas.translate(0, -y);
  drawPixelTextRaw(canvas, text, x, y, k, o);
  canvas.restore();
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

/**
 * Camadas estáticas viram um Picture uma única vez (altura da tela = chave) e são desenhadas com uma
 * rolagem circular: dezenas de retângulos de estrela/prédio viram 1–2 comandos por quadro.
 */
const layers = new Map<string, SkPicture>();
let layersFor = 0;
function layerPic(key: string, viewH: number, y0: number, h: number, draw: (c: SkCanvas) => void): SkPicture {
  if (layersFor !== viewH) { layers.clear(); layersFor = viewH; }
  let pic = layers.get(key);
  if (!pic) { pic = createPicture(draw, {x: 0, y: y0, width: FIELD_W, height: h}); layers.set(key, pic); }
  return pic;
}
function drawScrolling(canvas: SkCanvas, pic: SkPicture, viewH: number, offset: number) {
  const o = ((offset % viewH) + viewH) % viewH;
  canvas.save();
  canvas.translate(0, o);
  canvas.drawPicture(pic);
  canvas.translate(0, -viewH);
  canvas.drawPicture(pic);
  canvas.restore();
}
let alphaPaint: SkPaint | null = null;
function drawPicAlpha(canvas: SkCanvas, pic: SkPicture, alpha: number) {
  if (alpha >= 0.98) { canvas.drawPicture(pic); return; }
  if (!alphaPaint) alphaPaint = Skia.Paint();
  alphaPaint.setAlphaf(alpha);
  canvas.saveLayer(alphaPaint);
  canvas.drawPicture(pic);
  canvas.restore();
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

  // Skyline distante (some com a altitude): prédios e janelas acesas, parallax lento (uma imagem só).
  const city = clamp(1 - meters / 140, 0, 1);
  if (city > 0.02) {
    const base = viewH + cam * 0.32 - 40;
    const pic = layerPic('neon-city', viewH, -260, 700, (c) => {
      for (let i = 0; i < 14; i++) {
        const w = 26 + ((i * 37) % 34);
        const h = 70 + ((i * 53) % 170);
        const x = i * 31 - 8;
        rect(c, '#1b0f33', x, -h, w, h + 400, 0.9);
        rect(c, '#2a1650', x, -h, w, 3, 0.9);
        for (let r = 0; r < 6; r++) {
          for (let k = 0; k < 3; k++) {
            if (((i * 7 + r * 5 + k * 3) & 3) === 0) rect(c, i % 2 ? '#ff4dac' : '#49e6ff', x + 5 + k * 9, -h + 12 + r * 18, 4, 5, 0.55);
          }
        }
      }
      rect(c, '#ff4dac', 0, -6, FIELD_W, 3, 0.35); // brilho do horizonte
    });
    canvas.save();
    canvas.translate(0, base);
    drawPicAlpha(canvas, pic, city);
    canvas.restore();
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
  // Estrelas em quatro profundidades (cada uma é uma imagem rolando).
  for (let g = 0; g < 4; g++) {
    const pic = layerPic('neon-stars' + g, viewH, 0, viewH, (c) => {
      for (let i = g; i < 46; i += 4) {
        const x = (i * 79 + 23) % FIELD_W;
        const y = (i * 177 + Math.floor(i / 4) * 73) % viewH;
        const big = i % 9 === 0;
        rect(c, i % 5 === 0 ? '#5a425e' : '#433452', x, y, big ? 4 : 2, big ? 4 : 2);
      }
    });
    drawScrolling(canvas, pic, viewH, cam * (0.08 + g * 0.04));
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

let beam: ReturnType<typeof Skia.Path.Make> | null = null;
const beamPath = () => beam ?? (beam = Skia.Path.Make());

function drawCrystalBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('crystal', viewH, '#16336b', '#0a1230'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Feixes de luz diagonais devagar.
  for (let i = 0; i < 4; i++) {
    const x = ((i * 137 + time * 9) % (FIELD_W + 200)) - 100;
    const path = beamPath();
    path.rewind();
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

/** Cosmos: nebulosas, planeta com anel, três camadas de estrelas que piscam e estrela cadente. */
function drawCosmosBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('cosmos', viewH, '#2a0d5c', '#06021a'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Nebulosas (brilhos grandes, parallax lento).
  const neb: [string, number, number, number][] = [['#ff3fb0', 90, 0.18, 0.2], ['#3f8bff', 330, 0.14, 0.12], ['#8e3fff', 210, 0.2, 0.3], ['#2fe6d0', 360, 0.1, 0.07]];
  for (let i = 0; i < neb.length; i++) {
    const [c, x, a, d] = neb[i];
    const y = viewH - ((((i * 331 + cam * d) % (viewH + 360)) + viewH + 360) % (viewH + 360) - 180);
    drawGlow(canvas, c, 190, x, y, a);
  }
  // Planeta com anel.
  const py = viewH - ((((120 + cam * 0.06) % (viewH + 420)) + viewH + 420) % (viewH + 420) - 210);
  drawGlow(canvas, '#ff9d5c', 90, 320, py, 0.15);
  const q = P();
  q.setShader(null); q.setColor(col('#c8603a')); q.setAlphaf(0.9);
  canvas.drawCircle(320, py, 36, q);
  q.setColor(col('#8a3a4a')); q.setAlphaf(0.7);
  canvas.drawCircle(331, py + 7, 29, q);
  q.setColor(col('#ffb98a')); q.setAlphaf(0.5);
  canvas.drawCircle(308, py - 12, 11, q);
  q.setStyle(1); q.setStrokeWidth(5); q.setColor(col('#ffe0a8')); q.setAlphaf(0.55);
  canvas.save(); canvas.rotate(-18, 320, py);
  canvas.drawOval(Skia.XYWHRect(320 - 62, py - 11, 124, 22), q);
  canvas.restore();
  q.setStyle(0);
  // Estrelas: quatro camadas estáticas rolando + algumas que piscam.
  for (let g = 0; g < 4; g++) {
    const pic = layerPic('cosmos-stars' + g, viewH, 0, viewH, (c) => {
      for (let i = g; i < 64; i += 4) {
        const x = (i * 67 + 11) % FIELD_W;
        const y = (i * 149) % viewH;
        if (i % 11 === 0) pixelStar(c, i % 2 ? '#ffe9a8' : '#bfeaff', x, y, 2, 0.75);
        else rect(c, i % 3 === 0 ? '#bfeaff' : i % 3 === 1 ? '#ffffff' : '#d3a8ff', x, y, 2, 2, 0.6);
      }
    });
    drawScrolling(canvas, pic, viewH, cam * (0.05 + g * 0.05));
  }
  for (let i = 0; i < 12; i++) {
    const x = (i * 97 + 31) % FIELD_W;
    const y = ((((i * 211) + cam * 0.08) % viewH) + viewH) % viewH;
    rect(canvas, '#ffffff', x, y, 3, 3, 0.2 + 0.8 * Math.abs(Math.sin(time * (1.3 + (i % 4) * 0.5) + i)));
  }
  // Estrela cadente (a cada ~5 s).
  const k = (time / 5) % 1;
  if (k < 0.16) {
    const t = k / 0.16;
    const sx = 40 + ((Math.floor(time / 5) * 137) % 300) + t * 90, sy2 = 60 + t * 120;
    for (let j = 0; j < 8; j++) rect(canvas, j ? '#9fd8ff' : '#ffffff', sx - j * 8, sy2 - j * 5, 5 - j * 0.4, 3, (1 - t) * (1 - j / 9));
  }
}

let foldShader: SkShader | null = null;

/** Papel: caderno pautado com dobra no meio, margem vermelha, rabiscos e furos de espiral. */
function drawPaperBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('paper', viewH, '#f3e7c8', '#e6d5ae'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Pauta azul (rola com a câmera).
  for (let y = (cam * 0.9) % 28 - 28; y < viewH; y += 28) rect(canvas, '#7ba7d9', 0, y, FIELD_W, 1.5, 0.5);
  // Margens vermelhas de cada folha.
  rect(canvas, '#e0605a', 24, 0, 1.5, viewH, 0.55);
  rect(canvas, '#e0605a', FIELD_W - 25.5, 0, 1.5, viewH, 0.55);
  // Rabiscos à caneta à deriva (estrela, flor, coração, espiral).
  for (let i = 0; i < 9; i++) {
    const depth = 0.18 + (i % 3) * 0.08;
    const x = 40 + ((i * 97) % 150);
    const y = ((((i * 181) + cam * depth) % (viewH + 100)) + viewH + 100) % (viewH + 100) - 50;
    const c = i % 3 === 0 ? '#3b5fb0' : i % 3 === 1 ? '#d94a5a' : '#2d2a40';
    const a = 0.42;
    if (i % 3 === 0) pixelStar(canvas, c, x, y, 3, a);
    else if (i % 3 === 1) pixelFlower(canvas, c, '#ffb347', x, y, 4, a);
    else { rect(canvas, c, x - 8, y - 3, 6, 6, a); rect(canvas, c, x + 2, y - 3, 6, 6, a); rect(canvas, c, x - 5, y + 2, 10, 5, a); rect(canvas, c, x - 2, y + 6, 4, 4, a); }
  }
  // Fita adesiva e grampos soltos.
  for (let i = 0; i < 3; i++) {
    const y = ((((i * 311) + cam * 0.3) % (viewH + 120)) + viewH + 120) % (viewH + 120) - 60;
    rect(canvas, '#ffd36b', 6, y, 16, 30, 0.45);
    rect(canvas, '#ffd36b', FIELD_W - 22, y + 40, 16, 30, 0.45);
  }
  // Dobra central: sombra, vinco e luz.
  const c = FIELD_W / 2;
  foldShader ??= Skia.Shader.MakeLinearGradient({x: c - 36, y: 0}, {x: c + 36, y: 0}, [col('#00000000'), col('#5a4023aa'), col('#fff8e0aa'), col('#5a4023aa'), col('#00000000')], [0, 0.42, 0.5, 0.58, 1], TileMode.Clamp);
  p.setShader(foldShader); p.setAlphaf(0.55);
  canvas.drawRect(Skia.XYWHRect(c - 36, 0, 72, viewH), p);
  p.setShader(null);
  rect(canvas, '#7a5a38', c - 1, 0, 2, viewH, 0.45);
  // Paredes de papel dobrado nas bordas da faixa jogável (esquerda e espelho).
  for (const [x0, w, edge] of [[0, PAPER.WALL_MIN, 1], [PAPER.WALL_MAX, c - PAPER.WALL_MAX, 0], [c, c - PAPER.WALL_MAX, 1], [FIELD_W - PAPER.WALL_MIN, PAPER.WALL_MIN, 0]] as const) {
    rect(canvas, '#cdb98e', x0, 0, w, viewH, 0.55);
    for (let y = ((cam * 0.9) % 20) - 20; y < viewH; y += 20) rect(canvas, '#b39c6e', edge ? x0 + w - 5 : x0, y, 5, 10, 0.6);
  }
  // Furos de espiral na dobra.
  for (let y = ((cam * 0.9) % 56) - 56; y < viewH; y += 56) { rect(canvas, '#7a5a38', c - 5, y + 12, 10, 10, 0.5); rect(canvas, '#fff8e0', c - 3, y + 14, 6, 6, 0.8); }
  void time;
}

/** Fundo do Mar: água em degradê, raios de luz, bolhas subindo, cardume ao longe e algas. */
function drawOceanBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('ocean', viewH, '#0e6aa8', '#031a3a'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Raios de luz do alto, balançando.
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 105 + Math.sin(time * 0.5 + i) * 18;
    const path = beamPath();
    path.rewind();
    path.moveTo(x, 0); path.lineTo(x + 40, 0); path.lineTo(x + 130, viewH); path.lineTo(x + 40, viewH); path.close();
    const q = P(); q.setShader(null); q.setColor(col('#bff4ff')); q.setAlphaf(0.05 + 0.025 * Math.sin(time * 0.8 + i * 2));
    canvas.drawPath(path, q);
  }
  // Cardume de silhuetas passando (parallax).
  for (let i = 0; i < 5; i++) {
    const y = ((((i * 227) + cam * 0.14) % (viewH + 80)) + viewH + 80) % (viewH + 80) - 40;
    const x = ((time * (14 + i * 4) + i * 90) % (FIELD_W + 80)) - 40;
    for (let f = 0; f < 3; f++) {
      rect(canvas, '#042a52', x - f * 16, y + (f % 2) * 7, 10, 5, 0.55);
      rect(canvas, '#042a52', x - f * 16 - 5, y + (f % 2) * 7 + 1, 4, 3, 0.55);
    }
  }
  // Bolhas subindo (duas camadas estáticas rolando para baixo = sobem na tela).
  for (let g = 0; g < 3; g++) {
    const pic = layerPic('ocean-bub' + g, viewH, 0, viewH, (c) => {
      for (let i = g; i < 30; i += 3) {
        const x = (i * 59 + 13) % FIELD_W;
        const y = (i * 131) % viewH;
        const r = 2 + (i % 3) * 1.5;
        rect(c, '#bff4ff', x - r, y - r, r * 2, r * 2, 0.35);
        rect(c, '#ffffff', x - r + 1, y - r + 1, 2, 2, 0.7);
      }
    });
    drawScrolling(canvas, pic, viewH, cam * (0.1 + g * 0.07) - time * (6 + g * 5));
  }
  // Algas nas laterais.
  for (const sx of [0, FIELD_W - 18]) {
    for (let i = 0; i < 10; i++) {
      const y = (((((i * 96) + cam * 0.5) % (viewH + 96)) + viewH + 96) % (viewH + 96)) - 48;
      const sway = Math.sin(time * 1.6 + i + sx) * 4;
      rect(canvas, '#0b7f6a', sx + (sx ? 4 : 0) + sway, y, 14, 8, 0.7);
      rect(canvas, '#14b58a', sx + (sx ? 8 : 4) + sway, y - 8, 8, 10, 0.7);
    }
  }
}

/** Vulcão: céu de cinzas, vulcões ao longe com brilho, brasas subindo e fumaça. */
function drawVolcanoBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('volcano', viewH, '#3a0d16', '#120408'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Silhuetas de vulcões com cratera brilhando (parallax lento).
  for (let i = 0; i < 3; i++) {
    const base = viewH + cam * 0.1 + 20 - i * 6;
    const x = 40 + i * 150;
    const w = 150 + i * 20;
    rect(canvas, '#1c0a10', x - w / 2, base - 120 - i * 14, w, 400, 1);
    for (let k = 0; k < 8; k++) rect(canvas, '#1c0a10', x - w / 2 + k * 6 - 30 + k * 2, base - 120 - i * 14 - k * 5, w - k * 12 + 60 - k * 4, 6, 1);
    drawGlow(canvas, '#ff5a2a', 70, x, base - 126 - i * 14, 0.28 + 0.1 * Math.sin(time * 2 + i));
  }
  // Brasas e cinzas subindo (três camadas estáticas).
  for (let g = 0; g < 3; g++) {
    const pic = layerPic('volc-ash' + g, viewH, 0, viewH, (c) => {
      for (let i = g; i < 36; i += 3) {
        const x = (i * 61 + 7) % FIELD_W;
        const y = (i * 157) % viewH;
        rect(c, i % 3 === 0 ? '#ff7a3a' : i % 3 === 1 ? '#ffd36b' : '#6a4a4a', x, y, 2 + (i % 2), 2 + (i % 2), 0.7);
      }
    });
    drawScrolling(canvas, pic, viewH, cam * (0.12 + g * 0.06) - time * (22 + g * 12));
  }
  // Fumaça grossa nas bordas.
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.12 + i * 0.17) % 1;
    rect(canvas, '#4a2a2e', (i % 2 ? FIELD_W - 50 : 0) + Math.sin(i + time) * 8, viewH - t * viewH, 50, 40 + t * 40, 0.16 * (1 - t));
  }
  // Rachaduras de lava nos cantos.
  for (let y = ((cam * 0.4) % 60) - 60; y < viewH; y += 60) { rect(canvas, '#ff6a2a', 0, y, 6, 3, 0.55); rect(canvas, '#ff6a2a', FIELD_W - 6, y + 28, 6, 3, 0.55); }
}

/** A lava: superfície ondulada com brilho, bolhas e uma faixa de calor acima. */
function drawLava(canvas: SkCanvas, sim: Sim, sy: (y: number) => number, viewH: number, time: number) {
  if (sim.world !== 'volcano' || sim.lava <= 0) return;
  const top = sy(sim.lava);
  if (top > viewH + 30) return;
  const t0 = Math.max(-20, top);
  drawGlow(canvas, '#ff5a2a', 160, FIELD_W / 2, t0 + 10, 0.32);
  rect(canvas, '#d92a14', 0, t0, FIELD_W, viewH - t0 + 20, 1);
  rect(canvas, '#ff7a22', 0, t0 + 10, FIELD_W, viewH - t0, 0.9);
  rect(canvas, '#ffcf4a', 0, t0 + 26, FIELD_W, viewH, 0.55);
  // Crista ondulada.
  for (let x = 0; x < FIELD_W; x += 14) {
    const h = 6 + Math.sin(time * 3 + x * 0.09) * 5 + Math.sin(time * 1.7 + x * 0.21) * 3;
    rect(canvas, '#ff4a1a', x, t0 - h, 14, h + 4, 1);
    rect(canvas, '#ffb347', x, t0 - h, 14, 3, 1);
  }
  // Bolhas estourando.
  for (let i = 0; i < 6; i++) {
    const k = (time * 0.8 + i * 0.37) % 1;
    const bx = (i * 83 + 20) % FIELD_W;
    rect(canvas, '#ffe9a0', bx, t0 - k * 26 + 8, 5 - k * 3, 5 - k * 3, 1 - k);
  }
}

/** Queda livre: crepúsculo violeta com cortinas de aurora e pétalas (aparece de cabeça para baixo). */
function drawInverseBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const p = P();
  p.setShader(grad('inverse', viewH, '#2a1066', '#0b2a55'));
  p.setAlphaf(1);
  canvas.drawRect(Skia.XYWHRect(0, 0, FIELD_W, viewH), p);
  p.setShader(null);
  // Cortinas de aurora ondulando.
  const cols: [string, number][] = [['#3dffb0', 0.1], ['#ff5fd2', 0.09], ['#58a8ff', 0.1]];
  for (let b = 0; b < 3; b++) {
    const baseY = ((((b * 311) + cam * (0.05 + b * 0.03)) % (viewH + 200)) + viewH + 200) % (viewH + 200) - 100;
    for (let x = 0; x < FIELD_W; x += 14) {
      const w = Math.sin(time * 0.9 + x * 0.025 + b * 2) * 26 + Math.sin(time * 0.4 + x * 0.06) * 12;
      rect(canvas, cols[b][0], x, baseY + w, 14, 90 + 40 * Math.sin(x * 0.04 + b), cols[b][1]);
    }
  }
  // Lua grande e estrelas.
  const my = ((((60 + cam * 0.04) % (viewH + 300)) + viewH + 300) % (viewH + 300)) - 150;
  drawGlow(canvas, '#cfd8ff', 110, 320, my, 0.2);
  const q = P(); q.setShader(null); q.setColor(col('#e8ecff')); q.setAlphaf(0.9);
  canvas.drawCircle(320, my, 34, q);
  q.setColor(col('#b4bdf0')); q.setAlphaf(0.6); canvas.drawCircle(331, my + 7, 8, q); canvas.drawCircle(308, my - 10, 6, q);
  for (let g = 0; g < 3; g++) {
    const pic = layerPic('inv-stars' + g, viewH, 0, viewH, (c) => {
      for (let i = g; i < 45; i += 3) rect(c, i % 4 === 0 ? '#ffd0f4' : '#ffffff', (i * 71 + 9) % FIELD_W, (i * 139) % viewH, 2, 2, 0.7);
    });
    drawScrolling(canvas, pic, viewH, cam * (0.06 + g * 0.05));
  }
  // Pétalas caindo (para cima, no mundo de cabeça para baixo).
  for (let i = 0; i < 10; i++) {
    const t = (time * 0.12 + i * 0.1) % 1;
    pixelFlower(canvas, '#ff9bd6', '#ffe08a', (i * 83 + Math.sin(time + i) * 12) % FIELD_W, t * viewH, 3, 0.45);
  }
}

/** Rascunho: metade lápis em papel, metade planta azul a giz, com a dobra rasgada no meio. */
function drawSketchBackground(canvas: SkCanvas, cam: number, viewH: number, time: number) {
  const c = FIELD_W / 2;
  rect(canvas, '#efe6d0', 0, 0, c, viewH);
  rect(canvas, '#1d3f7a', c, 0, c, viewH);
  // Pauta e grade.
  for (let y = (cam * 0.9) % 28 - 28; y < viewH; y += 28) { rect(canvas, '#a89d80', 0, y, c, 1, 0.5); rect(canvas, '#9cc0ff', c, y, c, 1, 0.35); }
  for (let x = 0; x < c; x += 28) { rect(canvas, '#a89d80', x, 0, 1, viewH, 0.25); rect(canvas, '#9cc0ff', c + x, 0, 1, viewH, 0.2); }
  // Rabiscos: lápis (esquerda) e giz branco (direita).
  for (let i = 0; i < 10; i++) {
    const depth = 0.16 + (i % 3) * 0.07;
    const y = ((((i * 173) + cam * depth) % (viewH + 100)) + viewH + 100) % (viewH + 100) - 50;
    const xl = 30 + ((i * 59) % 150);
    if (i % 2) pixelStar(canvas, '#5a5a66', xl, y, 3, 0.4); else pixelFlower(canvas, '#7a6a5a', '#d9a066', xl, y, 4, 0.4);
    if (i % 2) pixelStar(canvas, '#ffffff', FIELD_W - xl, y, 3, 0.5); else pixelFlower(canvas, '#cfe4ff', '#ffe08a', FIELD_W - xl, y, 4, 0.5);
  }
  // Dobra rasgada: borda serrilhada com sombra e fibras de papel.
  for (let y = ((cam * 0.9) % 14) - 14; y < viewH; y += 14) {
    const j = ((Math.floor((y - cam * 0.9) / 14) * 7919) % 5) * 2 - 4;
    rect(canvas, '#efe6d0', c - 10 + j, y, 16, 14);
    rect(canvas, '#b8a98a', c - 12 + j, y, 3, 14, 0.7);
    rect(canvas, '#ffffff', c + 4 + j, y + 2, 3, 3, 0.8);
  }
  rect(canvas, '#000000', c + 6, 0, 8, viewH, 0.14);
  drawGlow(canvas, '#ffd36b', 60, c, (time * 90) % (viewH + 100) - 20, 0.14);
}

function drawWorldBackground(canvas: SkCanvas, world: WorldId, cam: number, viewH: number, meters: number, time: number) {
  if (world === 'crystal') drawCrystalBackground(canvas, cam, viewH, time);
  else if (world === 'clock') drawClockBackground(canvas, cam, viewH, time);
  else if (world === 'cosmos') drawCosmosBackground(canvas, cam, viewH, time);
  else if (world === 'paper') drawPaperBackground(canvas, cam, viewH, time);
  else if (world === 'ocean') drawOceanBackground(canvas, cam, viewH, time);
  else if (world === 'volcano') drawVolcanoBackground(canvas, cam, viewH, time);
  else if (world === 'inverse') drawInverseBackground(canvas, cam, viewH, time);
  else if (world === 'sketch') drawSketchBackground(canvas, cam, viewH, time);
  else drawNeonBackground(canvas, cam, viewH, meters);
}

type Skin = {
  top: Record<string, string>;
  accent: Record<string, string>;
  body: string;
  bodyDark: string;
  ink: string;
  glint: string;
  dots: string;
  glass: boolean;
};

const SKINS: Record<WorldId, Skin> = {
  neon: {
    top: {normal: '#b594fc', moving: '#59dcd6', fragile: '#ff5896', spring: '#f5b967', start: '#bba0fe', conveyor: '#b594fc', ghost: '#d9c8ff'},
    accent: {normal: '#ff4dac', moving: '#49e6ff', fragile: '#ff5896', spring: '#ffd369', start: '#8e6bff', conveyor: '#ff4dac', ghost: '#d9c8ff'},
    body: '#3d265e', bodyDark: '#2e1b4a', ink: '#10091f', glint: '#f0ceff', dots: '#ff9bd6', glass: false,
  },
  crystal: {
    top: {normal: '#9ff6ff', moving: '#6bf5d6', fragile: '#ff9ccb', spring: '#ffe08a', start: '#b9d8ff', conveyor: '#9ff6ff', ghost: '#e6ffff'},
    accent: {normal: '#49e6ff', moving: '#6bf5d6', fragile: '#ff9ccb', spring: '#ffe08a', start: '#7fb0ff', conveyor: '#49e6ff', ghost: '#e6ffff'},
    body: '#2c6fb8', bodyDark: '#1d4a8c', ink: '#08142e', glint: '#e8ffff', dots: '#b9fbff', glass: true,
  },
  clock: {
    top: {normal: '#e0b070', moving: '#7be0d8', fragile: '#ff7b8a', spring: '#ffd070', start: '#e8c890', conveyor: '#c9d0e8', ghost: '#f0e6d8'},
    accent: {normal: '#ffbf65', moving: '#7be0d8', fragile: '#ff7b8a', spring: '#ffd070', start: '#ffbf65', conveyor: '#8cf0ff', ghost: '#f0e6d8'},
    body: '#6a4a3a', bodyDark: '#3f2c2a', ink: '#120c14', glint: '#fff0d0', dots: '#ffd9a0', glass: false,
  },
  cosmos: {
    top: {normal: '#8f9cff', moving: '#5ff0d8', fragile: '#ff6fb0', spring: '#ffd36b', start: '#b0b8ff', conveyor: '#8f9cff', ghost: '#e0d6ff'},
    accent: {normal: '#6f7cff', moving: '#5ff0d8', fragile: '#ff6fb0', spring: '#ffd36b', start: '#9aa4ff', conveyor: '#6f7cff', ghost: '#e0d6ff'},
    body: '#473a8c', bodyDark: '#2d2465', ink: '#080420', glint: '#e8e4ff', dots: '#b9c2ff', glass: false,
  },
  ocean: {
    top: {normal: '#9ff0d4', moving: '#7be0ff', fragile: '#ff9ccb', spring: '#ffe08a', start: '#c0fff0', conveyor: '#9ff0d4', ghost: '#e6ffff'},
    accent: {normal: '#2fd4a8', moving: '#49c8ff', fragile: '#ff9ccb', spring: '#ffe08a', start: '#6be0c4', conveyor: '#2fd4a8', ghost: '#e6ffff'},
    body: '#1f7f86', bodyDark: '#14565e', ink: '#04202c', glint: '#e8fffa', dots: '#b9fff0', glass: true,
  },
  volcano: {
    top: {normal: '#c96a4a', moving: '#ffb04a', fragile: '#ff6a6a', spring: '#ffd36b', start: '#e08a60', conveyor: '#c96a4a', ghost: '#ffd9c8'},
    accent: {normal: '#ff7a3a', moving: '#ffb04a', fragile: '#ff6a6a', spring: '#ffd36b', start: '#ff7a3a', conveyor: '#ff7a3a', ghost: '#ffd9c8'},
    body: '#4a2a2e', bodyDark: '#2e181c', ink: '#0e0508', glint: '#ffd9b0', dots: '#ff9a5a', glass: false,
  },
  inverse: {
    top: {normal: '#ff9be0', moving: '#7fe8ff', fragile: '#ffb3b3', spring: '#ffe08a', start: '#ffc4ee', conveyor: '#ff9be0', ghost: '#f4e6ff'},
    accent: {normal: '#ff5fd2', moving: '#49e6ff', fragile: '#ff7b8a', spring: '#ffd369', start: '#ff8ee0', conveyor: '#ff5fd2', ghost: '#f4e6ff'},
    body: '#4a2a8a', bodyDark: '#2e1a63', ink: '#0c0626', glint: '#ffeaff', dots: '#ffb8ee', glass: false,
  },
  sketch: {
    top: {normal: '#fff4d6', moving: '#9fe0d4', fragile: '#ff9b9b', spring: '#ffd36b', start: '#fff9e6', conveyor: '#fff4d6', ghost: '#d9e6ff'},
    accent: {normal: '#8a7a5a', moving: '#5fc0b0', fragile: '#e06a6a', spring: '#ffb347', start: '#8a7a5a', conveyor: '#8a7a5a', ghost: '#9bb8ff'},
    body: '#d9c9a4', bodyDark: '#b8a67e', ink: '#4a3f2e', glint: '#ffffff', dots: '#6a5a3a', glass: false,
  },
  paper: {
    top: {normal: '#fff4d6', moving: '#9fe0d4', fragile: '#ff9b9b', spring: '#ffd36b', start: '#fff9e6', conveyor: '#fff4d6', ghost: '#d9e6ff'},
    accent: {normal: '#d9a66a', moving: '#5fc0b0', fragile: '#e06a6a', spring: '#ffb347', start: '#d9a66a', conveyor: '#d9a66a', ghost: '#9bb8ff'},
    body: '#c99a64', bodyDark: '#a87a48', ink: '#3a2a1e', glint: '#ffffff', dots: '#7a5230', glass: false,
  },
};

/** Plataforma-fantasma: some e volta num ciclo; pisca nos instantes antes de sumir. */
function ghostAlpha(pl: Platform, time: number): number {
  if (!ghostSolid(pl, time)) return 0.2 + 0.06 * Math.sin(time * 9 + pl.phase);
  const k = (((time * pl.speed + pl.phase) / (Math.PI * 2)) % 1 + 1) % 1;
  return k > 0.5 && Math.floor(time * 16) % 2 === 0 ? 0.5 : 1; // avisa: vai sumir
}

function drawPlatform(canvas: SkCanvas, pl: Platform, x: number, y: number, time: number, world: WorldId) {
  if (pl.type !== 'ghost') { drawPlatformBody(canvas, pl, x, y, time, world); return; }
  const lp = P();
  lp.setShader(null); lp.setAlphaf(ghostAlpha(pl, time));
  canvas.saveLayer(lp);
  drawPlatformBody(canvas, pl, x, y, time, world);
  // Ondas de fumaça sob a plataforma.
  for (let i = 0; i < 3; i++) rect(canvas, '#ffffff', x - pl.w / 2 + 14 + i * (pl.w / 3), y + 17 + Math.sin(time * 3 + i) * 2, 6, 3, 0.7);
  canvas.restore();
}

/** Plataforma "adesivo": contorno de tinta, chapa colorida, brilho por baixo e um padrão por tipo (e por mundo). */
/** Rascunho, lado da planta azul (a giz). */
const SKETCH_R: Skin = {
  top: {normal: '#ffffff', moving: '#9fe0ff', fragile: '#ff9b9b', spring: '#ffe08a', start: '#ffffff', conveyor: '#ffffff', ghost: '#cfe4ff'},
  accent: {normal: '#9cc0ff', moving: '#49e6ff', fragile: '#ff7b8a', spring: '#ffd369', start: '#9cc0ff', conveyor: '#9cc0ff', ghost: '#cfe4ff'},
  body: '#2f62b8', bodyDark: '#1b3f85', ink: '#071a3d', glint: '#ffffff', dots: '#cfe4ff', glass: false,
};

function drawPlatformBody(canvas: SkCanvas, pl: Platform, x: number, y: number, time: number, world: WorldId) {
  const sk = world === 'sketch' && x > FIELD_W / 2 ? SKETCH_R : SKINS[world];
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
    case 'switch': {
      // Botão: placa com um botão redondo (vermelho; verde e afundado depois de pisado).
      const on = !!pl.pressed;
      rect(canvas, sk.ink, x - 22, y - 12, 44, 14);
      rect(canvas, '#8c95b8', x - 20, y - 10, 40, 10);
      rect(canvas, on ? '#1f8a4a' : '#8a1c2c', x - 15, y - (on ? 9 : 17), 30, on ? 7 : 9);
      rect(canvas, on ? '#4dff90' : '#ff4d5e', x - 13, y - (on ? 10 : 20), 26, on ? 6 : 9);
      rect(canvas, '#ffffff', x - 9, y - (on ? 9 : 18), 8, 2, on ? 0.5 : 0.8);
      if (!on) drawGlow(canvas, '#ff4d5e', 36, x, y - 14, 0.28 + 0.12 * Math.sin(time * 6));
      break;
    }
    case 'ghost':
      for (let dx = left + 8; dx < left + w - 10; dx += 12) rect(canvas, '#ffffff', dx, y + 5, 6, 2, 0.8);
      break;
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

function drawHero(canvas: SkCanvas, S: SceneInput, hero: Hero, facing: 1 | -1, x: number, footY: number, fi: number, alpha = 1) {
  const img = S.sprites[hero][fi];
  const m = META[hero].frames[fi];
  if (!img || !m) return;
  const flip = facing * NATIVE[hero] === -1;
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

const ENEMY_GLOW: Record<Enemy['kind'], string> = {drone: '#c46bff', zigzag: '#5b8cff', turret: '#ffb35e', orb: '#28d8fd', guardian: '#ff4dac', ufo: '#7ff6ff', meteor: '#ff9d4a', blackhole: '#8e3fff', clip: '#9bb0d8', jelly: '#ff7ad9', ember: '#ff7a3a'};

/** Buraco negro: disco escuro, braços de pixels girando e anel da atração (tracejado). */
function drawBlackhole(canvas: SkCanvas, x: number, y: number, time: number) {
  drawGlow(canvas, '#8e3fff', 70, x, y, 0.42 + 0.1 * Math.sin(time * 4));
  const p = P();
  p.setShader(null);
  p.setStyle(1); p.setStrokeWidth(2); p.setColor(col('#b58cff')); p.setAlphaf(0.18 + 0.08 * Math.sin(time * 3));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + time * 0.6;
    if (i % 2) continue;
    canvas.drawLine(x + Math.cos(a) * BLACKHOLE.PULL_R, y + Math.sin(a) * BLACKHOLE.PULL_R, x + Math.cos(a + 0.18) * BLACKHOLE.PULL_R, y + Math.sin(a + 0.18) * BLACKHOLE.PULL_R, p);
  }
  p.setStyle(0);
  for (let arm = 0; arm < 3; arm++) {
    for (let j = 0; j < 12; j++) {
      const t = j / 12;
      const ang = time * 3 + arm * 2.094 + t * 5;
      const r = 40 * (1 - t * 0.82);
      rect(canvas, j % 3 === 0 ? '#ffffff' : arm % 2 ? '#ff7ad9' : '#7ff6ff', x + Math.cos(ang) * r - 2, y + Math.sin(ang) * r * 0.82 - 2, 4 - t * 2, 4 - t * 2, 0.9 - t * 0.3);
    }
  }
  p.setColor(col('#000000')); p.setAlphaf(1);
  canvas.drawCircle(x, y, 17, p);
  p.setStyle(1); p.setStrokeWidth(2); p.setColor(col('#c9a6ff')); p.setAlphaf(0.9);
  canvas.drawCircle(x, y, 17, p);
  p.setStyle(0);
}

/** Clipe de papel (Universo de Papel): fio prateado com contorno de tinta, balança ao subir e descer. */
let clipPath: ReturnType<typeof Skia.Path.Make> | null = null;
function drawClip(canvas: SkCanvas, x: number, y: number, time: number, flip: boolean) {
  if (!clipPath) {
    clipPath = Skia.Path.Make();
    clipPath.moveTo(-3, 9); clipPath.lineTo(-3, -8); clipPath.cubicTo(-3, -14, 4, -14, 4, -8); clipPath.lineTo(4, 12);
    clipPath.cubicTo(4, 19, -7, 19, -7, 12); clipPath.lineTo(-7, -12); clipPath.cubicTo(-7, -21, 8, -21, 8, -12); clipPath.lineTo(8, 6);
  }
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate(Math.sin(time * 3 + x) * 12 + (flip ? 180 : 0), 0, 0);
  canvas.scale(1.15, 1.15);
  const p = P();
  p.setShader(null); p.setStyle(1); p.setStrokeWidth(5.5); p.setColor(col('#2d2a40')); p.setAlphaf(1);
  canvas.drawPath(clipPath, p);
  p.setStrokeWidth(2.5); p.setColor(col('#d5dcee')); canvas.drawPath(clipPath, p);
  p.setStrokeWidth(1); p.setColor(col('#ffffff')); canvas.drawPath(clipPath, p);
  p.setStyle(0);
  canvas.restore();
}

function drawEnemy(canvas: SkCanvas, e: Enemy, time: number, sy: (y: number) => number, text = true) {
  const pos = enemyAt(e, time);
  const x = pos.x;
  const y = sy(pos.y);
  const warn = e.warn && Math.floor(time * 10) % 2 === 0;
  if (e.kind === 'blackhole') { drawBlackhole(canvas, x, y, time); return; }
  if (e.kind === 'clip') {
    drawGlow(canvas, ENEMY_GLOW.clip, 36, x, y, 0.22);
    drawClip(canvas, x, y, time, false);
    return;
  }
  const frames = ENEMY_SPRITES[e.kind];
  const fr = e.kind === 'turret' || e.kind === 'guardian' ? (warn ? 1 : 0) : Math.floor(time * (e.kind === 'orb' ? 4 : e.kind === 'ufo' || e.kind === 'jelly' ? 3 : 9)) % 2;
  const flip = e.kind === 'drone' || e.kind === 'zigzag' ? enemyAt(e, time + 0.05).x < pos.x : false;
  if (e.kind === 'meteor') {
    // Cauda de fogo contra o sentido do movimento.
    const nx = enemyAt(e, time + 0.04);
    let dx = nx.x - pos.x, dy = -(nx.y - pos.y);
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const rot = Math.floor(time * 5) % 2;
    for (let i = 1; i <= 9; i++) {
      const q = i / 9;
      const sz = 20 * (1 - q * 0.75);
      rect(canvas, i < 3 ? '#fff3b0' : i < 6 ? '#ffb347' : '#ff5a3a', x - dx * i * 8 - sz / 2 + (i % 2 ? rot : -rot), y - dy * i * 8 - sz / 2, sz, sz, 0.85 * (1 - q));
    }
  }
  drawGlow(canvas, ENEMY_GLOW[e.kind], e.size * 2.2, x, y, 0.2 + (e.warn ? 0.2 : 0));
  drawPix(canvas, frames[fr], x, y, e.kind === 'guardian' ? 2.4 : 2, {flip});
  if (e.kind === 'ember') for (let i = 1; i <= 4; i++) rect(canvas, i < 3 ? '#ffb347' : '#ff5a2a', x - 2 + Math.sin(time * 9 + i) * 2, y + 14 + i * 7, 4 - i * 0.6, 5, 0.6 - i * 0.12);
  if (e.maxHp > 1 && e.maxHp <= 5) {
    for (let i = 0; i < e.maxHp; i++) {
      const px = x - (e.maxHp * 9) / 2 + i * 9 + 1;
      rect(canvas, '#10091f', px - 1, y - e.size - 16, 9, 8);
      rect(canvas, i < e.hp ? '#8cf9ee' : '#43223d', px, y - e.size - 15, 7, 6);
    }
  }
  if (e.warn && text) drawPixelText(canvas, '!', x, y - e.size - (e.maxHp > 1 ? 30 : 20), 3, {top: '#fff1a5', low: '#ffd36b', shadow: '#ff4167'});
}

type PortalLook = {c1: string; c2: string; core: string; name: string};
const WORLD_LOOK: Record<WorldId, PortalLook> = {
  neon: {c1: '#ff7ad9', c2: '#ffd0f2', core: '#2a0f5e', name: 'NEON'},
  crystal: {c1: '#5ceef4', c2: '#d4ffff', core: '#0c2a5e', name: 'CRISTAL'},
  clock: {c1: '#ffbf65', c2: '#fff0cc', core: '#3a2410', name: 'MECANICO'},
  cosmos: {c1: '#9b7bff', c2: '#e6dcff', core: '#0a0430', name: 'COSMOS'},
  paper: {c1: '#e8d9ae', c2: '#ffffff', core: '#fff1c9', name: 'PAPEL'},
  ocean: {c1: '#49c8ff', c2: '#d4f6ff', core: '#04304f', name: 'MAR'},
  volcano: {c1: '#ff7a3a', c2: '#ffe0b0', core: '#3a0c0c', name: 'VULCAO'},
  inverse: {c1: '#b86bff', c2: '#f0dcff', core: '#1a0a3a', name: 'INVERSO'},
  sketch: {c1: '#ffd36b', c2: '#fff3c9', core: '#1d3f7a', name: 'RASCUNHO'},
};
function portalLook(it: Item): PortalLook {
  switch (it.variant) {
    case 'paper': return WORLD_LOOK.paper;
    case 'bonus': return {c1: '#ffd369', c2: '#fff3b0', core: '#4a3200', name: 'BONUS'};
    case 'warp': return {c1: '#ff4fd8', c2: '#ffd0f7', core: '#3a0a40', name: 'ATALHO'};
    case 'flip': return WORLD_LOOK.inverse;
    case 'sketch': return WORLD_LOOK.sketch;
    case 'tele': return it.open ? {c1: '#3aa0ff', c2: '#bfe2ff', core: '#06284a', name: 'PORTAL'} : {c1: '#8a9bb5', c2: '#cfd8ea', core: '#141b26', name: 'TRANCADO'};
    case 'exit': return {c1: '#ff9a3d', c2: '#ffe0b8', core: '#3a1a06', name: 'SAIDA'};
    case 'time': return {c1: '#7fd8ff', c2: '#effbff', core: '#0a2a4a', name: 'CRONOS'};
    case 'leap': return {c1: '#b6ff6b', c2: '#f0ffd0', core: '#133a10', name: 'SALTO ' + WORLD_LOOK[it.target ?? 'neon'].name};
    case 'back': return {...WORLD_LOOK[it.target ?? 'neon'], name: 'VOLTAR'};
    default: return WORLD_LOOK[it.target ?? 'neon'];
  }
}

function drawPortal(canvas: SkCanvas, it: Item, x: number, y: number, time: number, text = true) {
  const {c1, c2, core, name} = portalLook(it);
  const variant = it.variant ?? 'world';
  const pulse = 1 + 0.06 * Math.sin(time * 7);
  const rx = 24 * pulse, ry = 40 * pulse;
  drawGlow(canvas, c1, 90, x, y, 0.35 + 0.1 * Math.sin(time * 5));
  const p = P();
  p.setShader(null); p.setColor(col(core)); p.setAlphaf(0.82);
  canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), p);
  p.setColor(col(variant === 'paper' ? '#e6d4a4' : c1)); p.setAlphaf(0.42);
  canvas.drawOval(Skia.XYWHRect(x - rx * 0.72, y - ry * 0.72, rx * 1.44, ry * 1.44), p);
  if (variant === 'warp') {
    // Setas subindo (atalho turbo).
    for (let j = 0; j < 3; j++) {
      const t = ((time * 1.6 + j / 3) % 1);
      const cy = y + ry * 0.7 - t * ry * 1.4;
      rect(canvas, '#ffffff', x - 12, cy, 12, 4, 1 - Math.abs(t - 0.5));
      rect(canvas, '#ffffff', x, cy, 12, 4, 1 - Math.abs(t - 0.5));
      rect(canvas, c2, x - 18, cy + 4, 8, 4, 1 - Math.abs(t - 0.5));
      rect(canvas, c2, x + 10, cy + 4, 8, 4, 1 - Math.abs(t - 0.5));
    }
  } else if (variant === 'flip') {
    // Setas para cima e para baixo: a tela vai virar.
    for (let k = 0; k < 4; k++) {
      const up = k < 2;
      const t = (time * 1.3 + k * 0.25) % 1;
      const cy = up ? y - ry * 0.1 - t * ry * 0.7 : y + ry * 0.1 + t * ry * 0.7;
      const a = 1 - t;
      for (let r = 0; r < 4; r++) rect(canvas, '#ffffff', x - (3 - r) * 3, cy + (up ? r * 3 : -r * 3), (3 - r) * 6 + 3, 3, a);
    }
  } else if (variant === 'sketch') {
    // Meio papel, meio planta azul, com a rasgadura no meio.
    rect(canvas, '#fff1c9', x - rx * 0.7, y - ry * 0.55, rx * 0.7, ry * 1.1, 0.9);
    rect(canvas, '#2f62b8', x, y - ry * 0.55, rx * 0.7, ry * 1.1, 0.9);
    for (let k = 0; k < 6; k++) rect(canvas, k % 2 ? '#7a6a4a' : '#ffffff', x - 2 + (k % 2) * 3 - 2, y - ry * 0.55 + k * (ry * 1.1 / 6), 4, 5, 1);
  } else if (variant === 'tele' || variant === 'exit') {
    // Anéis concêntricos girando (estilo portal de laboratório); fechado = quase parado e com cadeado.
    const sp = variant === 'tele' && !it.open ? 0.15 : 1;
    for (let r = 0; r < 3; r++) {
      const q2 = P(); q2.setShader(null); q2.setStyle(1); q2.setStrokeWidth(3); q2.setColor(col(r % 2 ? c2 : c1)); q2.setAlphaf(0.85 - r * 0.2);
      canvas.save(); canvas.translate(x, y); canvas.rotate(time * 60 * sp * (r % 2 ? -1 : 1), 0, 0);
      canvas.drawOval(Skia.XYWHRect(-rx * (0.8 - r * 0.22), -ry * (0.8 - r * 0.22), rx * 2 * (0.8 - r * 0.22), ry * 2 * (0.8 - r * 0.22)), q2);
      canvas.restore(); q2.setStyle(0);
    }
    if (variant === 'tele' && !it.open) {
      rect(canvas, '#cfd8ea', x - 8, y - 2, 16, 14, 1); rect(canvas, '#3a4658', x - 2, y + 4, 4, 5, 1);
      rect(canvas, '#cfd8ea', x - 6, y - 12, 3, 12, 1); rect(canvas, '#cfd8ea', x + 3, y - 12, 3, 12, 1); rect(canvas, '#cfd8ea', x - 6, y - 14, 12, 3, 1);
    }
  } else if (variant === 'time') {
    // Relógio: ponteiros girando (o rápido é rápido, o lento é lento) e marcas das horas.
    for (let h = 0; h < 12; h++) { const a = (h / 12) * 6.283; rect(canvas, h % 3 === 0 ? '#ffffff' : c2, x + Math.cos(a) * rx * 0.72 - 1.5, y + Math.sin(a) * ry * 0.72 - 1.5, 3, 3, 0.9); }
    const hand = (len: number, ang: number, w: number) => { for (let k = 1; k <= 6; k++) rect(canvas, '#ffffff', x + Math.cos(ang) * (len * rx * k) / 6 - w / 2, y + Math.sin(ang) * (len * ry * k) / 6 - w / 2, w, w, 1); };
    hand(0.62, time * 5, 3); hand(0.4, time * 0.8, 4);
    rect(canvas, c1, x - 2, y - 2, 4, 4, 1);
  } else if (variant === 'leap') {
    // Duas setas grandes para a frente: pula um mundo.
    for (let j = 0; j < 2; j++) {
      const t = (time * 1.4 + j / 2) % 1;
      const cy = y + ry * 0.55 - t * ry * 1.1;
      for (let k = 0; k < 4; k++) { rect(canvas, '#ffffff', x - 14 + k * 2, cy + k * 3, 4, 3, 1 - Math.abs(t - 0.5)); rect(canvas, '#ffffff', x + 10 - k * 2, cy + k * 3, 4, 3, 1 - Math.abs(t - 0.5)); }
    }
  } else if (variant === 'bonus') {
    // Fitas douradas girando para dentro.
    for (let j = 0; j < 8; j++) {
      const t = j / 8;
      const ang = time * 2.4 + t * 6.28;
      const r = 0.75 - 0.4 * Math.abs(Math.sin(time + j));
      drawPix(canvas, STAR[j % 2], x + Math.cos(ang) * rx * r, y + Math.sin(ang) * ry * r, 0.7, {alpha: 0.9});
    }
  } else {
    // Redemoinho em pixels, girando para dentro (no Papel: tinta preta e branca; dobra no meio).
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const ang = time * 3.2 + t * 11;
      rect(canvas, variant === 'paper' ? (j % 2 ? '#2d2a40' : '#d94a5a') : j % 2 ? c2 : '#ffffff', x + Math.cos(ang) * rx * 0.78 * (1 - t * 0.9) - 2, y + Math.sin(ang) * ry * 0.78 * (1 - t * 0.9) - 2, 4, 4, 0.9 - t * 0.5);
    }
    if (variant === 'paper' || variant === 'back') rect(canvas, '#2d2a40', x - 1, y - ry * 0.9, 2, ry * 1.8, 0.5);
  }
  // Aro de pixels.
  const n = 56;
  const tick = Math.floor(time * 12);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + time * 1.1;
    const color = (i + tick) % 4 === 0 ? '#ffffff' : (i + tick) % 2 ? c1 : c2;
    rect(canvas, color, Math.round((x + Math.cos(a) * rx) / 2) * 2 - 3, Math.round((y + Math.sin(a) * ry) / 2) * 2 - 3, 6, 6);
  }
  if (text) drawPixelText(canvas, name, x, y + ry + 18, 2, {top: '#ffffff', low: c2, shadow: variant === 'paper' ? '#7a5a38' : c1});
}

/** Barreira da sala do portal: feixe de laser de ponta a ponta com dois emissores; aberta, vira pontilhado verde. */
function drawGate(canvas: SkCanvas, it: Item, y: number, time: number, text: boolean) {
  const open = !!it.open;
  const c1 = open ? '#4dff90' : '#ff3d5a';
  const beatA = open ? 0.25 : 0.7 + 0.25 * Math.sin(time * 20);
  rect(canvas, '#10091f', -4, y - 14, 22, 28); rect(canvas, '#5a4c7a', 0, y - 10, 16, 20);
  rect(canvas, '#10091f', FIELD_W - 18, y - 14, 26, 28); rect(canvas, '#5a4c7a', FIELD_W - 16, y - 10, 16, 20);
  rect(canvas, c1, 8, y - 5, 6, 10, 1); rect(canvas, c1, FIELD_W - 14, y - 5, 6, 10, 1);
  if (open) {
    for (let x = 22; x < FIELD_W - 22; x += 18) rect(canvas, c1, x + ((time * 30) % 18), y - 1.5, 8, 3, beatA);
  } else {
    drawGlow(canvas, c1, 70, FIELD_W / 2, y, 0.18);
    rect(canvas, c1, 16, y - 4, FIELD_W - 32, 8, 0.28);
    rect(canvas, '#ffffff', 16, y - 1.5, FIELD_W - 32, 3, beatA);
    rect(canvas, c1, 16, y - 3, FIELD_W - 32, 6, beatA * 0.6);
    for (let i = 0; i < 6; i++) rect(canvas, '#ffffff', 30 + ((i * 67 + time * 140) % (FIELD_W - 60)), y - 6 + (i % 2) * 8, 3, 3, 0.8);
    if (text) drawPixelText(canvas, 'APERTE O BOTAO', FIELD_W / 2, y + 20, 2, {top: '#ffffff', low: '#ff9aa8', shadow: '#5a0c1c'});
  }
}

function drawItem(canvas: SkCanvas, it: Item, x: number, y: number, time: number, text = true) {
  const bob = Math.sin(time * 4 + it.phase) * 3;
  const yy = y + bob;
  switch (it.kind) {
    case 'tape': drawTape(canvas, x, yy, time); break;
    case 'shield': drawGlow(canvas, '#51ecff', 38, x, yy, 0.3); drawPix(canvas, SHIELD, x, yy, 2); break;
    case 'boost': drawGlow(canvas, '#ffe36c', 38, x, yy, 0.3); drawPix(canvas, BOOST, x, yy, 2); break;
    case 'jet': drawGlow(canvas, '#ff7a95', 40, x, yy, 0.32); drawPix(canvas, JET[Math.floor(time * 20) % 2], x, yy, 2); break;
    case 'heart': drawGlow(canvas, '#ff3d6e', 38, x, yy, 0.32); drawPix(canvas, HEART, x, yy, 2 + 0.2 * Math.sin(time * 6)); break;
    case 'flag': drawGlow(canvas, '#ffe36c', 44, x, y - 6, 0.22); drawPix(canvas, FLAG[Math.floor(time * 4) % 2], x - 6, y + 36, 2, {anchor: 'bottom'}); break;
    case 'magnet': drawGlow(canvas, '#ff5a7a', 40, x, yy, 0.3); drawPix(canvas, MAGNET, x, yy, 2); break;
    case 'star': {
      drawGlow(canvas, '#ffe36c', 56, x, yy, 0.4 + 0.12 * Math.sin(time * 8));
      drawPix(canvas, STAR[Math.floor(time * 6) % 2], x, yy, 2 + 0.2 * Math.sin(time * 5));
      if (Math.sin(time * 5 + x) > 0.2) pixelStar(canvas, '#ffffff', x + 16, yy - 14, 1.5, 0.9);
      break;
    }
    case 'gate': drawGate(canvas, it, y, time, text); break;
    case 'portal': drawPortal(canvas, it, x, y, time, text); break;
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
  if (sim.jet > 0 && sim.jetSpeed < 800) { drawPix(canvas, JET[Math.floor(time * 20) % 2], x + 18, y0 + 8, 1.5); bar(Math.min(1, sim.jet / 2.1), '#ff7a95', x); x += 48; }
  if (sim.inverted) { drawPixelText(canvas, 'INVERTIDO', x + 62, y0 + 12, 2, {top: '#ffffff', low: '#ffd36b', shadow: '#5a3a00'}); x += 128; }
  if (sim.slow > 0) { drawPixelText(canvas, 'ZZ', x + 12, y0 + 8, 2, {top: '#ffffff', low: '#7fd8ff', shadow: '#0a2a4a'}); bar(Math.min(1, sim.slow / PORTAL.TIME_SECONDS), '#7fd8ff', x); x += 48; }
  if (sim.magnet > 0) { drawPix(canvas, MAGNET, x + 12, y0 + 8, 1.2); bar(Math.min(1, sim.magnet / POWER.MAGNET_TIME), '#ff5a7a', x); x += 48; }
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
  if (S.session.sim.world === 'inverse') { canvas.save(); canvas.translate(0, z.cy * 2); canvas.scale(1, -1); } // o tiro vai "para a frente": para baixo
  drawPix(canvas, ARROW_UP, z.cx, z.cy + (held ? 2 : 0), Math.max(3, Math.round(z.r / 9)), {alpha: ready || held ? 1 : 0.45});
  if (S.session.sim.world === 'inverse') canvas.restore();
  void time;
}

const otherHero = (h: Hero): Hero => (h === 'josperd' ? 'camila' : 'josperd');

/** Tudo que fica entre o fundo e o herói. `text` = false no espelho do Papel (letras não espelham). */
function drawEntities(canvas: SkCanvas, S: SceneInput, sy: (y: number) => number, viewH: number, time: number, text: boolean) {
  const sim = S.session.sim;
  const fx = S.session.fx;
  drawBonusZone(canvas, sim, sy, viewH, time);
  drawLava(canvas, sim, sy, viewH, time);
  drawMarkers(canvas, S, sy, viewH, time, text);
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
    drawItem(canvas, it, it.x, y, time, text);
  }
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    const y = sy(e.y);
    if (y < -60 || y > viewH + 60) continue;
    drawEnemy(canvas, e, time, sy, text);
  }
  drawBullets(canvas, S, time, sy);
  for (const p of fx.list) {
    const f = Math.max(0, Math.min(1, p.life / p.max));
    if (p.size > 4) pixelStar(canvas, p.color, p.x, sy(p.y), 1.4, f);
    else rect(canvas, p.color, p.x, sy(p.y), p.size, p.size, f);
  }
}

/** Marcos de altitude a cada 100 m (tracejado fraco) e a linha dourada do recorde pessoal. */
function drawMarkers(canvas: SkCanvas, S: SceneInput, sy: (y: number) => number, viewH: number, time: number, text: boolean) {
    const top = sy(0) - viewH; // y de mundo na base da tela
  const lo = Math.max(1, Math.ceil(((top) - PHYS.START_Y) / 1000));
  const hi = Math.floor((top + viewH - PHYS.START_Y) / 1000);
  const best = S.session.bestMeters;
  const line = (m: number, color: string, label: string, a: number) => {
    const y = sy(PHYS.START_Y + m * 10);
    if (y < -20 || y > viewH + 20) return;
    for (let x = 0; x < FIELD_W; x += 20) rect(canvas, color, x + ((time * 12) % 20), y, 10, 2, a);
    if (text) drawPixelText(canvas, label, 34, y - 12, 2, {top: '#ffffff', low: color, shadow: '#1a0d2e', alpha: Math.min(1, a * 3)});
  };
  for (let k = lo; k <= hi; k++) {
    if (best > 0 && Math.abs(k * 100 - best) < 30) continue;
    line(k * 100, '#d9c8ff', k * 100 + ' M', 0.22);
  }
  if (best > 0) line(best, '#ffd369', 'RECORDE', 0.7);
}

/** Fase bônus: faixa dourada com bordas de xadrez, chuva de brilho e linha de chegada no topo. */
function drawBonusZone(canvas: SkCanvas, sim: Sim, sy: (y: number) => number, viewH: number, time: number) {
  if (sim.bonusY1 <= 0) return;
  const top = sy(sim.bonusY1);
  const bottom = sy(sim.bonusY0);
  if (bottom < 0 || top > viewH) return;
  const y0 = Math.max(0, top), y1 = Math.min(viewH, bottom);
  rect(canvas, '#ffd369', 0, y0, FIELD_W, y1 - y0, 0.07);
  fillPattern(canvas, checker(), '#ffe9a0', 0.35, 0, y0, 10, y1 - y0, 0, (time * 30) % 16);
  fillPattern(canvas, checker(), '#ffe9a0', 0.35, FIELD_W - 10, y0, 10, y1 - y0, 0, (time * 30) % 16);
  for (let i = 0; i < 16; i++) {
    const x = (i * 71 + 19) % FIELD_W;
    const y = y0 + ((((i * 97) + time * 70) % (y1 - y0 + 1)));
    rect(canvas, i % 3 === 0 ? '#ffffff' : '#ffd369', x, y, 3, 3, 0.5);
  }
  if (top > -20 && top < viewH + 20) {
    fillPattern(canvas, checker(), '#ffffff', 0.9, 0, top - 8, FIELD_W, 16);
    drawPixelText(canvas, 'CHEGADA', FIELD_W / 2, top - 22, 2, {top: '#ffffff', low: '#ffd369', shadow: '#7a5200'});
  }
}

/** Atalho turbo: riscos de velocidade verticais e um brilho rosa nas bordas. */
function drawSpeedLines(canvas: SkCanvas, viewH: number, time: number) {
  for (let i = 0; i < 18; i++) {
    const x = (i * 53 + 17) % FIELD_W;
    const len = 60 + (i % 5) * 26;
    const y = ((time * (900 + (i % 4) * 260) + i * 131) % (viewH + len * 2)) - len;
    rect(canvas, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ff7ae9' : '#9bfbff', x, viewH - y - len, 2 + (i % 2), len, 0.3);
  }
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

  // Queda livre: o mundo inteiro (fundo, plataformas, herói, tiros) é desenhado de cabeça para baixo.
  const flipWorld = sim.world === 'inverse';
  if (flipWorld) { canvas.translate(0, viewH); canvas.scale(1, -1); flipped = true; }
  drawWorldBackground(canvas, sim.world, cam, viewH, meters, time);
  if (fx.worldFade > 0 && fx.worldFrom && fx.worldFrom !== sim.world) {
    // Mundo anterior some por cima do novo (transição do portal).
    const lp = P();
    lp.setAlphaf(Math.min(1, fx.worldFade * 1.2));
    canvas.saveLayer(lp);
    drawWorldBackground(canvas, fx.worldFrom, cam, viewH, meters, time);
    canvas.restore();
  }

  const paper = sim.world === 'paper';
  const half = FIELD_W / 2;
  if (paper) {
    canvas.save(); canvas.clipRect(Skia.XYWHRect(0, 0, half, viewH), ClipOp.Intersect, false);
    drawEntities(canvas, S, sy, viewH, time, true);
    canvas.restore();
    canvas.save(); canvas.translate(FIELD_W, 0); canvas.scale(-1, 1); canvas.clipRect(Skia.XYWHRect(0, 0, half, viewH), ClipOp.Intersect, false);
    drawEntities(canvas, S, sy, viewH, time, false);
    canvas.restore();
  } else drawEntities(canvas, S, sy, viewH, time, true);

  // Herói (interpolado entre o passo anterior e o atual; sem interpolar ao atravessar a lateral).
  const pl = sim.player;
  const jump = Math.abs(pl.x - pl.px) > 200;
  const px = jump ? pl.x : lerp(pl.px, pl.x, a);
  const py = lerp(pl.py, pl.y, a);
  const fi = frameIndex(pl, sim.mode === 'over');
  const foot = sy(py) + 6;
  const main: Hero = sim.swapped !== sim.inverted ? otherHero(S.hero) : S.hero;
  drawShadow(canvas, S, px, py, time, sy);
  // Aura na cor do personagem (cresce com o combo) e rastro quando a velocidade é alta.
  drawGlow(canvas, HERO_COLOR[main], 66, px, foot - 52, 0.24 + Math.min(4, sim.combo) * 0.035);
  if (sim.boost > 0) drawGlow(canvas, '#ffe36c', 44, px, foot - 4, 0.3 + 0.1 * Math.sin(time * 14));
  if (sim.magnet > 0) {
    const q = P();
    q.setShader(null); q.setColor(col('#ff5a7a')); q.setStyle(1); q.setStrokeWidth(2);
    const ph = (time * 1.4) % 1;
    q.setAlphaf(0.22 * (1 - ph)); canvas.drawCircle(px, foot - 52, POWER.MAGNET_R * (1 - ph * 0.5), q);
    q.setStyle(0);
  }
  if (Math.abs(pl.vy) > 520 && sim.mode === 'playing') {
    for (let k = 2; k >= 1; k--) drawHero(canvas, S, main, pl.facing, px - pl.vx * 0.012 * k, foot + pl.vy * 0.03 * k, fi, 0.2 / k);
  }
  // Invencível: pisca (exceto com a hélice).
  const blink = sim.invuln > 0 && sim.jet <= 0 && Math.floor(time * 14) % 2 === 0;
  const heroAlpha = blink ? 0.35 : 1;
  if (sim.jet > 0) {
    // Chama sob os pés.
    for (let i = 0; i < 4; i++) rect(canvas, i % 2 ? '#ffd36b' : '#ff6a3d', px - 6 + (i % 2) * 2 + ((Math.floor(time * 30) + i) % 3), foot + i * 5, 4 + (i % 2) * 2, 6, 0.9 - i * 0.18);
  }
  drawHero(canvas, S, main, pl.facing, px, foot, fi, heroAlpha);
  if (paper) {
    // O outro personagem, espelhado na dobra: faz o mesmo movimento (e é quem entra no seu lugar na volta).
    const twin = otherHero(main);
    drawGlow(canvas, HERO_COLOR[twin], 66, FIELD_W - px, foot - 52, 0.22);
    drawHero(canvas, S, twin, pl.facing === 1 ? -1 : 1, FIELD_W - px, foot, fi, heroAlpha);
  } else {
    const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
    if (px < 50) drawHero(canvas, S, main, pl.facing, px + span, foot, fi, heroAlpha);
    else if (px > FIELD_W - 50) drawHero(canvas, S, main, pl.facing, px - span, foot, fi, heroAlpha);
  }
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

  if (sim.jet > 0 && sim.jetSpeed >= 800) drawSpeedLines(canvas, viewH, time);
  drawRingsAndPops(canvas, S, sy);
  flipped = false;
  canvas.restore(); // fim do tremor

  if (sim.slow > 0) {
    // Cronos: tom azul-gelo e riscos de relógio nas bordas.
    const k = Math.min(1, sim.slow / 0.6);
    rect(canvas, '#7fd8ff', 0, 0, FIELD_W, viewH, 0.1 * k);
    rect(canvas, '#bfeaff', 0, 0, 6, viewH, 0.25 * k);
    rect(canvas, '#bfeaff', FIELD_W - 6, 0, 6, viewH, 0.25 * k);
  }
  if (sim.world === 'volcano' && sim.lava > 0 && sim.mode === 'playing') {
    // Aviso: a lava está perto do herói.
    const close = clamp(1 - (sim.player.y - sim.lava) / 260, 0, 1);
    if (close > 0) {
      const g = grad('lavawarn', viewH, '#ff2a1a00', '#ff2a1a');
      const pp = P(); pp.setShader(g); pp.setAlphaf(close * (0.35 + 0.15 * Math.sin(time * 14)));
      canvas.drawRect(Skia.XYWHRect(0, viewH * 0.55, FIELD_W, viewH * 0.45), pp);
      pp.setShader(null);
    }
  }
  if (fx.flash > 0) rect(canvas, fx.flashColor, 0, 0, FIELD_W, viewH, Math.min(0.3, fx.flash * 0.5));
  if (sim.mode === 'playing') drawStatus(canvas, S, scale, time);
  canvas.restore();
  if (sim.mode === 'playing') drawFireButton(canvas, S, time);
  return nowMs() - t0;
}
