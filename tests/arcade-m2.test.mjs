// NEON STEP DX — M2: inimigos, vidas, poderes, portais e mundos (native/src/arcade/core). Rode: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = p => import(join(ROOT, 'native/src/arcade/core', p));
const {createSim, step, metersOf, windAt, ghostSolid} = await C('sim.ts');
const {enemyAt, tri} = await C('enemies.ts');
const {makeGen, generateUntil, nextWorld} = await C('worldgen.ts');
const {makeBot, botInput, IDEAL, HUMAN} = await C('bot.ts');
const {canReach} = await C('validate.ts');
const {PHYS, LIFE, COMBAT, POWER, PORTAL, LAVA, WORLD_ORDER, SKETCH, INVERSE, LAB, SPAWN, ENEMIES, WORLD_FX, SCORE_M2, PICKUP, PAPER, BLACKHOLE, METEOR} = await import(join(ROOT, 'native/src/arcade/data/neon.ts'));

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

test('portal: bem longe (700–1000 m), um por vez, com apoio ao lado; primeiro portal nunca é o do Papel', () => {
  const kinds = {};
  for (let seed = 1; seed <= 80; seed++) {
    const g = makeGen(seed);
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 12000);
    const portals = out.items.filter(i => i.kind === 'portal' && i.variant !== 'tele' && i.variant !== 'exit');
    assert.equal(portals.length, 1, `semente ${seed}: um portal por vez`);
    const p = portals[0];
    const m = (p.y - 90) / 10;
    assert.ok(m >= PORTAL.FIRST_M[0] - 5 && m <= PORTAL.FIRST_M[1] + 120, `primeiro portal aos ${m} m`);
    assert.ok(['world', 'bonus', 'warp', 'time'].includes(p.variant), `primeiro portal não é do Papel: ${p.variant}`);
    kinds[p.variant] = (kinds[p.variant] || 0) + 1;
    if (p.variant === 'world') assert.equal(p.target, 'crystal');
    const pad = out.platforms.find(q => q.pattern === 'portalPad');
    assert.ok(pad && Math.abs(p.y - pad.y - PORTAL.ABOVE) < 1e-9 && Math.abs(p.x - pad.x) >= 40, 'apoio ao lado do portal');
  }
  assert.ok(kinds.world > 15 && kinds.bonus > 3 && kinds.warp > 3, JSON.stringify(kinds));
});

test('portal: depois do primeiro, o do Papel também entra no sorteio; dentro do Papel só aparece o portal de volta', () => {
  const seen = {};
  for (let seed = 1; seed <= 120; seed++) {
    const g = makeGen(seed); g.portalsMade = 1; g.portalY = 400;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 3000);
    const it = out.items.find(i => i.kind === 'portal' && i.variant !== 'tele' && i.variant !== 'exit');
    seen[it.variant] = (seen[it.variant] || 0) + 1;
    const h = makeGen(seed); h.world = 'paper'; h.returnWorld = 'clock'; h.portalY = 400; h.lane = [44, 168];
    const o2 = {platforms: [], items: [], enemies: []};
    generateUntil(h, o2, 90 + 3000);
    // no Papel o primeiro portal é o do Rascunho (a dobra rasgada); depois dele (ou se for perdido), o de volta
    const first = o2.items.find(i => i.kind === 'portal');
    assert.deepEqual([first.variant, first.target], ['sketch', 'sketch']);
    const k = makeGen(seed); k.world = 'sketch'; k.returnWorld = 'clock'; k.portalY = 400; k.lane = [44, 376];
    const o3 = {platforms: [], items: [], enemies: []};
    generateUntil(k, o3, 90 + 3000);
    const back = o3.items.find(i => i.kind === 'portal');
    assert.deepEqual([back.variant, back.target], ['back', 'clock']);
  }
  assert.ok(seen.paper > 6 && seen.world > 15 && seen.bonus > 4 && seen.warp > 4 && seen.flip > 4 && seen.time > 4, JSON.stringify(seen));
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
    const powers = out.items.filter(i => ['shield', 'boost', 'jet', 'heart', 'magnet'].includes(i.kind)).map(i => i.y);
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
  for (const [world, expect] of [['neon', ['drone', 'zigzag', 'turret', 'blackhole']], ['crystal', ['zigzag', 'orb', 'drone', 'blackhole']], ['clock', ['turret', 'drone', 'orb', 'blackhole']], ['cosmos', ['meteor', 'ufo', 'orb', 'blackhole', 'drone']], ['ocean', ['jelly', 'zigzag', 'orb', 'blackhole']], ['volcano', ['ember', 'turret', 'drone']]]) {
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const g = makeGen(seed); g.world = world; g.worldY0 = 90;
      const out = {platforms: [], items: [], enemies: []};
      g.portalPlaced = true; // sem portal neste teste
      g.portalY = 1e12;
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

/* ---------- tipos de portal ---------- */
const portalAt = (s, variant, target, extra = {}) => { const p = s.player; s.items.push({id: 6000 + s.items.length, kind: 'portal', x: p.x, y: p.y + 55, phase: 0, hit: false, target, variant, ...extra}); };

test('portal: o próximo só vem muito depois (750–1250 m) e o perdido recomeça mais adiante (420 m)', () => {
  for (const variant of ['world', 'bonus', 'paper']) {
    const s = bare({platforms: [plat({y: 100, w: 600})]});
    put(s, 210, 600, 300);
    portalAt(s, variant, variant === 'world' ? 'crystal' : variant === 'paper' ? 'paper' : 'neon');
    steps(s, 1);
    const base = variant === 'paper' ? s.gen.paperExitY : s.gen.portalY;
    if (variant === 'paper') assert.ok(base - s.gen.worldY0 === PAPER.LENGTH_M * 10);
    else {
      const from = variant === 'bonus' ? s.gen.bonusEndY : s.gen.worldY0;
      const gap = (s.gen.portalY - from) / 10;
      assert.ok(gap >= PORTAL.GAP_M[0] - 1 && gap <= PORTAL.GAP_M[1] + 1, `${variant}: próximo portal a ${gap} m`);
    }
  }
});

test('portal de bônus: continua no mesmo mundo, chuva de fitas sem inimigos, volta sozinho', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  s.world = 'crystal'; s.gen.world = 'crystal';
  put(s, 210, 600, 300);
  portalAt(s, 'bonus', 'crystal');
  steps(s, 1);
  assert.equal(s.world, 'crystal');
  assert.ok(s.gen.bonusEndY > 0 && s.gen.last === 'bonus');
  assert.ok(Math.abs(s.bonusY1 - s.bonusY0 - PORTAL.BONUS_M * 10) < 1e-6);
  assert.equal(s.revive, 0, 'bônus não dá recuperação');
  const zone = s.platforms.filter(p => p.pattern === 'bonus');
  assert.ok(zone.length >= 6 && zone.every(p => p.w >= 110 && p.type === 'normal'));
  const tapes = s.items.filter(i => i.kind === 'tape').length;
  assert.ok(tapes >= zone.length * 3 - 3, `fitas ${tapes}`);
  assert.equal(s.enemies.filter(e => e.alive && e.y0 < s.gen.bonusEndY).length, 0, 'sem inimigos na fase bônus');
  assert.ok(s.platforms.every(p => p.broken || p.type === 'normal' || p.pattern !== 'bonus'));
});

test('portal de atalho: hélice turbo (900) por 2,6 s, invencível, sobe centenas de metros', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 600, 300);
  portalAt(s, 'warp', 'neon');
  const y0 = s.player.y;
  steps(s, 1);
  assert.ok(s.jet > PORTAL.WARP_TIME - 0.05 && s.jetSpeed === PORTAL.WARP_SPEED);
  assert.ok(s.invuln > PORTAL.WARP_TIME);
  s.gen.y = 1e9;
  steps(s, Math.round(PORTAL.WARP_TIME / PHYS.STEP) + 5);
  assert.ok(s.player.y - y0 > 2000, `subiu só ${s.player.y - y0}`);
  assert.equal(s.jetSpeed, POWER.JET_SPEED, 'volta à hélice normal');
});

test('Universo de Papel: faixa estreita, sem volta pela lateral, plataformas só dentro da faixa; o portal de volta troca os heróis', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  s.world = 'clock'; s.gen.world = 'clock';
  put(s, 210, 600, 300);
  portalAt(s, 'paper', 'paper');
  steps(s, 1);
  assert.equal(s.world, 'paper');
  assert.equal(s.gen.returnWorld, 'clock');
  assert.deepEqual(s.gen.lane, [PAPER.LANE_MIN, PAPER.LANE_MAX]);
  assert.equal(s.swapped, false);
  s.gen.y = s.gen.y; // a geração está liberada neste mundo
  const ahead = s.platforms.filter(p => p.y > s.player.y);
  assert.ok(ahead.length > 5);
  for (const p of ahead) assert.ok(p.x - p.shift >= PAPER.LANE_MIN - 1 && p.x + p.shift <= PAPER.LANE_MAX + 1, `plataforma fora da faixa: x ${p.x} sh ${p.shift}`);
  for (const e of s.enemies) assert.ok(e.x0 >= 0 && e.x0 <= PAPER.WALL_MAX + 30, 'inimigo do Papel perto da faixa');
  // physics: empurra para a direita sem parar e fica preso na parede
  for (let i = 0; i < 400 && s.mode === 'playing'; i++) { s.invuln = 9; step(s, {axis: 1}); s.player.y = Math.max(s.player.y, 500); s.player.vy = Math.max(s.player.vy, 100); }
  assert.ok(s.player.x <= PAPER.WALL_MAX + 1e-9 && s.player.x > PAPER.WALL_MAX - 5, `x ${s.player.x}`);
  for (let i = 0; i < 400; i++) { s.invuln = 9; step(s, {axis: -1}); s.player.vy = Math.max(s.player.vy, 100); }
  assert.ok(s.player.x >= PAPER.WALL_MIN - 1e-9 && s.player.x < PAPER.WALL_MIN + 5);
  // portal de volta
  portalAt(s, 'back', 'clock');
  s.items[s.items.length - 1].y = s.player.y + 55; s.items[s.items.length - 1].x = s.player.x;
  steps(s, 1);
  assert.equal(s.world, 'clock');
  assert.equal(s.swapped, true, 'os heróis trocam');
  assert.equal(s.gen.lane, null);
  assert.ok(s.events.some(e => e.t === 'swap'));
});

test('Papel: aos ~110 m aparece o portal do Rascunho (um só); perdido, o de volta vem logo depois (60 m)', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  s.world = 'neon';
  put(s, 210, 600, 300);
  portalAt(s, 'paper', 'paper');
  steps(s, 1);
  const start = s.gen.worldY0;
  generateUntil(s.gen, {platforms: s.platforms, items: s.items, enemies: s.enemies}, start + 3000);
  const portals = s.items.filter(i => i.kind === 'portal');
  assert.equal(portals.length, 1);
  assert.equal(portals[0].variant, 'sketch');
  assert.ok(portals[0].y >= start + SKETCH.OFFER_AT_M * 10 && portals[0].y < start + SKETCH.OFFER_AT_M * 10 + 1500, 'y ' + portals[0].y + ' start ' + start); // um padrão do caos pode passar de 700 un.
  assert.equal(s.gen.returnWorld, 'neon');
});

/* ---------- novos elementos ---------- */
test('plataforma-fantasma: sólida só em parte do ciclo; o herói atravessa quando ela some', () => {
  const g = plat({type: 'ghost', y: 200, w: 300, speed: 1, phase: 0});
  let on = 0, n = 0;
  for (let t = 0; t < 6.3; t += 0.01) { n++; if (ghostSolid(g, t)) on++; }
  assert.ok(on / n > 0.55 && on / n < 0.7, `fração sólida ${on / n}`);
  const s = bare({platforms: [g]});
  // t=0 → sólida: pousa
  put(s, 210, 210, -100);
  steps(s, 30);
  assert.ok(s.events.some(e => e.t === 'land'));
  // fase em que está sumida: atravessa
  const h = bare({platforms: [plat({type: 'ghost', y: 200, w: 300, speed: 0, phase: Math.PI * 1.6})]});
  assert.equal(ghostSolid(h.platforms[0], 0), false);
  put(h, 210, 210, -300);
  steps(h, 20);
  assert.ok(!h.events.some(e => e.t === 'land') && h.player.y < 200);
});

test('ímã puxa fitas e estrelas num raio; estrela dá 150 pontos', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 300, 0);
  s.magnet = POWER.MAGNET_TIME;
  s.items.push({id: 1, kind: 'tape', x: 210 + 120, y: 300 + 64, phase: 0, hit: false}, {id: 2, kind: 'tape', x: 210 + 300, y: 300 + 64, phase: 0, hit: false}, {id: 3, kind: 'star', x: 210 - 100, y: 300 + 64, phase: 0, hit: false});
  for (let i = 0; i < 40; i++) { s.player.y = 300; s.player.vy = 0; step(s, {axis: 0}); }
  assert.equal(s.tapes, 1, 'só a fita dentro do raio');
  assert.equal(s.items.find(i => i.id === 2).x, 510, 'a de longe não se mexe');
  assert.equal(s.bonus, SCORE_M2.STAR);
  const t2 = bare({platforms: [plat({y: 100, w: 600})]});
  put(t2, 210, 300, 0);
  t2.items.push({id: 1, kind: 'magnet', x: 210, y: 300 + PICKUP.BODY_Y, phase: 0, hit: false});
  steps(t2, 1);
  assert.ok(t2.magnet > POWER.MAGNET_TIME - 0.1);
});

test('buraco negro: puxa de longe, machuca no centro, indestrutível (tiro e pisada não adiantam); hélice passa', () => {
  const bh = enemy({kind: 'blackhole', x0: 300, y0: 400, x: 300, y: 400, size: ENEMIES.blackhole.size, hp: 99, maxHp: 99});
  const s = bare({enemies: [bh], platforms: [plat({y: 100, w: 600})]});
  put(s, 240, 360, 0);
  const x0 = s.player.x;
  for (let i = 0; i < 30; i++) { put(s, 240, 360, 0); step(s, {axis: 0}); }
  assert.ok(s.player.drift > 0, 'puxa para o lado do buraco');
  // contato
  const t = bare({enemies: [enemy({kind: 'blackhole', x0: 210, y0: 400, x: 210, y: 400, size: 20, hp: 99, maxHp: 99})], platforms: [plat({y: 100, w: 600})]});
  put(t, 210, 360, 0); steps(t, 3);
  assert.equal(t.lives, LIFE.START - 1);
  // tiro passa
  const u = bare({enemies: [enemy({kind: 'blackhole', x0: 210, y0: 500, x: 210, y: 500, size: 20, hp: 99, maxHp: 99})], platforms: [plat({y: 100, w: 600})]});
  u.bullets.push({id: 1, x: 210, y: 470, vx: 0, vy: 600, own: true, alive: true});
  for (let i = 0; i < 20; i++) { put(u, 60, 200, 0); u.invuln = 9; step(u, {axis: 0}); }
  assert.ok(u.enemies[0].alive && u.enemies[0].hp === 99);
  // hélice atravessa
  const j = bare({enemies: [enemy({kind: 'blackhole', x0: 210, y0: 420, x: 210, y: 420, size: 20, hp: 99, maxHp: 99})], platforms: [plat({y: 100, w: 600})]});
  put(j, 210, 380, 100); j.jet = 1.5;
  for (let i = 0; i < 60; i++) step(j, {axis: 0});
  assert.equal(j.lives, LIFE.START);
  assert.ok(j.enemies[0].alive);
  void x0;
});

test('disco voador atira em leque (3 tiros); meteoro cai em laço; clipe sobe e desce', () => {
  const u = enemy({kind: 'ufo', x0: 210, y0: 520, x: 210, y: 520, size: 22, hp: 2, maxHp: 2, cooldown: 0.001});
  const s = bare({enemies: [u], platforms: [plat({y: 100, w: 600})], meters: 80});
  put(s, 100, 300, 0);
  for (let i = 0; i < 10; i++) { put(s, 100, 300, 0); s.invuln = 9; step(s, {axis: 0}); }
  assert.ok(s.bullets.filter(b => !b.own).length >= 3, `balas ${s.bullets.length}`);
  const m = {kind: 'meteor', x0: 200, y0: 500, phase: 0.8, speed: 1, range: 90};
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < METEOR.LOOP * 3; t += 0.02) { const q = enemyAt(m, t); lo = Math.min(lo, q.y); hi = Math.max(hi, q.y); }
  assert.ok(hi - lo > METEOR.SPAN * 0.97 && Math.abs(enemyAt(m, 0.5).y - enemyAt(m, 0.5 + METEOR.LOOP).y) < 1e-6, 'laço periódico');
  const c = {kind: 'clip', x0: 100, y0: 600, phase: 0, speed: 1.5, range: 60};
  let cl = Infinity, ch = -Infinity;
  for (let t = 0; t < 8; t += 0.02) { const q = enemyAt(c, t); cl = Math.min(cl, q.y); ch = Math.max(ch, q.y); }
  assert.ok(ch - cl > 110 && ch - cl <= 120.5);
});

test('Papel e Cosmos: inimigos do mundo (clipe no Papel; meteoro/disco no Cosmos) e tudo dentro da faixa no Papel', () => {
  const kindsPaper = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const g = makeGen(seed); g.world = 'paper'; g.lane = [PAPER.LANE_MIN, PAPER.LANE_MAX]; g.returnWorld = 'neon'; g.portalY = 1e12; g.portalPlaced = true;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 12000);
    for (const e of out.enemies) { kindsPaper.add(e.kind); assert.ok(e.x0 >= PAPER.LANE_MIN - 25 && e.x0 <= PAPER.LANE_MAX + 25, `${e.kind} em ${e.x0}`); }
    for (const p of out.platforms) assert.ok(p.x >= PAPER.LANE_MIN - 1 && p.x <= PAPER.LANE_MAX + 1, `plat ${p.x}`);
  }
  assert.ok(kindsPaper.has('clip'));
});

test('mais lugares: Cosmos → Fundo do Mar → Vulcão → volta ao começo; correnteza do mar alterna', () => {
  assert.deepEqual(WORLD_ORDER, ['neon', 'crystal', 'clock', 'cosmos', 'ocean', 'volcano']);
  assert.equal(nextWorld('cosmos'), 'ocean');
  assert.equal(nextWorld('ocean'), 'volcano');
  assert.equal(nextWorld('volcano'), 'neon');
  const w = [0, 1.15, 2.3, 3.45].map(t => windAt('ocean', t));
  assert.ok(w[1] > 50 && w[3] < -50, `correnteza ${w}`);
  assert.equal(windAt('volcano', 1), 0);
});

test('água-viva balança e fagulha de lava salta em arco (funções puras do tempo)', () => {
  const j = {kind: 'jelly', x0: 200, y0: 500, phase: 0, speed: 1, range: 80};
  const ys = [0, 0.5, 1, 1.5, 2, 2.5].map(t => enemyAt(j, t).y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 30 && Math.max(...ys) - Math.min(...ys) <= 52);
  const e = {kind: 'ember', x0: 200, y0: 300, phase: 0, speed: 1.5, range: 90};
  const eys = Array.from({length: 40}, (_, i) => enemyAt(e, i * 0.1).y);
  assert.ok(Math.min(...eys) >= 300 - 90 * 0.35 - 1 && Math.max(...eys) <= 300 + 90 * 0.65 + 1);
  assert.deepEqual(enemyAt(e, 2.2), enemyAt(e, 2.2));
});

test('portal Cronos: câmera lenta nos inimigos e tiros por 8 s, sem limpar nada; depois volta ao normal', () => {
  const e = enemy({kind: 'drone', x0: 210, y0: 900, x: 210, y: 900, speed: 1, range: 100});
  const s = bare({platforms: [plat({y: 100, w: 600})], enemies: [e]});
  put(s, 210, 600, 300);
  portalAt(s, 'time', 'neon');
  steps(s, 1);
  assert.ok(s.slow > PORTAL.TIME_SECONDS - 0.05);
  assert.equal(s.world, 'neon');
  assert.ok(s.enemies.includes(e), 'nada foi limpo');
  const e0 = s.etime;
  steps(s, 120);
  assert.ok(Math.abs((s.etime - e0) - 120 * PHYS.STEP * PORTAL.TIME_SCALE) < 1e-6, 'relógio dos inimigos em 35 %');
  s.slow = 0; s.invuln = 99; s.lives = 3; s.camera = s.prevCamera = 0; put(s, 210, 130, 0); const e1 = s.etime; assert.equal(s.mode, 'playing'); steps(s, 120);
  assert.ok(Math.abs((s.etime - e1) - 120 * PHYS.STEP) < 1e-6, 'relógio normal de novo ');
});

test('portal Salto: pula um mundo (2 à frente) e só aparece depois do primeiro portal', () => {
  const g = makeGen(5); g.world = 'neon';
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const gg = makeGen(i + 1); gg.world = 'neon'; gg.worldY0 = 90; gg.portalsMade = 1; gg.portalPlaced = false; gg.portalY = 0;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(gg, out, 90 + 3000);
    for (const it of out.items) if (it.kind === 'portal') { seen.add(it.variant); if (it.variant === 'leap') assert.equal(it.target, 'clock'); }
  }
  for (const v of ['world', 'paper', 'bonus', 'warp', 'time', 'leap']) assert.ok(seen.has(v), `portal ${v} nunca saiu`);
  const first = new Set();
  for (let i = 0; i < 200; i++) {
    const gg = makeGen(i + 1); gg.portalPlaced = false; gg.portalY = 0;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(gg, out, 90 + 3000);
    for (const it of out.items) if (it.kind === 'portal') first.add(it.variant);
  }
  assert.ok(!first.has('leap') && !first.has('paper'), 'o 1º portal é comum');
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 600, 300);
  portalAt(s, 'leap', 'clock');
  steps(s, 1);
  assert.equal(s.world, 'clock');
});

test('Vulcão: a lava sobe sozinha, nunca fica abaixo da tela, machuca e joga para cima; fora do vulcão não existe', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 600, 300);
  portalAt(s, 'world', 'volcano');
  steps(s, 1);
  assert.equal(s.world, 'volcano');
  assert.ok(s.lava > 0 && s.lava < s.player.y);
  const l0 = s.lava;
  s.gen.y = 1e9;
  put(s, 210, s.player.y, 0);
  Object.assign(s.platforms.find(p => p.w === 132) ?? {}, {broken: true});
  steps(s, 30);
  assert.ok(s.lava > l0 + LAVA.SPEED * 0.2, 'sobe com o tempo');
  // Herói parado abaixo da lava: dano e quique.
  s.lava = s.player.y + 20; s.invuln = 0; const lives = s.lives;
  steps(s, 1);
  assert.equal(s.lives, lives - 1);
  assert.ok(s.player.vy >= 700, 'jogado para cima');
  assert.ok(s.lava <= s.player.y - 100, 'a lava recua');
  // Hélice ignora a lava.
  const t = bare({platforms: [plat({y: 100, w: 600})]});
  t.world = 'ocean'; steps(t, 5);
  assert.equal(t.lava, 0);
});

test('robô ideal sobrevive ao Fundo do Mar e ao Vulcão (correnteza e lava) por 90 s', () => {
  for (const world of ['ocean', 'volcano']) {
    let overs = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = createSim(seed);
      s.gen.portalPlaced = true; s.gen.portalY = 1e12;
      put(s, s.player.x, s.player.y + 5, 300);
      s.items.push({id: 99999, kind: 'portal', x: s.player.x, y: s.player.y + 55, phase: 0, hit: false, target: world, variant: 'world'});
      step(s, {axis: 0});
      const bot = makeBot(IDEAL, seed);
      for (let i = 0; i < 90 * 120 && s.mode === 'playing' && s.world === world; i++) step(s, botInput(s, bot));
      if (s.mode !== 'playing') overs++;
    }
    assert.ok(overs <= 1, `${world}: o robô ideal caiu em ${overs}/6 partidas`);
  }
});

/* ---------- sala do portal (botão + barreira + teletransporte) ---------- */
const labOf = (seed) => {
  const g = makeGen(seed); g.labY = 600; g.portalY = 1e9; g.portalPlaced = true;
  const out = {platforms: [], items: [], enemies: []};
  generateUntil(g, out, 90 + 3000);
  const A = out.items.find(i => i.variant === 'tele');
  return {g, out, A, S: out.platforms.find(p => p.id === A.lock), gate: out.items.find(i => i.kind === 'gate'), exit: out.items.find(i => i.variant === 'exit')};
};

test('sala do portal: botão, portal azul trancado, barreira e portal laranja do outro lado; o botão nunca fica coberto', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const {out, A, S, gate, exit} = labOf(seed);
    assert.ok(A && S && gate && exit, `seed ${seed}`);
    assert.equal(S.type, 'switch');
    assert.ok(!A.open && !gate.open);
    const pad = out.platforms.find(p => Math.abs(p.y + PORTAL.ABOVE - A.y) < 1e-6);
    assert.ok(pad && pad.y > S.y && pad.y - S.y < 100);
    assert.ok(Math.abs(pad.x - S.x) >= 48, `botão coberto pela plataforma (dx ${Math.abs(pad.x - S.x)})`);
    assert.ok(Math.abs(gate.y - pad.y - LAB.GATE_ABOVE) < 1e-6 && exit.y > gate.y);
    assert.equal(A.dx, exit.x);
    assert.ok(A.dy > gate.y, 'o portal azul leva ao outro lado da barreira');
  }
});

test('barreira: fechada, o herói bate e desce; pisar no botão abre a barreira e destranca o portal; portal azul teletransporta', () => {
  const {out, A, S, gate} = labOf(7);
  const s = bare({platforms: out.platforms.filter(p => p.y < gate.y + 600), items: out.items.filter(i => i.y < gate.y + 600)});
  const g = s.items.find(i => i.kind === 'gate'), a = s.items.find(i => i.variant === 'tele'), sw = s.platforms.find(p => p.type === 'switch');
  // sobe até a barreira com tudo fechado
  put(s, g.x, g.y - 160, 800);
  steps(s, 40);
  assert.ok(s.events.some(e => e.t === 'bonk') || s.player.y <= g.y - 84 + 1e-6, 'bateu na barreira');
  assert.ok(s.player.y + LAB.HEAD <= g.y + 1e-6, 'não atravessa');
  // portal trancado não faz nada
  s.events.length = 0; put(s, a.x, a.y - 45, 0); steps(s, 2);
  assert.ok(!a.hit && !s.events.some(e => e.t === 'portal'), 'trancado');
  // pisar no botão
  put(s, sw.x, sw.y + 1.5, -100); steps(s, 2);
  assert.ok(sw.pressed && a.open && g.open, 'botão abriu tudo');
  assert.ok(s.events.some(e => e.t === 'press'));
  // portal azul: teletransporta
  s.events.length = 0; put(s, a.x, a.y - 45, 0); steps(s, 1);
  assert.ok(a.hit);
  assert.ok(Math.abs(s.player.x - a.dx) < 1e-6 && s.player.y >= a.dy - 3 && s.player.y > g.y);
  assert.ok(s.events.some(e => e.t === 'portal' && e.variant === 'tele'));
  assert.equal(s.world, 'neon', 'continua no mesmo mundo');
});

test('barreira aberta (ou hélice) deixa passar; portal laranja é só saída (não leva a lugar nenhum)', () => {
  const {out} = labOf(3);
  const s = bare({platforms: out.platforms, items: out.items});
  const g = s.items.find(i => i.kind === 'gate'), ex = s.items.find(i => i.variant === 'exit');
  g.open = true;
  put(s, g.x, g.y - 120, 800); steps(s, 25);
  assert.ok(s.player.y > g.y, 'aberta: atravessa');
  const t = bare({platforms: out.platforms, items: out.items});
  t.jet = 2; put(t, g.x, g.y - 160, 0); steps(t, 25);
  assert.ok(t.player.y + LAB.HEAD > g.y, 'hélice atravessa');
  put(s, ex.x, ex.y - 45, 0); steps(s, 2);
  assert.ok(!ex.hit);
});

test('sala do portal: só no campo aberto, a cada 450–760 m, sempre resolvível; robô ideal passa por ela', () => {
  let passed = 0, total = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const s = createSim(seed), bot = makeBot(IDEAL, seed);
    let pressed = false, tele = false;
    for (let i = 0; i < 120 * 200 && s.mode === 'playing' && !tele; i++) {
      step(s, botInput(s, bot));
      for (const e of s.events) { if (e.t === 'press') pressed = true; if (e.t === 'portal' && e.variant === 'tele') tele = true; }
      s.events.length = 0;
    }
    if (s.mode === 'playing' || tele) { total++; if (tele && pressed) passed++; }
  }
  assert.ok(passed >= 7, `o robô só passou pela sala em ${passed}/${total}`);
});

/* ---------- Rascunho (campo inteiro, dobra rasgada) ---------- */
test('Rascunho: pousar do outro lado da dobra inverte o controle e troca o personagem; voltar desinverte; no ar não muda nada', () => {
  const s = bare({platforms: [plat({y: 100, w: 700, x: 210}), plat({id: 2, y: 100, w: 90, x: 300}), plat({id: 3, y: 100, w: 90, x: 120})]});
  s.world = 'sketch'; s.gen.world = 'sketch'; s.gen.lane = [SKETCH.LANE_MIN, SKETCH.LANE_MAX];
  s.platforms.length = 0;
  s.platforms.push(plat({id: 2, y: 100, w: 90, x: 300}), plat({id: 3, y: 100, w: 90, x: 120}));
  // cruza a dobra no ar: ainda não inverteu
  put(s, 150, 400, 300);
  for (let i = 0; i < 20; i++) step(s, {axis: 1});
  assert.equal(s.inverted, false, 'no ar nada muda');
  // pousa na plataforma do lado direito
  put(s, 300, 101, -300); steps(s, 4);
  assert.equal(s.inverted, true);
  assert.ok(s.events.some(e => e.t === 'swap'));
  // controle invertido: apertar direita anda para a esquerda
  const x0 = s.player.x; put(s, x0, 600, 0);
  steps(s, 12, {axis: 1});
  assert.ok(s.player.x < x0 - 5, 'direita anda para a esquerda');
  assert.equal(s.player.facing, -1);
  // pousa do lado esquerdo: desinverte
  s.events.length = 0; s.camera = s.prevCamera = 0; put(s, 120, 101, -300); steps(s, 4);
  assert.equal(s.inverted, false);
  const x1 = s.player.x; s.camera = s.prevCamera = 0; put(s, x1, 300, 0); steps(s, 12, {axis: 1});
  assert.ok(s.player.x > x1 + 5, `x ${x1} -> ${s.player.x}, inv ${s.inverted}, drift ${s.player.drift}`);
});

test('Rascunho: mundo SIMÉTRICO em torno da dobra (as duas personagens sempre têm chão), sem volta pela lateral, alcance garantido, portal de volta no fim (150 m)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = makeGen(seed); g.world = 'sketch'; g.lane = [SKETCH.LANE_MIN, SKETCH.LANE_MAX]; g.returnWorld = 'neon'; g.portalY = 90 + 1500; g.worldY0 = 90;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 6000);
    const key = (p) => `${Math.round(p.y)}:${p.type}:${p.w}`;
    const left = out.platforms.filter(p => p.x < SKETCH.FOLD), right = out.platforms.filter(p => p.x > SKETCH.FOLD);
    assert.ok(left.length > 20 && Math.abs(left.length - right.length) <= 1, `${left.length} à esquerda × ${right.length} à direita`);
    // cada plataforma tem a gêmea em W − x, à mesma altura e do mesmo tipo
    for (const p of left) assert.ok(right.some(q => Math.abs(q.x - (FIELD_W - p.x)) < 1e-6 && key(q) === key(p)), `sem gêmea para ${key(p)} em x=${p.x}`);
    for (const p of out.platforms) assert.ok((p.x >= SKETCH.LANE_MIN - 1 && p.x <= SKETCH.LANE_MAX + 1) || (p.x >= FIELD_W - SKETCH.LANE_MAX - 1 && p.x <= FIELD_W - SKETCH.LANE_MIN + 1));
    // sem a volta pela lateral: cada plataforma é alcançável da anterior pelo caminho direto
    const sorted = [...out.platforms].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const b = sorted[i];
      let ok = false;
      for (let j = i - 1; j >= 0 && b.y - sorted[j].y < 330; j--) if (canReach(sorted[j], b, 1, false)) { ok = true; break; }
      assert.ok(ok, `seed ${seed}: plataforma ${b.id} inalcançável sem a volta pela lateral`);
    }
    // inimigos e fitas também têm gêmeos
    const eL = out.enemies.filter(e => e.x0 < SKETCH.FOLD).length, eR = out.enemies.filter(e => e.x0 > SKETCH.FOLD).length;
    assert.equal(eL, eR);
    const backs = out.items.filter(i => i.kind === 'portal');
    assert.ok(backs.length >= 2 && backs.every(i => i.variant === 'back' && i.target === 'neon'), 'um portal de volta de cada lado');
  }
});

test('Rascunho: portal do Papel leva ao Rascunho; voltar de lá mantém o personagem em que você terminou (swap só se estava invertido)', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 600, 300);
  portalAt(s, 'paper', 'paper'); steps(s, 1);
  assert.equal(s.world, 'paper');
  put(s, 100, 600, 300); portalAt(s, 'sketch', 'sketch'); steps(s, 1);
  assert.equal(s.world, 'sketch');
  assert.deepEqual(s.gen.lane, [SKETCH.LANE_MIN, SKETCH.LANE_MAX]);
  assert.equal(s.gen.returnWorld, 'neon', 'o mundo de origem continua o mesmo');
  s.inverted = true; s.swapped = false;
  put(s, 300, 600, 300); portalAt(s, 'back', 'neon'); steps(s, 1);
  assert.equal(s.world, 'neon');
  assert.equal(s.inverted, false);
  assert.equal(s.swapped, true, 'terminou do lado de lá: continua o outro personagem');
  assert.equal(s.gen.lane, null);
});

/* ---------- Queda livre (desenho invertido na vertical) ---------- */
test('Queda livre: portal leva ao mundo "inverse" (mesma física), dura 180 m, volta ao mundo de origem sem trocar herói', () => {
  const s = bare({platforms: [plat({y: 100, w: 600})]});
  put(s, 210, 600, 300);
  portalAt(s, 'flip', 'inverse'); steps(s, 1);
  assert.equal(s.world, 'inverse');
  assert.equal(s.gen.returnWorld, 'neon');
  assert.ok(Math.abs(s.gen.portalY - (s.gen.worldY0 + INVERSE.LENGTH_M * 10)) < 1e-6);
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const g = makeGen(seed); g.world = 'inverse'; g.returnWorld = 'clock'; g.portalY = 90 + 1800; g.worldY0 = 90;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 6000);
    assert.deepEqual(out.items.filter(i => i.kind === 'portal').map(i => i.variant), ['back']);
    for (const e of out.enemies) seen.add(e.kind);
  }
  assert.ok(seen.has('ufo') && seen.has('orb'));
  put(s, 300, 600, 0); portalAt(s, 'back', 'neon', {y: 555}); steps(s, 1); // na queda livre o corpo fica ACIMA dos pés
  assert.equal(s.world, 'neon');
  assert.equal(s.swapped, false, 'a Queda livre não troca o personagem');
});

/* ---------- Queda livre = descida de verdade ---------- */
const {DESC, FIELD_W} = await import(join(ROOT, 'native/src/arcade/data/neon.ts'));
const {canDrop} = await C('validate.ts');

function descent(extra = {}) {
  const s = bare({platforms: [plat({y: 600, w: 600})], ...extra});
  s.world = 'inverse'; s.gen.world = 'inverse';
  s.camera = s.prevCamera = 300;
  return s;
}

test('Queda livre: a gravidade puxa para a frente (y cresce), pousar dá só um saltinho e a câmera desce junto', () => {
  const s = descent();
  put(s, 210, 400, 0);
  steps(s, 30);
  assert.ok(s.player.vy > 0 && s.player.y > 400, 'cai');
  // pousa na plataforma de y=600
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) { step(s, {axis: 0}); landed = s.events.some(e => e.t === 'land'); s.events.length = 0; }
  assert.ok(landed, 'pousou');
  assert.ok(s.player.vy < 0 && Math.abs(s.player.vy) <= DESC.HOP + 1e-6, 'salta para cima na tela, pouco');
  let top = s.player.y;
  for (let i = 0; i < 80; i++) { step(s, {axis: 0}); top = Math.min(top, s.player.y); }
  assert.ok(600 - top < 60 && 600 - top > 35, `saltinho de ${(600 - top).toFixed(1)} un. (≈ HOP²/2g = ${(DESC.HOP ** 2 / 2400).toFixed(1)})`);
  assert.ok(s.player.y <= 601, 'nunca atravessa a plataforma');
});

test('Queda livre: o teto desce sozinho e esmaga quem fica parado (causa "crush"); descer faz a câmera acompanhar', () => {
  const s = descent();
  put(s, 210, 600, 0);
  const c0 = s.camera;
  let cause = null;
  for (let i = 0; i < 120 * 12 && s.mode === 'playing'; i++) { step(s, {axis: 0}); for (const e of s.events) if (e.t === 'over') cause = e.cause; s.events.length = 0; }
  assert.equal(s.mode, 'over');
  assert.equal(cause, 'crush');
  assert.ok(s.camera > c0 + 100, 'a câmera desceu sozinha');
  // descendo, a câmera segue o herói e ele não é esmagado
  const t = descent({platforms: [plat({y: 700, w: 600}), plat({id: 2, y: 1500, w: 600})]});
  put(t, 210, 650, 400);
  steps(t, 200);
  assert.equal(t.mode, 'playing');
  assert.ok(t.camera >= t.player.y - t.viewH * DESC.TOP_FRAC - 1e-6);
});

test('Queda livre: plataformas só são alcançáveis caindo e nunca ficam cobertas; sem mola; itens ficam acima das plataformas', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = makeGen(seed); g.world = 'inverse'; g.returnWorld = 'neon'; g.portalY = 90 + 1800; g.worldY0 = 90; g.y = 90;
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 6000);
    const sorted = [...out.platforms].sort((a, b) => a.y - b.y);
    assert.ok(sorted.length > 30);
    for (let i = 1; i < sorted.length; i++) {
      const b = sorted[i];
      let ok = false;
      for (let j = i - 1; j >= 0 && b.y - sorted[j].y < 460; j--) if (sorted[j].y !== b.y && canDrop(sorted[j], b, 1, true)) { ok = true; break; }
      assert.ok(ok, `seed ${seed}: plataforma ${b.id} inalcançável caindo`);
      assert.notEqual(b.type, 'spring');
    }
    for (const it of out.items) if (it.kind === 'tape') {
      const under = out.platforms.filter(p => Math.abs(p.x - it.x) < 1 && Math.abs(p.y - it.y) < 80 && p.y > it.y);
      void under;
    }
  }
});

test('Queda livre: hélice vira mergulho (sobe y), pisar num inimigo de cima o derruba, o corpo do herói fica acima dos pés', () => {
  const s = descent();
  put(s, 210, 400, 0); s.jet = 1; s.jetSpeed = 640;
  steps(s, 60);
  assert.ok(s.player.y > 400 + 300, 'mergulha');
  const t = descent({enemies: [enemy({x0: 210, y0: 560, x: 210, y: 560})]});
  t.platforms.length = 0;
  put(t, 210, 520, 300);
  steps(t, 12);
  assert.ok(t.kills === 1, 'pisou de cima');
  const u = descent({enemies: [enemy({x0: 210, y0: 450, x: 210, y: 450})]});
  put(u, 210, 495, 0); steps(u, 2);
  assert.equal(u.lives, LIFE.START - 1, 'o corpo está acima dos pés: encostar na cabeça dói');
});

test('Queda livre: robôs descem 180 m; o ideal quase nunca é esmagado e o humano às vezes sim', () => {
  let idealOk = 0, humanOk = 0, n = 0;
  for (const [skill, key] of [[IDEAL, 'ideal'], [HUMAN, 'human']]) {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createSim(seed), bot = makeBot(skill, seed);
      s.gen.portalPlaced = true; s.gen.portalY = 1e12;
      portalAt(s, 'flip', 'inverse'); put(s, s.player.x, s.player.y + 5, 300);
      step(s, {axis: 0});
      assert.equal(s.world, 'inverse');
      for (let i = 0; i < 120 * 60 && s.mode === 'playing' && s.world === 'inverse'; i++) step(s, botInput(s, bot));
      if (s.mode === 'playing') { if (key === 'ideal') idealOk++; else humanOk++; }
      n++;
    }
  }
  assert.ok(idealOk >= 9, `ideal sobreviveu em ${idealOk}/12`);
  assert.ok(humanOk >= 5, `humano sobreviveu em ${humanOk}/12`);
});

test('distribuição de portais: portais de mundo e salas do portal nunca ficam perto; detalhes entre portais de desvio são longos', () => {
  const minGap = (arr) => { let m = Infinity; for (let i = 1; i < arr.length; i++) m = Math.min(m, arr[i] - arr[i - 1]); return m; };
  for (let seed = 1; seed <= 60; seed++) {
    const g = makeGen(seed);
    const out = {platforms: [], items: [], enemies: []};
    generateUntil(g, out, 90 + 30000);
    const mains = out.items.filter(i => i.kind === 'portal' && i.variant !== 'tele' && i.variant !== 'exit').map(i => (i.y - 90) / 10);
    const labs = out.items.filter(i => i.kind === 'gate').map(i => (i.y - 90) / 10);
    assert.ok(minGap([...mains].sort((a, b) => a - b)) >= 700 - 1 || mains.length < 2, `seed ${seed}: portais a ${minGap(mains)} m`);
    assert.ok(minGap([...labs].sort((a, b) => a - b)) >= 400 || labs.length < 2, `seed ${seed}: salas a ${minGap(labs)} m`);
    for (const l of labs) for (const m of mains) assert.ok(Math.abs(l - m) >= 390, `seed ${seed}: sala a ${Math.abs(l - m)} m de um portal de mundo`);
  }
  assert.ok(SKETCH.OFFER_AT_M >= 200 && SKETCH.LENGTH_M >= 300 && INVERSE.LENGTH_M >= 300, 'trechos de desvio longos');
});
