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
