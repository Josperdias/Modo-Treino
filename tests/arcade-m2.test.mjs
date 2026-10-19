// NEON STEP DX — M2: inimigos, vidas, poderes, portais e mundos (native/src/arcade/core). Rode: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = p => import(join(ROOT, 'native/src/arcade/core', p));
const {createSim, step, metersOf, windAt} = await C('sim.ts');
const {enemyAt, tri} = await C('enemies.ts');
const {makeGen, generateUntil} = await C('worldgen.ts');
const {PHYS, LIFE, COMBAT, POWER, PORTAL, SPAWN, ENEMIES, WORLD_FX, SCORE_M2, PICKUP} = await import(join(ROOT, 'native/src/arcade/data/neon.ts'));

const plat = (o = {}) => ({id: 1, x: 210, y: 300, w: 100, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'stairs', dir: 0, ...o});
const enemy = (o = {}) => ({id: 900 + Math.floor(Math.random() * 1e6), kind: 'drone', x0: 210, y0: 400, x: 210, y: 400, phase: 0, speed: 0, range: 0, size: ENEMIES.drone.size, hp: 1, maxHp: 1, cooldown: 99, warn: false, alive: true, ...o});

/** Partida vazia: só o que o teste colocar; geração travada; herói parado no ar, caindo devagar. */
function bare({platforms = [], enemies = [], items = [], meters = 0} = {}) {
  const s = createSim(1);
  s.platforms.length = 0; s.items.length = 0; s.enemies.length = 0;
  s.gen.y = 1e9;
  s.platforms.push(...platforms);
  s.enemies.push(...enemies);
  s.items.push(...items);
  if (meters) { s.maxY = 90 + meters * 10; }
  return s;
}
function put(s, x, y, vy = 0) { Object.assign(s.player, {x, y, px: x, py: y, vy, vx: 0}); }
function steps(s, n, input = {axis: 0}) { for (let i = 0; i < n && s.mode === 'playing'; i++) step(s, input); }
const kinds = s => s.events.map(e => e.t);

/* ---------- inimigos: movimento ---------- */
test('inimigos: a posição é função pura do tempo; zigue-zague limitado ao alcance; torre parada', () => {
  const d = enemy({kind: 'drone', x0: 200, y0: 500, range: 60, speed: 1, phase: 0.4});
  assert.deepEqual(enemyAt(d, 3.3), enemyAt(d, 3.3));
  for (let t = 0; t < 20; t += 0.07) {
    const p = enemyAt(d, t);
    assert.ok(Math.abs(p.x - 200) <= 60 + 1e-9 && Math.abs(p.y - 500) <= 6 + 1e-9);
  }
  const z = enemy({kind: 'zigzag', x0: 200, y0: 500, range: 90, speed: 1.7});
  let max = 0; for (let t = 0; t < 30; t += 0.01) max = Math.max(max, Math.abs(enemyAt(z, t).x - 200));
  assert.ok(max <= 90 + 1e-9 && max > 85);
  assert.ok(Math.abs(tri(0)) < 1e-12 && Math.abs(tri(Math.PI / 2) - 1) < 1e-12);
  const o = enemy({kind: 'orb', x0: 200, y0: 500, range: 40, speed: 1.2});
  for (let t = 0; t < 10; t += 0.1) assert.ok(Math.hypot(enemyAt(o, t).x - 200, (enemyAt(o, t).y - 500) / 0.8) <= 40 + 1e-9);
  assert.deepEqual(enemyAt(enemy({kind: 'turret', x0: 77, y0: 123}), 9), {x: 77, y: 123});
});

/* ---------- combate ---------- */
test('pisar num inimigo derruba e quica (sem dano); score ganha o abate', () => {
  const e = enemy({x0: 210, y0: 400, x: 210, y: 400});
  const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 400 + 20, -300); // pés acima do centro do inimigo, descendo
  steps(s, 3);
  assert.equal(e.alive, false);
  assert.equal(s.lives, LIFE.START);
  assert.ok(s.player.vy > COMBAT.STOMP_SPEED - 60, `vy ${s.player.vy}`);
  assert.equal(s.kills, 1);
  assert.equal(s.bonus, SCORE_M2.KILL);
  assert.ok(s.events.some(ev => ev.t === 'kill' && ev.by === 'stomp'));
});

test('encostar de lado machuca: perde 1 vida, fica invencível e não leva dano em dobro', () => {
  const e = enemy({x0: 210, y0: 420, x: 210, y: 420, size: 20});
  const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})]});
  put(s, 214, 380, 200); // subindo contra o inimigo
  steps(s, 4);
  assert.equal(s.lives, LIFE.START - 1);
  assert.ok(s.invuln > LIFE.AFTER_HIT - 0.1);
  assert.ok(s.events.some(ev => ev.t === 'hit' && !ev.blocked));
  assert.equal(s.hits, 1);
  s.events.length = 0;
  steps(s, 10);
  assert.equal(s.lives, LIFE.START - 1, 'invencível: sem segundo dano');
});

test('escudo absorve um golpe sem tirar vida', () => {
  const e = enemy({x0: 210, y0: 420, x: 210, y: 420});
  const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})]});
  s.shields = 1;
  put(s, 214, 380, 200);
  steps(s, 4);
  assert.equal(s.shields, 0);
  assert.equal(s.lives, LIFE.START);
  assert.ok(s.events.some(ev => ev.t === 'hit' && ev.blocked));
});

test('hélice: sobe sozinha a 640, é imune e destrói quem toca', () => {
  const e = enemy({x0: 210, y0: 460, x: 210, y: 460});
  const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 380, 100);
  s.jet = POWER.JET_TIME;
  steps(s, 60);
  assert.equal(e.alive, false);
  assert.ok(s.events.some(ev => ev.t === 'kill' && ev.by === 'jet'));
  assert.equal(s.lives, LIFE.START);
  assert.ok(Math.abs(s.player.vy - POWER.JET_SPEED) < 1e-9 || s.jet === 0);
});

test('tiro para cima derruba; respeita o cooldown; torre precisa de 2 tiros', () => {
  const d = enemy({x0: 210, y0: 600, x: 210, y: 600});
  const t = enemy({kind: 'turret', x0: 300, y0: 640, x: 300, y: 640, size: ENEMIES.turret.size, hp: 2, maxHp: 2});
  const s = bare({enemies: [d, t], platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 300, 0); s.jet = 99; // paira: sem gravidade com hélice? usamos jet para manter altura
  s.jet = 0; s.player.vy = 0;
  // sem gravidade relevante em 120 passos? usa plataforma larga logo abaixo e salto: simplesmente mantém o herói por reposição
  let shots = 0, lastShotTick = -999;
  for (let i = 0; i < 90 && d.alive; i++) {
    put(s, 210, 300, 0);
    step(s, {axis: 0, fire: true});
    for (const ev of s.events) if (ev.t === 'shoot' && ev.own) { shots++; if (lastShotTick >= 0) assert.ok(i - lastShotTick >= Math.floor(COMBAT.FIRE_COOLDOWN / PHYS.STEP) - 1, 'cooldown'); lastShotTick = i; }
    s.events.length = 0;
  }
  assert.equal(d.alive, false);
  assert.ok(shots >= 1);
  assert.equal(s.kills, 1);
  // torre
  s.bullets.length = 0;
  for (let i = 0; i < 400 && t.alive; i++) { put(s, 300, 300, 0); step(s, {axis: 0, fire: true}); s.events.length = 0; }
  assert.equal(t.alive, false);
  assert.equal(s.kills, 2);
});

test('tiros inimigos: só a partir de 50 m, com aviso antes, e no máximo 4 no ar', () => {
  const mk = (meters) => {
    const e = enemy({kind: 'turret', x0: 210, y0: 520, x: 210, y: 520, size: 24, hp: 2, maxHp: 2, cooldown: 1.0});
    const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})], meters});
    put(s, 100, 300, 0);
    return {s, e};
  };
  const early = mk(30);
  for (let i = 0; i < 400; i++) { put(early.s, 100, 300, 0); step(early.s, {axis: 0}); }
  assert.equal(early.s.bullets.length + early.s.events.filter(e => e.t === 'shoot').length, 0, 'abaixo de 50 m não atira');
  const late = mk(80);
  let warned = -1, shot = -1;
  for (let i = 0; i < 400 && shot < 0; i++) {
    put(late.s, 100, 300, 0);
    step(late.s, {axis: 0});
    for (const ev of late.s.events) { if (ev.t === 'warn' && warned < 0) warned = i; if (ev.t === 'shoot' && !ev.own && shot < 0) shot = i; }
    late.s.events.length = 0;
  }
  assert.ok(warned >= 0 && shot > warned, `aviso ${warned} antes do tiro ${shot}`);
  assert.ok((shot - warned) * PHYS.STEP > COMBAT.TELEGRAPH - 0.1);
  // limite de 4
  late.e.cooldown = 0;
  for (let i = 0; i < 2000; i++) { put(late.s, 100, 300, 0); late.s.invuln = 99; late.e.cooldown = Math.min(late.e.cooldown, 0.001); step(late.s, {axis: 0}); assert.ok(late.s.bullets.filter(b => !b.own).length <= COMBAT.ENEMY_BULLETS_MAX); }
});

test('um tiro inimigo que acerta tira vida e some', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 300, 0);
  s.bullets.push({id: 5, x: 210, y: 342, vx: 0, vy: 0, own: false, alive: true});
  steps(s, 2);
  assert.equal(s.lives, LIFE.START - 1);
  assert.equal(s.bullets.length, 0);
});

/* ---------- vidas e recuperação ---------- */
test('sem recuperação: ficar sem vidas encerra com causa "damage"', () => {
  const e = enemy({x0: 210, y0: 420, x: 210, y: 420});
  const s = bare({enemies: [e], platforms: [plat({y: 100, w: 600})]});
  s.lives = 1;
  put(s, 214, 380, 200);
  steps(s, 4);
  assert.equal(s.mode, 'over');
  assert.deepEqual(s.events.find(ev => ev.t === 'over'), {t: 'over', cause: 'damage'});
});

test('recuperação: volta numa plataforma firme da tela, vidas cheias, invencível e tela limpa; só uma vez', () => {
  const e = enemy({x0: 210, y0: 420, x: 210, y: 420});
  const keep = plat({id: 7, x: 150, y: 250, w: 140});
  const s = bare({enemies: [e, enemy({x0: 100, y0: 500, x: 100, y: 500})], platforms: [plat({y: 100, w: 600}), keep]});
  s.revive = 1; s.lives = 1;
  put(s, 214, 380, 200);
  steps(s, 4);
  assert.equal(s.mode, 'playing');
  assert.equal(s.lives, LIFE.START);
  assert.equal(s.revive, 0);
  assert.ok(s.invuln > LIFE.AFTER_REVIVE - 0.1);
  assert.ok(s.events.some(ev => ev.t === 'revive'));
  assert.ok(s.enemies.every(x => !x.alive), 'ameaças da tela somem');
  assert.ok(s.player.y >= s.camera + 70 && s.player.y <= s.camera + s.viewH * 0.5 + 1, 'dentro da tela');
  // cair sem carga encerra
  s.invuln = 0; s.lives = 1;
  put(s, 210, s.camera - 200, -500);
  steps(s, 5);
  assert.equal(s.mode, 'over');
  assert.deepEqual(s.events.find(ev => ev.t === 'over'), {t: 'over', cause: 'fall'});
});

test('recuperação também vale para a queda (e cria um apoio se não houver plataforma firme)', () => {
  const s = bare({platforms: []});
  s.revive = 1;
  put(s, 210, s.camera - 120, -400);
  steps(s, 3);
  assert.equal(s.mode, 'playing');
  assert.equal(s.revive, 0);
  assert.ok(s.platforms.length >= 1);
  assert.ok(s.player.vy > 600);
});

/* ---------- poderes ---------- */
test('poderes: escudo (máx. 2), sapatos de mola (pulo 835), hélice, coração (máx. 3) e bandeira', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  const give = (kind, y = 150) => { s.items.push({id: 50 + s.items.length, kind, x: 210, y: y + PICKUP.BODY_Y, phase: 0, hit: false}); put(s, 210, y, 0); steps(s, 1); };
  give('shield'); give('shield'); give('shield');
  assert.equal(s.shields, LIFE.SHIELD_MAX);
  s.lives = 3; give('heart');
  assert.equal(s.lives, LIFE.MAX);
  assert.equal(s.bonus, SCORE_M2.HEART);
  assert.equal(s.revive, 0);
  give('flag'); assert.equal(s.revive, 1);
  give('flag'); assert.equal(s.revive, 1); assert.equal(s.bonus, SCORE_M2.HEART + SCORE_M2.FLAG);
  give('boost'); assert.ok(s.boost > POWER.BOOST_TIME - 0.1);
  // pulo com sapatos: pousa e sobe a 835
  put(s, 210, 100.5, -50);
  steps(s, 2);
  assert.ok(s.player.vy > 800 && s.player.vy <= PHYS.BOOST, `vy ${s.player.vy}`);
  give('jet'); assert.ok(s.jet > 0);
  assert.ok(s.events.some(ev => ev.t === 'pickup'));
});

/* ---------- portais e mundos ---------- */
test('portal: por contato; troca o mundo, limpa à frente, cria chão seguro e dá uma recuperação', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})], enemies: [enemy({id: 4242, x0: 100, y0: 900, x: 100, y: 900})]});
  const portal = {id: 77, kind: 'portal', x: 210, y: 600, phase: 0, hit: false, target: 'crystal'};
  s.items.push(portal, {id: 78, kind: 'tape', x: 100, y: 900, phase: 0, hit: false});
  s.platforms.push(plat({id: 9, x: 200, y: 700, w: 100}));
  put(s, 210, 600 - 45, 300);
  steps(s, 1);
  assert.equal(s.world, 'crystal');
  assert.equal(s.gen.world, 'crystal');
  assert.equal(s.portals, 1);
  assert.equal(s.revive, 1);
  assert.ok(s.invuln > LIFE.AFTER_WORLD - 0.1);
  assert.ok(s.events.some(ev => ev.t === 'portal' && ev.world === 'crystal'));
  assert.ok(!s.platforms.some(p => p.id === 9), 'à frente foi limpo');
  assert.ok(!s.enemies.some(e => e.id === 4242), 'o inimigo que estava à frente sumiu');
  const safe = s.platforms.find(p => p.w === 132);
  assert.ok(safe && safe.y < s.player.y && safe.y > s.player.y - 80, 'chão seguro logo abaixo');
  assert.equal(s.bonus, SCORE_M2.PORTAL);
  assert.ok(Math.abs(s.gen.worldY0 - safe.y) < 1e-9);
});

test('portal: nunca antes de 565 un. de subida nem sem plataforma de apoio; vem num mundo diferente do atual', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const g = makeGen(seed);
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 25000);
    const portals = out.items.filter(i => i.kind === 'portal');
    assert.equal(portals.length, 1, `semente ${seed}: um portal por vez`);
    const p = portals[0];
    assert.ok(p.y - 90 >= 565, `portal baixo demais: ${p.y}`);
    assert.ok(p.y - 90 >= PORTAL.FIRST_M * 10, 'primeiro portal só a partir de 100 m');
    assert.equal(p.target, 'crystal');
    const pad = out.platforms.find(q => q.pattern === 'portalPad');
    assert.ok(pad && Math.abs(p.y - pad.y - PORTAL.ABOVE) < 1e-9 && Math.abs(p.x - pad.x) >= 50, 'apoio ao lado do portal');
  }
});

test('portal perdido: o próximo vem mais adiante (e só um portal pendente por vez)', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  s.items.push({id: 80, kind: 'portal', x: 210, y: 150, phase: 0, hit: false, target: 'crystal'});
  s.gen.portalPlaced = true; s.gen.y = 9000;
  s.camera = 150 + 400;
  put(s, 400, 600, 0);
  steps(s, 31);
  assert.equal(s.items.some(i => i.kind === 'portal'), false);
  assert.equal(s.gen.portalPlaced, false);
  assert.ok(s.gen.portalY >= s.gen.y + PORTAL.MISS_RETRY_M * 10 - 1);
});

test('mundo cristal: o vento muda o alvo horizontal; mecânico: esteira empurra no pouso e o empurrão decai', () => {
  assert.equal(windAt('neon', 1.2), 0);
  const peak = windAt('crystal', WORLD_FX.CRYSTAL_PERIOD / 4);
  assert.ok(Math.abs(peak - WORLD_FX.CRYSTAL_WIND) < 1e-9);
  const c = bare({platforms: [plat({y: 100, w: 600})]});
  c.world = 'crystal';
  put(c, 210, 300, 0);
  let moved = 0;
  for (let i = 0; i < 120; i++) { put(c, c.player.x, 300, 0); c.player.vy = 0; step(c, {axis: 0}); moved = Math.max(moved, Math.abs(c.player.vx)); }
  assert.ok(moved > 5, 'vento empurra');

  const k = bare({platforms: [plat({y: 100, w: 600, type: 'conveyor', dir: -1})]});
  k.world = 'clock';
  put(k, 210, 110, -50);
  for (let i = 0; i < 60 && !k.events.some(e => e.t === 'land'); i++) step(k, {axis: 0});
  assert.ok(k.events.some(e => e.t === 'land' && e.plat === 'conveyor'));
  assert.ok(Math.abs(k.player.drift) > WORLD_FX.CLOCK_DRIFT * 0.9 && k.player.drift < 0, `drift ${k.player.drift}`);
  const d0 = Math.abs(k.player.drift);
  steps(k, 60);
  assert.ok(Math.abs(k.player.drift) < d0 * 0.6, 'decai');
});

/* ---------- geração ---------- */
test('geração: inimigos só depois de 38 m, fora das plataformas, com poderes e bandeiras espaçados', () => {
  let enemies = 0, bad = 0;
  const firstEnemy = [];
  for (let seed = 1; seed <= 60; seed++) {
    const g = makeGen(seed);
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 25000);
    firstEnemy.push(Math.min(...out.enemies.map(e => (e.y - 90) / 10)));
    for (const e of out.enemies) {
      enemies++;
      for (const p of out.platforms) {
        if (Math.abs(p.y - e.y0) > e.size + 16) continue;
        const reach = p.w / 2 + p.shift;
        if (e.x0 - e.range - e.size < p.x + reach && e.x0 + e.range + e.size > p.x - reach) bad++;
      }
      assert.ok(e.x0 - e.range - e.size >= 0 && e.x0 + e.range + e.size <= 420, 'dentro do campo');
    }
    const powers = out.items.filter(i => ['shield', 'boost', 'jet', 'heart'].includes(i.kind)).map(i => i.y);
    assert.ok(powers.length >= 8 && powers[0] - 90 >= SPAWN.POWER_FROM_M * 10 - 600, `poderes ${powers.length}`);
    for (let i = 1; i < powers.length; i++) assert.ok(powers[i] - powers[i - 1] >= SPAWN.POWER_GAP_M[0] * 10 - 900, 'poder em cascata');
    const flags = out.items.filter(i => i.kind === 'flag').map(i => i.y);
    assert.ok(flags.length >= 6 && flags[0] - 90 >= 300);
    for (let i = 1; i < flags.length; i++) assert.ok(flags[i] - flags[i - 1] >= 1200, 'bandeira em cascata');
  }
  assert.ok(enemies > 800, `inimigos ${enemies}`);
  assert.equal(bad, 0, 'inimigo atravessando plataforma');
  assert.ok(Math.min(...firstEnemy) >= SPAWN.FROM_M, `primeiro inimigo aos ${Math.min(...firstEnemy)} m`);
});

test('geração: tipos por mundo (neon: drone/zigue-zague/torre; cristal: orbe e zigue-zague; mecânico: torre)', () => {
  for (const [world, expect] of [['neon', ['drone', 'zigzag', 'turret']], ['crystal', ['zigzag', 'orb', 'drone']], ['clock', ['turret', 'drone', 'orb']]]) {
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const g = makeGen(seed); g.world = world; g.worldY0 = 90;
      const out = {platforms: [], items: [], enemies: []};
      g.portalPlaced = true; // sem portal neste teste
      generateUntil(g, out, 90 + 20000);
      for (const e of out.enemies) if (e.kind !== 'guardian') seen.add(e.kind);
    }
    assert.deepEqual([...seen].sort(), [...expect].sort(), world);
  }
});

test('mundo mecânico: parte das plataformas vira esteira (com sentido); nos outros mundos não', () => {
  const count = (world) => {
    let conv = 0, n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = makeGen(seed); g.world = world; g.portalPlaced = true;
      const out = {platforms: [], items: [], enemies: []};
      generateUntil(g, out, 90 + 15000);
      for (const p of out.platforms) { n++; if (p.type === 'conveyor') { conv++; assert.ok(p.dir === 1 || p.dir === -1); } }
    }
    return conv / n;
  };
  assert.equal(count('neon'), 0);
  assert.equal(count('crystal'), 0);
  const f = count('clock');
  assert.ok(f > 0.12 && f < 0.4, `fração ${f}`);
});

test('sem avisos de fase: o motor não emite mais evento de nível', () => {
  const s = createSim(3);
  for (let i = 0; i < 120 * 60; i++) { step(s, {axis: Math.sin(i / 90)}); if (s.mode !== 'playing') break; }
  assert.ok(!s.events.some(e => e.t === 'level'));
});
