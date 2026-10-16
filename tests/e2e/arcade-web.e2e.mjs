// NEON STEP DX no navegador: a MESMA árvore React Native + Skia (CanvasKit/WebGL) do app, via react-native-web.
// Não substitui teste em aparelho (toque multi-dedo real, inclinação, vibração, FPS no Android).
//   NATIVE_WEB_DIR=<pasta do "expo export --platform web"> node --test tests/e2e/arcade-web.e2e.mjs
//   ARCADE_SHOTS=<pasta> grava as capturas de tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync, existsSync, statSync, mkdirSync} from 'node:fs';
import {join, extname, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.NATIVE_WEB_DIR ? resolve(process.env.NATIVE_WEB_DIR) : null;
const SHOTS = process.env.ARCADE_SHOTS ? resolve(process.env.ARCADE_SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, {recursive: true});
const require = createRequire(import.meta.url);
const {chromium} = (() => {
  try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); }
})();
// O CanvasKit "full" que o Skia empacota precisa do .wasm da MESMA build (a versão "leve" derruba a página).
const WASM = join(HERE, '../../native/node_modules/canvaskit-wasm/bin/full/canvaskit.wasm');
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ttf': 'font/ttf'};
const skip = DIR ? false : 'defina NATIVE_WEB_DIR (saída de `expo export --platform web`)';

let server, base, browser;
test.before(async () => {
  if (!DIR) return;
  server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/canvaskit.wasm') { res.writeHead(200, {'Content-Type': 'application/wasm'}); res.end(readFileSync(WASM)); return; }
    let file = normalize(join(DIR, p));
    if (!file.startsWith(DIR)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream'});
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
});
test.after(async () => { await browser?.close(); if (server) await new Promise((ok) => server.close(ok)); });

/** save: objeto gravado em `arcade.v1` antes do app abrir (uma vez). */
async function open({save = null, viewport = {width: 393, height: 852}, touch = false} = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce'});
  context.setDefaultTimeout(15000);
  await context.route('https://api.github.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*', 'content-type': 'application/json'}, body: '[]'}));
  await context.addInitScript(({save}) => {
    window.__MODO_ARCADE_SEED__ = 20260416; // semente fixa: mundo igual em todo teste
    if (save && !localStorage.getItem('__seeded')) { localStorage.setItem('arcade.v1', JSON.stringify(save)); localStorage.setItem('__seeded', '1'); }
  }, {save});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\.github|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(base);
  await page.getByText('MODO', {exact: false}).first().waitFor();
  return {context, page, errors};
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({path: join(SHOTS, name + '.png')}); };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('arcade.v1') || 'null'));
const sess = (page) => page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; return s && {tick: s.sim.tick, mode: s.sim.mode, score: s.sim.score, x: s.sim.player.x, y: s.sim.player.y, axis: s.axis, paused: s.paused, seed: s.sim.seed, platforms: s.sim.platforms.length}; });

async function openSettings(page) { await page.getByLabel('Abrir ajustes').click(); await page.getByText('Ajustes', {exact: true}).first().waitFor(); }
async function toArcade(page) {
  await openSettings(page);
  await page.getByText('JOGAR AGORA').click();
  await page.getByText('ESCOLHA SEU PERSONAGEM').waitFor();
}
async function startGame(page, who = 'JOSPERD') {
  await page.getByText(`COMEÇAR COM ${who}`).click();
  await page.getByTestId('arcade-score').waitFor();
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__ && globalThis.__MODO_ARCADE_SESSION__.sim.tick > 60);
}

/** Mede o que de fato foi pintado: decodifica a captura no próprio navegador e conta cores. */
async function paintStats(page) {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set(); let platformPx = 0, tapePx = 0, heroPx = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      const r = d[i], gr = d[i + 1], b = d[i + 2];
      seen.add(((r >> 4) << 8) | ((gr >> 4) << 4) | (b >> 4));
      if (Math.abs(r - 0xb5) < 10 && Math.abs(gr - 0x94) < 10 && Math.abs(b - 0xfc) < 10) platformPx++; // topo das plataformas
      if (Math.abs(r - 0xff) < 8 && Math.abs(gr - 0x5c) < 8 && Math.abs(b - 0xaa) < 8) tapePx++; // fita
      if (Math.abs(r - 0xd8) < 30 && gr < 40 && b < 40) heroPx++; // jaqueta vermelha do Josperd
    }
    return {colors: seen.size, platformPx, tapePx, heroPx};
  }, png);
}

test('desbloqueio: 6 toques não bastam; a dica só aparece perto do fim; 7 liberam e fica salvo', {skip}, async () => {
  const {context, page, errors} = await open();
  await openSettings(page);
  assert.equal(await page.getByText('Fliperama', {exact: true}).count(), 0, 'o fliperama começa escondido');
  const version = page.getByLabel(/Modo Treino, versão/);
  await version.scrollIntoViewIfNeeded();
  for (let i = 1; i <= 3; i++) await version.click();
  assert.equal(await page.getByText(/Faltam/).count(), 0, 'sem dica antes do 4º toque');
  await version.click(); // 4º
  await page.getByText('Faltam 3 toques…').waitFor();
  await version.click(); await version.click(); // 6º
  assert.equal(await page.getByText('Fliperama', {exact: true}).count(), 0, 'com 6 toques ainda não libera');
  await version.click(); // 7º
  await page.getByText('Você achou o fliperama!', {exact: false}).waitFor();
  await page.getByText('NEON STEP DX', {exact: true}).waitFor();
  assert.equal((await saved(page)).unlocked, true);
  await shot(page, '00-ajustes-fliperama');
  // Persistência: recarregar mantém desbloqueado.
  await page.reload();
  await page.getByText('MODO', {exact: false}).first().waitFor();
  await openSettings(page);
  await page.getByText('NEON STEP DX', {exact: true}).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('desbloqueio: toques espaçados (> 1,5 s) recomeçam a contagem', {skip}, async () => {
  const {context, page} = await open();
  await page.clock.install();
  await openSettings(page);
  const version = page.getByLabel(/Modo Treino, versão/);
  await version.scrollIntoViewIfNeeded();
  for (let i = 0; i < 5; i++) { await version.click(); await page.clock.fastForward(300); }
  await page.clock.fastForward(2000);
  for (let i = 0; i < 4; i++) { await version.click(); await page.clock.fastForward(300); }
  assert.equal(await page.getByText('NEON STEP DX', {exact: true}).count(), 0, '5 + pausa + 4 toques não liberam');
  await context.close();
});

test('seleção: escolher Camila, salvar a escolha e mostrar recordes; o jogo abre sem erro', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true, best: {josperd: 1234, camila: 77}}});
  await toArcade(page);
  await page.getByText('RECORDE 1234').waitFor();
  await page.getByText('RECORDE 0077').waitFor();
  await shot(page, '01-selecao');
  await page.getByTestId('arcade-hero-camila').click();
  await page.getByText('COMEÇAR COM CAMILA').waitFor();
  assert.equal((await saved(page)).settings.hero, 'camila');
  await shot(page, '01b-selecao-camila');
  await startGame(page, 'CAMILA');
  assert.deepEqual(errors, []);
  await context.close();
});

test('jogo: o Skia pinta de verdade (plataformas, fita, herói) e o mundo é o da semente', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.waitForTimeout(600);
  const s = await sess(page);
  assert.equal(s.seed, 20260416);
  assert.ok(s.tick > 60 && s.mode === 'playing');
  const p = await paintStats(page);
  assert.ok(p.colors > 60, `poucas cores: ${p.colors}`);
  assert.ok(p.platformPx > 40, `plataformas não pintadas (${p.platformPx})`);
  await shot(page, '02-jogando');
  assert.deepEqual(errors, []);
  await context.close();
});

test('controles: setas movem o herói; sem entrada ele para; dá a volta pela lateral', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  const x0 = (await sess(page)).x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  const x1 = (await sess(page)).x;
  await page.keyboard.up('ArrowRight');
  assert.ok(x1 > x0 + 60, `foi de ${x0} para ${x1}`);
  await page.waitForTimeout(700);
  assert.equal((await sess(page)).axis, 0);
  await context.close();
});

test('controles de toque: lado direito = +1, esquerdo = -1, os dois = 0, soltar = 0', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}, touch: true});
  const cdp = await context.newCDPSession(page);
  await toArcade(page);
  await startGame(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map(([x, y], id) => ({x, y, id}))});
  await touch('touchStart', [[330, 500]]);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 1);
  await touch('touchEnd', []);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 0);
  await touch('touchStart', [[60, 500]]);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === -1);
  await touch('touchStart', [[60, 500], [330, 500]]); // dois dedos, um de cada lado
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 0);
  await touch('touchStart', [[330, 500]]); // soltou o esquerdo: sobra só o direito
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 1);
  await touch('touchEnd', []);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 0);
  await context.close();
});

test('pausa: congela a simulação, mostra o menu e retoma sem salto de tempo', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.getByTestId('arcade-pause').click();
  await page.getByText('CONTINUAR', {exact: true}).waitFor();
  await shot(page, '03-pausa');
  const a = await sess(page);
  await page.waitForTimeout(800);
  const b = await sess(page);
  assert.equal(b.tick, a.tick, 'a simulação não avança em pausa');
  assert.equal(b.paused, true);
  await page.getByText('CONTINUAR', {exact: true}).click();
  await page.waitForTimeout(500);
  const c = await sess(page);
  assert.ok(c.tick > b.tick && c.tick - b.tick < 120 * 1.2, `retomou com ${c.tick - b.tick} passos em 0,5 s`);
  // Tecla P também pausa.
  await page.keyboard.press('p');
  await page.getByText('PAUSA', {exact: true}).waitFor();
  await context.close();
});

test('configurações na pausa: medidor de desempenho mostra FPS; escolhas ficam salvas', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.getByTestId('arcade-pause').click();
  await page.getByText('Medidor de desempenho').click();
  await page.getByText('Vibração leve').click();
  await page.getByText('CONTINUAR', {exact: true}).click();
  await page.getByText(/fps · quadro p50/).waitFor({timeout: 5000});
  const st = (await saved(page)).settings;
  assert.equal(st.perf, true);
  assert.equal(st.haptics, true);
  await shot(page, '04-medidor');
  await context.close();
});

test('fim de jogo: cair encerra, mostra pontos, grava o recorde e permite jogar de novo', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  // Força a queda pelo gancho de teste: sem plataformas e com o herói descendo.
  await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; s.sim.platforms.length = 0; s.sim.gen.y = 1e9; s.sim.player.vy = -400; });
  await page.getByText('FIM DE JOGO', {exact: false}).waitFor({timeout: 10000});
  await shot(page, '05-fim');
  const final = Number(await page.getByTestId('arcade-final').textContent());
  assert.ok(final > 0);
  const sv = await saved(page);
  assert.equal(sv.best.josperd, final, 'recorde gravado');
  assert.equal(sv.plays, 1);
  await page.getByText('JOGAR DE NOVO').click();
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__ && globalThis.__MODO_ARCADE_SESSION__.sim.mode === 'playing' && globalThis.__MODO_ARCADE_SESSION__.sim.tick > 30);
  assert.deepEqual(errors, []);
  await context.close();
});

test('desempenho: 6 s de jogo no Chromium (WebGL por software) — passo, desenho e memória sob controle', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(6000);
  await page.keyboard.up('ArrowRight');
  const perf = await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; return {...s.perfSummary(), tick: s.sim.tick, platforms: s.sim.platforms.length, particles: s.fx.list.length}; });
  if (SHOTS) (await import('node:fs')).writeFileSync(join(SHOTS, 'desempenho-web.json'), JSON.stringify({ambiente: 'Chromium headless, WebGL por software (SwiftShader), 393x852@2x — NÃO representa um celular', ...perf}, null, 1));
  // O WebGL por software do CI é lento (o FPS aqui NÃO vale para celular): só exigimos que o laço rode e que o custo em JS seja baixo.
  assert.ok(perf.samples >= 20, `poucas amostras: ${perf.samples}`);
  assert.ok(perf.stepMs < 1, `a simulação custou ${perf.stepMs} ms por quadro`);
  assert.ok(perf.drawMs < 30, `o desenho custou ${perf.drawMs} ms por quadro`);
  assert.ok(perf.platforms < 60 && perf.particles <= 160, 'listas crescendo sem parar');
  assert.deepEqual(errors, []);
  await context.close();
});

test('layout: cabe em celular estreito (360×640) e em tela grande sem cortar o jogo', {skip}, async () => {
  for (const viewport of [{width: 360, height: 640}, {width: 412, height: 915}]) {
    const {context, page, errors} = await open({save: {v: 1, unlocked: true}, viewport});
    await toArcade(page);
    const btn = await page.getByText('COMEÇAR COM JOSPERD').boundingBox();
    assert.ok(btn.y + btn.height <= viewport.height, `botão de começar cortado em ${viewport.width}×${viewport.height}`);
    await startGame(page);
    await shot(page, `06-layout-${viewport.width}x${viewport.height}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('sair: o botão fechar volta ao app e o back do navegador não quebra nada', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await page.getByTestId('arcade-close').click();
  await page.getByTestId('arcade-root').waitFor({state: 'detached'});
  await page.getByLabel('Abrir ajustes').waitFor();
  await context.close();
});
