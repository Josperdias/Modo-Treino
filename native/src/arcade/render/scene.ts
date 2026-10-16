import {FilterMode, MipmapMode, Skia, TileMode, type SkCanvas, type SkColor, type SkPaint, type SkShader} from '@shopify/react-native-skia';
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

function drawPlatform(canvas: SkCanvas, pl: Platform, x: number, y: number) {
  const w = pl.w;
  rect(canvas, '#10091f', x - w / 2 - 3, y - 3, w + 6, 21);
  rect(canvas, '#3d265e', x - w / 2, y, w, 14);
  rect(canvas, platformColors(pl.type), x - w / 2, y - 3, w, 7);
  rect(canvas, '#654080', x - w / 2 + 8, y + 9, w - 16, 2);
  rect(canvas, '#f0ceff', x - w / 2 + 10, y - 1, 9, 2);
  rect(canvas, '#f0ceff', x + w / 2 - 21, y - 1, 9, 2);
  if (pl.type === 'moving') {
    rect(canvas, '#66f5e7', x - 5, y + 5, 10, 4);
    rect(canvas, '#66f5e7', x - 12, y + 6, 5, 2);
    rect(canvas, '#66f5e7', x + 8, y + 6, 5, 2);
  } else if (pl.type === 'fragile') {
    for (let i = 0; i < 3; i++) {
      rect(canvas, '#ff8ac0', x - 23 + i * 20, y + 4, 2, 6);
      rect(canvas, '#ff8ac0', x - 21 + i * 20, y + 7, 4, 2);
    }
  } else if (pl.type === 'spring') {
    rect(canvas, '#873d83', x - 18, y - 11, 36, 9);
    rect(canvas, '#fbd76e', x - 17, y - 17, 34, 7);
    rect(canvas, '#fff3bf', x - 12, y - 15, 24, 3);
    rect(canvas, '#ffdd88', x - 13, y - 10, 3, 8);
    rect(canvas, '#ffdd88', x + 10, y - 10, 3, 8);
  }
}

function drawTape(canvas: SkCanvas, x: number, y: number) {
  rect(canvas, '#160e22', x - 14, y - 10, 28, 20);
  rect(canvas, '#ff5caa', x - 12, y - 10, 24, 17);
  rect(canvas, '#ffd57c', x - 9, y - 8, 18, 8);
  rect(canvas, '#5b225c', x - 7, y - 6, 4, 4);
  rect(canvas, '#5b225c', x + 4, y - 6, 4, 4);
  rect(canvas, '#7c316d', x - 7, y + 3, 14, 3);
  rect(canvas, '#842769', x - 14, y + 7, 28, 3);
  rect(canvas, '#ffefb7', x + 15, y - 12, 2, 3);
}

type Meta = {file: string; w: number; h: number; pivotX: number; pivotY: number};
const META = SPRITES.characters as Record<Hero, {frames: Meta[]}>;
const NATIVE = SPRITES.nativeFacing as Record<Hero, 1 | -1>;

function drawHero(canvas: SkCanvas, S: SceneInput, x: number, footY: number, fi: number) {
  const img = S.sprites[S.hero][fi];
  const m = META[S.hero].frames[fi];
  if (!img || !m) return;
  const flip = S.session.sim.player.facing * NATIVE[S.hero] === -1;
  canvas.save();
  canvas.translate(Math.round(x), Math.round(footY));
  if (flip) canvas.scale(-1, 1);
  // O pivô (centro de massa) fica sobre `x` e a base opaca sobre o chão, qualquer que seja o quadro.
  canvas.drawImageRectOptions(
    img,
    Skia.XYWHRect(0, 0, m.w, m.h),
    Skia.XYWHRect(-Math.round(m.pivotX), -m.pivotY, m.w, m.h),
    FilterMode.Nearest,
    MipmapMode.None,
    SP(),
  );
  canvas.restore();
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
    drawPlatform(canvas, pl, platformX(pl, time), y);
  }

  for (const it of sim.items) {
    if (it.hit) continue;
    const y = sy(it.y) + Math.sin(time * 4 + it.phase) * 3;
    if (y < -50 || y > viewH + 50) continue;
    drawTape(canvas, it.x, y);
  }

  for (const p of session.fx.list) {
    const f = Math.max(0, Math.min(1, p.life / p.max));
    rect(canvas, p.color, p.x, sy(p.y), p.size, p.size, f);
  }

  // Herói (interpolado entre o passo anterior e o atual; sem interpolar ao atravessar a lateral).
  const pl = sim.player;
  const jump = Math.abs(pl.x - pl.px) > 200;
  const px = jump ? pl.x : lerp(pl.px, pl.x, a);
  const py = lerp(pl.py, pl.y, a);
  const fi = frameIndex(pl, sim.mode === 'over');
  const foot = sy(py) + 6;
  drawHero(canvas, S, px, foot, fi);
  const span = FIELD_W + 2 * PHYS.WRAP_MARGIN;
  if (px < 50) drawHero(canvas, S, px + span, foot, fi);
  else if (px > FIELD_W - 50) drawHero(canvas, S, px - span, foot, fi);

  if (session.fx.flash > 0) rect(canvas, session.fx.flashColor, 0, 0, FIELD_W, viewH, Math.min(0.26, session.fx.flash * 0.5));
  canvas.restore();
  return nowMs() - t0;
}

