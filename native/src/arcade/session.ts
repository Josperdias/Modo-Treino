import {advance, makeLoop, type Loop} from './core/loop.ts';
import {createSim, metersOf, setViewH} from './core/sim.ts';
import type {Sim, SimEvent} from './core/types.ts';
import {makeFx, onEvents, updateFx, type Fx} from './fx.ts';
import {makePerf, recordFrame, summarize, type Perf} from './perf.ts';

export type Hud = {
  score: number;
  best: number;
  tapes: number;
  meters: number;
  combo: number;
  lives: number;
  shields: number;
  /** Segundos restantes de sapatos de mola / hélice. */
  boost: number;
  jet: number;
  kills: number;
  /** Há uma recuperação guardada (bandeira ou portal). */
  revive: boolean;
  world: string;
};

/**
 * Uma partida em andamento: simulação + laço de passo fixo + efeitos + medidor.
 * Sem React e sem Skia: quem desenha só chama `frame()` a cada quadro e lê `sim`/`fx`/`alpha`.
 */
export class Session {
  sim: Sim;
  loop: Loop = makeLoop();
  fx: Fx = makeFx();
  perf: Perf = makePerf();
  axis = 0;
  /** Botão de tiro segurado. */
  fire = false;
  alpha = 0;
  paused = false;
  best: number;
  /** Eventos novos desde a última leitura (HUD, vibração, avisos). */
  private pending: SimEvent[] = [];
  private lastNow = -1;
  private worldBefore: Sim['world'] = 'neon';
  private now: () => number;

  constructor(seed: number, viewH: number, best = 0, now: () => number = () => Date.now()) {
    this.sim = createSim(seed, viewH);
    this.best = best;
    this.now = now;
  }

  get over(): boolean {
    return this.sim.mode === 'over';
  }

  /** Altura visível medida na tela (só vale antes do primeiro passo). */
  setViewH(h: number) {
    setViewH(this.sim, h);
  }

  setAxis(a: number) {
    this.axis = Math.max(-1, Math.min(1, a));
  }

  setFire(f: boolean) {
    this.fire = f;
  }

  pause() {
    this.paused = true;
    this.axis = 0;
    this.fire = false;
    this.lastNow = -1;
  }

  resume() {
    this.paused = false;
    this.lastNow = -1; // o tempo parado não pode virar um quadro gigante
  }

  /** `ts` = carimbo de tempo do quadro em ms (requestAnimationFrame). Devolve true se algo mudou. */
  frame(ts: number): boolean {
    if (this.paused || this.over) { this.lastNow = ts; return false; }
    if (this.lastNow < 0) { this.lastNow = ts; return false; }
    const frameMs = ts - this.lastNow;
    this.lastNow = ts;
    const t0 = this.now();
    const before = this.sim.events.length;
    this.worldBefore = this.sim.world;
    this.alpha = advance(this.sim, this.loop, {axis: this.axis, fire: this.fire}, frameMs / 1000);
    const stepMs = this.now() - t0;
    recordFrame(this.perf, frameMs, stepMs);
    if (this.sim.events.length > before) {
      const fresh = this.sim.events.splice(before);
      onEvents(this.fx, fresh, this.worldBefore);
      for (const e of fresh) this.pending.push(e);
    }
    updateFx(this.fx, Math.min(frameMs, 50) / 1000);
    if (this.sim.score > this.best) this.best = this.sim.score;
    return true;
  }

  /** Entrega e limpa os eventos pendentes. */
  drain(): SimEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  hud(): Hud {
    const s = this.sim;
    return {
      score: s.score,
      best: this.best,
      tapes: s.tapes,
      meters: metersOf(s),
      combo: s.combo,
      lives: s.lives,
      shields: s.shields,
      boost: s.boost,
      jet: s.jet,
      kills: s.kills,
      revive: s.revive > 0,
      world: s.world,
    };
  }

  perfSummary() {
    return summarize(this.perf);
  }
}

