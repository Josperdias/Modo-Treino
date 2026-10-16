import {PHYS} from '../data/neon.ts';
import {step} from './sim.ts';
import type {Input, Sim} from './types.ts';

/** Acumulador de tempo: transforma quadros de duração variável em passos fixos da simulação. */
export type Loop = {acc: number};

export const MAX_FRAME = 0.25;
/** Passos máximos por quadro (evita espiral da morte depois de um tranco longo). */
export const MAX_STEPS = 24;

export function makeLoop(): Loop {
  return {acc: 0};
}

/**
 * Avança a simulação por `frameDt` segundos reais. Devolve `alpha` ∈ [0,1): quanto do próximo
 * passo já decorreu, para interpolar o desenho entre o estado anterior e o atual.
 */
export function advance(sim: Sim, loop: Loop, input: Input, frameDt: number): number {
  loop.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
  let steps = 0;
  while (loop.acc >= PHYS.STEP && steps < MAX_STEPS) {
    step(sim, input);
    loop.acc -= PHYS.STEP;
    steps++;
  }
  if (steps === MAX_STEPS) loop.acc = 0;
  return sim.mode === 'playing' ? loop.acc / PHYS.STEP : 0;
}
