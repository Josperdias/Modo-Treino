// Simula o GitHub Pages: o site sai em https://<usuario>.github.io/Modo-Treino/ (SUBCAMINHO), não na raiz.
// Garante que caminhos, service worker, offline, manifesto e a página /baixar/ funcionam nesse formato.
//   node --test tests/e2e/pages-subpath.e2e.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {join, extname, normalize, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); } })();
const SITE = join(dirname(fileURLToPath(import.meta.url)), '../../site');
const BASE_PATH = '/Modo-Treino/';
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.woff2': 'font/woff2'};
let server, origin, browser;
test.before(async () => {
  server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith(BASE_PATH)) { res.writeHead(404).end('fora do subcaminho (como no GitHub Pages)'); return; }
    let file = normalize(join(SITE, p.slice(BASE_PATH.length)));
    if (!file.startsWith(SITE)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600'}); res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  origin = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
});
test.after(async () => { await browser?.close(); await new Promise((ok) => server.close(ok)); });

test('site em subcaminho: carrega sem 404, com fontes locais, e o service worker assume o escopo certo', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const bad = []; page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + BASE_PATH); await page.waitForSelector('#main > *');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
  assert.equal(scope, origin + BASE_PATH, 'o service worker deve controlar /Modo-Treino/ e não a raiz');
  assert.deepEqual(bad, []); assert.deepEqual(errors, []);
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [document.fonts.check("900 20px 'Barlow Condensed'"), document.fonts.check("16px 'DM Sans'")]; });
  assert.deepEqual(fonts, [true, true]);
  await ctx.close();
});

test('site em subcaminho: links, rotas, imagens e a página /baixar/ funcionam', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const bad = []; page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await page.goto(origin + BASE_PATH + '#/treino/A'); await page.waitForSelector('.exercise-row');
  await page.waitForFunction(() => { const vis = [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight); return vis.length > 0 && vis.every((i) => i.complete && i.naturalWidth > 0); }); // imagens lazy fora da tela só carregam ao rolar
  await page.goto(origin + BASE_PATH + '#/'); await page.waitForSelector('#dlCard');
  assert.equal(new URL(await page.locator('#dlCard').evaluate((a) => a.href)).pathname, BASE_PATH + 'baixar/');
  await page.click('#dlCard'); await page.waitForURL(origin + BASE_PATH + 'baixar/');
  assert.match(await page.locator('h1').innerText(), /NO BOLSO/);
  await page.click('.back'); await page.waitForURL(origin + BASE_PATH);
  assert.deepEqual(bad, []);
  const m = await (await page.request.get(origin + BASE_PATH + 'manifest.webmanifest')).json();
  for (const ic of m.icons) assert.equal((await page.request.get(origin + BASE_PATH + ic.src)).status(), 200, ic.src);
  await ctx.close();
});

test('site em subcaminho: depois da primeira visita abre offline, inclusive a página de download', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(origin + BASE_PATH + '#/treino/B'); await page.waitForSelector('.exercise-row');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => { const ks = await caches.keys(); const m = ks.find((k) => k.includes('media')); return m && (await (await caches.open(m)).keys()).length >= 40; }, null, {timeout: 20000});
  await page.reload(); await page.waitForSelector('.exercise-row');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.exercise-row');
  await page.waitForFunction(() => { const vis = [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight); return vis.length > 0 && vis.every((i) => i.complete && i.naturalWidth > 0); });
  await page.goto(origin + BASE_PATH + 'baixar/'); await page.waitForSelector('h1');
  assert.match(await page.locator('h1').innerText(), /NO BOLSO/);
  await ctx.close();
});
