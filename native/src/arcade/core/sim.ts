import {BLACKHOLE, COMBAT, ENEMIES, GEN, LAVA, LEVELS, LIFE, PAPER, PHYS, PICKUP, PORTAL, POWER, SCORE, SCORE_M2, WORLD_FX} from '../data/neon.ts';
import {enemyAt} from './enemies.ts';
import {jumpSpeed, landHalfWidth, platformX, vxMax, wrapX} from './physics.ts';
import {makeRng, range} from './rng.ts';
import {generateUntil, makeGen, metersAt, type Out} from './worldgen.ts';
import type {Enemy, Input, Item, Platform, PortalVariant, Sim, WorldId} from './types.ts';

/** Fração da altura da tela, a partir de baixo, onde fica a plataforma inicial. */
const START_SCREEN_FRAC = 0.14;

export function levelAt(meters: number): number {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) if (meters >= LEVELS[i].from) lv = i + 1;
  return lv;
}

/** O nível só regula a velocidade e os tiros; ele não é mostrado ao jogador. */
export function levelName(level: number): string {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))].name;
}

/** Cria uma partida. `viewH` = altura visível em unidades (690 no protótipo; maior em telas altas). */
export function createSim(seed: number, viewH = 690): Sim {
  const gen = makeGen(seed);
  const start: Platform = {
    id: 0,
    x: PHYS.START_X,
    y: PHYS.START_Y,
    w: PHYS.START_W,
    type: 'start',
    phase: 0,
    speed: 0,
    shift: 0,
    broken: false,
    pattern: 'start',
    dir: 0,
  };
  const camera = PHYS.START_Y - START_SCREEN_FRAC * viewH;
  const sim: Sim = {
    seed,
    tick: 0,
    time: 0,
    mode: 'playing',
    player: {
      x: PHYS.START_X,
      y: PHYS.START_Y,
      vx: 0,
      // Como no protótipo: a partida começa com o primeiro salto já em curso.
      vy: PHYS.JUMP,
      px: PHYS.START_X,
      py: PHYS.START_Y,
      landTimer: PHYS.LAND_TIME,
      facing: 1,
      drift: 0,
    },
    camera,
    prevCamera: camera,
    viewH,
    platforms: [start],
    items: [],
    enemies: [],
    bullets: [],
    gen,
    prng: makeRng(seed ^ 0x7f4a7c15),
    world: 'neon',
    lives: LIFE.START,
    shields: 0,
    boost: 0,
    jet: 0,
    invuln: 0,
    fireCd: 0,
    revive: 0,
    kills: 0,
    hits: 0,
    portals: 0,
    bonus: 0,
    magnet: 0,
    slow: 0,
    etime: 0,
    lava: 0,
    jetSpeed: POWER.JET_SPEED,
    swapped: false,
    bonusY0: 0,
    bonusY1: 0,
    score: 0,
    maxY: PHYS.START_Y,
    tapes: 0,
    combo: 0,
    comboTime: 0,
    level: 1,
    events: [],
  };
  ensureWorld(sim);
  return sim;
}

/** Ajusta a altura visível ANTES da primeira jogada (a tela só é medida depois de criada a partida). */
export function setViewH(sim: Sim, viewH: number) {
  if (sim.tick !== 0 || viewH === sim.viewH || !Number.isFinite(viewH) || viewH < 300 || viewH > 3000) return;
  sim.viewH = viewH;
  sim.camera = sim.prevCamera = PHYS.START_Y - START_SCREEN_FRAC * viewH;
  ensureWorld(sim);
}

function out(sim: Sim): Out {
  return {platforms: sim.platforms, items: sim.items, enemies: sim.enemies};
}

function ensureWorld(sim: Sim) {
  generateUntil(sim.gen, out(sim), sim.camera + sim.viewH + GEN.LOOKAHEAD);
}

function compact(sim: Sim) {
  const floor = sim.camera - GEN.KEEP_BEHIND;
  let n = 0;
  for (let i = 0; i < sim.platforms.length; i++) {
    const p = sim.platforms[i];
    if (!p.broken && p.y >= floor) sim.platforms[n++] = p;
  }
  sim.platforms.length = n;
  n = 0;
  for (let i = 0; i < sim.items.length; i++) {
    const it = sim.items[i];
    if (!it.hit && it.y >= floor) sim.items[n++] = it;
    else if (!it.hit && it.kind === 'portal') {
      // Portal que ficou para trás: o próximo vem mais adiante (não fica dois perto um do outro).
      sim.gen.portalPlaced = false;
      sim.gen.portalY = sim.gen.y + PORTAL.MISS_RETRY_M * 10;
    }
  }
  sim.items.length = n;
  n = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i];
    if (e.alive && e.y >= floor - 60) sim.enemies[n++] = e;
  }
  sim.enemies.length = n;
}

/** Vento do mundo (somado ao alvo horizontal). */
export function windAt(world: Sim['world'], time: number): number {
  if (world === 'crystal') return Math.sin((time * Math.PI * 2) / WORLD_FX.CRYSTAL_PERIOD) * WORLD_FX.CRYSTAL_WIND;
  if (world === 'ocean') return Math.sin((time * Math.PI * 2) / WORLD_FX.OCEAN_PERIOD) * WORLD_FX.OCEAN_CURRENT;
  return 0;
}

/* ---------- dano, abates, recuperação ---------- */

function kill(sim: Sim, e: Enemy, by: 'stomp' | 'shot' | 'jet') {
  e.alive = false;
  e.hp = 0;
  e.warn = false;
  sim.kills++;
  sim.bonus += e.kind === 'guardian' ? SCORE_M2.GUARDIAN : SCORE_M2.KILL;
  sim.events.push({t: 'kill', kind: e.kind, x: e.x, y: e.y, by});
}

function fatal(sim: Sim, cause: 'fall' | 'damage') {
  if (sim.revive > 0 && tryRevive(sim)) return;
  sim.mode = 'over';
  sim.events.push({t: 'over', cause});
}

/** Dano ao herói. Escudo absorve; hélice e invencibilidade ignoram. */
function hurt(sim: Sim, x: number, y: number, fromX: number) {
  const p = sim.player;
  if (sim.invuln > 0 || sim.jet > 0) return;
  if (sim.shields > 0) {
    sim.shields--;
    sim.invuln = LIFE.AFTER_SHIELD;
    sim.events.push({t: 'hit', x, y, blocked: true, lives: sim.lives});
  } else {
    sim.lives--;
    sim.hits++;
    sim.invuln = LIFE.AFTER_HIT;
    sim.combo = 0;
    sim.comboTime = 0;
    sim.events.push({t: 'hit', x, y, blocked: false, lives: sim.lives});
  }
  p.vy = Math.max(p.vy, COMBAT.KNOCKBACK_VY);
  p.drift += (p.x < fromX ? -1 : 1) * COMBAT.KNOCKBACK_VX;
  if (sim.lives <= 0) fatal(sim, 'damage');
}

/**
 * Recuperação (bandeira ou portal): volta numa plataforma firme da tela, com vidas cheias e alguns
 * segundos de invencibilidade. Uma só por carga.
 */
function tryRevive(sim: Sim): boolean {
  const p = sim.player;
  const lo = sim.camera + 70;
  const hi = sim.camera + sim.viewH * 0.5;
  let pick: Platform | null = null;
  for (const pl of sim.platforms) {
    if (pl.broken || (pl.type !== 'normal' && pl.type !== 'conveyor' && pl.type !== 'start')) continue;
    if (pl.y < lo || pl.y > hi) continue;
    if (!pick || pl.y > pick.y) pick = pl;
  }
  if (!pick) {
    // Nada firme à vista: apoia uma plataforma nova (e o gerador continua acima dela).
    pick = {id: sim.gen.nextId++, x: Math.max(100, Math.min(320, p.x)), y: sim.camera + sim.viewH * 0.3, w: 132, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'start', dir: 0};
    sim.platforms.push(pick);
  }
  sim.revive = 0;
  sim.lives = LIFE.START;
  sim.invuln = LIFE.AFTER_REVIVE;
  sim.combo = 0;
  sim.comboTime = 0;
  p.x = platformX(pick, sim.time);
  p.y = pick.y;
  p.px = p.x;
  p.py = p.y;
  p.vx = 0;
  p.vy = PHYS.JUMP;
  p.drift = 0;
  p.landTimer = PHYS.LAND_TIME;
  // Tela limpa de ameaças para a volta não começar em dano.
  for (const e of sim.enemies) if (e.alive && e.y < sim.camera + sim.viewH + 40) e.alive = false;
  sim.bullets.length = 0;
  sim.events.push({t: 'revive', x: p.x, y: p.y});
  return true;
}

/** Plataforma-fantasma: sólida só numa parte do ciclo (função pura do tempo). */
export function ghostSolid(pl: Pick<Platform, 'phase' | 'speed'>, time: number): boolean {
  const k = (((time * pl.speed + pl.phase) / (Math.PI * 2)) % 1 + 1) % 1;
  return k < 0.62;
}

function scheduleNextPortal(sim: Sim, from: number) {
  const g = sim.gen;
  g.portalPlaced = false;
  g.portalY = from + range(g.rng, PORTAL.GAP_M[0], PORTAL.GAP_M[1]) * 10;
}

/**
 * Atravessa o portal. Quatro tipos:
 * mundo (próximo universo) · papel (dois heróis espelhados; ao voltar, os heróis trocam) ·
 * bônus (chuva de fitas, volta sozinho) · atalho (hélice turbo que sobe centenas de metros).
 * Os três primeiros limpam o que estava à frente e criam um chão seguro; o jogo continua daí.
 */
function takePortal(sim: Sim, portal: Item) {
  const p = sim.player;
  const variant: PortalVariant = portal.variant ?? 'world';
  const target: WorldId = portal.target ?? sim.world;
  const g = sim.gen;
  sim.portals++;
  g.portalsMade++;
  sim.bonus += SCORE_M2.PORTAL;
  const world: WorldId = variant === 'back' ? (g.returnWorld ?? 'neon') : variant === 'paper' ? 'paper' : variant === 'world' || variant === 'leap' ? target : sim.world;
  sim.events.push({t: 'portal', world, variant, x: portal.x, y: portal.y});

  if (variant === 'warp') {
    // Atalho: voa invencível; o que tocar vira fumaça. Não limpa nada.
    portal.hit = true;
    sim.jet = PORTAL.WARP_TIME;
    sim.jetSpeed = PORTAL.WARP_SPEED;
    sim.invuln = Math.max(sim.invuln, PORTAL.WARP_TIME + 1);
    scheduleNextPortal(sim, p.y + PORTAL.WARP_SPEED * PORTAL.WARP_TIME);
    return;
  }

  if (variant === 'time') {
    // Cronos: câmera lenta (inimigos e tiros) por alguns segundos. Não limpa nada.
    portal.hit = true;
    sim.slow = PORTAL.TIME_SECONDS;
    scheduleNextPortal(sim, p.y);
    return;
  }

  const keep = p.y - 150;
  sim.platforms = sim.platforms.filter(pl => pl.y <= keep);
  sim.items = sim.items.filter(it => it.y <= keep && it !== portal);
  sim.enemies = sim.enemies.filter(e => e.y <= keep);
  sim.bullets.length = 0;
  const lane = world === 'paper' ? ([PAPER.LANE_MIN, PAPER.LANE_MAX] as [number, number]) : null;
  const sx = lane ? (lane[0] + lane[1]) / 2 : Math.max(92, Math.min(328, p.x));
  const safe: Platform = {id: g.nextId++, x: sx, y: p.y - 62, w: lane ? 84 : 132, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'start', dir: 0};
  sim.platforms.push(safe);
  sim.invuln = LIFE.AFTER_WORLD;
  if (variant !== 'bonus') sim.revive = 1;
  g.x = safe.x;
  g.y = safe.y;
  g.last = 'start';
  g.repeat = 0;
  g.lane = lane;
  g.nextEnemyY = safe.y + 360;
  g.nextPowerY = Math.max(g.nextPowerY, safe.y + 700);
  g.nextFlagY = Math.max(g.nextFlagY, safe.y + 1600);
  p.vy = Math.max(p.vy, 520);
  p.drift = 0;
  if (variant === 'bonus') {
    g.bonusEndY = safe.y + PORTAL.BONUS_M * 10;
    sim.bonusY0 = safe.y;
    sim.bonusY1 = g.bonusEndY;
    scheduleNextPortal(sim, g.bonusEndY);
  } else if (variant === 'paper') {
    g.returnWorld = sim.world;
    g.paperExitY = safe.y + PAPER.LENGTH_M * 10;
    sim.world = 'paper';
    g.world = 'paper';
    g.worldY0 = safe.y;
    g.portalPlaced = false;
    g.portalY = g.paperExitY;
    p.x = Math.max(PAPER.WALL_MIN, Math.min(PAPER.WALL_MAX, p.x));
  } else {
    if (variant === 'back') {
      sim.swapped = !sim.swapped;
      g.returnWorld = null;
      sim.events.push({t: 'swap', x: portal.x, y: portal.y});
    }
    sim.world = world;
    g.world = world;
    g.worldY0 = safe.y;
    sim.lava = world === 'volcano' ? safe.y - LAVA.GAP : 0;
    scheduleNextPortal(sim, safe.y);
  }
  ensureWorld(sim);
}

/* ---------- combate ---------- */

function onScreen(sim: Sim, y: number): boolean {
  return y > sim.camera + 50 && y < sim.camera + sim.viewH - 80;
}

function enemyShoot(sim: Sim, e: Enemy) {
  const p = sim.player;
  const dx = p.x - e.x;
  const dy = p.y + 38 - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const v = Math.min(COMBAT.ENEMY_BULLET_CAP, COMBAT.ENEMY_BULLET_BASE + sim.level * COMBAT.ENEMY_BULLET_PER_LEVEL);
  const mk = (vx: number, vy: number) => sim.bullets.push({id: sim.gen.nextId++, x: e.x, y: e.y, vx, vy, own: false, alive: true});
  mk((dx / d) * v, (dy / d) * v);
  if (e.kind === 'guardian') {
    const a = Math.atan2(dy, dx) + 0.23;
    mk(Math.cos(a) * v, Math.sin(a) * v);
  } else if (e.kind === 'ufo') {
    for (const da of [-0.32, 0.32]) {
      const a = Math.atan2(dy, dx) + da;
      mk(Math.cos(a) * v, Math.sin(a) * v);
    }
  }
  sim.events.push({t: 'shoot', own: false, x: e.x, y: e.y});
}

function combat(sim: Sim, input: Input, dt: number) {
  const p = sim.player;
  const meters = metersAt(sim.maxY);

  // Tiro do herói (para cima).
  if (input.fire && sim.fireCd <= 0) {
    sim.fireCd = COMBAT.FIRE_COOLDOWN;
    sim.bullets.push({id: sim.gen.nextId++, x: p.x, y: p.y + 72, vx: 0, vy: COMBAT.BULLET_SPEED, own: true, alive: true});
    sim.events.push({t: 'shoot', own: true, x: p.x, y: p.y + 72});
  }

  const ts = sim.slow > 0 ? PORTAL.TIME_SCALE : 1;
  let enemyBullets = 0;
  for (const b of sim.bullets) if (b.alive && !b.own) enemyBullets++;

  for (const e of sim.enemies) {
    if (!e.alive) continue;
    const pos = enemyAt(e, sim.etime);
    e.x = pos.x;
    e.y = pos.y;
    const spec = ENEMIES[e.kind];
    if (e.kind === 'blackhole') {
      // Indestrutível: puxa de longe e machuca no centro. A hélice passa por ele.
      if (sim.jet <= 0) {
        const bx = e.x - p.x, by = e.y - (p.y + 42);
        const dist = Math.hypot(bx, by);
        if (dist < BLACKHOLE.PULL_R) p.drift += Math.sign(bx || 1) * BLACKHOLE.PULL * (1 - dist / BLACKHOLE.PULL_R) * dt;
        if (dist < e.size + 16) { hurt(sim, p.x, p.y + 42, e.x); if (sim.mode !== 'playing') return; }
      }
      continue;
    }
    const visible = onScreen(sim, e.y);
    if (spec.shoots && visible && meters >= COMBAT.SHOOT_FROM_M) {
      e.cooldown -= dt * ts;
      const warn = e.cooldown < COMBAT.TELEGRAPH;
      if (warn && !e.warn) sim.events.push({t: 'warn', x: e.x, y: e.y});
      e.warn = warn;
      if (e.cooldown <= 0) {
        if (enemyBullets < COMBAT.ENEMY_BULLETS_MAX) {
          enemyShoot(sim, e);
          enemyBullets++;
        }
        const base = e.kind === 'turret' ? range(sim.prng, 3, 4.8) : e.kind === 'guardian' ? range(sim.prng, 2.8, 4.2) : range(sim.prng, 4.2, 6.6);
        e.cooldown = Math.max(2.4, base - sim.level * 0.2);
        e.warn = false;
      }
    } else e.warn = false;

    // Contato com o herói: hélice destrói; pisar de cima derruba; o resto machuca.
    const bodyY = p.y + 42;
    const dxAbs = Math.abs(p.x - e.x);
    const stomp = p.vy < -40 && dxAbs < e.size + 16 && p.y >= e.y - 6 && p.y <= e.y + e.size + 14;
    if (sim.jet > 0 && dxAbs < e.size + 8 && Math.abs(bodyY - e.y) < e.size + 20) kill(sim, e, 'jet');
    else if (stomp) {
      p.vy = COMBAT.STOMP_SPEED;
      p.landTimer = PHYS.LAND_TIME;
      if (e.kind === 'guardian' && e.hp > 1) {
        e.hp--;
        sim.events.push({t: 'hit', x: e.x, y: e.y, blocked: true, lives: sim.lives});
      } else kill(sim, e, 'stomp');
    } else if (dxAbs < e.size + 8 && Math.abs(bodyY - e.y) < e.size + 20) {
      hurt(sim, p.x, bodyY, e.x);
      if (sim.mode !== 'playing') return;
    }
  }

  // Balas.
  const top = sim.camera + sim.viewH + 120;
  const bottom = sim.camera - 90;
  for (const b of sim.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt * ts;
    b.y += b.vy * dt * ts;
    if (b.y < bottom || b.y > top || b.x < -30 || b.x > 450) { b.alive = false; continue; }
    if (b.own) {
      for (const e of sim.enemies) {
        if (!e.alive || e.kind === 'blackhole') continue;
        if (Math.abs(b.x - e.x) < e.size + 6 && Math.abs(b.y - e.y) < e.size + 8) {
          b.alive = false;
          e.hp--;
          if (e.hp <= 0) kill(sim, e, 'shot');
          else sim.events.push({t: 'hit', x: e.x, y: e.y, blocked: true, lives: sim.lives});
          break;
        }
      }
    } else if (Math.abs(b.y - (p.y + 42)) < 30 && Math.abs(b.x - p.x) < 20) {
      b.alive = false;
      hurt(sim, b.x, b.y, b.x);
      if (sim.mode !== 'playing') return;
    }
  }
  let n = 0;
  for (let i = 0; i < sim.bullets.length; i++) if (sim.bullets[i].alive) sim.bullets[n++] = sim.bullets[i];
  sim.bullets.length = n;
}

/** Um passo fixo (PHYS.STEP). Determinístico: mesmo estado + mesma entrada ⇒ mesmo resultado. */
export function step(sim: Sim, input: Input): void {
  if (sim.mode !== 'playing') return;
  const dt = PHYS.STEP;
  const p = sim.player;
  sim.tick++;
  sim.time = sim.tick * dt;
  p.px = p.x;
  p.py = p.y;
  sim.prevCamera = sim.camera;
  p.landTimer = Math.max(0, p.landTimer - dt);
  sim.comboTime = Math.max(0, sim.comboTime - dt);
  if (sim.comboTime === 0) sim.combo = 0;
  sim.invuln = Math.max(0, sim.invuln - dt);
  sim.fireCd = Math.max(0, sim.fireCd - dt);
  sim.boost = Math.max(0, sim.boost - dt);
  sim.magnet = Math.max(0, sim.magnet - dt);
  sim.etime += dt * (sim.slow > 0 ? PORTAL.TIME_SCALE : 1);
  sim.slow = Math.max(0, sim.slow - dt);
  if (sim.jet > 0) {
    sim.jet = Math.max(0, sim.jet - dt);
    if (sim.jet === 0) { sim.invuln = Math.max(sim.invuln, 0.8); sim.jetSpeed = POWER.JET_SPEED; } // sai da hélice protegido por um instante
  }

  // Horizontal: resposta exponencial ao alvo (independente do dt), mais vento do mundo e empurrão de esteira.
  const axis = Math.max(-1, Math.min(1, input.axis));
  if (axis !== 0) p.facing = axis > 0 ? 1 : -1;
  const target = axis * vxMax(sim.level) + windAt(sim.world, sim.time) + p.drift;
  p.drift *= Math.exp(-WORLD_FX.CLOCK_DECAY * dt);
  p.vx += (target - p.vx) * (1 - Math.exp(-PHYS.ACCEL_K * dt));
  if (sim.world === 'paper') {
    // Universo de Papel: não dá a volta pela lateral; a dobra e a parede seguram o herói.
    p.x = p.x + p.vx * dt;
    if (p.x <= PAPER.WALL_MIN) { p.x = PAPER.WALL_MIN; if (p.vx < 0) p.vx = 0; }
    else if (p.x >= PAPER.WALL_MAX) { p.x = PAPER.WALL_MAX; if (p.vx > 0) p.vx = 0; }
  } else p.x = wrapX(p.x + p.vx * dt);

  // Vertical: integração exata para aceleração constante (a altura do salto não depende do dt).
  const y0 = p.y;
  const vy0 = p.vy;
  let y1: number;
  let vy1: number;
  if (sim.jet > 0) {
    // Hélice: sobe em velocidade constante, sem gravidade.
    vy1 = sim.jetSpeed;
    y1 = y0 + vy1 * dt;
  } else {
    y1 = y0 + vy0 * dt - 0.5 * PHYS.G * dt * dt;
    vy1 = vy0 - PHYS.G * dt;
  }
  p.y = y1;
  p.vy = vy1;

  if (vy1 <= 0) {
    let hit: Platform | null = null;
    for (let i = 0; i < sim.platforms.length; i++) {
      const pl = sim.platforms[i];
      if (pl.broken) continue;
      if (pl.type === 'ghost' && !ghostSolid(pl, sim.time)) continue;
      if (y0 >= pl.y && y1 <= pl.y && Math.abs(p.x - platformX(pl, sim.time)) < landHalfWidth(pl)) {
        if (!hit || pl.y > hit.y) hit = pl;
      }
    }
    if (hit) {
      const drop = y0 - y1;
      const frac = drop > 0 ? (y0 - hit.y) / drop : 1;
      const rem = dt * (1 - frac);
      const v = jumpSpeed(hit.type, sim.boost > 0);
      p.y = hit.y + v * rem - 0.5 * PHYS.G * rem * rem;
      p.vy = v - PHYS.G * rem;
      p.landTimer = PHYS.LAND_TIME;
      if (hit.type === 'fragile') {
        hit.broken = true;
        sim.events.push({t: 'break', x: hit.x, y: hit.y});
      } else if (hit.type === 'conveyor') p.drift = (hit.dir || 1) * WORLD_FX.CLOCK_DRIFT;
      sim.events.push({t: 'land', plat: hit.type, x: p.x, y: hit.y});
    }
  }

  // Ímã: puxa fitas e estrelas que estiverem perto.
  if (sim.magnet > 0) {
    for (let i = 0; i < sim.items.length; i++) {
      const it = sim.items[i];
      if (it.hit || (it.kind !== 'tape' && it.kind !== 'star')) continue;
      const mx = p.x - it.x, my = p.y + PICKUP.BODY_Y - it.y;
      const md = Math.hypot(mx, my);
      if (md > 1 && md < POWER.MAGNET_R) { const k = Math.min(md, 560 * dt) / md; it.x += mx * k; it.y += my * k; }
    }
  }

  // Itens.
  for (let i = 0; i < sim.items.length; i++) {
    const it: Item = sim.items[i];
    if (it.hit) continue;
    if (it.kind === 'portal') {
      if (Math.abs(p.x - it.x) < PORTAL.HALF_W && Math.abs(p.y + 45 - it.y) < PORTAL.HALF_H) {
        it.hit = true;
        takePortal(sim, it);
        break; // a lista mudou
      }
      continue;
    }
    if (Math.abs(p.x - it.x) < PICKUP.HALF_W && Math.abs(p.y + PICKUP.BODY_Y - it.y) < PICKUP.HALF_H) {
      it.hit = true;
      if (it.kind === 'tape') {
        sim.tapes++;
        sim.combo = Math.min(SCORE.COMBO_MAX, sim.combo + 1);
        sim.comboTime = SCORE.COMBO_TIME;
        sim.events.push({t: 'collect', kind: 'tape', x: it.x, y: it.y, combo: sim.combo});
      } else {
        if (it.kind === 'shield') sim.shields = Math.min(LIFE.SHIELD_MAX, sim.shields + 1);
        else if (it.kind === 'boost') sim.boost = POWER.BOOST_TIME;
        else if (it.kind === 'jet') { sim.jet = POWER.JET_TIME; sim.jetSpeed = POWER.JET_SPEED; sim.bonus += SCORE_M2.POWER; }
        else if (it.kind === 'magnet') sim.magnet = POWER.MAGNET_TIME;
        else if (it.kind === 'star') sim.bonus += SCORE_M2.STAR;
        else if (it.kind === 'heart') { if (sim.lives < LIFE.MAX) sim.lives++; else sim.bonus += SCORE_M2.HEART; }
        else if (it.kind === 'flag') { if (sim.revive < 1) sim.revive = 1; else sim.bonus += SCORE_M2.FLAG; }
        sim.events.push({t: 'pickup', kind: it.kind, x: it.x, y: it.y});
      }
    }
  }

  // Inimigos, tiros e dano.
  combat(sim, input, dt);
  if (sim.mode !== 'playing') return;

  // Altura, pontos, nível (interno).
  if (p.y > sim.maxY) sim.maxY = p.y;
  const meters = metersAt(sim.maxY);
  sim.score =
    Math.max(0, Math.floor((sim.maxY - PHYS.START_Y) / SCORE.HEIGHT_DIV)) +
    sim.tapes * SCORE.TAPE +
    Math.max(0, sim.combo - 1) * SCORE.COMBO_STEP +
    sim.bonus;
  sim.level = levelAt(meters);

  // A câmera só sobe.
  sim.camera = Math.max(sim.camera, p.y - sim.viewH * PHYS.FOLLOW);
  ensureWorld(sim);
  if (sim.tick % 30 === 0) compact(sim);

  if (sim.world === 'volcano') lavaStep(sim, dt);
  else sim.lava = 0;

  if (p.y < sim.camera - PHYS.FALL_MARGIN) fatal(sim, 'fall');
}

/** Vulcão: a lava sobe sozinha (nunca abaixo da base da tela); encostar machuca e joga o herói para cima. */
function lavaStep(sim: Sim, dt: number) {
  const p = sim.player;
  if (sim.lava <= 0) sim.lava = sim.camera - 40;
  sim.lava = Math.max(sim.lava + LAVA.SPEED * dt, sim.camera - 40);
  if (sim.jet > 0) { sim.lava = Math.max(sim.camera - 40, Math.min(sim.lava, p.y - LAVA.GAP)); return; }
  if (p.y < sim.lava) {
    hurt(sim, p.x, sim.lava, p.x);
    if (sim.mode !== 'playing') return;
    p.vy = Math.max(p.vy, 760);
    sim.lava = Math.max(sim.camera - 40, p.y - LAVA.RESET_GAP);
  }
}

/** Metros alcançados (para HUD/recorde). */
export function metersOf(sim: Sim): number {
  return Math.floor(metersAt(sim.maxY));
}

/** Hash curto do estado: testes de determinismo e repetição (fantasma). */
export function hashSim(sim: Sim): string {
  let h = 2166136261;
  const mix = (n: number) => {
    const v = Math.round(n * 1e5) | 0;
    h = Math.imul(h ^ (v & 0xffff), 16777619);
    h = Math.imul(h ^ ((v >>> 16) & 0xffff), 16777619);
  };
  mix(sim.tick);
  mix(sim.player.x);
  mix(sim.player.y);
  mix(sim.player.vx);
  mix(sim.player.vy);
  mix(sim.camera);
  mix(sim.score);
  mix(sim.tapes);
  mix(sim.platforms.length);
  mix(sim.gen.count);
  mix(sim.lives);
  mix(sim.shields);
  mix(sim.enemies.length);
  mix(sim.bullets.length);
  mix(sim.kills);
  mix(sim.portals);
  mix(sim.world.length + (sim.swapped ? 7 : 0));
  mix(sim.magnet);
  mix(sim.etime);
  mix(sim.lava);
  for (const pl of sim.platforms) { mix(pl.x); mix(pl.y); mix(pl.w); }
  for (const e of sim.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
