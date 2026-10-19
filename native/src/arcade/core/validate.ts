import {GEN, PHYS} from '../data/neon.ts';
import {apex, jumpSpeed, landHalfWidth, reach, wrapDist} from './physics.ts';
import type {Platform} from './types.ts';

/**
 * Validador de alcance: prova (conservadoramente) que cada plataforma pode ser alcançada de
 * alguma plataforma anterior, no pior caso (plataformas móveis nos extremos, saída parada,
 * nível de velocidade mínimo) e com folga de `SAFETY` sobre os limites físicos.
 */

/** Fração do alcance físico que o gerador pode usar (o resto é folga para erro humano). */
export const SAFETY = {
  /** Subida máxima permitida em relação ao ápice do salto. */
  RISE: 0.86,
  /** Deslocamento horizontal máximo em relação ao alcance físico. */
  REACH: 0.9,
};

export type Problem = {id: number; reason: string; dx?: number; dy?: number};

/** Intervalo X que a plataforma pode ocupar (móveis oscilam). */
function span(p: Platform): [number, number] {
  return [p.x - p.shift, p.x + p.shift];
}

/** Pior distância horizontal (centro→centro) entre `a` e `b` nas piores fases, contando a volta pela lateral. */
export function worstDx(a: Platform, b: Platform): number {
  const [a0, a1] = span(a);
  const [b0, b1] = span(b);
  return Math.max(wrapDist(a0, b1), wrapDist(a1, b0), wrapDist(a0, b0), wrapDist(a1, b1));
}

/** `a` → `b` é um salto seguro? */
export function canReach(a: Platform, b: Platform, level = 1): boolean {
  const dy = b.y - a.y;
  if (dy <= 0) return true; // descer sempre é possível: cai-se na plataforma abaixo
  const v = jumpSpeed(a.type, false);
  if (dy > apex(v) * SAFETY.RISE) return false;
  const r = reach(dy, v, level);
  if (r < 0) return false;
  const need = worstDx(a, b) - landHalfWidth(b) + b.shift * 0; // pouso aceita qualquer ponto da plataforma
  return need <= r * SAFETY.REACH;
}

/**
 * Confere uma lista de plataformas ordenada por criação: cada uma (exceto a primeira) precisa
 * de um predecessor seguro entre as anteriores a até 2 apexes abaixo; também verifica sobreposição.
 */
export function validate(platforms: readonly Platform[], level = 1): Problem[] {
  const problems: Problem[] = [];
  const sorted = [...platforms].sort((p, q) => p.y - q.y || p.x - q.x);
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i];
    let ok = false;
    for (let j = i - 1; j >= 0 && b.y - sorted[j].y < apex(PHYS.SPRING); j--) {
      const a = sorted[j];
      if (a.y === b.y) continue;
      if (canReach(a, b, level)) { ok = true; break; }
    }
    if (!ok) problems.push({id: b.id, reason: 'inalcançável', dy: b.y - sorted[i - 1].y});
    for (let j = i - 1; j >= 0 && b.y - sorted[j].y < GEN.CLEARANCE_Y; j--) {
      const a = sorted[j];
      const [a0, a1] = span(a);
      const [b0, b1] = span(b);
      const overlap = Math.min(a1 + a.w / 2, b1 + b.w / 2) - Math.max(a0 - a.w / 2, b0 - b.w / 2);
      if (overlap > -10) problems.push({id: b.id, reason: 'sobreposta', dx: overlap, dy: b.y - a.y});
    }
  }
  return problems;
}
