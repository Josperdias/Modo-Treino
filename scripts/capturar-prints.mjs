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
// As músicas do "celular" nos prints são simuladas (no navegador não existe MediaStore); o restante vem de interações reais.
if (nativeDir) {
  const nat = await serve(nativeDir);
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, reducedMotion: 'reduce'});
  await ctx.addInitScript(() => {
    window.__MODO_DEVICE__ = {permission: 'granted', tracks: [['Eye of the Tiger', 245], ['Lose Yourself', 326], ['Till I Collapse', 297], ['Stronger', 312], ['Remember the Name', 231]].map(([title, duration], i) => ({id: 'dev:' + i, title, uri: 'file:///musica/' + i + '.mp3', duration, source: 'device'}))};
  });
  const page = await ctx.newPage();
  const pause = (ms = 700) => page.waitForTimeout(ms);
  await page.goto(nat.url + '/'); await pause(2200); await shot(page, 'app-01-inicio');
  await page.getByLabel('Abrir treino B').scrollIntoViewIfNeeded(); await pause(); await shot(page, 'app-02-escolha-treino');
  await page.getByLabel('Abrir treino A').click(); await pause(900); await shot(page, 'app-03-treino-a');
  await page.getByLabel(/^Começar treino A/).last().click(); await page.getByText('EXERCÍCIO 1/6').waitFor(); await pause(); await shot(page, 'app-04-cartao-exercicio');
  await page.getByLabel(/^Ampliar a ilustração/).last().click(); await page.getByLabel('Aumentar zoom').click(); await pause(300); await page.getByLabel('Aumentar zoom').click(); await pause(500); await shot(page, 'app-05-zoom'); await page.getByLabel('Fechar imagem ampliada').click();
  const setBtn = (k) => page.locator(`[aria-label="${k} ${k === 1 ? 'série feita' : 'séries feitas'} de Rosca direta na barra W"]`);
  await setBtn(3).click(); await pause(500); await shot(page, 'app-06-series-sem-descanso');
  await setBtn(5).click(); await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).waitFor(); await pause(); await shot(page, 'app-07-descanso-entre-exercicios');
  await page.getByLabel('Pular descanso').click(); await pause();
  for (let i = 0; i < 45 && !(await page.getByText(/COMPLETO!/).count()); i++) {
    if (await page.getByLabel('Pular descanso').count()) await page.getByLabel('Pular descanso').click();
    if (await page.getByText(/COMPLETO!/).count()) break;
    await page.getByLabel(/^(CONCLUIR SÉRIE|PRÓXIMO EXERCÍCIO|TERMINAR)/).first().click().catch(() => {}); await pause(180);
  }
  await page.getByText(/COMPLETO!/).waitFor(); await pause(); await shot(page, 'app-08-treino-completo');
  await page.getByLabel('FINALIZAR E SALVAR').click(); await page.getByText('Seu histórico.').waitFor(); await pause();
  await page.getByLabel(/^Treino A, /).first().click(); await pause(400); await shot(page, 'app-09-historico');
  await page.getByRole('tab', {name: 'Músicas', exact: true}).click(); await pause();
  await page.getByLabel('Adicionar músicas do celular').click(); await page.getByText('Adicionar à Treino A').waitFor();
  await page.getByRole('checkbox', {name: 'Eye of the Tiger'}).click(); await page.getByRole('checkbox', {name: 'Lose Yourself'}).click(); await pause(); await shot(page, 'app-10-musicas-do-celular');
  await page.getByLabel(/^ADICIONAR \d/).click(); await pause(3200); await shot(page, 'app-11-musica-fitas');
  await page.getByLabel('Editar fita').click(); await pause(); await shot(page, 'app-12-editar-fita');
  await page.getByLabel('Concluir edição da fita').click();
  await page.getByRole('tab', {name: 'Início', exact: true}).click(); await pause();
  await page.getByLabel('Abrir ajustes').click(); await page.getByText('Ajustes', {exact: true}).waitFor(); await pause(); await shot(page, 'app-13-ajustes');
  await ctx.close(); nat.s.close();
}
await browser.close(); site.s.close();
console.log('prints em', out);
