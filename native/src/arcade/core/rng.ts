/** PRNG semeado (mulberry32). Nenhum código do arcade usa Math.random: toda partida é reproduzível. */
export type Rng = {
  /** Estado interno (inteiro de 32 bits): salve e restaure para retomar a sequência. */
  state: number;
};

export function makeRng(seed: number): Rng {
  return {state: seed >>> 0 || 0x9e3779b9};
}

/** Próximo número em [0, 1). */
export function next(r: Rng): number {
  r.state = (r.state + 0x6d2b79f5) >>> 0;
  let t = r.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(r: Rng, a: number, b: number): number {
  return a + next(r) * (b - a);
}

export function int(r: Rng, a: number, b: number): number {
  return a + Math.floor(next(r) * (b - a + 1));
}

export function chance(r: Rng, p: number): boolean {
  return next(r) < p;
}

export function pick<T>(r: Rng, list: readonly T[]): T {
  return list[Math.floor(next(r) * list.length)];
}

/** Escolha ponderada: pesos <= 0 nunca saem. */
export function weighted<T>(r: Rng, list: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of list) if (w > 0) total += w;
  let x = next(r) * total;
  for (const [v, w] of list) {
    if (w <= 0) continue;
    x -= w;
    if (x < 0) return v;
  }
  return list[list.length - 1][0];
}
