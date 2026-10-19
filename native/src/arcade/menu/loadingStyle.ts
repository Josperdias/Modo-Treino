/** Dois jeitos de carregar: o de pixels (padrão) e o clássico ilustrado, que aparece em ~15 % das vezes. */
export type LoadingStyle = 'pixel' | 'classic';
export const CLASSIC_CHANCE = 0.15;

/** `r` ∈ [0, 1) vem de Math.random() na tela (fora do motor, que nunca sorteia). */
export const pickLoadingStyle = (r: number): LoadingStyle => (r < CLASSIC_CHANCE ? 'classic' : 'pixel');
