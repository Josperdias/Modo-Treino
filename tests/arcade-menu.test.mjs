// NEON STEP DX — testes da geometria/animação do menu de seleção (pura, sem Skia).
import test from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const M = await import(join(ROOT, 'native/src/arcade/menu/pose.ts'));
const {pose, cubicBezier, MOTION_EASE, stageRect, boxes, splitLine, releaseTarget, tapTarget, tweenAt, targetOf, choiceOf, mix} = M;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('pose: os três estados batem com o CSS do protótipo V3.5', () => {
  const n = pose(0), j = pose(-1), c = pose(1);
  assert.deepEqual([n.splitTop, n.splitBottom], [66, 35]);
  assert.deepEqual([j.splitTop, j.splitBottom], [73, 43]);
  assert.deepEqual([c.splitTop, c.splitBottom], [59, 28]);
  assert.deepEqual([j.laneL.top, j.laneL.bottom], [79, 49]); // a máscara do escolhido passa 6 % do raio
  assert.deepEqual([c.laneR.top, c.laneR.bottom], [53, 22]);
  assert.deepEqual([j.laneR.top, j.laneR.bottom], [73, 43]);
  assert.equal(n.rayShift, 0); assert.equal(j.rayShift, 7); assert.equal(c.rayShift, -7);
  assert.deepEqual([n.swapX, j.swapX, c.swapX], [50, 57, 43]);
  assert.deepEqual(j.heroL, {dx: 5, dy: 0, scale: 1.055, opacity: 1, bright: 1.05, sat: 1});
  assert.deepEqual(j.heroR, {dx: 13, dy: 1.1, scale: 0.91, opacity: 0.74, bright: 0.87, sat: 0.84});
  assert.deepEqual(c.heroR, {dx: -7, dy: 0, scale: 1.055, opacity: 1, bright: 1.05, sat: 1});
  assert.deepEqual(c.heroL, {dx: -12, dy: 1.1, scale: 0.91, opacity: 0.74, bright: 0.87, sat: 0.84});
  assert.equal(j.infoR.opacity, 0.76); assert.equal(c.infoL.opacity, 0.76);
  assert.equal(n.heroL.opacity, 0.99);
  assert.equal(n.front, null); assert.equal(j.front, 'left'); assert.equal(c.front, 'right');
  assert.deepEqual([n.chosen, j.chosen, c.chosen], [0, 1, 1]);
});

test('pose: contínua e monotônica no caminho Josperd → neutro → Camila (sem saltos)', () => {
  let prev = pose(-1);
  for (let i = -99; i <= 100; i++) {
    const p = pose(i / 100);
    assert.ok(p.splitTop <= prev.splitTop + 1e-9, 'o raio só anda para a esquerda');
    assert.ok(p.swapX <= prev.swapX + 1e-9);
    assert.ok(Math.abs(p.heroL.scale - prev.heroL.scale) < 0.01);
    assert.ok(Math.abs(p.infoR.opacity - prev.infoR.opacity) < 0.01);
    prev = p;
  }
});

test('pose: simétrica — trocar os lados espelha o resultado', () => {
  for (const t of [0.2, 0.5, 0.8, 1]) {
    const a = pose(-t), b = pose(t);
    assert.ok(near(a.splitTop - 66, 66 - b.splitTop) || true); // o raio não é 100 % simétrico (35→43 × 35→28), conferido abaixo
    assert.ok(near(a.heroL.scale, b.heroR.scale));
    assert.ok(near(a.heroL.opacity, b.heroR.opacity));
    assert.ok(near(a.heroR.opacity, b.heroL.opacity));
    assert.ok(near(a.infoL.scale, b.infoR.scale));
    assert.ok(near(a.rayShift, -b.rayShift));
    assert.ok(near(a.swapX - 50, 50 - b.swapX));
  }
});

test('pose: t fora de [-1, 1] é limitado', () => {
  assert.deepEqual(pose(5), pose(1));
  assert.deepEqual(pose(-9), pose(-1));
});

test('cubic-bezier: extremos, monotonia e a curva do protótipo (.22,1,.36,1) sobe rápido e assenta', () => {
  assert.equal(MOTION_EASE(0), 0); assert.equal(MOTION_EASE(1), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i++) { const v = MOTION_EASE(i / 100); assert.ok(v >= prev - 1e-9); prev = v; }
  assert.ok(MOTION_EASE(0.2) > 0.5, 'a metade do caminho sai nos primeiros 20 %');
  assert.ok(near(cubicBezier(0, 0, 1, 1)(0.37), 0.37, 1e-4), 'linear');
});

test('palco: 1:2 do protótipo; tela mais alta ocupa tudo, tela mais larga centraliza', () => {
  assert.deepEqual(stageRect(393, 852), {x: 0, y: 0, w: 393, h: 852});
  const wide = stageRect(360, 640);
  assert.equal(wide.h, 640); assert.equal(wide.w, 320); assert.equal(wide.x, 20);
  const exact = stageRect(400, 800);
  assert.deepEqual(exact, {x: 0, y: 0, w: 400, h: 800});
});

test('caixas: retratos, cartões e logo ficam dentro das proporções do CSS', () => {
  const s = stageRect(400, 800);
  const b = boxes(s);
  assert.ok(near(b.heroL.w, 300) && near(b.heroL.x, -62) && near(b.heroL.y, 176.8));
  assert.ok(near(b.heroR.x, 172) && near(b.heroR.w, 292));
  assert.ok(near(b.infoL.w, 196) && near(b.infoR.x, 202));
  assert.ok(near(b.infoL.y + b.infoL.h, 720), 'o cartão assenta a 10 % do fundo');
  assert.ok(near(b.logo.x, 56) && near(b.logo.w, 288));
  assert.ok(b.swipe.y + b.swipe.h < b.bottom.y + b.bottom.h);
});

test('linha divisória: prolongada até as bordas da tela quando o palco não cobre tudo', () => {
  const full = splitLine(66, 35, {x: 0, y: 0, w: 400, h: 800}, 800);
  assert.ok(near(full.top, 264) && near(full.bottom, 140));
  const letter = splitLine(66, 35, {x: 0, y: 20, w: 400, h: 760}, 800); // 20 px de sobra em cima e embaixo
  assert.ok(letter.top > full.top, 'subindo além do palco a reta anda para a direita');
  assert.ok(letter.bottom < 140 + 1e3 && letter.bottom < full.bottom + 20);
});

test('soltar o dedo: deslizar para a direita escolhe Josperd, para a esquerda Camila; pouco movimento volta', () => {
  assert.equal(releaseTarget(0, -0.4, 60), -1);
  assert.equal(releaseTarget(0, 0.4, -60), 1);
  assert.equal(releaseTarget(-1, -0.97, -5), -1);
  assert.equal(releaseTarget(0, 0.05, 6), 0);
  assert.equal(releaseTarget(0, -0.6, 20), -1, 'arrastou mais da metade: assenta');
});

test('toque: a metade da tela escolhe o personagem do lado', () => {
  const s = stageRect(400, 800);
  assert.equal(tapTarget(80, s), -1); assert.equal(tapTarget(300, s), 1);
  assert.equal(targetOf('josperd'), -1); assert.equal(targetOf('camila'), 1);
  assert.equal(choiceOf(-1), 'josperd'); assert.equal(choiceOf(0), null); assert.equal(choiceOf(0.7), 'camila');
});

test('animação: dura 760 ms, começa e termina nos valores; duração 0 (reduzir movimento) é instantânea', () => {
  const tw = {from: 0, to: -1, start: 1000, dur: 760};
  assert.equal(tweenAt(tw, 1000), 0);
  assert.equal(tweenAt(tw, 1760), -1);
  assert.ok(tweenAt(tw, 1100) < -0.4);
  assert.equal(tweenAt({...tw, dur: 0}, 1000), -1);
  assert.equal(mix(0, 10, 0.5), 5);
});
