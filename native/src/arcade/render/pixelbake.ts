import {BlendMode, Skia, createPicture, type SkCanvas, type SkPaint, type SkPicture} from '@shopify/react-native-skia';
import {expand, sizeOf, type PixelSprite} from './pixelart.ts';

/**
 * Transforma um sprite de pixel em um Picture do Skia (uma vez) e o desenha em qualquer escala inteira.
 * Cada linha de pixels da mesma cor vira UM retângulo, então um sprite custa algumas dezenas de comandos.
 */

const colors = new Map<string, ReturnType<typeof Skia.Color>>();
const col = (hex: string) => {
  let c = colors.get(hex);
  if (!c) { c = Skia.Color(hex); colors.set(hex, c); }
  return c;
};

const cache = new WeakMap<PixelSprite, SkPicture>();

export function bake(s: PixelSprite): SkPicture {
  let pic = cache.get(s);
  if (pic) return pic;
  const grid = expand(s);
  const {w, h} = sizeOf(s);
  pic = createPicture((canvas) => {
    const p = Skia.Paint();
    p.setAntiAlias(false);
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '.' || !s.pal[ch]) { x++; continue; }
        let e = x + 1;
        while (e < row.length && row[e] === ch) e++;
        p.setColor(col(s.pal[ch]));
        canvas.drawRect(Skia.XYWHRect(x, y, e - x, 1), p);
        x = e;
      }
    }
  }, {x: 0, y: 0, width: w, height: h});
  cache.set(s, pic);
  return pic;
}

let layerPaint: SkPaint | null = null;

export type DrawOpts = {
  /** Espelha na horizontal. */
  flip?: boolean;
  alpha?: number;
  /** Onde fica o ponto (x, y): centro (padrão), pés ou canto superior esquerdo. */
  anchor?: 'center' | 'bottom' | 'top-left';
  /** Soma a luz em vez de cobrir (brilhos). */
  add?: boolean;
};

/** Desenha o sprite com escala `k` (use inteiro para ficar nítido). */
export function drawPix(canvas: SkCanvas, s: PixelSprite, x: number, y: number, k: number, o: DrawOpts = {}) {
  const pic = bake(s);
  const {w, h} = sizeOf(s);
  const a = o.anchor ?? 'center';
  const ox = a === 'top-left' ? 0 : (w * k) / 2;
  const oy = a === 'center' ? (h * k) / 2 : a === 'bottom' ? h * k : 0;
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.01) return;
  canvas.save();
  canvas.translate(Math.round(o.flip ? x + ox : x - ox), Math.round(y - oy));
  canvas.scale(o.flip ? -k : k, k);
  if (alpha < 0.99 || o.add) {
    if (!layerPaint) layerPaint = Skia.Paint();
    layerPaint.setAlphaf(alpha);
    layerPaint.setBlendMode(o.add ? BlendMode.Plus : BlendMode.SrcOver);
    canvas.saveLayer(layerPaint);
    canvas.drawPicture(pic);
    canvas.restore();
  } else canvas.drawPicture(pic);
  canvas.restore();
}
