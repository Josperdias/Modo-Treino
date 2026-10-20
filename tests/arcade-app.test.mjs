// NEON STEP DX — testes da camada de app sem React/Skia: desbloqueio, save, sessão, medidor, efeitos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = p => import(join(ROOT, 'native/src/arcade', p));
const {registerTap, NO_TAPS, UNLOCK_TAPS, UNLOCK_GAP_MS, HINT_FROM} = await A('unlock.ts');
const {normalizeSave, recordRun, DEFAULT_SAVE} = await A('save.ts');
const {Session} = await A('session.ts');
const {makePerf, recordFrame, recordDraw, summarize} = await A('perf.ts');
const {makeFx, onEvents, updateFx, MAX_PARTICLES} = await A('fx.ts');
const {PHYS} = await A('data/neon.ts');

/* ---------- desbloqueio ---------- */
test('desbloqueio: 7 toques seguidos liberam; o 6º ainda não', () => {
  let st = NO_TAPS, r;
  for (let i = 0; i < UNLOCK_TAPS - 1; i++) { r = registerTap(st, 1000 + i * 300); st = r.state; assert.equal(r.unlocked, false); }
  assert.equal(r.remaining, 1);
  r = registerTap(st, 1000 + 6 * 300);
  assert.equal(r.unlocked, true);
  assert.deepEqual(r.state, NO_TAPS);
});

test('desbloqueio: pausa maior que a janela recomeça a contagem', () => {
  let st = NO_TAPS, t = 0, r;
  for (let i = 0; i < 5; i++) { r = registerTap(st, t); st = r.state; t += 400; }
  r = registerTap(st, t + UNLOCK_GAP_MS + 1);
  assert.equal(r.state.count, 1);
  assert.equal(r.unlocked, false);
  // exatamente no limite ainda conta
  const a = registerTap(NO_TAPS, 0).state;
  assert.equal(registerTap(a, UNLOCK_GAP_MS).state.count, 2);
});

test('desbloqueio: segredo — nenhuma dica antes do 4º toque', () => {
  let st = NO_TAPS;
  for (let i = 1; i <= 6; i++) {
    const r = registerTap(st, i * 200); st = r.state;
    assert.equal(r.hint, i >= HINT_FROM, `toque ${i}`);
  }
});

/* ---------- save ---------- */
test('save: normalização aceita lixo sem lançar e devolve valores válidos', () => {
  for (const bad of [null, undefined, 42, 'x', [], {best: 'a', settings: 7}, {best: {josperd: -5, camila: 'NaN'}}]) {
    const s = normalizeSave(bad);
    assert.equal(s.v, 1);
    assert.equal(s.unlocked, false);
    assert.ok(s.best.josperd >= 0 && s.best.camila >= 0);
    assert.ok(['josperd', 'camila'].includes(s.settings.hero));
  }
  assert.deepEqual(normalizeSave(undefined), DEFAULT_SAVE);
});

test('save: padrões seguros — vibração e medidor desligados, controle por toque', () => {
  const s = normalizeSave({});
  assert.equal(s.settings.haptics, false);
  assert.equal(s.settings.perf, false);
  assert.equal(s.settings.control, 'touch');
});

test('save: preserva dados válidos e ignora campos desconhecidos', () => {
  const s = normalizeSave({unlocked: true, best: {josperd: 1234.9, camila: 5}, bestMeters: {josperd: 99}, plays: 3, lixo: 1, settings: {hero: 'camila', control: 'tilt', tiltInvert: true, haptics: true, perf: true}});
  assert.equal(s.unlocked, true);
  assert.equal(s.best.josperd, 1234);
  assert.equal(s.settings.hero, 'camila');
  assert.equal(s.settings.control, 'tilt');
  assert.ok(!('lixo' in s));
});

test('save: recordRun só sobe recordes, conta partidas e sinaliza novo recorde', () => {
  let save = DEFAULT_SAVE;
  let r = recordRun(save, {hero: 'josperd', score: 500, meters: 40});
  assert.equal(r.record, true);
  save = r.save;
  r = recordRun(save, {hero: 'josperd', score: 300, meters: 90});
  assert.equal(r.record, false);
  assert.equal(r.save.best.josperd, 500);
  assert.equal(r.save.bestMeters.josperd, 90); // metros têm recorde próprio
  assert.equal(r.save.plays, 2);
  assert.equal(r.save.best.camila, 0); // por personagem
});

/* ---------- sessão ---------- */
test('sessão: o primeiro quadro só marca o tempo; depois avança em passos fixos', () => {
  const s = new Session(5, 690);
  assert.equal(s.frame(1000), false);
  assert.equal(s.frame(1000 + 1000 / 60), true);
  assert.ok(s.sim.tick >= 1 && s.sim.tick <= 2, `tick ${s.sim.tick}`); // 16,7 ms ≈ 2 passos de 8,3 ms
  assert.ok(s.alpha >= 0 && s.alpha < 1);
});

test('sessão: pausa não acumula tempo — retomar não gera quadro gigante', () => {
  const s = new Session(5, 690);
  s.frame(0); s.frame(16);
  const tick = s.sim.tick;
  s.pause();
  assert.equal(s.frame(60000), false);
  assert.equal(s.sim.tick, tick);
  s.resume();
  assert.equal(s.frame(60016), false); // reinicia a referência
  s.frame(60032);
  assert.ok(s.sim.tick - tick <= 4);
});

test('sessão: o eixo entra na simulação e é limitado a [-1, 1]', () => {
  const s = new Session(5, 690);
  s.setAxis(9);
  assert.equal(s.axis, 1);
  s.frame(0);
  for (let t = 16; t < 400; t += 16) s.frame(t);
  assert.ok(s.sim.player.vx > 100);
});

test('sessão: eventos vão para a fila e para os efeitos; recorde acompanha a pontuação', () => {
  const s = new Session(9, 690, 0);
  let t = 0;
  s.frame(t);
  const seen = new Set();
  while (!s.over && t < 4000) { t += 16; s.frame(t); for (const e of s.drain()) seen.add(e.t); }
  assert.ok(seen.has('land'), 'pousos geram evento');
  assert.ok(s.best >= s.sim.score);
  assert.deepEqual(s.drain(), []);
});

test('sessão: depois do fim de jogo nada mais avança', () => {
  const s = new Session(3, 690);
  s.sim.player.vy = -300; s.sim.platforms.length = 0; s.sim.gen.y = 1e9;
  let t = 0;
  while (!s.over && t < 20000) { t += 16; s.frame(t); }
  assert.equal(s.over, true);
  const tick = s.sim.tick;
  assert.equal(s.frame(t + 16), false);
  assert.equal(s.sim.tick, tick);
  assert.ok(s.drain().some(e => e.t === 'over'));
});

test('sessão: HUD reflete pontos, metros, vidas e poderes (sem nível na tela)', () => {
  const s = new Session(1, 690, 777);
  const h = s.hud();
  assert.equal(h.best, 777);
  assert.equal(h.lives, 2);
  assert.equal(h.shields, 0);
  assert.equal(h.revive, false);
  assert.equal(h.world, 'neon');
  assert.ok(!('level' in h) && !('levelName' in h), 'o jogo não avisa fases');
});

/* ---------- medidor ---------- */
test('medidor: percentis, FPS e quadros lentos', () => {
  const p = makePerf();
  for (let i = 0; i < 100; i++) { recordFrame(p, i < 95 ? 16.67 : 40, 0.2); recordDraw(p, 1.5); }
  const s = summarize(p);
  assert.equal(s.samples, 100);
  assert.equal(s.slow, 5);
  assert.ok(Math.abs(s.p50 - 16.67) < 0.01);
  assert.equal(s.p99, 40);
  assert.equal(s.worst, 40);
  assert.ok(s.fps > 50 && s.fps < 60);
  assert.equal(s.drawMs, 1.5);
  assert.equal(s.stepMs, 0.2);
});

test('medidor: o anel descarta amostras antigas e vazio não quebra', () => {
  assert.equal(summarize(makePerf()).fps, 0);
  const p = makePerf();
  for (let i = 0; i < 1000; i++) recordFrame(p, 10, 0);
  assert.equal(summarize(p).samples, 360);
});

/* ---------- efeitos ---------- */
test('efeitos: partículas nascem, morrem e nunca passam do limite', () => {
  const fx = makeFx();
  for (let i = 0; i < 50; i++) onEvents(fx, [{t: 'land', plat: 'spring', x: 100, y: 100}]);
  assert.ok(fx.list.length <= MAX_PARTICLES);
  assert.ok(fx.flash > 0);
  for (let i = 0; i < 200; i++) updateFx(fx, 0.016);
  assert.equal(fx.list.length, 0);
  assert.equal(fx.flash, 0);
  onEvents(fx, [{t: 'over'}]);
  assert.ok(fx.shake > 0);
});

test('o passo fixo é 1/120 s', () => {
  assert.equal(PHYS.STEP, 1 / 120);
});
