/**
 * Desbloqueio do NEON STEP DX: 7 toques seguidos no número da versão (Ajustes), como o modo
 * desenvolvedor do Android. Cada toque precisa vir até UNLOCK_GAP_MS depois do anterior.
 */
export const UNLOCK_TAPS = 7;
export const UNLOCK_GAP_MS = 1500;
/** A dica ("faltam N toques") só aparece perto do fim, para continuar sendo um segredo. */
export const HINT_FROM = 4;

export type TapState = {count: number; last: number};

export const NO_TAPS: TapState = {count: 0, last: -Infinity};

export type TapResult = {state: TapState; unlocked: boolean; remaining: number; hint: boolean};

export function registerTap(prev: TapState, now: number): TapResult {
  const count = now - prev.last <= UNLOCK_GAP_MS ? prev.count + 1 : 1;
  if (count >= UNLOCK_TAPS) return {state: NO_TAPS, unlocked: true, remaining: 0, hint: false};
  return {state: {count, last: now}, unlocked: false, remaining: UNLOCK_TAPS - count, hint: count >= HINT_FROM};
}
