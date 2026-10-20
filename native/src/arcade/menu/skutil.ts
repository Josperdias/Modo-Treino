import {BlendMode, FilterMode, MipmapMode, Skia, TileMode, type SkCanvas, type SkColor, type SkColorFilter, type SkImage, type SkPaint, type SkShader} from '@shopify/react-native-skia';

/** Ferramentas de desenho compartilhadas pelo menu e pelo carregando (pincel único, cores, gradientes e brilho em cache). */
const colors = new Map<string, SkColor>();
export const col = (hex: string): SkColor => {
  let c = colors.get(hex);
  if (!c) { c = Skia.Color(hex); colors.set(hex, c); }
  return c;
};

let paint: SkPaint | null = null;
export const P = (): SkPaint => {
  if (!paint) { paint = Skia.Paint(); paint.setAntiAlias(true); }
  paint.setShader(null);
  paint.setColorFilter(null);
  paint.setBlendMode(BlendMode.SrcOver);
  paint.setAlphaf(1);
  return paint;
};

const filters = new Map<string, SkColorFilter>();
/** Brilho e saturação como filtro de cor (os `filter: brightness() saturate()` do CSS). */
export function look(bright: number, sat: number): SkColorFilter | null {
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

export function img(canvas: SkCanvas, im: SkImage | null, x: number, y: number, w: number, h: number, alpha = 1, f: SkColorFilter | null = null) {
  if (!im || alpha <= 0.003) return;
  const p = P();
  p.setAlphaf(alpha);
  if (f) p.setColorFilter(f);
  canvas.drawImageRectOptions(im, Skia.XYWHRect(0, 0, im.width(), im.height()), Skia.XYWHRect(x, y, w, h), FilterMode.Linear, MipmapMode.None, p);
}


const gradients = new Map<string, SkShader>();
export function vGrad(key: string, h: number, stops: [string, number][]): SkShader {
  const k = key + Math.round(h);
  let g = gradients.get(k);
  if (!g) {
    g = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: 0, y: h}, stops.map(([c]) => col(c)), stops.map(([, p]) => p), TileMode.Clamp);
    gradients.set(k, g);
  }
  return g;
}
export function hGrad(key: string, w: number, stops: [string, number][]): SkShader {
  const k = 'h' + key + Math.round(w);
  let g = gradients.get(k);
  if (!g) {
    g = Skia.Shader.MakeLinearGradient({x: 0, y: 0}, {x: w, y: 0}, stops.map(([c]) => col(c)), stops.map(([, p]) => p), TileMode.Clamp);
    gradients.set(k, g);
  }
  return g;
}
const radials = new Map<string, SkShader>();
export function radial(hex: string, r: number): SkShader {
  const k = hex + Math.round(r);
  let g = radials.get(k);
  if (!g) { g = Skia.Shader.MakeRadialGradient({x: 0, y: 0}, r, [col(hex), col(hex + '00')], null, TileMode.Clamp); radials.set(k, g); }
  return g;
}
export function glow(canvas: SkCanvas, hex: string, r: number, x: number, y: number, alpha: number, sx = 1, sy = 1) {
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

