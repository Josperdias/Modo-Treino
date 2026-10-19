// NEON STEP DX — Diário de descobertas, partida guardada e rampa de dificuldade. Rode: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = (p) => import(join(ROOT, 'native/src/arcade', p));
const {CATALOG, GROUPS, TOTAL, fromEvent, fromState, fresh, countFound, isDiscovery} = await A('discovery.ts');
const {DEFAULT_SAVE, normalizeSave, addFound, recordRun} = await A('save.ts');
const {snapshotOf, parseSnapshot} = await A('runsave.ts');
const {createSim, step, metersOf} = await A('core/sim.ts');
const {makeBot, botInput, IDEAL, HUMAN} = await A('core/bot.ts');
const {rampAt, intensityAt} = await A('core/worldgen.ts');
const {ENEMIES, WORLD_ORDER, PHYS} = await A('data/neon.ts');
const {Session} = await A('session.ts');

test('diário: ids únicos, grupos válidos e cobre todo mundo, portal, inimigo e poder do motor', () => {
  const ids = CATALOG.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const groups = new Set(GROUPS.map((g) => g.id));
  for (const c of CATALOG) { assert.ok(groups.has(c.group), c.id); assert.ok(c.name && c.hint, c.id); assert.ok(c.id.startsWith({chao: 'floor:', poder: 'power:', feito: 'feat:', inimigo: 'enemy:', mundo: 'world:', portal: 'portal:'}[c.group]), c.id); }
  for (const w of [...WORLD_ORDER, 'paper', 'sketch', 'inverse']) assert.ok(isDiscovery(`world:${w}`), w);
  for (const k of Object.keys(ENEMIES)) assert.ok(isDiscovery(`enemy:${k}`), k);
  for (const v of ['world', 'paper', 'bonus', 'warp', 'back', 'time', 'leap', 'flip', 'sketch', 'tele']) assert.ok(isDiscovery(`portal:${v}`), v);
  assert.equal(TOTAL, CATALOG.length);
});

test('diário: eventos e estado revelam as descobertas certas', () => {
  assert.deepEqual(fromEvent({t: 'land', plat: 'normal', x: 0, y: 0}), []);
  assert.deepEqual(fromEvent({t: 'land', plat: 'ghost', x: 0, y: 0}), ['floor:ghost']);
  assert.deepEqual(fromEvent({t: 'collect', kind: 'tape', x: 0, y: 0, combo: 4}), []);
  assert.deepEqual(fromEvent({t: 'collect', kind: 'tape', x: 0, y: 0, combo: 5}), ['feat:combo5']);
  assert.deepEqual(fromEvent({t: 'pickup', kind: 'jet', x: 0, y: 0}), ['power:jet']);
  assert.deepEqual(fromEvent({t: 'pickup', kind: 'tape', x: 0, y: 0}), []);
  assert.deepEqual(fromEvent({t: 'kill', kind: 'drone', x: 0, y: 0, by: 'stomp'}), ['enemy:drone', 'feat:stomp']);
  assert.deepEqual(fromEvent({t: 'portal', world: 'neon', variant: 'exit', x: 0, y: 0}), ['portal:tele']);
  assert.deepEqual(fromEvent({t: 'over', cause: 'fall'}), []);
  const s = createSim(3, 910);
  s.enemies.push({id: 1, kind: 'ufo', x0: 100, y0: s.player.y + 200, x: 100, y: s.player.y + 200, phase: 0, speed: 0, range: 0, size: 30, hp: 1, maxHp: 1, cooldown: 9, warn: false, alive: true});
  s.enemies.push({id: 2, kind: 'jelly', x0: 100, y0: s.player.y + 5000, x: 100, y: s.player.y + 5000, phase: 0, speed: 0, range: 0, size: 30, hp: 1, maxHp: 1, cooldown: 9, warn: false, alive: true});
  const st = fromState(s, 1200);
  assert.ok(st.includes('world:neon') && st.includes('enemy:ufo') && !st.includes('enemy:jelly'));
  assert.ok(st.includes('feat:m500') && st.includes('feat:m1000') && !st.includes('feat:m2500'));
});

test('save: descobertas e personagens usados persistem, só ids do catálogo, sem inventar nem repetir', () => {
  assert.deepEqual(fresh({'world:neon': 1}, ['world:neon', 'world:clock', 'world:clock', 'xx:nada']), ['world:clock']);
  let sv = addFound(DEFAULT_SAVE, ['world:neon', 'enemy:drone', 'lixo'], 'josperd');
  assert.deepEqual(Object.keys(sv.found).sort(), ['enemy:drone', 'world:neon']);
  assert.equal(addFound(sv, ['world:neon'], 'josperd'), sv, 'nada novo = mesmo objeto (não regrava)');
  assert.equal(sv.found['feat:both'], undefined);
  sv = addFound(sv, [], 'camila');
  assert.ok(sv.found['feat:both'] !== undefined, 'jogou com os dois');
  const back = normalizeSave(JSON.parse(JSON.stringify(sv)));
  assert.deepEqual(back.found, sv.found);
  assert.deepEqual(back.played, ['josperd', 'camila']);
  assert.equal(countFound(back.found), 3);
  // Disco corrompido nunca derruba nem inventa descobertas.
  const bad = normalizeSave({found: {'world:neon': 'x', 'inventado:1': 3, 'world:clock': -5}, played: 'oi'});
  assert.deepEqual(Object.keys(bad.found).sort(), ['world:clock', 'world:neon']);
  assert.deepEqual(bad.played, []);
  // A partida seguinte continua somando; recordRun não apaga o Diário.
  const r = recordRun(sv, {hero: 'josperd', score: 10, meters: 5});
  assert.deepEqual(r.save.found, sv.found);
  assert.equal(normalizeSave(null).found && Object.keys(normalizeSave(null).found).length, 0);
});

/** Roda um robô por `secs` segundos de jogo, passando por um portal de mundo no meio (estado de mundo/gerador mudando). */
function play(seed, secs, bot, portal = true) {
  const s = createSim(seed, 910);
  for (let i = 0; i < 120 * secs && s.mode === 'playing'; i++) {
    if (portal && i === 120 * 20) s.items.push({id: 99990, kind: 'portal', x: s.player.x, y: s.player.y + 55, phase: 0, hit: false, target: 'crystal', variant: 'world'});
    step(s, botInput(s, bot)); s.events.length = 0;
  }
  return s;
}

test('partida guardada: o JSON volta idêntico e a partida segue EXATAMENTE igual (mesma semente, mesmo estado)', () => {
  for (const seed of [3, 11, 29]) {
    const bot = makeBot(IDEAL, seed);
    const a = play(seed, 45, bot);
    assert.equal(a.mode, 'playing');
    const raw = snapshotOf(a, 'camila', metersOf(a), 123);
    assert.ok(raw && raw.length < 400_000, `tamanho ${raw && raw.length}`);
    const snap = parseSnapshot(raw);
    assert.ok(snap);
    assert.equal(snap.hero, 'camila');
    const b = snap.sim;
    // O robô do original e o do restaurado precisam decidir igual: o estado do robô é separado, então reusa-se o mesmo objeto sem mexer.
    const botB = JSON.parse(JSON.stringify(bot));
    for (let i = 0; i < 120 * 30 && a.mode === 'playing'; i++) {
      step(a, botInput(a, bot)); a.events.length = 0;
      step(b, botInput(b, botB)); b.events.length = 0;
    }
    assert.equal(JSON.stringify(a), JSON.stringify(b), `partida ${seed} divergiu depois de restaurar`);
  }
});

test('partida guardada: não guarda partida terminada e recusa lixo, JSON quebrado e campos faltando', () => {
  const s = createSim(5, 910);
  assert.ok(snapshotOf(s, 'josperd', 0, 1));
  s.mode = 'over';
  assert.equal(snapshotOf(s, 'josperd', 0, 1), null);
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot(''), null);
  assert.equal(parseSnapshot('{oi'), null);
  assert.equal(parseSnapshot('{"v":1,"hero":"x","sim":{}}'), null);
  const ok = JSON.parse(snapshotOf(createSim(5, 910), 'josperd', 7, 1));
  for (const mut of [(o) => { o.sim.mode = 'over'; }, (o) => { delete o.sim.gen; }, (o) => { o.sim.platforms = []; }, (o) => { o.sim.player.x = null; }, (o) => { o.hero = 'z'; }, (o) => { o.v = 2; }]) {
    const o = JSON.parse(JSON.stringify(ok)); mut(o);
    assert.equal(parseSnapshot(JSON.stringify(o)), null);
  }
  const r = parseSnapshot(JSON.stringify(ok));
  assert.equal(r.meters, 7);
});

test('sessão: restaurar uma partida guardada começa PAUSADA e continua de onde parou', () => {
  const a = play(7, 30, makeBot(IDEAL, 7), false);
  const snap = parseSnapshot(snapshotOf(a, 'josperd', metersOf(a), 1));
  const sess = new Session(9, 910, 0);
  sess.restore(snap.sim);
  assert.equal(sess.paused, true);
  assert.equal(sess.sim.tick, a.tick);
  assert.equal(sess.frame(1000), false, 'pausada não anda');
  sess.resume();
  sess.frame(2000); sess.frame(2016); sess.frame(2033);
  assert.ok(sess.sim.tick > a.tick);
});

test('rampa: a dificuldade sobe devagar — quase nada nos primeiros 300 m e só chega ao máximo perto dos 2400 m', () => {
  const at = (m) => rampAt(PHYS.START_Y + m * 10);
  assert.ok(at(100) < 0.04 && at(300) < 0.16 && at(600) < 0.4, `${at(100)} ${at(300)} ${at(600)}`);
  assert.ok(at(1200) > 0.3 && at(1200) < 0.55 && at(2000) > 0.7 && at(2400) === 1 && at(5000) === 1);
  let prev = -1;
  for (let m = 0; m <= 2600; m += 50) { const v = at(m); assert.ok(v >= prev, 'nunca desce'); prev = v; }
  // A intensidade (rampa × ritmo) também fica baixa no começo, mesmo no pico do ritmo.
  let peak = 0;
  for (let m = 0; m <= 300; m += 5) peak = Math.max(peak, intensityAt(PHYS.START_Y + m * 10));
  assert.ok(peak < 0.16, `pico até 300 m = ${peak}`);
});

test('rampa: um jogador humano comum vai bem mais longe que no começo e ainda assim morre antes da dificuldade máxima (não é eterno)', () => {
  const deaths = [];
  for (let seed = 1; seed <= 16; seed++) {
    const s = createSim(seed, 910), b = makeBot({every: 42, noise: 45, lapse: 0.18, digital: true, dodge: 0.3}, seed);
    while (s.mode === 'playing' && s.tick < 120 * 360) step(s, botInput(s, b));
    deaths.push(s.mode === 'over' ? metersOf(s) : 99999);
  }
  deaths.sort((x, y) => x - y);
  assert.ok(deaths[0] > 150, `ninguém morre no começo: ${deaths[0]}`);
  assert.ok(deaths.filter((m) => m < 99999).length >= 10, 'a maioria cai em 6 min');
});
