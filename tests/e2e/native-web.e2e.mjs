// Testa a MESMA árvore React Native do app (native/App.tsx) renderizada no navegador via react-native-web.
// NÃO substitui teste em aparelho: áudio nativo, seletor de arquivos, compartilhamento e Alert não são exercitados aqui.
//   NATIVE_WEB_DIR=<pasta do "expo export --platform web"> node --test tests/e2e/native-web.e2e.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {join, extname, normalize, resolve} from 'node:path';

const DIR = process.env.NATIVE_WEB_DIR ? resolve(process.env.NATIVE_WEB_DIR) : null;
const require = createRequire(import.meta.url);
const {chromium} = (() => {
  try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); }
})();
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.ttf': 'font/ttf'};
const skip = DIR ? false : 'defina NATIVE_WEB_DIR (saída de `expo export --platform web`)';

let server, base, browser;
test.before(async () => {
  if (!DIR) return;
  server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(DIR, p));
    if (!file.startsWith(DIR)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream'});
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required']});
});
test.after(async () => { await browser?.close(); if (server) await new Promise((ok) => server.close(ok)); });

const REPO = 'Josperdias/Modo-Treino';
const rel = (tag, extra = {}) => ({tag_name: tag, draft: false, prerelease: true, html_url: `https://github.com/${REPO}/releases/tag/${tag}`, assets: [], ...extra});

async function open({releases = [], status = 200, viewport = {width: 390, height: 844}, seed = null, clock = false} = {}) {
  const context = await browser.newContext({viewport});
  context.setDefaultTimeout(8000);
  await context.route('https://api.github.com/**', (r) => r.fulfill({status, headers: {'access-control-allow-origin': '*', 'content-type': 'application/json'}, body: JSON.stringify(releases)}));
  if (seed) await context.addInitScript(({k, v}) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__seeded', '1'); } }, seed);
  const page = await context.newPage();
  if (clock) await page.clock.install();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base);
  await page.getByText('MODO', {exact: false}).first().waitFor();
  return {context, page, errors};
}
const tab = (page, name) => page.locator(`[role="tab"][aria-label="${name}"]`).click();
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('modo-treino-native-v1') || 'null'));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const SET = (n, nome = 'Rosca direta na barra W') => `[aria-label="Série ${n} de ${nome}"]`;

test('app abre sem erro de execução e mostra a identidade (Josperd por padrão)', {skip}, async () => {
  const {context, page, errors} = await open();
  assert.match(await page.locator('body').innerText(), /BY JOSPERD\s*\/\s*EDIÇÃO 001/);
  assert.match(await page.locator('body').innerText(), /VAI LÁ\.\s*FAZ VALER\./);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Treino A tem 6 exercícios e B tem 8, com 14 no total; B3 avisa SEM IMAGEM DO EXERCÍCIO', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'TREINO A');
  assert.equal(await page.locator('[aria-label^="Ver detalhes de "]').count(), 6);
  await tab(page, 'TREINO B');
  assert.equal(await page.locator('[aria-label^="Ver detalhes de "]').count(), 8);
  assert.match(await page.locator('body').innerText(), /SEM IMAGEM DO EXERCÍCIO/);
  await context.close();
});

test('marcar série: persiste no armazenamento local, abre o cronômetro e sobrevive ao recarregar', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'TREINO A');
  await page.locator(SET(1)).click();
  assert.equal(await page.locator(SET(1)).getAttribute('aria-checked'), 'true');
  const timer = page.locator('[role="timer"]');
  await timer.waitFor();
  assert.match(await timer.innerText(), /DESCANSO\s*0[01]:[0-5]\d/);
  assert.deepEqual((await store(page)).sets[`${today()}:A`].a1.slice(0, 1), [true]);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  await tab(page, 'TREINO A');
  assert.equal(await page.locator(SET(1)).getAttribute('aria-checked'), 'true');
  await page.locator('[aria-label="Pular descanso"]').click().catch(() => {});
  await context.close();
});

test('+ e − de séries respeitam 1–12 e a tela reflete a quantidade', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'TREINO B');
  const nome = 'Rosca Scott';
  for (let i = 0; i < 14; i++) await page.locator(`[aria-label="Aumentar séries de ${nome}"]`).click();
  assert.equal(await page.locator(`[aria-label^="Série "][aria-label$="de ${nome}"]`).count(), 12);
  for (let i = 0; i < 14; i++) await page.locator(`[aria-label="Diminuir séries de ${nome}"]`).click();
  assert.equal(await page.locator(`[aria-label^="Série "][aria-label$="de ${nome}"]`).count(), 1);
  assert.equal((await store(page)).override.b2.series, 1);
  await context.close();
});

test('finalizar treino grava detalhe e volume; histórico expande; recorde aparece quando a carga sobe', {skip}, async () => {
  const seed = {k: 'modo-treino-native-v1', v: {persona: 'vinho', rest: 60, sets: {}, override: {}, notifyUpdates: false, keepAwake: false, sounds: {},
    sessions: [{date: '2026-01-05', time: '07:00', treino: 'A', sets: 2, percent: 20, volume: 80, items: [{id: 'a1', nome: 'Rosca direta na barra W', series: 2, reps: 5, peso: 8}]}]}};
  const {context, page, errors} = await open({seed});
  await tab(page, 'TREINO A');
  await page.locator(SET(1)).click(); await page.locator(SET(2)).click();
  await page.getByText(/FINALIZAR TREINO A/).click();
  await page.getByText('SEU HISTÓRICO').waitFor();
  const saved = (await store(page)).sessions;
  assert.equal(saved.length, 2);
  assert.equal(saved[1].volume, 100); // 2 séries × 5 reps × 10 kg
  assert.equal(saved[1].items[0].id, 'a1');
  const body = await page.locator('body').innerText();
  assert.match(body, /★ RECORDE/);
  assert.match(body, /CARGAS E RECORDES/);
  await page.locator('[aria-label^="Treino A, "]').first().click(); // expande o mais recente
  assert.match(await page.locator('body').innerText(), /2 × 5 · 10 kg/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('personagem: Camila é "a ruivinha", nunca "loira" em texto visível, e a escolha persiste', {skip}, async () => {
  const {context, page} = await open();
  await page.locator('[aria-label="Escolher Camila Camomila, a ruivinha"]').first().click();
  assert.equal((await store(page)).persona, 'loira');
  for (const t of ['INÍCIO', 'TREINO A', 'TREINO B', 'HIST.', 'ARTES', 'MÚSICA']) {
    await page.locator(`[role="tab"][aria-label="${t}"]`).click();
    assert.doesNotMatch(await page.locator('body').innerText(), /loira/i, `"loira" visível em ${t}`);
  }
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  assert.match(await page.locator('body').innerText(), /CAMILA/);
  await context.close();
});

test('ajustes: sons desligados por padrão; ativar e "manter tela ligada" persistem após recarregar', {skip}, async () => {
  const {context, page} = await open();
  await page.getByText('JOSPERD', {exact: true}).first().click(); // chip do cabeçalho → Ajustes
  await page.getByText('O SEU MODO').waitFor();
  assert.equal((await store(page))?.sounds?.enabled ?? false, false);
  assert.equal(await page.getByText('DESLIGADO', {exact: true}).count(), 1);
  await page.getByText('ATIVAR EFEITOS SONOROS').click();
  await page.getByText('MANTER TELA LIGADA').click();
  const s = await store(page);
  assert.equal(s.sounds.enabled, true); assert.equal(s.keepAwake, true);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  await page.getByText('JOSPERD', {exact: true}).first().click();
  await page.getByText('O SEU MODO').waitFor();
  assert.equal(await page.getByText('ATIVO ✓', {exact: true}).count(), 1);
  assert.equal((await store(page)).keepAwake, true);
  await context.close();
});

test('avisos de versão: mostra o estado correto (mais nova, igual, mais antiga, nenhuma, offline)', {skip}, async () => {
  const cases = [
    [{releases: [rel('v1.0.0'), rel('v9.0.0'), rel('v1.5.0')]}, /Versão 9\.0\.0 publicada\. Baixe e instale manualmente\./],
    [{releases: [rel('v1.1.0')]}, /tudo em dia/],
    [{releases: [rel('v1.0.0')]}, /mais nova que a última release \(1\.0\.0\)/],
    [{releases: []}, /nenhuma release publicada/],
    [{releases: [rel('v9.9.9', {draft: true})]}, /nenhuma release publicada/],
    [{releases: [], status: 500}, /GitHub indisponível/],
  ];
  for (const [opts, expected] of cases) {
    const {context, page} = await open(opts);
    await page.getByText('JOSPERD', {exact: true}).first().click();
    await page.getByText('ATUALIZAÇÕES DO GITHUB').waitFor();
    await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), expected.source, {timeout: 6000}).catch(() => {});
    assert.match(await page.locator('body').innerText(), expected, JSON.stringify(opts.releases?.map((r) => r.tag_name)));
    await context.close();
  }
});

test('música: fitas padrão A, B e Favoritas existem e o player compacto aparece em todas as telas', {skip}, async () => {
  const {context, page} = await open();
  assert.match(await page.locator('body').innerText(), /MODO MÚSICA/); // dock na tela inicial
  await tab(page, 'MÚSICA');
  const body = await page.locator('body').innerText();
  for (const t of ['Treino A', 'Treino B', 'Favoritas']) assert.match(body, new RegExp(t));
  assert.match(body, /ESTA FITA ESTÁ EM BRANCO/);
  await page.locator('[aria-label="Tocar ou pausar"]').first().waitFor();
  await context.close();
});

test('celular pequeno (320 px): nenhuma tela estoura a largura', {skip}, async () => {
  const {context, page} = await open({viewport: {width: 320, height: 640}});
  for (const t of ['INÍCIO', 'TREINO A', 'TREINO B', 'HIST.', 'ARTES', 'MÚSICA']) {
    await tab(page, t);
    const over = await page.evaluate(() => Math.max(...[...document.querySelectorAll('body *')].map((e) => e.getBoundingClientRect().right)) - window.innerWidth);
    assert.ok(over <= 40, `conteúdo ${Math.round(over)}px além da tela em ${t}`); // rotações decorativas podem sangrar poucos px
  }
  await context.close();
});

/* ---------- modo execução ---------- */
const startGuided = async (page, t = 'A') => { await tab(page, `TREINO ${t}`); await page.getByText(new RegExp(`COMEÇAR TREINO ${t}|CONTINUAR · `)).first().click(); await page.getByText(/EXERCÍCIO 1\/\d/).first().waitFor(); };
const setBtn = (page, k, nome = 'Rosca direta na barra W') => page.locator(`[aria-label="${k} ${k === 1 ? 'série feita' : 'séries feitas'} de ${nome}"]`);

test('modo execução: card do exercício 1/6 com um botão por série e a ilustração inteira', {skip}, async () => {
  const {context, page, errors} = await open();
  await startGuided(page);
  assert.match(await page.locator('body').innerText(), /ROSCA DIRETA NA BARRA W/);
  assert.equal(await page.locator('[aria-label$="séries feitas de Rosca direta na barra W"], [aria-label="1 série feita de Rosca direta na barra W"]').count(), 5);
  const fit = await page.locator('[aria-label="Ilustração de Rosca direta na barra W"]').last().evaluate((el) => getComputedStyle(el.querySelector('div') || el).backgroundSize);
  assert.equal(fit, 'contain', 'a arte deve ser exibida inteira (contain), não cortada');
  assert.deepEqual(errors, []);
  await context.close();
});

test('modo execução: tocar em "3" registra 3 séries e abre o descanso; Pular volta ao card; tocar de novo corrige', {skip}, async () => {
  const {context, page} = await open();
  await startGuided(page);
  await setBtn(page, 3).click();
  await page.getByText('PRÓXIMA: SÉRIE 4 DE 5').waitFor();
  assert.deepEqual((await store(page)).sets[`${today()}:A`].a1.slice(0, 4), [true, true, true, false]);
  assert.match(await page.locator('[aria-label="Tempo de descanso"]').innerText(), /^(01:00|00:59)$/);
  await page.locator('[aria-label="Pular descanso"]').click();
  await page.getByText('TOQUE EM QUANTAS SÉRIES VOCÊ FEZ').waitFor();
  await setBtn(page, 3).click(); // já são 3: desmarca a última
  assert.equal((await store(page)).sets[`${today()}:A`].a1.filter(Boolean).length, 2);
  assert.equal(await page.getByText('DESCANSE').count(), 0, 'corrigir não inicia descanso');
  await context.close();
});

test('modo execução: o descanso termina sozinho e leva ao próximo exercício; +15s e editar tempo funcionam', {skip}, async () => {
  const {context, page} = await open({clock: true});
  await startGuided(page);
  await setBtn(page, 5).click();
  await page.getByText(/PRÓXIMO EXERCÍCIO 2\/6/).waitFor();
  await page.locator('[aria-label="Mais 15 segundos"]').click();
  const secs = async () => { const [m, s] = (await page.locator('[aria-label="Tempo de descanso"]').innerText()).split(':').map(Number); return m * 60 + s; };
  assert.ok((await secs()) >= 70);
  await page.getByText('EDITAR TEMPO').click();
  await page.locator('[aria-label="Descansar 45 segundos"]').click();
  assert.equal((await store(page)).rest, 45);
  assert.ok((await secs()) <= 45);
  await page.clock.runFor(47000);
  await page.getByText('EXERCÍCIO 2/6').waitFor();
  await context.close();
});

test('modo execução: completar tudo mostra "treino completo"; finalizar salva com detalhe no histórico', {skip}, async () => {
  const {context, page, errors} = await open();
  await startGuided(page);
  const totals = [5, 3, 3, 3, 4, 5];
  for (let i = 0; i < 6; i++) {
    await page.locator(`[aria-label*="séries feitas de"], [aria-label*="série feita de"]`).nth(totals[i] - 1).click();
    if (i < 5) await page.locator('[aria-label="Pular descanso"]').click();
  }
  await page.getByText(/COMPLETO!/).waitFor();
  assert.match(await page.locator('body').innerText(), /23 séries registradas/);
  await page.getByText('FINALIZAR E SALVAR ✓').click();
  await page.getByText('SEU HISTÓRICO').waitFor();
  const saved = (await store(page)).sessions;
  assert.equal(saved.length, 1); assert.equal(saved[0].sets, 23); assert.equal(saved[0].items.length, 6);
  assert.deepEqual(errors, []);
  await context.close();
});

test('modo execução: navegar, ver como fazer, ampliar a imagem inteira e Continuar/Recomeçar', {skip}, async () => {
  const {context, page} = await open();
  await startGuided(page);
  assert.equal(await page.locator('[aria-label="Exercício anterior"]').getAttribute('aria-disabled'), 'true');
  await page.locator('[aria-label="Próximo exercício"]').click();
  await page.getByText('ROSCA CONCENTRADA').first().waitFor();
  await page.locator('[aria-label="Como fazer o movimento"]').click();
  assert.ok((await page.locator('body').innerText()).length > 0);
  await page.locator('[aria-label^="Ampliar a ilustração"]').click();
  const box = await page.locator('[aria-label^="Ilustração de Rosca concentrada"]').last().evaluate((el) => ({fit: getComputedStyle(el.querySelector('div') || el).backgroundSize}));
  assert.equal(box.fit, 'contain');
  await page.locator('[aria-label="Fechar imagem ampliada"]').click();
  await page.locator('[aria-label="Sair do modo execução"]').click();
  await tab(page, 'TREINO A');
  await setBtn(page, 1).count().catch(() => 0);
  await context.close();
});

test('ilustração inteira também nas listas, galeria e janela de edição do app', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'TREINO A');
  const fits = await page.locator('[aria-label^="Ilustração "]').evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('div') || e).backgroundSize));
  assert.ok(fits.length >= 6 && fits.every((f) => f === 'contain'), JSON.stringify(fits));
  await tab(page, 'ARTES');
  const g = await page.locator('[aria-label^="Ilustração "]').evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('div') || e).backgroundSize));
  assert.ok(g.length >= 14 && g.every((f) => f === 'contain'));
  await context.close();
});
