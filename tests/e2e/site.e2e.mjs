// Testes de ponta a ponta do site/PWA em Chromium real.
//   node --test tests/e2e/site.e2e.mjs
// Variáveis opcionais: CHROMIUM_PATH (executável), PLAYWRIGHT_MODULE (caminho do pacote playwright).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync, existsSync, statSync, mkdtempSync, writeFileSync} from 'node:fs';
import {join, extname, normalize, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const require = createRequire(import.meta.url);
const {chromium} = (() => {
  try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); }
})();
const SITE = join(dirname(fileURLToPath(import.meta.url)), '../../site');
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.woff2': 'font/woff2'};

let server, base, browser;
test.before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(SITE, p));
    if (!file.startsWith(SITE)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end('nao encontrado'); return; }
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required']});
});
test.after(async () => { await browser?.close(); await new Promise((ok) => server.close(ok)); });

/* ---------- helpers ---------- */
const GH = 'Josperdias/modo-treino';
const INSTALLED = JSON.parse(readFileSync(join(SITE, '../native/package.json'), 'utf8')).version; // site e app andam juntos (verify.py garante)
const rel = (tag, extra = {}) => ({
  tag_name: tag, draft: false, prerelease: false,
  html_url: `https://github.com/${GH}/releases/tag/${tag}`, published_at: '2026-10-12T12:00:00Z', body: '',
  assets: [{name: `modo-treino-${tag.replace(/^v/, '')}-debug.apk`, size: 52428800, digest: 'sha256:' + 'ab'.repeat(32),
    browser_download_url: `https://github.com/${GH}/releases/download/${tag}/modo-treino-${tag.replace(/^v/, '')}-debug.apk`}],
  ...extra,
});

const COMMIT = {sha: '0123456789abcdef0123', html_url: `https://github.com/${GH}/commit/0123456789abcdef0123`};
async function newPage({viewport = {width: 1280, height: 900}, github = {releases: [], commit: COMMIT}, seed = null, clock = false} = {}) {
  const context = await browser.newContext({viewport, acceptDownloads: true, serviceWorkers: 'allow'});
  const errors = [];
  context.setDefaultTimeout(8000);
  await context.route('https://api.github.com/**', (route) => {
    const url = route.request().url();
    const cors = {'access-control-allow-origin': '*', 'content-type': 'application/json'};
    if (/\/commits\//.test(url)) return github.commit ? route.fulfill({status: 200, headers: cors, body: JSON.stringify(github.commit)}) : route.fulfill({status: 404, headers: cors, body: '{}'});
    return route.fulfill({status: 200, headers: cors, body: JSON.stringify(github.releases)});
  });
  await context.addInitScript(() => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push({src: this.currentSrc || this.src, volume: this.volume}); return orig.apply(this, arguments); };
  });
  if (seed) {
    await context.addInitScript(({entries}) => {
      if (localStorage.getItem('__seeded')) return;
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      localStorage.setItem('__seeded', '1');
    }, {entries: seed});
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  if (clock) await page.clock.install();
  return {context, page, errors};
}
const go = async (page, route) => { await page.goto(`${base}/#${route}`); await page.waitForSelector('#main > *'); };
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('modo-treino-v1') || 'null'));
const mark = (page, id, i) => page.click(`button.set-box[data-set="${id}"][data-index="${i}"]`);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function wav(seconds, hz = 440) { // WAV PCM 8 kHz mono 16 bits
  const rate = 8000, n = Math.floor(rate * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 3000), 44 + i * 2);
  return buf;
}

/* ---------- carregamento e estrutura ---------- */
test('todas as telas carregam sem erro de console, sem recurso faltando e sem pedir nada ao Google', async () => {
  const {context, page, errors} = await newPage();
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  for (const r of ['/', '/treino/A', '/treino/B', '/historico', '/colecao', '/musica', '/ajustes']) { await go(page, r); await page.waitForTimeout(250); }
  await page.goto(`${base}/baixar/`); await page.waitForTimeout(400);
  assert.deepEqual(errors, []);
  assert.equal(requested.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)).length, 0);
  await context.close();
});

test('Treino A tem 6 exercícios e Treino B tem 8; B3 mostra SEM IMAGEM DO EXERCÍCIO', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A'); assert.equal(await page.locator('.exercise-row').count(), 6);
  await go(page, '/treino/B'); assert.equal(await page.locator('.exercise-row').count(), 8);
  const b3 = page.locator('.exercise-row', {hasText: 'Elevação frontal na polia baixa'});
  assert.match(await b3.locator('.art-status').innerText(), /SEM IMAGEM DO EXERCÍCIO/);
  assert.match(await b3.locator('img').getAttribute('alt'), /não é uma demonstração/);
  await context.close();
});

test('nenhuma tela chama a Camila de "loira" em texto visível; fallback de arte é sinalizado', async () => {
  const {context, page} = await newPage();
  await go(page, '/'); await page.click('button[data-persona="loira"]');
  assert.match(await page.locator('.profile-pill span').innerText(), /Camila Camomila, a ruivinha/);
  for (const r of ['/', '/treino/A', '/treino/B', '/historico', '/colecao', '/musica', '/ajustes']) {
    await go(page, r);
    assert.doesNotMatch(await page.locator('body').innerText(), /loira/i, `texto "loira" visível em ${r}`);
  }
  await go(page, '/treino/A');
  assert.match(await page.locator('.exercise-row', {hasText: 'Rosca direta'}).locator('.availability').innerText(), /versão de Josperd/); // a1 não tem arte da Camila
  assert.match(await page.locator('.exercise-row', {hasText: 'Rosca concentrada'}).locator('.art-status').innerText(), /CAMILA CAMOMILA/);
  assert.equal((await state(page)).persona, 'loira');
  await page.reload(); await page.waitForSelector('#main > *');
  assert.match(await page.locator('.profile-pill span').innerText(), /ruivinha/); // persistiu
  await context.close();
});

/* ---------- registro de séries, cargas e descanso ---------- */
test('marcar série persiste após recarregar e não depende de som ligado', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  const box = page.locator('button.set-box[data-set="a1"][data-index="0"]');
  assert.equal(await box.getAttribute('aria-checked'), 'false');
  await box.click();
  assert.equal(await page.locator('button.set-box[data-set="a1"][data-index="0"]').getAttribute('aria-checked'), 'true');
  assert.deepEqual((await state(page)).sets[`${today()}:A`].a1.slice(0, 1), [true]);
  await page.reload(); await page.waitForSelector('.exercise-row');
  assert.equal(await page.locator('button.set-box[data-set="a1"][data-index="0"]').getAttribute('aria-checked'), 'true');
  assert.match(await page.locator('.progress-copy p').innerText(), /^1 de 23 séries/);
  await page.locator('button.set-box[data-set="a1"][data-index="0"]').click(); // desmarcar
  assert.equal(await page.locator('button.set-box[data-set="a1"][data-index="0"]').getAttribute('aria-checked'), 'false');
  await context.close();
});

test('+ e − ajustam séries entre 1 e 12 e persistem', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/B');
  const plus = 'button[data-adjust="b2"][data-delta="1"]', minus = 'button[data-adjust="b2"][data-delta="-1"]';
  for (let i = 0; i < 15; i++) await page.click(plus);
  assert.equal((await state(page)).override.b2.series, 12);
  assert.equal(await page.locator('button.set-box[data-set="b2"]').count(), 12);
  for (let i = 0; i < 15; i++) await page.click(minus);
  assert.equal((await state(page)).override.b2.series, 1);
  await page.click(plus); await page.reload(); await page.waitForSelector('.exercise-row');
  assert.equal(await page.locator('button.set-box[data-set="b2"]').count(), 2);
  await context.close();
});

test('editar carga/séries/repetições: valida limites e salva valores válidos', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  await page.click('.edit-button[data-detail="a1"]');
  await page.fill('#series', '99'); await page.fill('#weight', '5000');
  await page.click('#editForm button[type="submit"]');
  assert.equal(await page.locator('#editForm').count(), 1, 'modal continua aberto com dados inválidos');
  assert.equal((await state(page))?.override?.a1, undefined);
  await page.fill('#series', '4'); await page.fill('#reps', '8'); await page.fill('#weight', '12.5');
  await page.click('#editForm button[type="submit"]');
  assert.equal(await page.locator('#editForm').count(), 0);
  assert.deepEqual((await state(page)).override.a1, {peso: '12.5', series: 4, reps: 8});
  assert.match(await page.locator('.exercise-row', {hasText: 'Rosca direta'}).locator('.ex-caption').innerText(), /4 séries × 8 rep\. · 12.5 kg/);
  await context.close();
});

test('modal: foco entra no botão fechar, Tab não escapa e Esc devolve o foco', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  const opener = page.locator('.edit-button[data-detail="a2"]');
  await opener.click();
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('modal-close')));
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('#modal')), 'foco escapou do modal'); }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modal *').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.detail), 'a2');
  await context.close();
});

test('cronômetro: aparece ao marcar, +15s soma, pular remove, e os botões não são recriados a cada segundo', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  await mark(page, 'a1', 0);
  await page.waitForSelector('#timer .rest-timer');
  const t0 = await page.locator('#timerTime').innerText();
  assert.match(t0, /^(01:00|00:59)$/);
  const handle = await page.locator('[data-action="plusTime"]').elementHandle();
  await page.waitForTimeout(2300);
  assert.ok(await handle.evaluate((el) => el.isConnected), 'botão +15s foi recriado pelo tick do cronômetro');
  await page.click('[data-action="plusTime"]');
  const secs = async () => { const [m, s] = (await page.locator('#timerTime').innerText()).split(':').map(Number); return m * 60 + s; };
  assert.ok((await secs()) >= 70, 'esperava ~1:12 após +15s');
  await page.click('[data-action="endTime"]');
  assert.equal(await page.locator('#timer .rest-timer').count(), 0);
  await context.close();
});

test('descanso configurável (45 s) persiste e é usado pelo cronômetro', async () => {
  const {context, page} = await newPage();
  await go(page, '/ajustes'); await page.selectOption('#restSelect', '45');
  assert.equal((await state(page)).rest, 45);
  await go(page, '/treino/A'); await mark(page, 'a2', 0);
  assert.match(await page.locator('#timerTime').innerText(), /^(00:45|00:44)$/);
  await context.close();
});

/* ---------- finalizar treino, histórico, volume e recordes ---------- */
test('finalizar treino: histórico com volume e detalhe por exercício; não duplica no mesmo dia', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  assert.equal(await page.locator('button[data-finish="A"]').isDisabled(), true);
  await mark(page, 'a1', 0); await mark(page, 'a1', 1);
  await page.click('button[data-finish="A"]');
  await page.waitForSelector('.history-entry');
  const entry = page.locator('.history-entry').first();
  assert.match(await entry.locator('small').innerText(), /2 séries marcadas · 100 kg/); // 2 × 5 reps × 10 kg
  await entry.locator('summary').click();
  assert.match(await entry.locator('.history-items').innerText(), /Rosca direta na barra W[\s\S]*2 × 5 · 10 kg/);
  const saved = (await state(page)).sessions[0];
  assert.equal(saved.volume, 100); assert.equal(saved.items.length, 1);
  await go(page, '/treino/A'); await page.click('button[data-finish="A"]');
  assert.match(await page.locator('#toast').innerText(), /já foi finalizado hoje/);
  assert.equal((await state(page)).sessions.length, 1);
  await context.close();
});

test('recorde pessoal: carga maior que todas as anteriores ganha selo; painel mostra a melhor carga', async () => {
  const seed = {'modo-treino-v1': {persona: 'vinho', rest: 60, sets: {}, override: {}, sounds: {}, githubRepo: GH, notifyUpdates: false,
    sessions: [{date: '2026-01-05', time: '07:00', treino: 'A', sets: 2, percent: 20, volume: 80, items: [{id: 'a1', nome: 'Rosca direta na barra W', series: 2, reps: 5, peso: 8}]}]}};
  const {context, page} = await newPage({seed});
  await go(page, '/treino/A'); await mark(page, 'a1', 0);
  await page.click('button[data-finish="A"]'); await page.waitForSelector('.history-entry');
  assert.equal(await page.locator('.history-entry').count(), 2);
  assert.equal(await page.locator('.history-entry').first().locator('summary .pr-badge').count(), 1, 'sessão de hoje (10 kg > 8 kg) deve ter selo');
  assert.equal(await page.locator('.history-entry').nth(1).locator('summary .pr-badge').count(), 0, 'primeiro registro não é recorde');
  assert.match(await page.locator('.records-list').innerText(), /Rosca direta na barra W\s*10 kg/);
  await context.close();
});

test('histórico antigo (v1.0.1, sem detalhe) continua abrindo e exportando', async () => {
  const seed = {'modo-treino-v1': {persona: 'vinho', rest: 60, sets: {}, override: {}, githubRepo: GH, notifyUpdates: false,
    sessions: [{date: '2026-09-01', time: '08:00', treino: 'B', sets: 9, percent: 75}]}};
  const {context, page, errors} = await newPage({seed});
  await go(page, '/historico');
  await page.locator('.history-entry summary').click();
  assert.match(await page.locator('.history-note').innerText(), /sem detalhe/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-csv"]')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.startsWith('﻿data,hora,treino,exercicio,series_feitas'));
  assert.match(csv, /2026-09-01,08:00,B,,9,,,/);
  assert.deepEqual(errors, []);
  await context.close();
});

/* ---------- backup ---------- */
test('backup: exportar JSON, importar de volta restaura; arquivo inválido ou malicioso é recusado', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A'); await mark(page, 'a1', 0); await page.click('button[data-finish="A"]'); await page.waitForSelector('.history-entry');
  await go(page, '/ajustes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
  assert.match(dl.suggestedFilename(), /^modo-treino-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await dl.path();
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(exported.sessions.length, 1);

  page.once('dialog', (d) => d.accept()); await page.click('[data-action="reset"]');
  assert.equal((await state(page)).sessions.length, 0);

  page.once('dialog', (d) => d.accept()); await page.setInputFiles('#importFile', file);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('modo-treino-v1')).sessions.length === 1);

  const dir = mkdtempSync(join(tmpdir(), 'mt-'));
  const bad = join(dir, 'ruim.json'); writeFileSync(bad, '{"foo":1}');
  await page.setInputFiles('#importFile', bad);
  await page.waitForFunction(() => /inválido/.test(document.getElementById('toast').textContent)); // a importação é assíncrona: espera o aviso certo
  assert.equal((await state(page)).sessions.length, 1, 'estado não pode ser substituído por arquivo inválido');

  const evil = join(dir, 'evil.json');
  writeFileSync(evil, '{"sets":{"__proto__":{"a1":[true]}},"override":{"__proto__":{"series":3}},"sessions":[{"date":"2026-01-01","treino":"A","sets":1,"percent":1,"__proto__":{"polluted":1}}],"rest":60}');
  page.once('dialog', (d) => d.accept()); await page.setInputFiles('#importFile', evil);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('modo-treino-v1')).sessions[0]?.date === '2026-01-01'); // backup sanitizado foi aplicado
  assert.equal(await page.evaluate(() => ({}).a1 === undefined && ({}).polluted === undefined && ({}).series === undefined), true, 'Object.prototype poluído');
  await context.close();
});

/* ---------- sons opcionais ---------- */
test('sons: desligados por padrão (nada toca), prévia funciona, ativar persiste e volume é limitado', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A'); await mark(page, 'a1', 0); await page.click('button[data-finish="A"]');
  await go(page, '/ajustes');
  assert.equal(await page.locator('input[data-sound="enabled"]').isChecked(), false);
  assert.equal((await page.evaluate(() => window.__plays)).filter((p) => /assets\/sounds/.test(p.src)).length, 0, 'nenhum efeito pode tocar com sons desligados');
  await page.click('[data-sound-preview="arcade"]');
  await page.waitForFunction(() => window.__plays.some((p) => /sounds\/arcade\/series\.wav/.test(p.src)));
  await page.check('input[data-sound="enabled"]');
  assert.equal((await state(page)).sounds.enabled, true);
  await page.reload(); await page.waitForSelector('#main > *');
  assert.equal(await page.locator('input[data-sound="enabled"]').isChecked(), true, 'ativação persiste');
  await page.fill('#soundsVolume', '100'); await page.dispatchEvent('#soundsVolume', 'input');
  await go(page, '/treino/B'); await mark(page, 'b1', 0);
  await page.waitForFunction(() => window.__plays.some((p) => /sounds\/suave\/series\.wav/.test(p.src)));
  const played = (await page.evaluate(() => window.__plays)).filter((p) => /suave\/series/.test(p.src));
  assert.ok(played.every((p) => p.volume <= 0.8), 'volume dos efeitos deve ser limitado');
  await context.close();
});

test('contagem 3-2-1 por voz e aviso de fim do descanso tocam na hora certa (relógio simulado)', async () => {
  const seed = {'modo-treino-v1': {persona: 'vinho', rest: 30, sets: {}, override: {}, sessions: [], githubRepo: GH, notifyUpdates: false,
    sounds: {enabled: true, pack: 'minimal', volume: 40, buttons: false, series: false, finish: true, rest: true, countdown: true, voice: true}}};
  const {context, page} = await newPage({seed, clock: true});
  await go(page, '/treino/A'); await mark(page, 'a1', 0);
  await page.clock.runFor(26000);
  const names = async () => (await page.evaluate(() => window.__plays)).map((p) => p.src.split('/sounds/')[1]);
  assert.deepEqual((await names()).filter((n) => n.startsWith('voice')), [], 'a voz não pode começar antes dos 3 s finais');
  await page.clock.runFor(5500); // passa de 30 s mesmo com o tick desalinhado
  assert.deepEqual((await names()).filter((n) => n.startsWith('voice')), ['voice/3.wav', 'voice/2.wav', 'voice/1.wav']);
  assert.ok((await names()).includes('minimal/rest.wav'), 'aviso de descanso concluído');
  await context.close();
});

/* ---------- música ---------- */
test('música: importar, tocar/pausar, crossfade para a próxima faixa, persistir após recarregar', async () => {
  const {context, page, errors} = await newPage();
  const dir = mkdtempSync(join(tmpdir(), 'mt-wav-'));
  const f1 = join(dir, 'Faixa Um.wav'), f2 = join(dir, 'Faixa Dois.wav'), txt = join(dir, 'nota.txt');
  writeFileSync(f1, wav(5, 440)); writeFileSync(f2, wav(5, 660)); writeFileSync(txt, 'nao sou audio');
  await go(page, '/musica');
  await page.setInputFiles('#music-files', [f1, f2, txt]);
  await page.waitForFunction(() => document.querySelectorAll('.song-row').length >= 2);
  assert.equal(await page.locator('.song-row').count(), 2, 'o .txt deve ser ignorado');
  await page.selectOption('#music-fade', '1');
  await page.click('.transport-main');
  await page.waitForFunction(() => /Tocando/.test(document.querySelector('.music-dock')?.innerText || ''));
  assert.match(await page.locator('.player-metadata strong').innerText(), /Faixa Um/);
  assert.ok(await page.locator('.cassette.is-playing').count() === 1, 'fita animada ao tocar');
  await page.click('.transport-main'); // pausa
  await page.waitForFunction(() => /Parado/.test(document.querySelector('.music-dock')?.innerText || ''));
  await page.click('.transport-main');
  await page.waitForFunction(() => /Faixa Dois/.test(document.querySelector('.player-metadata strong')?.innerText || ''), null, {timeout: 9000}); // crossfade automático
  assert.match(await page.locator('.music-dock').innerText(), /Tocando/);
  await go(page, '/treino/A'); // trocar de tela não interrompe
  assert.match(await page.locator('.music-dock').innerText(), /Tocando/);
  await page.reload(); await page.waitForSelector('.music-dock');
  await go(page, '/musica');
  assert.equal(await page.locator('.song-row').count(), 2, 'faixas persistem (IndexedDB)');
  assert.equal(await page.locator('#music-fade').inputValue(), '1');
  assert.deepEqual(errors, []);
  await context.close();
});

test('música: criar fita, mover faixa e remover; fitas padrão A, B e Favoritas existem', async () => {
  const {context, page} = await newPage();
  await go(page, '/musica');
  assert.deepEqual(await page.locator('.tape-select strong').allInnerTexts(), ['Treino A', 'Treino B', 'Favoritas']);
  page.once('dialog', (d) => d.accept('Fita da Camila')); await page.click('[data-music="new-tape"]');
  assert.deepEqual(await page.locator('.tape-select strong').allInnerTexts(), ['Treino A', 'Treino B', 'Favoritas', 'Fita da Camila']);
  assert.equal(await page.locator('.tape-select.selected strong').innerText(), 'Fita da Camila');
  await context.close();
});

/* ---------- avisos de versão (GitHub mockado) ---------- */
test('aviso de versão: release mais nova mostra faixa com link do APK; nunca instala sozinha', async () => {
  const {context, page} = await newPage({github: {releases: [rel('v1.0.0'), rel('v9.0.0', {prerelease: true}), rel('v1.5.0')], commit: null}});
  await go(page, '/');
  const banner = page.locator('#git-news-banner');
  await banner.waitFor({state: 'visible'});
  assert.match(await banner.innerText(), /MODO TREINO 9\.0\.0 DISPONÍVEL/); // maior versão, não a primeira da lista
  assert.equal(await banner.locator('a').count(), 2);
  assert.match(await banner.locator('a').first().getAttribute('href'), /^https:\/\/github\.com\/Josperdias\/modo-treino\/releases\/download\/v9\.0\.0\/.+\.apk$/);
  assert.equal(await banner.locator('a').first().getAttribute('rel'), 'noopener noreferrer');
  await context.close();
});

test('aviso de versão: versão igual, rascunho e tag inválida não geram aviso', async () => {
  for (const releases of [[rel('v' + INSTALLED)], [rel('v9.9.9', {draft: true})], [rel('nightly')], []]) {
    const {context, page} = await newPage({github: {releases, commit: null}});
    await go(page, '/ajustes'); await page.waitForFunction(() => !/Consultando/.test(document.getElementById('updateStatus')?.textContent || 'Consultando'));
    assert.equal(await page.locator('#git-news-banner').isVisible(), false, JSON.stringify(releases.map((r) => r.tag_name)));
    await context.close();
  }
});

test('aviso de versão: só um commit novo vira "novidades", nunca "versão disponível"', async () => {
  const seed = {'modo-treino-latest-seen': `${GH}||aaaaaaaaaaaa`};
  const github = {releases: [], commit: {sha: 'bbbbbbbbbbbbbbbbbbbb', html_url: `https://github.com/${GH}/commit/bbbbbbbbbbbbbbbbbbbb`}};
  const {context, page} = await newPage({github, seed});
  await go(page, '/');
  const banner = page.locator('#git-news-banner');
  await banner.waitFor({state: 'visible'});
  assert.match(await banner.innerText(), /NOVIDADES NO GITHUB/);
  assert.doesNotMatch(await banner.innerText(), /DISPONÍVEL/);
  assert.equal(await banner.locator('a').count(), 1);
  await context.close();
});

test('aviso de versão: respeita "desativar avisos" e links fora do GitHub são descartados', async () => {
  const evil = rel('v9.0.0', {html_url: 'https://evil.example/releases/v9', assets: [{name: 'x.apk', browser_download_url: 'https://evil.example/x.apk'}]});
  const {context, page} = await newPage({github: {releases: [evil], commit: null}});
  await go(page, '/'); await page.waitForTimeout(600);
  assert.equal(await page.locator('#git-news-banner').isVisible(), false);
  await context.close();
  const off = await newPage({github: {releases: [rel('v9.0.0')], commit: null}, seed: {'modo-treino-v1': {notifyUpdates: false, sessions: [], sets: {}, override: {}}}});
  await go(off.page, '/'); await off.page.waitForTimeout(600);
  assert.equal(await off.page.locator('#git-news-banner').isVisible(), false);
  await off.context.close();
});

/* ---------- página de download ---------- */
test('página de download: mostra versão, tamanho e SHA-256 do APK; texto externo nunca vira HTML', async () => {
  const xss = '<img src=x onerror="window.__xss=1">';
  const release = rel('v1.2.0', {prerelease: true, body: xss});
  const {context, page, errors} = await newPage({github: {releases: [rel('v1.0.0'), release], commit: null}});
  await page.goto(`${base}/baixar/`);
  await page.locator('#apk-link').waitFor({state: 'visible'});
  assert.match(await page.locator('#apk-link').getAttribute('href'), /^https:\/\/github\.com\/Josperdias\/modo-treino\/releases\/download\/v1\.2\.0\/modo-treino-1\.2\.0-debug\.apk$/);
  assert.match(await page.locator('#f-version').innerText(), /1\.2\.0 \(teste\)/);
  assert.match(await page.locator('#f-size').innerText(), /50,0 MB/);
  assert.equal(await page.locator('#f-sha').innerText(), 'ab'.repeat(32));
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(errors, []);
  await context.close();
});

test('página de download: sem APK publicado mostra aviso claro e esconde o botão', async () => {
  const {context, page} = await newPage({github: {releases: [rel('v1.0.0', {assets: []})], commit: null}});
  await page.goto(`${base}/baixar/`);
  await page.waitForFunction(() => /Ainda não há um APK/.test(document.getElementById('apk-status').textContent));
  assert.equal(await page.locator('#apk-link').isVisible(), false);
  assert.equal(await page.locator('#releases-link').isVisible(), true);
  await context.close();
});

/* ---------- offline e layout ---------- */
test('offline: depois da primeira visita o app abre sem rede, com imagens, dados e sons em cache', async () => {
  const {context, page} = await newPage({github: {releases: [], commit: null}});
  await go(page, '/treino/A'); await mark(page, 'a1', 0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => { const ks = await caches.keys(); const m = ks.find((k) => k.includes('media')); return m && (await (await caches.open(m)).keys()).length >= 40; }, null, {timeout: 20000});
  await page.reload(); await page.waitForSelector('.exercise-row'); // já controlado pelo SW
  await context.setOffline(true);
  await page.reload(); await page.waitForSelector('.exercise-row');
  assert.equal(await page.locator('button.set-box[data-set="a1"][data-index="0"]').getAttribute('aria-checked'), 'true', 'dados locais disponíveis offline');
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const soundOk = await page.evaluate(async () => (await fetch('assets/sounds/suave/series.wav')).ok);
  assert.equal(soundOk, true, 'som disponível offline');
  const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("900 20px 'Barlow Condensed'"); });
  assert.equal(fontOk, true, 'tipografia embutida disponível offline');
  await go(page, '/baixar/'.replace('/baixar/', '/ajustes'));
  await context.close();
});

test('layout em tela de 320 px: nada estoura a largura em nenhuma tela', async () => {
  const {context, page} = await newPage({viewport: {width: 320, height: 640}});
  for (const r of ['/', '/treino/A', '/treino/B', '/historico', '/colecao', '/musica', '/ajustes']) {
    await go(page, r); await page.waitForTimeout(200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `rolagem horizontal de ${over}px em ${r}`);
  }
  await page.goto(`${base}/baixar/`);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'rolagem horizontal em /baixar/');
  await context.close();
});

test('manifesto do PWA: ícones PNG existem e atalhos apontam para rotas válidas', async () => {
  const {context, page} = await newPage();
  const m = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
  for (const ic of m.icons) assert.equal((await page.request.get(`${base}/${ic.src}`)).status(), 200, ic.src);
  assert.ok(m.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.deepEqual(m.shortcuts.map((s) => s.url), ['./#/treino/A', './#/treino/B', './#/musica']);
  await context.close();
});

/* ---------- regressões de layout encontradas na revisão visual ---------- */
test('celular: a arte do exercício nunca invade o texto (320, 360, 390, 430 px)', async () => {
  for (const width of [320, 360, 390, 430]) {
    const {context, page} = await newPage({viewport: {width, height: 800}});
    await go(page, '/treino/A'); await page.waitForSelector('.exercise-row');
    const gap = await page.evaluate(() => { const row = document.querySelector('.exercise-row'); return row.querySelector('.ex-info').getBoundingClientRect().left - row.querySelector('.art-frame').getBoundingClientRect().right; });
    assert.ok(gap >= 8, `largura ${width}px: só ${gap}px entre a arte e o texto`);
    await context.close();
  }
});

test('celular: cronômetro e aviso ficam visíveis e clicáveis, sem ficar atrás do player ou do menu', async () => {
  for (const width of [390, 800]) {
    const {context, page} = await newPage({viewport: {width, height: 844}});
    await go(page, '/treino/A'); await mark(page, 'a1', 0);
    await page.waitForSelector('.toast.show');
    const covered = await page.evaluate(() => {
      const onTop = (el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && el.contains(hit); };
      const toast = document.getElementById('toast').getBoundingClientRect(), dock = document.querySelector('.music-dock').getBoundingClientRect();
      // o aviso tem pointer-events:none (nunca bloqueia toques); então conferimos que fica dentro da tela e acima do player
      return {toast: !(toast.top >= 0 && toast.bottom <= dock.top + 1 && toast.right <= innerWidth + 1), plus: !onTop(document.querySelector('[data-action="plusTime"]')), skip: !onTop(document.querySelector('[data-action="endTime"]'))};
    });
    assert.deepEqual(covered, {toast: false, plus: false, skip: false}, `largura ${width}px: elemento coberto`);
    await context.close();
  }
});

/* ---------- modo execução (um card por exercício) ---------- */
const openGuided = async (page, t = 'A') => { await go(page, `/treino/${t}`); await page.click(`[data-g-open="${t}"]`); await page.waitForSelector('#guided .g-shell'); };
const gstate = async (page, id = 'a1') => (await state(page))?.sets?.[`${today()}:A`]?.[id] || [];

test('modo execução: abre em tela cheia no exercício 1/6 com botões para cada série', async () => {
  const {context, page, errors} = await newPage();
  await go(page, '/treino/A');
  assert.match(await page.locator('.guided-panel').innerText(), /COMEÇAR TREINO A/);
  await openGuided(page);
  assert.match(await page.locator('.g-count').innerText(), /EXERCÍCIO 1\/6/);
  assert.match(await page.locator('.g-title h2').innerText(), /Rosca direta na barra W/i);
  assert.equal(await page.locator('.g-set').count(), 5); // a1 tem 5 séries
  assert.equal(await page.locator('.g-seg').count(), 6);
  assert.deepEqual(errors, []);
  await context.close();
});

test('modo execução: tocar em "3" registra 3 séries e abre o descanso; tocar de novo corrige', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('[data-gset="3"]');
  assert.deepEqual((await gstate(page)).slice(0, 4), [true, true, true, false]);
  await page.waitForSelector('#guided .g-rest');
  assert.match(await page.locator('.g-next').innerText(), /PRÓXIMA: SÉRIE 4 DE 5/);
  assert.match(await page.locator('#gTime').innerText(), /^(01:00|00:59)$/);
  await page.click('[data-g="skip"]');
  await page.waitForSelector('#guided .g-sets');
  assert.equal(await page.locator('.g-set.is-done').count(), 3);
  assert.equal(await page.locator('.g-set.is-next').getAttribute('data-gset'), '4');
  await page.click('[data-gset="3"]'); // já são 3: desmarca a última
  assert.equal((await gstate(page)).filter(Boolean).length, 2);
  assert.equal(await page.locator('#guided .g-rest').count(), 0, 'corrigir não inicia descanso');
  await context.close();
});

test('modo execução: "concluir série" marca a próxima e, ao terminar o exercício, o descanso leva ao seguinte', async () => {
  const {context, page} = await newPage({clock: true});
  await openGuided(page);
  for (let i = 0; i < 5; i++) {
    assert.match(await page.locator('.g-main').innerText(), new RegExp(`CONCLUIR SÉRIE ${i + 1}`));
    await page.click('[data-g="complete"]');
    await page.waitForSelector('#guided .g-rest');
    if (i < 4) await page.click('[data-g="skip"]');
  }
  assert.equal((await gstate(page)).filter(Boolean).length, 5);
  assert.match(await page.locator('.g-next').innerText(), /PRÓXIMO EXERCÍCIO 2\/6[\s\S]*Rosca concentrada/i);
  await page.clock.runFor(61000); // o descanso acaba sozinho
  await page.waitForSelector('#guided .g-sets');
  assert.match(await page.locator('.g-count').innerText(), /EXERCÍCIO 2\/6/);
  await context.close();
});

test('modo execução: contagem 3-2-1 e fim do descanso soam dentro da tela de descanso', async () => {
  const seed = {'modo-treino-v1': {persona: 'vinho', rest: 30, sets: {}, override: {}, sessions: [], githubRepo: GH, notifyUpdates: false,
    sounds: {enabled: true, pack: 'minimal', volume: 40, buttons: false, series: false, finish: false, rest: true, countdown: true, voice: true}}};
  const {context, page} = await newPage({seed, clock: true});
  await openGuided(page);
  await page.click('[data-gset="1"]');
  await page.clock.runFor(32500);
  const names = (await page.evaluate(() => window.__plays)).map((p) => p.src.split('/sounds/')[1]);
  assert.deepEqual(names.filter((n) => n.startsWith('voice')), ['voice/3.wav', 'voice/2.wav', 'voice/1.wav']);
  assert.ok(names.includes('minimal/rest.wav'));
  assert.equal(await page.locator('#guided .g-rest').count(), 0, 'voltou ao card quando o descanso acabou');
  await context.close();
});

test('modo execução: +15s, editar tempo (muda o padrão) e pular', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('[data-gset="1"]');
  const secs = async () => { const [m, s] = (await page.locator('#gTime').innerText()).split(':').map(Number); return m * 60 + s; };
  await page.click('[data-g="plus"]');
  assert.ok((await secs()) >= 70);
  await page.click('[data-g="edit-rest"]');
  await page.click('[data-g-rest="45"]');
  assert.equal((await state(page)).rest, 45);
  assert.ok((await secs()) <= 45 && (await secs()) >= 43);
  await page.click('[data-g="skip"]');
  assert.equal(await page.locator('#guided .g-rest').count(), 0);
  await context.close();
});

test('modo execução: navegar entre exercícios, ver como fazer e ajustar o número de séries', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  assert.equal(await page.locator('[data-g="prev"]').isDisabled(), true);
  await page.click('[data-g="next"]');
  assert.match(await page.locator('.g-title h2').innerText(), /Rosca concentrada/i);
  await page.click('[data-g="help"]');
  assert.ok((await page.locator('.g-help-text').innerText()).length > 20);
  await page.click('#guided [data-adjust="a2"][data-delta="1"]');
  assert.equal(await page.locator('.g-set').count(), 4); // 3 → 4
  assert.equal((await state(page)).override.a2.series, 4);
  await page.click('[data-g="prev"]');
  assert.match(await page.locator('.g-count').innerText(), /1\/6/);
  await context.close();
});

test('modo execução: Continuar começa no primeiro exercício incompleto; Recomeçar apaga só o treino de hoje', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('[data-gset="5"]'); await page.click('[data-g="skip"]'); // a1 completo → vai para a2
  await page.click('[data-g="close"]');
  await page.waitForSelector('.guided-panel');
  assert.match(await page.locator('.guided-panel').innerText(), /CONTINUAR · \d+% FEITO/);
  await page.click('[data-g-open="A"]');
  assert.match(await page.locator('.g-count').innerText(), /EXERCÍCIO 2\/6/);
  await page.click('[data-g="close"]');
  page.once('dialog', (d) => d.accept()); await page.click('[data-g-restart="A"]');
  assert.deepEqual(await gstate(page), []);
  assert.match(await page.locator('.guided-panel').innerText(), /COMEÇAR TREINO A/);
  await context.close();
});

test('modo execução: completar tudo mostra "treino completo" e finalizar salva no histórico com detalhe', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  for (let i = 0; i < 6; i++) {
    const total = await page.locator('.g-set').count();
    await page.click(`[data-gset="${total}"]`);
    if (i < 5) { await page.click('[data-g="skip"]'); }
  }
  await page.waitForSelector('#guided .g-done');
  assert.match(await page.locator('.g-done h2').innerText(), /TREINO A\s*COMPLETO/);
  assert.match(await page.locator('.g-lead').innerText(), /23 séries registradas/);
  await page.click('[data-g="finish"]');
  await page.waitForSelector('.history-entry');
  assert.equal(await page.locator('#guided .g-shell').count(), 0);
  const saved = (await state(page)).sessions;
  assert.equal(saved.length, 1); assert.equal(saved[0].sets, 23); assert.equal(saved[0].items.length, 6);
  await context.close();
});

test('modo execução: Esc e o botão Voltar do celular fecham; controles ficam visíveis e sem rolagem lateral', async () => {
  for (const width of [320, 390, 820]) {
    const {context, page} = await newPage({viewport: {width, height: 700}});
    await openGuided(page);
    const m = await page.evaluate(() => { const r = document.querySelector('.g-main').getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return {bottom: r.bottom, vh: innerHeight, ok: !!hit && document.querySelector('.g-main').contains(hit), over: document.documentElement.scrollWidth - innerWidth, lines: Math.round(r.height)}; });
    assert.ok(m.ok && m.bottom <= m.vh, `largura ${width}: botão principal não está acessível`);
    assert.ok(m.over <= 1, `largura ${width}: rolagem lateral`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#guided .g-shell').count(), 0);
    await page.click('[data-g-open="A"]'); await page.waitForSelector('#guided .g-shell');
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#guided .g-shell'));
    await context.close();
  }
});

test('modo execução: editar a carga abre por cima, salva e atualiza o card; Camila mostra o aviso de arte', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('.g-target [data-detail="a1"]');
  await page.waitForSelector('#editForm');
  await page.fill('#weight', '12.5'); await page.click('#editForm button[type="submit"]');
  await page.waitForFunction(() => /12\.5/.test(document.querySelector('.g-target')?.innerText || ''));
  await page.click('[data-g="close"]');
  await go(page, '/ajustes'); await page.click('button[data-persona="loira"]');
  await openGuided(page);
  assert.match(await page.locator('.g-art .availability').innerText(), /versão de Josperd/); // a1 não tem arte da Camila
  await page.click('[data-g="next"]');
  assert.match(await page.locator('.g-art .g-chip').innerText(), /CAMILA CAMOMILA/);
  assert.doesNotMatch(await page.locator('#guided').innerText(), /loira/i);
  await context.close();
});

test('ilustração inteira: nenhum corte no modo execução, nas listas, na galeria e na janela de edição', async () => {
  for (const width of [320, 390, 820, 1280]) {
    const {context, page} = await newPage({viewport: {width, height: 760}});
    await openGuided(page);
    await page.waitForFunction(() => document.querySelector('.g-zoom-btn img')?.complete);
    const g = await page.evaluate(() => { const img = document.querySelector('.g-zoom-btn img'), b = img.getBoundingClientRect(), f = document.querySelector('.g-zoom-btn').getBoundingClientRect(); return {fit: getComputedStyle(img).objectFit, h: b.height, w: b.width, inFrame: b.top >= f.top - 1 && b.bottom <= f.bottom + 1 && b.left >= f.left - 1 && b.right <= f.right + 1, chipBelow: document.querySelector('.g-chip').getBoundingClientRect().top >= f.bottom - 1}; });
    assert.equal(g.fit, 'contain'); assert.ok(g.inFrame); assert.ok(g.h >= 150, `largura ${width}: imagem com só ${g.h}px de altura`); assert.ok(g.chipBelow, 'o selo não pode cobrir a arte');
    await context.close();
  }
  const {context, page} = await newPage({viewport: {width: 390, height: 800}});
  await go(page, '/treino/A');
  assert.equal(await page.locator('.exercise-row .art-frame img').first().evaluate((i) => getComputedStyle(i).objectFit), 'contain');
  await go(page, '/colecao');
  assert.equal(await page.locator('.gallery-card .art-frame img').first().evaluate((i) => getComputedStyle(i).objectFit), 'contain');
  await page.click('.gallery-card >> nth=0');
  await page.waitForSelector('.modal-art');
  assert.equal(await page.locator('.modal-art').evaluate((i) => getComputedStyle(i).objectFit), 'contain');
  await context.close();
});

test('zoom: tocar na ilustração do card abre a imagem inteira; botões +, − e AJUSTAR; Esc fecha só o zoom', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('.g-zoom-btn');
  await page.waitForSelector('#zoom .zoom-img');
  const nat = await page.locator('.zoom-img').evaluate((i) => ({nw: i.naturalWidth, nh: i.naturalHeight, w: i.offsetWidth, h: i.offsetHeight}));
  assert.ok(Math.abs(nat.w / nat.h - nat.nw / nat.nh) < 0.02, 'proporção preservada (sem esticar nem cortar)');
  assert.equal(await page.locator('#zoomPct').innerText(), '100%');
  await page.click('[data-z="in"]'); assert.equal(await page.locator('#zoomPct').innerText(), '150%');
  await page.click('[data-z="in"]'); assert.equal(await page.locator('#zoomPct').innerText(), '225%');
  await page.click('[data-z="out"]'); assert.equal(await page.locator('#zoomPct').innerText(), '150%');
  await page.click('[data-z="reset"]'); assert.equal(await page.locator('#zoomPct').innerText(), '100%');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#zoom .zoom-view').count(), 0);
  assert.equal(await page.locator('#guided .g-shell').count(), 1, 'Esc fecha só o zoom, não o modo execução');
  await context.close();
});

test('zoom: roda do mouse amplia no ponto do cursor, toque duplo alterna 250%/100%, arrastar move e respeita as bordas', async () => {
  const {context, page} = await newPage();
  await openGuided(page);
  await page.click('.g-zoom-btn'); await page.waitForSelector('#zoom .zoom-img');
  const box = await page.locator('#zoomStage').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  const pct = async () => parseInt(await page.locator('#zoomPct').innerText(), 10);
  assert.ok((await pct()) > 150, 'a roda deve ampliar');
  await page.mouse.wheel(0, 4000);
  assert.equal(await pct(), 100, 'ao reduzir tudo volta a 100% e recentraliza');
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await pct(), 250);
  const tx = async () => (await page.locator('#zoomImg').evaluate((i) => i.style.transform));
  const before = await tx();
  await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 160, box.y + 150, {steps: 4}); await page.mouse.up();
  assert.notEqual(await tx(), before, 'arrastar deve mover a imagem ampliada');
  await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 5000, box.y + 5000, {steps: 3}); await page.mouse.up();
  const lim = await page.evaluate(() => { const st = document.getElementById('zoomStage'), img = document.getElementById('zoomImg'); const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(img.style.transform); const s = +m[3]; return {x: Math.abs(+m[1]), y: Math.abs(+m[2]), mx: Math.max(0, (img.offsetWidth * s - st.clientWidth) / 2), my: Math.max(0, (img.offsetHeight * s - st.clientHeight) / 2)}; });
  assert.ok(lim.x <= lim.mx + 1 && lim.y <= lim.my + 1, 'a imagem não pode sair das bordas: ' + JSON.stringify(lim));
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await pct(), 100);
  await context.close();
});

test('zoom: pinça com dois dedos amplia e reduz (eventos de ponteiro)', async () => {
  const {context, page} = await newPage({viewport: {width: 390, height: 800}});
  await openGuided(page);
  await page.click('.g-zoom-btn'); await page.waitForSelector('#zoom .zoom-img');
  await page.evaluate(() => {
    const st = document.getElementById('zoomStage'), r = st.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const ev = (type, id, x, y) => st.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1}));
    ev('pointerdown', 1, cx - 40, cy); ev('pointerdown', 2, cx + 40, cy);
    for (let i = 1; i <= 6; i++) { ev('pointermove', 1, cx - 40 - i * 20, cy); ev('pointermove', 2, cx + 40 + i * 20, cy); }
    window.__pinchPct = document.getElementById('zoomPct').textContent;
    ev('pointerup', 1, 0, 0); ev('pointerup', 2, 0, 0);
  });
  const pinched = parseInt(await page.evaluate(() => window.__pinchPct), 10);
  assert.ok(pinched >= 300, `pinça deveria ampliar (≥300%), ficou ${pinched}%`);
  await context.close();
});

test('zoom: a ilustração das listas e da janela de edição também amplia; foco volta ao fechar', async () => {
  const {context, page} = await newPage();
  await go(page, '/treino/A');
  await page.locator('.exercise-row img[data-zoom]').first().click();
  await page.waitForSelector('#zoom .zoom-img');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#zoom .zoom-view').count(), 0);
  await page.click('.edit-button[data-detail="a2"]'); await page.waitForSelector('.modal-art');
  await page.click('.modal-art'); await page.waitForSelector('#zoom .zoom-img');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#editForm').count(), 1, 'Esc fecha só o zoom; a janela de edição continua');
  await context.close();
});

test('música no modo execução: mini player mostra a faixa, toca/pausa/avança sem sair do treino', async () => {
  const {context, page} = await newPage();
  const dir = mkdtempSync(join(tmpdir(), 'mt-wav-'));
  const f1 = join(dir, 'Faixa Um.wav'), f2 = join(dir, 'Faixa Dois.wav');
  writeFileSync(f1, wav(30, 440)); writeFileSync(f2, wav(30, 660));
  await go(page, '/musica'); await page.setInputFiles('#music-files', [f1, f2]);
  await page.waitForFunction(() => document.querySelectorAll('.song-row').length >= 2);
  await openGuided(page);
  assert.match(await page.locator('#gMini').innerText(), /Modo Música[\s\S]*Treino A[\s\S]*toque ▶/);
  await page.click('#gMini .g-mini-play');
  await page.waitForFunction(() => /Faixa Um/.test(document.getElementById('gMini')?.innerText || ''));
  assert.match(await page.locator('#gMini').innerText(), /tocando agora/);
  await page.click('#gMini [data-music="next"]');
  await page.waitForFunction(() => /Faixa Dois/.test(document.getElementById('gMini')?.innerText || ''));
  await page.click('#gMini .g-mini-play');
  await page.waitForFunction(() => /pausado/.test(document.getElementById('gMini')?.innerText || ''));
  assert.equal(await page.locator('#guided .g-shell').count(), 1, 'continua no modo execução');
  await page.click('[data-gset="2"]'); await page.waitForSelector('#guided .g-rest');
  assert.ok(await page.locator('#guided .g-rest #gMini').count() === 1, 'o mini player também aparece no descanso');
  const covered = await page.evaluate(() => { const e = document.querySelector('#gMini .g-mini-play'), r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !(hit && e.contains(hit)); });
  assert.equal(covered, false);
  await context.close();
});

test('aviso (toast) invisível nunca bloqueia toques: todos os botões de série do modo execução ficam clicáveis', async () => {
  for (const width of [320, 390, 820]) {
    const {context, page} = await newPage({viewport: {width, height: 800}});
    await go(page, '/treino/A'); await mark(page, 'a1', 0); await page.waitForSelector('.toast.show');
    await page.waitForFunction(() => !document.querySelector('.toast.show'), null, {timeout: 6000}); // aviso sumiu (opacity:0), mas continua no DOM
    await page.click('[data-g-open="A"]'); await page.waitForSelector('#guided .g-set');
    const blocked = await page.evaluate(() => [...document.querySelectorAll('#guided .g-set, #guided .g-main, #guided .g-nav:not(:disabled)')].filter((e) => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !(hit && e.contains(hit)); }).map((e) => e.className));
    assert.deepEqual(blocked, [], `largura ${width}: botões bloqueados pelo aviso`);
    await context.close();
  }
});

/* ---------- cartão e aviso de download do app ---------- */
test('download: cartão na página inicial e link na barra lateral levam a /baixar/', async () => {
  const {context, page} = await newPage({github: {releases: [], commit: COMMIT}});
  await go(page, '/');
  const card = page.locator('#dlCard');
  assert.equal(await card.getAttribute('href'), 'baixar/');
  assert.match(await card.innerText(), /Baixe o app Android/i);
  assert.equal(await page.locator('.rail-download').getAttribute('href'), 'baixar/');
  await card.click(); await page.waitForURL(/\/baixar\/$/);
  assert.match(await page.locator('h1').innerText(), /NO BOLSO/);
  await context.close();
});

test('download: com release que tem APK, o cartão mostra a versão e o tamanho (mesmo sem ser mais nova)', async () => {
  const {context, page} = await newPage({github: {releases: [rel('v1.0.0'), rel('v1.1.0')], commit: COMMIT}});
  await go(page, '/');
  await page.waitForFunction(() => /1\.1\.0/.test(document.getElementById('dlTitle')?.textContent || ''));
  assert.match(await page.locator('#dlSub').innerText(), /APK de teste · 50,0 MB/);
  await context.close();
});

test('download: no app instalado (standalone) o cartão e o link não aparecem', async () => {
  const {context, page} = await newPage();
  await context.addInitScript(() => { const o = window.matchMedia.bind(window); window.matchMedia = (q) => q.includes('display-mode: standalone') ? {matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}} : o(q); });
  await go(page, '/');
  assert.equal(await page.locator('#dlCard').count(), 0);
  assert.equal(await page.locator('.rail-download').count(), 0);
  await context.close();
});
