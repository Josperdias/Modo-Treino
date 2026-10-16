import {PHYS, FIELD_W} from '../data/neon.ts';
import type {Platform} from './types.ts';

/** Altura máxima de um salto com velocidade inicial v (modelo exato: v²/2g). 690 → 198,375. */
export function apex(v: number): number {
  return (v * v) / (2 * PHYS.G);
}

/** Tempo para voltar a `dy` acima do ponto de partida, na DESCIDA. NaN se `dy` passa do ápice. */
export function timeToDescend(dy: number, v: number): number {
  const disc = v * v - 2 * PHYS.G * dy;
  if (disc < 0) return NaN;
  return (v + Math.sqrt(disc)) / PHYS.G;
}

export function vxMax(level: number): number {
  return PHYS.VX_BASE + Math.min(PHYS.VX_LEVEL_CAP, level * PHYS.VX_PER_LEVEL);
}

/**
 * Deslocamento horizontal garantido (saindo parado, olhando o pior caso) durante `t` segundos
 * com resposta exponencial de constante k: v(t) = vmax(1-e^{-kt}).
 */
export function horizontalTravel(t: number, level: number): number {
  const k = PHYS.ACCEL_K;
  return vxMax(level) * (t - (1 - Math.exp(-k * t)) / k);
}

/** Alcance horizontal (do centro de saída até o centro do destino, sem a folga de pouso) a `dy` de altura. */
export function reach(dy: number, v: number, level: number): number {
  const t = timeToDescend(dy, v);
  return Number.isNaN(t) ? -1 : horizontalTravel(t, level);
}

export function jumpSpeed(type: Platform['type'], boosted: boolean): number {
  if (type === 'spring') return PHYS.SPRING;
  return boosted ? PHYS.BOOST : PHYS.JUMP;
}

/** Posição X da plataforma no instante `time` (as móveis oscilam; a função é pura e determinística). */
export function platformX(p: Platform, time: number): number {
  return p.type === 'moving' ? p.x + Math.sin(time * p.speed + p.phase) * p.shift : p.x;
}

/** Meia-largura de aterrissagem: metade da plataforma + folga. */
export function landHalfWidth(p: Platform): number {
  return p.w / 2 + PHYS.LAND_TOL;
}

/** Reaparece do outro lado ao sair pela lateral. */
export function wrapX(x: number): number {
  const m = PHYS.WRAP_MARGIN;
  if (x < -m) return FIELD_W + m;
  if (x > FIELD_W + m) return -m;
  return x;
}
