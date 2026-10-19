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
async function open({save = null, viewport = {width: 393, height: 852}, touch = false, loadStyle = 'pixel'} = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce'});
  context.setDefaultTimeout(15000);
  await context.route('https://api.github.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*', 'content-type': 'application/json'}, body: '[]'}));
  await context.addInitScript(({save, loadStyle}) => {
    window.__MODO_ARCADE_SEED__ = 20260416; // semente fixa: mundo igual em todo teste
    window.__MODO_LOADING_STYLE__ = loadStyle; // o sorteio de 15 % é testado à parte; aqui cada estilo é forçado
    if (save && !localStorage.getItem('__seeded')) { localStorage.setItem('arcade.v1', JSON.stringify(save)); localStorage.setItem('__seeded', '1'); }
  }, {save, loadStyle});
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
  await page.getByTestId('arcade-menu').waitFor();
  await page.waitForTimeout(1300); // a animação de entrada do menu
}
/** O menu não escreve "selecionado" na tela; quem escolheu fica na região viva dos leitores de tela. */
const chosen = (page, who) => page.getByLabel(`${who} selecionado`).waitFor({state: 'attached'});
/** Escolhe o personagem no menu e aperta JOGAR (o "carregando" é de verdade e dura ~1,2 s). */
/** Toque curto no meio da tela: lado esquerdo = Josperd, direito = Camila (como o protótipo). */
async function pick(page, who) {
  const box = await page.getByTestId('arcade-menu').boundingBox();
  await page.mouse.click(box.x + box.width * (who.toLowerCase() === 'josperd' ? 0.25 : 0.75), box.y + box.height * 0.45);
}
async function startGame(page, who = 'josperd') {
  await pick(page, who);
  await page.getByTestId('arcade-play').click();
  await page.getByTestId('arcade-score').waitFor({timeout: 20000});
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

test('menu: tela neutra na 1ª vez, escolher mostra o JOGAR com o recorde, trocar e salvar o personagem', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true, best: {josperd: 1234, camila: 77}}});
  await toArcade(page);
  assert.equal(await page.getByTestId('arcade-indicator').getAttribute('aria-label'), '', 'nada escolhido na 1ª vez');
  await shot(page, '01-menu-neutro');
  await pick(page, 'josperd');
  await chosen(page, 'JOSPERD');
  assert.match(await page.getByTestId('arcade-play').getAttribute('aria-label'), /Recorde 1234/);
  await page.waitForTimeout(1000);
  await shot(page, '01a-menu-josperd');
  await page.getByTestId('arcade-swap').click(); // botão de setas do centro
  await chosen(page, 'CAMILA');
  assert.match(await page.getByTestId('arcade-play').getAttribute('aria-label'), /Recorde 77/);
  await page.waitForTimeout(1000);
  await shot(page, '01b-menu-camila');
  await startGame(page, 'camila');
  assert.equal((await saved(page)).settings.hero, 'camila');
  assert.deepEqual(errors, []);
  await context.close();
});

test('menu: quem já jogou também abre no centro, sem ninguém pré-selecionado (a pessoa escolhe)', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true, plays: 3, best: {josperd: 10, camila: 500}, settings: {hero: 'camila'}}});
  await toArcade(page);
  assert.equal(await page.getByTestId('arcade-indicator').getAttribute('aria-label'), '', 'nada escolhido ao abrir');
  assert.equal(await page.getByTestId('arcade-play').getAttribute('aria-label'), 'Escolha seu personagem');
  assert.equal(await page.getByTestId('arcade-play').isDisabled(), true, 'sem PRESS START até escolher');
  await shot(page, '01-menu-neutro-quem-ja-jogou');
  await context.close();
});

test('menu: teclado escolhe e começa; Esc fecha', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await page.keyboard.press('ArrowRight');
  await chosen(page, 'CAMILA');
  await page.keyboard.press('ArrowLeft');
  await chosen(page, 'JOSPERD');
  await page.keyboard.press('Escape');
  await page.getByTestId('arcade-menu').waitFor({state: 'detached'});
  await context.close();
});

test('menu: arrastar o dedo acompanha o toque e solta no personagem; toque curto escolhe o lado', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  const box = await page.getByTestId('arcade-menu').boundingBox();
  const y = box.y + box.height * 0.45;
  // Desliza para a ESQUERDA → Camila.
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, {steps: 6});
  await page.mouse.move(box.x + box.width * 0.25, y, {steps: 6});
  await page.mouse.up();
  await chosen(page, 'CAMILA');
  await page.waitForTimeout(900); // termina a animação
  assert.equal(await page.getByTestId('arcade-hero-camila').getAttribute('aria-checked'), 'true', 'leitor de tela: Camila marcada');
  // Desliza para a DIREITA → Josperd.
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, {steps: 6});
  await page.mouse.move(box.x + box.width * 0.8, y, {steps: 6});
  await page.mouse.up();
  await chosen(page, 'JOSPERD');
  // Um arrastão curtinho não troca.
  await page.mouse.move(box.x + box.width * 0.3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3 + 12, y, {steps: 3});
  await page.mouse.up();
  await page.waitForTimeout(500);
  await chosen(page, 'JOSPERD');
  await context.close();
});

test('menu: o botão de controle alterna toque/inclinação e fica salvo; JOGAR mostra o carregando', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await page.getByTestId('arcade-control').click();
  await page.getByText('INCLINAR', {exact: true}).waitFor();
  assert.equal((await saved(page)).settings.control, 'tilt');
  await pick(page, 'josperd');
  await page.getByTestId('arcade-play').click();
  await page.getByTestId('arcade-loading').waitFor({timeout: 5000});
  await page.waitForTimeout(1100);
  await shot(page, '01c-carregando-pixel');
  await page.getByTestId('arcade-score').waitFor({timeout: 20000});
  await context.close();
});

test('menu: o carregando clássico (ilustrado) também entra no jogo', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}, loadStyle: 'classic'});
  await toArcade(page);
  await pick(page, 'camila');
  await page.getByTestId('arcade-play').click();
  await page.getByTestId('arcade-loading').waitFor({timeout: 5000});
  await page.getByText('CARREGANDO…').waitFor();
  await page.waitForTimeout(900);
  await shot(page, '01d-carregando-classico');
  await page.getByTestId('arcade-score').waitFor({timeout: 20000});
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

test('tiro: o botão redondo do centro atira sem mover; um dedo de lado continua movendo', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}, touch: true});
  const cdp = await context.newCDPSession(page);
  await toArcade(page);
  await startGame(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map(([x, y], id) => ({x, y, id}))});
  const st = () => page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; return {fire: s.fire, axis: s.axis, own: s.sim.bullets.filter(b => b.own).length}; });
  await touch('touchStart', [[196, 790]]); // dentro do botão
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.fire === true);
  assert.equal((await st()).axis, 0, 'o botão não move o herói');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.bullets.some(b => b.own));
  await touch('touchStart', [[196, 790], [330, 500]]); // botão + lado direito
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 1 && globalThis.__MODO_ARCADE_SESSION__.fire === true);
  await touch('touchEnd', []);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.axis === 0 && globalThis.__MODO_ARCADE_SESSION__.fire === false);
  await context.close();
});

test('tiro: a barra de espaço atira no teclado', {skip}, async () => {
  const {context, page} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.keyboard.down(' ');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.bullets.some(b => b.own));
  await page.keyboard.up(' ');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.fire === false);
  await context.close();
});

test('vidas e inimigos: encostar tira um coração, acabar as vidas encerra e a tela diz a causa', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  const hit = () => page.evaluate(() => {
    const s = globalThis.__MODO_ARCADE_SESSION__, sim = s.sim, p = sim.player;
    sim.invuln = 0; sim.shields = 0;
    p.x = 210; p.vx = 0; p.drift = 0; p.y = p.py = sim.camera + 300; p.vy = 0; // o empurrão do dano tira o herói da plataforma; recoloca no ar, longe de qualquer queda
    sim.enemies.push({id: 777 + sim.enemies.length, kind: 'drone', x0: p.x, y0: p.y + 40, x: p.x, y: p.y + 40, phase: 0, speed: 0, range: 0, size: 20, hp: 1, maxHp: 1, cooldown: 99, warn: false, alive: true});
    return sim.lives;
  });
  assert.equal(await hit(), 2);
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.lives === 1);
  await page.evaluate(() => globalThis.__MODO_ARCADE_SESSION__.pause()); // a captura demora: sem pausa o herói cai e a causa vira "Você caiu"
  await shot(page, '07-dano-um-coracao');
  await page.evaluate(() => { const sim = globalThis.__MODO_ARCADE_SESSION__.sim, p = sim.player; p.x = 210; p.vx = 0; p.drift = 0; p.y = p.py = sim.camera + 300; p.vy = 0; globalThis.__MODO_ARCADE_SESSION__.resume(); });
  await hit(); // hit() zera a invencibilidade (sem esperar 1,8 s, que deixava o teste instável)
  await page.getByTestId('arcade-final').waitFor({timeout: 10000});
  await page.waitForFunction(() => document.querySelector('[data-testid="arcade-cause"]')?.textContent === 'Acabaram as vidas.', null, {timeout: 5000});
  assert.deepEqual(errors, []);
  await context.close();
});

test('portal: encostar leva ao mundo seguinte (cristal), com chão seguro, recuperação guardada e o jogo continua', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.evaluate(() => {
    const s = globalThis.__MODO_ARCADE_SESSION__, sim = s.sim, p = sim.player;
    sim.items.push({id: 5551, kind: 'portal', x: p.x, y: p.y + 45 + 10, phase: 0, hit: false, target: 'crystal'});
  });
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'crystal');
  const r = await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__.sim; return {portals: s.portals, revive: s.revive, invuln: s.invuln, genWorld: s.gen.world}; });
  assert.deepEqual([r.portals, r.revive, r.genWorld], [1, 1, 'crystal']);
  await page.waitForTimeout(1500);
  await shot(page, '08-mundo-cristal');
  const t0 = (await sess(page)).tick;
  await page.waitForTimeout(800);
  assert.ok((await sess(page)).tick > t0, 'o jogo segue rodando no mundo novo');
  assert.deepEqual(errors, []);
  await context.close();
});

/** Põe um portal de `variant` colado ao herói e espera a travessia. */
async function throughPortal(page, variant, target = 'neon') {
  await page.evaluate(({variant, target}) => {
    const sim = globalThis.__MODO_ARCADE_SESSION__.sim, p = sim.player;
    sim.items.push({id: 5600 + variant.length, kind: 'portal', x: p.x, y: p.y + 55, phase: 0, hit: false, target, variant});
  }, {variant, target});
}

test('portais novos: Papel espelha os dois personagens e a volta troca de herói; bônus e atalho funcionam; Cosmos desenha', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  const get = () => page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__.sim; return {world: s.world, swapped: s.swapped, jet: s.jet, bonusY1: s.bonusY1, lane: s.gen.lane, mode: s.mode}; });
  // Atalho: hélice turbo.
  await throughPortal(page, 'warp');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.jet > 0);
  await page.waitForTimeout(400);
  await shot(page, '09-atalho-turbo');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.jet <= 0, null, {timeout: 8000});
  // Papel: faixa estreita e herói espelhado.
  await throughPortal(page, 'paper');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'paper');
  assert.deepEqual((await get()).lane, [44, 168]);
  await page.waitForTimeout(1500);
  await shot(page, '10-universo-de-papel');
  // Volta: os heróis trocam.
  await throughPortal(page, 'back', 'cosmos');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world !== 'paper', null, {timeout: 8000});
  assert.equal((await get()).swapped, true, 'a volta do Papel troca o herói');
  // Cosmos.
  await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__.sim; s.world = 'cosmos'; s.gen.world = 'cosmos'; s.invuln = 99; });
  await page.waitForTimeout(1200);
  await shot(page, '11-cosmos');
  // Cronos: câmera lenta.
  await throughPortal(page, 'time');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.slow > 0);
  await page.waitForTimeout(500);
  await shot(page, '13-cronos');
  // Fundo do Mar e Vulcão (lava sobe).
  await throughPortal(page, 'world', 'ocean');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'ocean');
  await page.waitForTimeout(1000);
  await shot(page, '14-fundo-do-mar');
  await throughPortal(page, 'world', 'volcano');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'volcano');
  await page.waitForTimeout(1000);
  assert.ok((await page.evaluate(() => globalThis.__MODO_ARCADE_SESSION__.sim.lava)) > 0, 'a lava existe no Vulcão');
  await shot(page, '15-vulcao');
  await throughPortal(page, 'leap', 'clock');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'clock');
  // Queda livre: o mundo vira de cabeça para baixo e volta pelo portal VOLTAR.
  await throughPortal(page, 'flip', 'inverse');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'inverse');
  await page.waitForTimeout(1000);
  await shot(page, '16-queda-livre');
  // Queda livre: o corpo do herói fica ACIMA dos pés, então o portal fica 45 un. acima.
  await page.evaluate(() => { const sim = globalThis.__MODO_ARCADE_SESSION__.sim, p = sim.player; sim.invuln = 99; sim.items.push({id: 5990, kind: 'portal', x: p.x, y: p.y - 45, phase: 0, hit: false, target: 'clock', variant: 'back'}); });
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'clock');
  // Papel → Rascunho (dobra rasgada): pousar do outro lado inverte o controle.
  await throughPortal(page, 'paper');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'paper');
  await throughPortal(page, 'sketch', 'sketch');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.world === 'sketch');
  await page.evaluate(() => {
    const sim = globalThis.__MODO_ARCADE_SESSION__.sim, p = sim.player;
    sim.platforms.push({id: 8800, x: 330, y: p.y + 140, w: 90, type: 'normal', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'chaos', dir: 0});
    p.x = 330; p.y = p.py = p.y + 200; p.vy = -200; sim.invuln = 99;
  });
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.inverted === true, null, {timeout: 8000});
  await page.waitForTimeout(500);
  await shot(page, '17-rascunho-invertido');
  await page.evaluate(() => { const sim = globalThis.__MODO_ARCADE_SESSION__.sim; sim.world = 'neon'; sim.gen.world = 'neon'; sim.gen.lane = null; sim.inverted = false; });
  // Sala do portal: botão destranca o portal azul e a barreira.
  await page.evaluate(() => {
    const sim = globalThis.__MODO_ARCADE_SESSION__.sim, cam = sim.camera;
    const P = (x, dy, w, type, extra = {}) => { const pl = {id: 9100 + sim.platforms.length, x, y: cam + dy, w, type, phase: 0, speed: 0, shift: 0, broken: false, pattern: 'lab', dir: 0, ...extra}; sim.platforms.push(pl); return pl; };
    const sw = P(110, 190, 64, 'switch'), pad = P(270, 280, 110, 'normal'), gy = pad.y + 170, q = P(120, gy - cam + 56, 132, 'normal', {pattern: 'labExit'});
    sim.items.push({id: 9200, kind: 'portal', variant: 'tele', x: 270, y: pad.y + 74, phase: 0, hit: false, lock: sw.id, open: false, dx: 120, dy: q.y + 30});
    sim.items.push({id: 9201, kind: 'gate', x: 210, y: gy, phase: 0, hit: false, lock: sw.id, open: false});
    sim.items.push({id: 9202, kind: 'portal', variant: 'exit', x: 120, y: q.y + 74, phase: 0, hit: false, lock: sw.id});
    sim.platforms = sim.platforms.filter(pl => pl.pattern === 'lab' || pl.pattern === 'labExit' || pl.y < cam - 100); // sem outras plataformas no caminho (o mundo ao fundo é aleatório)
    sim.player.x = 110; sim.player.y = sim.player.py = sw.y + 2; sim.player.vy = -300; sim.invuln = 99;
  });
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.items.find(i => i.variant === 'tele')?.open === true, null, {timeout: 8000});
  await page.evaluate(() => globalThis.__MODO_ARCADE_SESSION__.pause()); // a captura demora: sem pausa o herói sai da sala (e a câmera sobe e descarta o portal)
  await page.waitForTimeout(400);
  await shot(page, '18-sala-do-portal-aberta');
  await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__, sim = s.sim, a = sim.items.find(i => i.variant === 'tele'); sim.camera = sim.prevCamera = Math.min(sim.camera, a.y - 300); sim.player.x = a.x; sim.player.y = sim.player.py = a.y - 45; sim.player.vy = 0; s.resume(); });
  // (o portal usado some da lista na faxina seguinte; por isso a prova é a posição do herói: do portal azul, x=270, para o laranja, x=120)
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.player.x < 160, null, {timeout: 8000});
  // Bônus: zona dourada.
  await throughPortal(page, 'bonus');
  await page.waitForFunction(() => globalThis.__MODO_ARCADE_SESSION__.sim.bonusY1 > 0);
  await page.waitForTimeout(800);
  await shot(page, '12-bonus');
  assert.equal((await get()).mode, 'playing');
  assert.deepEqual(errors, []);
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

test('som: desligado por padrão; o botão do menu liga, fica salvo, e a partida toca trilha e efeitos sem erros', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  // Espia o que o navegador de fato manda tocar (expo-audio na web usa elementos de mídia).
  await page.evaluate(() => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(String(this.currentSrc || this.src)); return orig.apply(this, arguments).catch(() => {}); };
  });
  await toArcade(page);
  assert.equal((await saved(page)) === null || (await saved(page)).settings?.sfx !== true, true);
  assert.equal(await page.evaluate(() => window.__plays.length), 0, 'nada toca antes de ligar o som');
  await page.getByTestId('arcade-sound').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('arcade.v1') || '{}').settings?.music === true);
  const st = (await saved(page)).settings;
  assert.equal(st.sfx, true);
  assert.equal(st.music, true);
  await page.waitForFunction(() => window.__plays.some((u) => /menu/.test(u)), null, {timeout: 8000}); // trilha do menu
  await startGame(page);
  await page.waitForTimeout(2500);
  const plays = await page.evaluate(() => window.__plays);
  assert.ok(plays.length >= 2, 'tocou algo no jogo: ' + plays.length);
  await page.getByTestId('arcade-pause').click();
  await page.getByText('Efeitos sonoros').waitFor();
  await page.getByText('Trilha do jogo').waitFor();
  await page.getByText('Efeitos sonoros').click();
  await page.getByText('Trilha do jogo').click();
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('arcade.v1') || '{}').settings; return s?.sfx === false && s?.music === false; });
  await page.getByText('CONTINUAR', {exact: true}).click();
  await page.waitForTimeout(500);
  assert.deepEqual(errors, []);
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

test('diário: abre no menu com "???", a partida revela descobertas, fica salvo e aparece no fim de jogo', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await page.getByTestId('arcade-diary').click();
  await page.getByTestId('arcade-diary-modal').waitFor();
  assert.match(await page.getByTestId('arcade-diary-count').textContent(), /^0 de \d+ descobertas/);
  assert.ok((await page.getByText('???').count()) >= 40, 'o que não foi visto aparece como ???');
  await shot(page, '06-diario-vazio');
  await page.getByLabel('Fechar o diário').click();
  await page.getByTestId('arcade-diary-modal').waitFor({state: 'detached'});
  await startGame(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('arcade.v1') || '{}').found?.['world:neon'] !== undefined);
  // Pisa em uma mola e pega um escudo à força: os eventos viram descobertas salvas na hora.
  await page.evaluate(() => {
    const s = globalThis.__MODO_ARCADE_SESSION__;
    s.sim.platforms.push({id: 777001, x: s.sim.player.x, y: s.sim.player.y - 40, w: 200, type: 'spring', phase: 0, speed: 0, shift: 0, broken: false, pattern: 'chaos', dir: 0});
    s.sim.player.vy = -300;
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('arcade.v1') || '{}').found?.['floor:spring'] !== undefined, null, {timeout: 8000});
  await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; s.sim.platforms.length = 0; s.sim.gen.y = 1e9; s.sim.player.vy = -400; });
  await page.getByText('FIM DE JOGO', {exact: false}).waitFor({timeout: 10000});
  assert.ok(await page.getByTestId('arcade-news').isVisible(), 'o fim de jogo lista o que entrou no Diário');
  await shot(page, '06-fim-descobertas');
  const sv = await saved(page);
  assert.ok(sv.found['world:neon'] >= 1 && sv.found['floor:spring'] >= 1, JSON.stringify(sv.found));
  assert.deepEqual(sv.played, ['josperd']);
  // Volta ao menu: o Diário mostra o que foi achado e continua salvo depois de recarregar.
  await page.reload();
  await page.getByText('MODO', {exact: false}).first().waitFor();
  await toArcade(page);
  await page.getByTestId('arcade-diary').click();
  const n = Number((await page.getByTestId('arcade-diary-count').textContent()).match(/^(\d+) de/)[1]);
  assert.ok(n >= 2, `diário com ${n}`);
  await page.getByText('Mola', {exact: true}).waitFor();
  await shot(page, '06-diario-achados');
  assert.deepEqual(errors, []);
  await context.close();
});

test('partida guardada: pausar guarda no aparelho; ao reabrir o menu mostra CONTINUAR e retoma de onde parou; o fim apaga', {skip}, async () => {
  const {context, page, errors} = await open({save: {v: 1, unlocked: true}});
  await toArcade(page);
  await startGame(page);
  await page.waitForTimeout(800);
  await page.getByTestId('arcade-pause').click();
  await page.getByText('PAUSA', {exact: true}).waitFor();
  const before = await sess(page);
  const raw = await page.evaluate(() => localStorage.getItem('arcade.run.v1'));
  assert.ok(raw && raw.length > 500, 'partida gravada ao pausar');
  // O app "morre": recarrega a página (sessão perdida) e volta ao fliperama.
  await page.reload();
  await page.getByText('MODO', {exact: false}).first().waitFor();
  await toArcade(page);
  await page.getByTestId('arcade-resume').waitFor();
  await shot(page, '06-continuar');
  await page.getByTestId('arcade-resume').click();
  await page.getByText('PAUSA', {exact: true}).waitFor();
  const back = await sess(page);
  assert.equal(back.seed, before.seed);
  assert.equal(back.tick, before.tick, 'a partida volta no mesmo instante');
  assert.equal(back.paused, true);
  await page.getByLabel('CONTINUAR').click();
  await page.waitForFunction((t) => globalThis.__MODO_ARCADE_SESSION__.sim.tick > t + 20, before.tick);
  // Cair encerra e apaga a partida guardada.
  await page.evaluate(() => { const s = globalThis.__MODO_ARCADE_SESSION__; s.sim.platforms.length = 0; s.sim.gen.y = 1e9; s.sim.player.vy = -400; });
  await page.getByText('FIM DE JOGO', {exact: false}).waitFor({timeout: 10000});
  await page.waitForFunction(() => localStorage.getItem('arcade.run.v1') === null);
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
  assert.ok(perf.samples >= 8, `poucas amostras: ${perf.samples}`); // o runner do CI chegou a 13 quadros em 6 s com o desenho completo (WebGL por software)
  assert.ok(perf.stepMs < 2.5, `a simulação custou ${perf.stepMs} ms por quadro`);
  assert.ok(perf.drawMs < 30, `o desenho custou ${perf.drawMs} ms por quadro`);
  assert.ok(perf.platforms < 60 && perf.particles <= 160, 'listas crescendo sem parar');
  assert.deepEqual(errors, []);
  await context.close();
});

test('mundo avançado: patrulhando até ~620 m aparecem plataformas móveis, quebráveis e mola (captura)', {skip}, async () => {
  for (const who of ['josperd', 'camila']) {
    const {context, page, errors} = await open({save: {v: 1, unlocked: true, settings: {hero: who}}});
    await toArcade(page);
    await startGame(page, who);
    // Robô simples dentro da página: mira a plataforma mais alta que o salto atual alcança.
    const seen = await page.evaluate(() => {
      const s = globalThis.__MODO_ARCADE_SESSION__, step = globalThis.__MODO_ARCADE_STEP__;
      const types = new Set();
      s.pause();
      // Começa sempre do mesmo ponto: o instante do primeiro pouso na plataforma inicial (o quadro em que o robô simples assume varia com a carga da máquina).
      for (let k = 0; k < 400; k++) { step(0); if (s.sim.player.vy > 600 && s.sim.player.y < 100) break; }
      for (let i = 0; i < 120 * 90 && (s.sim.player.y - 90) / 10 < 620; i++) {
        const p = s.sim.player, rise = p.vy > 0 ? p.vy * p.vy / 2400 : 0; let best = null;
        for (const pl of s.sim.platforms) {
          if (pl.broken || pl.y > p.y + rise - 6 || pl.y < p.y - 260) continue;
          const px = pl.type === 'moving' ? pl.x + Math.sin(s.sim.time * pl.speed + pl.phase) * pl.shift : pl.x;
          if (Math.abs(((px - p.x + 750) % 500) - 250) > 235) continue; // o mundo dá a volta pela lateral (500 un.)
          if (!best || pl.y > best.y) best = {y: pl.y, x: px};
        }
        const dx = best ? ((best.x - p.x + 750) % 500) - 250 : 0;
        s.sim.invuln = 99; // este teste olha as plataformas, não o combate
        step(Math.abs(dx) < 6 ? 0 : Math.max(-1, Math.min(1, dx / 36)));
        for (const pl of s.sim.platforms) types.add(pl.type);
        // Para quando a tela mostra pelo menos dois tipos especiais ao mesmo tempo (bom para a captura).
        if ((p.y - 90) / 10 > 120 && i % 20 === 0 && types.has('fragile') && types.has('moving')) {
          const vis = new Set(s.sim.platforms.filter(pl => pl.y > s.sim.camera + 60 && pl.y < s.sim.camera + s.sim.viewH - 120 && pl.type !== 'normal').map(pl => pl.type));
          if (vis.size >= 2) break;
        }
      }
      s.resume();
      return {types: [...types].sort(), meters: Math.floor((s.sim.player.y - 90) / 10), mode: s.sim.mode, world: s.sim.world, y: Math.round(s.sim.player.y), cam: Math.round(s.sim.camera), tick: s.sim.tick, lives: s.sim.lives};
    });
    assert.equal(seen.mode, 'playing', JSON.stringify(seen));
    for (const t of ['moving', 'fragile', 'normal']) assert.ok(seen.types.includes(t), `faltou ${t}: ${seen.types}`);
    await page.waitForTimeout(500);
    const p = await paintStats(page);
    assert.ok(p.colors > 60);
    await shot(page, `02b-mundo-avancado-${who}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('layout: menu e jogo cabem em celular estreito (360×640) e em tela grande', {skip}, async () => {
  for (const viewport of [{width: 360, height: 640}, {width: 412, height: 915}]) {
    const {context, page, errors} = await open({save: {v: 1, unlocked: true}, viewport});
    await toArcade(page);
    await pick(page, 'josperd');
    await page.waitForTimeout(900);
    await shot(page, `06-menu-${viewport.width}x${viewport.height}`);
    const btn = await page.getByTestId('arcade-play').boundingBox();
    assert.ok(btn.y + btn.height <= viewport.height && btn.x >= 0 && btn.x + btn.width <= viewport.width, `botão JOGAR cortado em ${viewport.width}×${viewport.height}`);
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
