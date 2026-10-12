// Gera prints REAIS das telas a partir de interações reais (sem dados fictícios injetados).
//   node scripts/capturar-prints.mjs <saida> [--native <pasta do expo export --platform web>]
// Requer Chromium (CHROMIUM_PATH opcional). Os prints do app nativo vêm de react-native-web: NÃO são capturas de aparelho.
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync, existsSync, statSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {join, extname, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const require = createRequire(import.meta.url);
const {chromium} = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); } })();
const out = resolve(process.argv[2] || 'screenshots/novos');
const nativeDir = process.argv.includes('--native') ? resolve(process.argv[process.argv.indexOf('--native') + 1]) : null;
mkdirSync(out, {recursive: true});
const SITE = join(dirname(fileURLToPath(import.meta.url)), '../site');
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.woff2': 'font/woff2'};
const serve = (root) => new Promise((ok) => {
  const s = http.createServer((req, res) => {
    let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!f.startsWith(root)) return res.writeHead(403).end();
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, {'Content-Type': MIME[extname(f)] || 'application/octet-stream'}); res.end(readFileSync(f));
  });
  s.listen(0, '127.0.0.1', () => ok({s, url: `http://localhost:${s.address().port}`}));
});
function wav(seconds, hz) {
  const rate = 8000, n = Math.floor(rate * seconds), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 3000), 44 + i * 2);
  return b;
}
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required']});
const shot = (page, name) => page.screenshot({path: join(out, name + '.png')});
const site = await serve(SITE);

/* ---------- SITE / PWA ---------- */
for (const [label, viewport] of [['mobile', {width: 390, height: 844}], ['desktop', {width: 1366, height: 850}]]) {
  const ctx = await browser.newContext({viewport, deviceScaleFactor: label === 'mobile' ? 2 : 1});
  const page = await ctx.newPage();
  const go = async (r) => { await page.goto(`${site.url}/#${r}`); await page.waitForSelector('#main > *'); await page.waitForTimeout(500); };
  await go('/'); await shot(page, `site-${label}-01-inicio`);
  const dir = mkdtempSync(join(tmpdir(), 'mt-'));
  writeFileSync(join(dir, 'Aquecimento (tom 440 Hz).wav'), wav(40, 440)); writeFileSync(join(dir, 'Pesado (tom 660 Hz).wav'), wav(40, 660));
  await go('/musica'); await page.setInputFiles('#music-files', [join(dir, 'Aquecimento (tom 440 Hz).wav'), join(dir, 'Pesado (tom 660 Hz).wav')]);
  await page.waitForFunction(() => document.querySelectorAll('.song-row').length >= 2); await page.click('.transport-main'); await page.waitForTimeout(800);
  await go('/treino/A');
  for (const [id, n] of [['a1', 0], ['a1', 1], ['a2', 0]]) await page.click(`button.set-box[data-set="${id}"][data-index="${n}"]`);
  await page.waitForTimeout(400); await shot(page, `site-${label}-02-treino-a-descanso`);
  await go('/treino/B'); await shot(page, `site-${label}-03-treino-b`);
  /* modo execução: um card por exercício, botões de séries, descanso e treino completo */
  await go('/treino/A'); await page.click('[data-g-open="A"]'); await page.waitForSelector('#guided .g-shell');
  await page.waitForFunction(() => !document.querySelector('.toast.show'), null, {timeout: 6000}); await page.waitForTimeout(400);
  await shot(page, `site-${label}-04-modo-execucao-card`);
  await page.click('.g-zoom-btn'); await page.waitForSelector('#zoom .zoom-img'); await page.click('[data-z="in"]'); await page.click('[data-z="in"]'); await page.waitForTimeout(300);
  await shot(page, `site-${label}-05-modo-execucao-zoom`); await page.keyboard.press('Escape');
  await page.click('[data-gset="3"]'); await page.waitForSelector('#guided .g-rest'); await page.waitForTimeout(300);
  await shot(page, `site-${label}-06-modo-execucao-descanso`);
  for (let i = 0; i < 12 && !(await page.locator('#guided .g-done').count()); i++) {
    if (await page.locator('#guided .g-rest').count()) await page.click('[data-g="skip"]');
    if (await page.locator('#guided .g-done').count()) break;
    const total = await page.locator('.g-set').count(); if (total) await page.click(`[data-gset="${total}"]`);
  }
  await page.waitForSelector('#guided .g-done'); await shot(page, `site-${label}-07-modo-execucao-completo`);
  await page.click('[data-g="finish"]'); await page.waitForSelector('.history-entry');
  await page.locator('.history-entry summary').first().click(); await page.waitForTimeout(300); await shot(page, `site-${label}-08-historico`);
  await go('/colecao'); await page.click('button[data-persona="loira"]'); await page.waitForTimeout(300); await shot(page, `site-${label}-09-colecao-camila`);
  await go('/ajustes'); await page.check('input[data-sound="enabled"]'); await page.waitForTimeout(300);
  await page.locator('.sounds-panel').scrollIntoViewIfNeeded(); await shot(page, `site-${label}-10-ajustes-audio`);
  await go('/musica'); await page.waitForTimeout(900); await shot(page, `site-${label}-11-musica-fitas`);
  await page.goto(`${site.url}/baixar/`); await page.waitForTimeout(900); await shot(page, `site-${label}-12-baixar`);
  await ctx.close();
}

/* ---------- APP NATIVO via react-native-web ---------- */
if (nativeDir) {
  const nat = await serve(nativeDir);
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  const page = await ctx.newPage();
  await page.goto(nat.url + '/'); await page.waitForTimeout(1500); await shot(page, 'app-01-inicio');
  const tab = (n) => page.locator(`[role="tab"][aria-label="${n}"]`).click();
  await tab('TREINO A'); await page.getByText(/COMEÇAR TREINO A/).first().click(); await page.getByText('EXERCÍCIO 1/6').waitFor(); await page.waitForTimeout(500); await shot(page, 'app-02-modo-execucao-card');
  await page.locator('[aria-label^="Ampliar a ilustração"]').last().click(); await page.locator('[aria-label="Aumentar zoom"]').click(); await page.locator('[aria-label="Aumentar zoom"]').click(); await page.waitForTimeout(300); await shot(page, 'app-02b-zoom'); await page.locator('[aria-label="Fechar imagem ampliada"]').click();
  const setBtn = (k) => page.locator(`[aria-label="${k} ${k === 1 ? 'série feita' : 'séries feitas'} de Rosca direta na barra W"]`);
  await setBtn(3).click(); await page.getByText('PRÓXIMA: SÉRIE 4 DE 5').waitFor(); await page.waitForTimeout(300); await shot(page, 'app-03-modo-execucao-descanso');
  await page.locator('[aria-label="Pular descanso"]').click(); await page.getByText('TOQUE EM QUANTAS SÉRIES VOCÊ FEZ').waitFor();
  for (let i = 0; i < 12 && !(await page.getByText(/COMPLETO!/).count()); i++) {
    if (await page.locator('[aria-label="Pular descanso"]').count()) await page.locator('[aria-label="Pular descanso"]').click();
    if (await page.getByText(/COMPLETO!/).count()) break;
    const n = await page.locator('[aria-label*="séries feitas de"], [aria-label*="série feita de"]').count(); if (n) await page.locator('[aria-label*="séries feitas de"], [aria-label*="série feita de"]').nth(n - 1).click();
  }
  await page.getByText(/COMPLETO!/).waitFor(); await shot(page, 'app-04-modo-execucao-completo');
  await page.getByText('FINALIZAR E SALVAR ✓').click(); await page.getByText('SEU HISTÓRICO').waitFor();
  await page.locator('[aria-label^="Treino A, "]').first().click(); await page.waitForTimeout(300); await shot(page, 'app-05-historico');
  await tab('MÚSICA'); await page.waitForTimeout(400); await shot(page, 'app-06-musica-fitas');
  await tab('ARTES'); await page.locator('[aria-label="Escolher Camila Camomila, a ruivinha"]').first().click(); await page.waitForTimeout(400); await shot(page, 'app-07-colecao-camila');
  await page.getByText('CAMILA', {exact: true}).first().click(); await page.getByText('O SEU MODO').waitFor(); await page.getByText('BIBLIOTECA DE SONS').scrollIntoViewIfNeeded(); await shot(page, 'app-08-ajustes-audio');
  await ctx.close(); nat.s.close();
}
await browser.close(); site.s.close();
console.log('prints em', out);
