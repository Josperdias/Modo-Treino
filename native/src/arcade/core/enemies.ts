import type {Enemy} from './types.ts';

/** Onda triangular suave em [-1, 1] (movimento "zigue-zague" do inimigo). */
export const tri = (u: number) => (2 / Math.PI) * Math.asin(Math.sin(u));

/** Posição do inimigo no instante `t` (s): função pura do tempo, sem estado escondido. */
export function enemyAt(e: Pick<Enemy, 'kind' | 'x0' | 'y0' | 'phase' | 'speed' | 'range'>, t: number): {x: number; y: number} {
  const u = t * e.speed + e.phase;
  switch (e.kind) {
    case 'drone': return {x: e.x0 + Math.sin(u) * e.range, y: e.y0 + Math.sin(t * 1.9 + e.phase) * 6};
    case 'zigzag': return {x: e.x0 + tri(u) * e.range, y: e.y0 + Math.sin(t * 3.1 + e.phase) * 8};
    case 'orb': return {x: e.x0 + Math.cos(u) * e.range, y: e.y0 + Math.sin(u) * e.range * 0.8};
    case 'guardian': return {x: e.x0 + Math.sin(u) * e.range, y: e.y0 + Math.sin(t * 1.2 + e.phase) * 5};
    default: return {x: e.x0, y: e.y0}; // torre: parada
  }
}
