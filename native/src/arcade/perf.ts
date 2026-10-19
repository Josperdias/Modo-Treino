/** Medidor de desempenho do arcade (anel de 360 quadros ≈ 6 s a 60 fps). Puro e sem alocação por quadro. */
const N = 360;

export type Perf = {
  frame: Float32Array;
  step: Float32Array;
  draw: Float32Array;
  n: number;
  head: number;
  total: number;
};

export type PerfSummary = {
  samples: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  worst: number;
  /** Quadros mais lentos que 25 ms (perceptíveis como tranco). */
  slow: number;
  stepMs: number;
  drawMs: number;
};

export function makePerf(): Perf {
  return {frame: new Float32Array(N), step: new Float32Array(N), draw: new Float32Array(N), n: 0, head: 0, total: 0};
}

export function recordFrame(p: Perf, frameMs: number, stepMs: number) {
  p.frame[p.head] = frameMs;
  p.step[p.head] = stepMs;
  p.draw[p.head] = 0;
  p.head = (p.head + 1) % N;
  p.n = Math.min(N, p.n + 1);
  p.total++;
}

/** Tempo de desenho do quadro que acabou de ser registrado. */
export function recordDraw(p: Perf, drawMs: number) {
  p.draw[(p.head + N - 1) % N] = drawMs;
}

export function summarize(p: Perf): PerfSummary {
  const n = p.n;
  if (!n) return {samples: 0, fps: 0, p50: 0, p95: 0, p99: 0, worst: 0, slow: 0, stepMs: 0, drawMs: 0};
  const f = Array.from(p.frame.subarray(0, n)).sort((a, b) => a - b);
  let sum = 0, st = 0, dr = 0, slow = 0;
  for (let i = 0; i < n; i++) {
    sum += p.frame[i]; st += p.step[i]; dr += p.draw[i];
    if (p.frame[i] > 25) slow++;
  }
  const q = (x: number) => f[Math.min(n - 1, Math.floor(x * n))];
  return {
    samples: n,
    fps: sum > 0 ? Math.round((n / sum) * 1000 * 10) / 10 : 0,
    p50: round(q(0.5)), p95: round(q(0.95)), p99: round(q(0.99)), worst: round(f[n - 1]),
    slow, stepMs: round(st / n), drawMs: round(dr / n),
  };
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Qualidade adaptativa do desenho: 0 completo · 1 leve (sem brilhos, menos partículas, fundo simples) ·
 * 2 mínimo (além disso desenha a 30 quadros/s e numa resolução menor). Sobe depressa quando o quadro pesa
 * e só desce depois de um bom tempo folgado (cada recaída dobra a espera: sem ficar oscilando).
 */
export type QLevel = 0 | 1 | 2;
export const Q_UP_DRAW_MS = 8;
export const Q_UP_FRAME_MS = 26;
export const Q_DOWN_DRAW_MS = 3;

export class Quality {
  level: QLevel;
  /** Piso escolhido pelo usuário (modo leve = 2). */
  floor: QLevel;
  private drawEma = 0;
  private frameEma = 17;
  private lastChange = 0;
  private downWait = 8000;
  private seen = 0;
  constructor(floor: QLevel = 0) { this.floor = floor; this.level = floor; }

  setFloor(f: QLevel) { this.floor = f; if (this.level < f) this.level = f; }

  /** Registra um quadro desenhado. Devolve true quando o nível mudou. */
  feed(drawMs: number, frameMs: number, ts: number): boolean {
    this.seen++;
    const a = this.seen < 8 ? 0.4 : 0.08;
    this.drawEma += (drawMs - this.drawEma) * a;
    this.frameEma += (frameMs - this.frameEma) * a;
    if (this.seen < 20) return false; // aquecimento (compilação de shaders/caches não conta)
    const heavy = this.drawEma > Q_UP_DRAW_MS || (this.level < 2 && this.frameEma > Q_UP_FRAME_MS);
    if (heavy && this.level < 2 && ts - this.lastChange > 700) {
      if (this.level >= this.floor && ts - this.lastChange < 30000 && this.lastChange > 0) this.downWait = Math.min(120000, this.downWait * 2);
      this.level = (this.level + 1) as QLevel;
      this.lastChange = ts;
      this.drawEma = Q_UP_DRAW_MS * 0.6; // reavalia do zero no nível novo
      this.frameEma = 17;
      return true;
    }
    if (this.level > this.floor && this.drawEma < Q_DOWN_DRAW_MS && ts - this.lastChange > this.downWait) {
      this.level = (this.level - 1) as QLevel;
      this.lastChange = ts;
      return true;
    }
    return false;
  }

  /** Nível 2 desenha a no máximo ~30 quadros/s. */
  skipDraw(ts: number, lastDraw: number): boolean { return this.level >= 2 && ts - lastDraw < 28; }
  /** Resolução relativa do canvas. */
  get scale(): number { return this.level >= 2 ? 0.75 : 1; }
}
