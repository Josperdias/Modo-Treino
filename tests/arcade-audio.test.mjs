// NEON STEP DX — áudio: mapeamento eventos→sons, trilha por parte, arquivos gerados e padrões do save (sem expo-audio).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUD = join(ROOT, 'native/assets/arcade/audio');
const {cuesFor, musicFor, stingerFor, lavaClose, Limiter, GAPS} = await import(join(ROOT, 'native/src/arcade/audio/plan.ts'));
const {DEFAULT_SAVE, normalizeSave} = await import(join(ROOT, 'native/src/arcade/save.ts'));
const {WORLD_ORDER, DETOURS} = await import(join(ROOT, 'native/src/arcade/data/neon.ts'));

const files = d => readdirSync(join(AUD, d)).filter(f => f.endsWith('.ogg')).map(f => f.slice(0, -4));
const MUSIC = new Set(files('musica'));
const SFX = new Set(files('sfx'));
const ctx = (o = {}) => ({phase: 'play', world: 'neon', y: 500, bonusY0: 0, bonusY1: 0, ...o});

test('som: desligado por padrão e save normaliza', () => {
  assert.equal(DEFAULT_SAVE.settings.sfx, false);
  assert.equal(DEFAULT_SAVE.settings.music, false);
  assert.equal(normalizeSave({settings: {sfx: 'sim', music: 1}}).settings.sfx, false);
  assert.equal(normalizeSave({settings: {sfx: true, music: true}}).settings.music, true);
  assert.equal(DEFAULT_SAVE.settings.volume, 2);
  assert.equal(normalizeSave({settings: {volume: 3}}).settings.volume, 3);
  assert.equal(normalizeSave({settings: {volume: 1}}).settings.volume, 1);
  assert.equal(normalizeSave({settings: {volume: 9}}).settings.volume, 2);
  assert.deepEqual(normalizeSave({}).settings, DEFAULT_SAVE.settings);
});

test('trilha: uma faixa para cada parte, todas existem', () => {
  assert.equal(musicFor(ctx({phase: 'select'})), 'menu');
  assert.equal(musicFor(ctx({phase: 'over'})), null);
  for (const w of [...WORLD_ORDER, ...DETOURS]) {
    const id = musicFor(ctx({world: w}));
    assert.equal(id, w, `mundo ${w}`);
    assert.ok(MUSIC.has(id), `falta musica/${id}.ogg`);
  }
  assert.equal(musicFor(ctx({world: 'cosmos', y: 1500, bonusY0: 1000, bonusY1: 2000})), 'bonus');
  assert.equal(musicFor(ctx({world: 'cosmos', y: 2500, bonusY0: 1000, bonusY1: 2000})), 'cosmos');
  assert.ok(MUSIC.has('menu') && MUSIC.has('bonus'));
});

test('eventos: todo som pedido existe como arquivo', () => {
  const evs = [];
  for (const plat of ['start', 'normal', 'moving', 'fragile', 'spring', 'conveyor', 'ghost', 'switch']) evs.push({t: 'land', plat, x: 0, y: 0});
  for (const combo of [0, 1, 2, 3, 4, 5, 9]) evs.push({t: 'collect', kind: 'tape', x: 0, y: 0, combo});
  evs.push({t: 'break', x: 0, y: 0});
  for (const kind of ['tape', 'shield', 'boost', 'jet', 'heart', 'flag', 'portal', 'magnet', 'star', 'gate']) evs.push({t: 'pickup', kind, x: 0, y: 0});
  for (const blocked of [true, false]) for (const lives of [1, 3]) evs.push({t: 'hit', x: 0, y: 0, blocked, lives});
  for (const kind of ['drone', 'guardian', 'blackhole', 'jelly']) for (const by of ['stomp', 'shot', 'jet']) evs.push({t: 'kill', kind, x: 0, y: 0, by});
  for (const own of [true, false]) evs.push({t: 'shoot', own, x: 0, y: 0});
  evs.push({t: 'warn', x: 0, y: 0}, {t: 'swap', x: 0, y: 0}, {t: 'press', x: 0, y: 0}, {t: 'bonk', x: 0, y: 0}, {t: 'revive', x: 0, y: 0});
  for (const variant of ['world', 'paper', 'bonus', 'warp', 'back', 'time', 'leap', 'flip', 'sketch', 'tele', 'exit']) evs.push({t: 'portal', world: 'neon', variant, x: 0, y: 0});
  for (const cause of ['fall', 'damage', 'crush']) evs.push({t: 'over', cause});
  let n = 0;
  for (const e of evs) for (const c of cuesFor(e)) {
    n++;
    assert.ok(SFX.has(c.id), `falta sfx/${c.id}.ogg (${e.t})`);
    assert.ok(c.gain > 0 && c.gain <= 1);
  }
  assert.ok(n > 60);
  assert.ok(SFX.has(stingerFor(true)) && SFX.has(stingerFor(false)) && SFX.has('lava_warn') && SFX.has('ui_start') && SFX.has('ui_pause') && SFX.has('tape_load'));
});

test('eventos: casos específicos', () => {
  assert.deepEqual(cuesFor({t: 'collect', kind: 'tape', x: 0, y: 0, combo: 9}).map(c => c.id), ['tape5']);
  assert.deepEqual(cuesFor({t: 'hit', x: 0, y: 0, blocked: false, lives: 1}).map(c => c.id), ['hit', 'life_low']);
  assert.deepEqual(cuesFor({t: 'hit', x: 0, y: 0, blocked: true, lives: 2}).map(c => c.id), ['shield_block']);
  assert.deepEqual(cuesFor({t: 'kill', kind: 'guardian', x: 0, y: 0, by: 'stomp'}).map(c => c.id), ['kill_big', 'stomp']);
  assert.deepEqual(cuesFor({t: 'portal', world: 'neon', variant: 'exit', x: 0, y: 0}).map(c => c.id), ['portal_tele']);
  assert.deepEqual(cuesFor({t: 'over', cause: 'damage'}).map(c => c.id), ['tape_stop']);
  assert.equal(cuesFor({t: 'pickup', kind: 'gate', x: 0, y: 0}).length, 0);
});

test('lava e limitador', () => {
  assert.equal(lavaClose('volcano', 500, 400), true);
  assert.equal(lavaClose('volcano', 900, 400), false);
  assert.equal(lavaClose('neon', 500, 400), false);
  assert.equal(lavaClose('volcano', 500, 0), false);
  const l = new Limiter(GAPS);
  assert.equal(l.filter([{id: 'land_normal', gain: 1}], 1000).length, 1);
  assert.equal(l.filter([{id: 'land_normal', gain: 1}], 1030).length, 0);
  assert.equal(l.filter([{id: 'land_normal', gain: 1}], 1200).length, 1);
  const burst = Array.from({length: 12}, (_, i) => ({id: `x${i}`, gain: 1}));
  assert.equal(new Limiter().filter(burst, 0).length, 5);
});

test('arquivos gerados: manifesto cobre tudo, tamanhos sãos, sem silêncio', () => {
  const ts = readFileSync(join(ROOT, 'native/src/arcade/audio/assets.ts'), 'utf8');
  for (const id of MUSIC) assert.match(ts, new RegExp(`${id}: require\\('../../../assets/arcade/audio/musica/${id}.ogg'\\)`));
  for (const id of SFX) assert.match(ts, new RegExp(`${id}: require\\('../../../assets/arcade/audio/sfx/${id}.ogg'\\)`));
  assert.equal(MUSIC.size, 11);
  assert.ok(SFX.size >= 50);
  let total = 0;
  for (const id of MUSIC) { const b = statSync(join(AUD, 'musica', `${id}.ogg`)).size; total += b; assert.ok(b > 100e3 && b < 1.2e6, `${id} ${b}`); }
  for (const id of SFX) { const b = statSync(join(AUD, 'sfx', `${id}.ogg`)).size; total += b; assert.ok(b > 1e3 && b < 60e3, `${id} ${b}`); }
  assert.ok(total < 10e6, `áudio do jogo pesa ${total}`);
  const rep = JSON.parse(readFileSync(join(ROOT, 'docs/neon-step-dx/AUDIT_audio.json'), 'utf8'));
  for (const id of MUSIC) {
    const m = rep.musica[id];
    assert.ok(m, id);
    assert.ok(m.pico_dBFS <= -1 && m.pico_dBFS > -12, `${id} pico ${m.pico_dBFS}`);
    assert.ok(m.silencio_pct < 5, `${id} silêncio ${m.silencio_pct}`);
    assert.ok(m.duracao_s >= 20, `${id} curta`);
    assert.ok(m.emenda_loop < 1.5, `${id} emenda ${m.emenda_loop}`);
  }
  for (const id of SFX) assert.ok(rep.sfx[id] && rep.sfx[id].pico_dBFS < 0, id);
  assert.ok(existsSync(join(ROOT, 'scripts/arcade_audio/build.py')));
});
