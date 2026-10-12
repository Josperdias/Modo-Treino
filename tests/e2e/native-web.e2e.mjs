// Testa a MESMA árvore React Native do app (native/App.tsx) renderizada no navegador via react-native-web.
// NÃO substitui teste em aparelho: áudio nativo, permissões do Android, seletor de arquivos, compartilhamento e Alert não são exercitados aqui.
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
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf'};
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
const INSTALLED = JSON.parse(readFileSync(new URL('../../native/package.json', import.meta.url), 'utf8')).version;
const bump = (v, k) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + k}`; };
const rel = (tag, extra = {}) => ({tag_name: tag, draft: false, prerelease: true, html_url: `https://github.com/${REPO}/releases/tag/${tag}`, assets: [], ...extra});
const APP = 'modo-treino-native-v1', MUSIC = 'modotreino-native-music-v1';
const TRACKS = [['Eye of the Tiger', 245], ['Lose Yourself', 326], ['Till I Collapse', 297], ['Stronger', 312]].map(([title, duration], i) => ({id: 'dev:' + i, title, uri: 'file:///musica/' + i + '.mp3', duration, source: 'device'}));

/** seed: {chave: valor} gravado no localStorage antes do app abrir (uma vez). device: simula o MediaStore (só no navegador). */
async function open({releases = [], status = 200, viewport = {width: 390, height: 844}, seed = null, device = null, clock = false, touch = false} = {}) {
  const context = await browser.newContext({viewport, hasTouch: touch, isMobile: touch});
  context.setDefaultTimeout(8000);
  await context.route('https://api.github.com/**', (r) => r.fulfill({status, headers: {'access-control-allow-origin': '*', 'content-type': 'application/json'}, body: JSON.stringify(releases)}));
  await context.addInitScript(({seed, device}) => {
    if (device) window.__MODO_DEVICE__ = device;
    if (seed && !localStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__seeded', '1'); }
  }, {seed, device});
  const page = await context.newPage();
  if (clock) await page.clock.install();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base);
  await page.getByText('MODO', {exact: false}).first().waitFor();
  return {context, page, errors};
}
const store = (page, key = APP) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tab = (page, name) => page.getByRole('tab', {name, exact: true}).click();
// as telas entram com animação; espera ela assentar antes de ler o texto
const body = async (page) => { await page.waitForTimeout(380); return page.locator('body').innerText(); };
const settle = (page, ms = 450) => page.waitForTimeout(ms);
const openSettings = async (page) => { await page.getByLabel('Abrir ajustes').click(); await page.getByText('Ajustes', {exact: true}).waitFor(); };
const closeSheet = (page) => page.getByRole('button', {name: 'Fechar', exact: true}).last().click();
const openTreino = async (page, t = 'A') => { await page.getByLabel(`Abrir treino ${t}`).click(); await page.getByLabel('Voltar ao início').waitFor(); };
const startWorkout = async (page, t = 'A') => {
  await page.getByLabel(new RegExp(`^(Começar|Continuar|Rever o) treino ${t}|Continuar o treino|Rever o treino`)).last().click();
  await page.getByText(/EXERCÍCIO 1\/\d/).first().waitFor();
};
const setBtn = (page, k, nome = 'Rosca direta na barra W') => page.locator(`[aria-label="${k} ${k === 1 ? 'série feita' : 'séries feitas'} de ${nome}"]`);
const A = [['Rosca direta na barra W', 5], ['Rosca concentrada', 3], ['Rosca martelo', 3], ['Remada curvada unilateral', 3], ['Encolhimento para trapézio', 4], ['Remada alta na barra W', 5]];
const musicLib = (extra = {}) => ({tracks: TRACKS.slice(0, 3), tapes: [{id: 'a', name: 'Treino A', ids: ['dev:0', 'dev:1', 'dev:2']}, {id: 'b', name: 'Treino B', ids: []}, {id: 'fav', name: 'Favoritas', ids: []}], selected: 'a', fade: 3, shuffle: false, repeat: false, ...extra});

/* ================= identidade e estrutura ================= */
test('app abre sem erro, com a identidade e só 3 abas', {skip}, async () => {
  const {context, page, errors} = await open();
  const t = await body(page);
  assert.match(t, /BY JOSPERD\s*\/\s*EDIÇÃO 001/);
  assert.match(t, /VAI LÁ\.\s*FAZ VALER\./);
  assert.deepEqual(await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Início', 'Músicas', 'Progresso']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Treino A tem 6 exercícios e B tem 8, 14 no total; B3 avisa que não tem demonstração', {skip}, async () => {
  const {context, page} = await open();
  await openTreino(page, 'A');
  assert.equal(await page.locator('[aria-label^="Abrir "][aria-label$="Rosca direta na barra W"], [aria-label^="Abrir Rosca"], [aria-label^="Abrir Remada"], [aria-label^="Abrir Encolhimento"]').count(), 6);
  await page.getByRole('tab', {name: 'Treino B', exact: true}).click(); await settle(page);
  const rows = await page.locator('[aria-label^="Editar "]').count();
  assert.equal(rows, 8);
  assert.match(await body(page), /Sem demonstração/);
  await page.getByLabel('Abrir Elevação frontal na polia baixa').click();
  await page.getByText(/EXERCÍCIO 3\/8|EXERCÍCIO 1\/8/).first().waitFor();
  
  await context.close();
});

test('personagem: Camila é "a ruivinha", nunca "loira" em texto visível ou rótulo, e a escolha persiste', {skip}, async () => {
  const {context, page} = await open();
  await page.getByLabel('Escolher Camila Camomila, a ruivinha').first().click();
  assert.equal((await store(page)).persona, 'loira');
  const visible = await body(page);
  const labels = (await page.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).join(' | ');
  assert.match(visible, /RUIVINHA/); assert.doesNotMatch(visible, /loira/i); assert.doesNotMatch(labels, /loira/i);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  assert.match(await body(page), /CAMILA/);
  await context.close();
});

test('ajustes: sons desligados por padrão; ativar sons e manter a tela ligada persistem', {skip}, async () => {
  const {context, page} = await open();
  await openSettings(page);
  assert.equal((await store(page))?.sounds?.enabled ?? false, false);
  assert.equal(await page.getByRole('switch', {name: 'Efeitos sonoros'}).getAttribute('aria-checked'), 'false');
  await page.getByRole('switch', {name: 'Efeitos sonoros'}).click();
  await page.getByRole('switch', {name: 'Manter a tela ligada no treino'}).click();
  const s = await store(page);
  assert.equal(s.sounds.enabled, true); assert.equal(s.keepAwake, true);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  await openSettings(page);
  assert.equal(await page.getByRole('switch', {name: 'Efeitos sonoros'}).getAttribute('aria-checked'), 'true');
  assert.equal((await store(page)).keepAwake, true);
  await context.close();
});

test('avisos de versão: estado correto (mais nova, igual, mais antiga, nenhuma, offline)', {skip}, async () => {
  const cases = [
    [{releases: [rel('v1.0.0'), rel('v9.0.0'), rel('v1.5.0')]}, /Versão 9\.0\.0 publicada\. Baixe e instale manualmente\./],
    [{releases: [rel('v' + INSTALLED)]}, /tudo em dia/],
    [{releases: [rel('v' + bump(INSTALLED, -1))]}, new RegExp('mais nova que a última release \\(' + bump(INSTALLED, -1).replace(/\./g, '\\.') + '\\)')],
    [{releases: []}, /nenhuma release publicada/],
    [{releases: [rel('v9.9.9', {draft: true})]}, /nenhuma release publicada/],
    [{releases: [], status: 500}, /GitHub indisponível/],
  ];
  for (const [opts, expected] of cases) {
    const {context, page} = await open(opts);
    await openSettings(page);
    await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), expected.source, {timeout: 6000}).catch(() => {});
    assert.match(await body(page), expected, JSON.stringify(opts.releases?.map((r) => r.tag_name)));
    await context.close();
  }
});

test('celular pequeno (320 px): nenhuma tela estoura a largura', {skip}, async () => {
  const {context, page} = await open({viewport: {width: 320, height: 640}, seed: {[MUSIC]: musicLib()}});
  // ignora o que está dentro de listas que rolam na horizontal (fitas): ali passar da tela é o esperado
  const over = () => page.evaluate(() => {
    const scrollsX = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
    return Math.max(...[...document.querySelectorAll('body *')].filter((e) => !scrollsX(e)).map((e) => e.getBoundingClientRect().right)) - window.innerWidth;
  });
  for (const name of ['Início', 'Músicas', 'Progresso']) { await tab(page, name); await settle(page, 600); assert.ok((await over()) <= 40, `${name}: conteúdo além da tela`); }
  await tab(page, 'Início'); await openTreino(page, 'A'); await settle(page, 600);
  assert.ok((await over()) <= 40, 'tela do treino');
  await context.close();
});

/* ================= treino, séries e descanso ================= */
test('marcar série: persiste e sobrevive ao recarregar; no padrão NÃO há descanso entre séries', {skip}, async () => {
  const {context, page, errors} = await open();
  await startWorkout(page);
  assert.match(await body(page), /ROSCA DIRETA NA BARRA W/);
  await setBtn(page, 3).click(); await settle(page);
  assert.deepEqual((await store(page)).sets[`${today()}:A`].a1.slice(0, 5), [true, true, true, false, false]);
  assert.equal(await page.getByText('DESCANSO', {exact: true}).count(), 0, 'sem descanso entre séries do mesmo exercício');
  assert.match(await body(page), /EXERCÍCIO 1\/6/);
  assert.match(await body(page), /3\/5/);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  await startWorkout(page);
  assert.match(await body(page), /3\/5/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('descanso só entre exercícios: terminar o exercício abre "ENTRE EXERCÍCIOS" 01:00; Pular leva ao próximo', {skip}, async () => {
  const {context, page} = await open();
  await startWorkout(page);
  await setBtn(page, 5).click();
  await page.getByText('ENTRE EXERCÍCIOS').waitFor();
  assert.match(await body(page), /01:00|00:59/);
  assert.match(await body(page), /PRÓXIMO EXERCÍCIO 2\/6/);
  assert.match(await body(page), /ROSCA CONCENTRADA/);
  await page.getByLabel('Pular descanso').click();
  await page.getByText(/EXERCÍCIO 2\/6/).first().waitFor();
  assert.match(await body(page), /ROSCA CONCENTRADA/);
  await context.close();
});

test('o descanso termina sozinho, avança de exercício e +15s soma tempo', {skip}, async () => {
  const {context, page} = await open({clock: true});
  await startWorkout(page);
  await setBtn(page, 5).click();
  await page.getByText('ENTRE EXERCÍCIOS').waitFor();
  await page.getByLabel('Mais 15 segundos').click();
  await page.clock.fastForward(30000);
  assert.match(await body(page), /00:4\d|00:3\d|00:5\d/, 'passaram 30 s de 75');
  assert.equal(await page.getByText('ENTRE EXERCÍCIOS').count(), 1);
  await page.clock.fastForward(50000);
  await page.getByText(/EXERCÍCIO 2\/6/).first().waitFor();
  await context.close();
});

test('descanso entre séries é opcional: configurado em 30 s, aparece após cada série e volta ao mesmo exercício', {skip}, async () => {
  const {context, page} = await open();
  await openSettings(page);
  await page.getByLabel('Descanso entre séries: 30 segundos').click();
  assert.equal((await store(page)).restSet, 30);
  await closeSheet(page);
  await startWorkout(page);
  await setBtn(page, 1).click();
  await page.getByText('ENTRE SÉRIES').waitFor();
  assert.match(await body(page), /PRÓXIMA: SÉRIE 2 DE 5/);
  await page.getByLabel('Pular descanso').click();
  await page.getByText(/EXERCÍCIO 1\/6/).first().waitFor();
  assert.match(await body(page), /1\/5/);
  assert.match(await body(page), /CONCLUIR SÉRIE 2/);
  await context.close();
});

test('descanso entre exercícios pode ser desligado: terminar o exercício não abre contagem', {skip}, async () => {
  const {context, page} = await open();
  await openSettings(page);
  await page.getByLabel('Descanso entre exercícios: desligado').click();
  assert.equal((await store(page)).restExercise, 0);
  await closeSheet(page);
  await startWorkout(page);
  await setBtn(page, 5).click(); await settle(page);
  assert.equal(await page.getByText('DESCANSO', {exact: true}).count(), 0);
  assert.match(await body(page), /PRÓXIMO EXERCÍCIO/);
  await page.getByRole('button', {name: 'PRÓXIMO EXERCÍCIO', exact: true}).click();
  await page.getByText(/EXERCÍCIO 2\/6/).first().waitFor();
  await context.close();
});

test('migração: backup/ajuste antigo com "rest" vira descanso entre exercícios', {skip}, async () => {
  const {context, page} = await open({seed: {[APP]: {rest: 90, persona: 'vinho'}}});
  await openSettings(page);
  assert.equal(await page.getByLabel('Descanso entre exercícios: 90 segundos').getAttribute('aria-selected') ?? 'true', 'true');
  assert.equal((await store(page)).restExercise, 90);
  assert.equal((await store(page)).restSet, 0);
  await context.close();
});

test('corrigir: tocar numa série menor desmarca as seguintes; + e − respeitam 1–12', {skip}, async () => {
  const {context, page} = await open();
  await startWorkout(page);
  await setBtn(page, 4).click(); await settle(page, 200);
  await setBtn(page, 2).click(); await settle(page, 200);
  assert.deepEqual((await store(page)).sets[`${today()}:A`].a1.slice(0, 5), [true, true, false, false, false]);
  for (let i = 0; i < 15; i++) await page.getByLabel('Aumentar séries de Rosca direta na barra W').click();
  assert.equal((await store(page)).override.a1.series, 12);
  for (let i = 0; i < 15; i++) await page.getByLabel('Diminuir séries de Rosca direta na barra W').click();
  assert.equal((await store(page)).override.a1.series, 1);
  await context.close();
});

test('completar tudo mostra "treino completo"; finalizar salva com detalhe e volume e marca recorde', {skip}, async () => {
  const prev = {date: '2026-01-05', time: '07:00', treino: 'A', sets: 23, percent: 100, volume: 0, items: [{id: 'a1', nome: 'Rosca direta na barra W', series: 5, reps: 5, peso: 8}]};
  const {context, page} = await open({seed: {[APP]: {sessions: [prev]}}});
  await startWorkout(page);
  for (const [i, [nome, total]] of A.entries()) {
    await setBtn(page, total, nome).click();
    if (i < A.length - 1) await page.getByLabel('Pular descanso').click();
  }
  await page.getByText(/TREINO A\s*COMPLETO!/).waitFor();
  await page.getByLabel('FINALIZAR E SALVAR').click();
  await page.getByText('Seu histórico.').waitFor();
  const s = await store(page);
  assert.equal(s.sessions.length, 2);
  const last = s.sessions[1];
  assert.equal(last.treino, 'A'); assert.equal(last.sets, 23); assert.equal(last.percent, 100);
  assert.equal(last.items.length, 6); assert.ok(last.volume > 0);
  assert.match(await body(page), /RECORDE/, 'a1 subiu de 8 para 10 kg');
  await page.getByLabel(/^Treino A, .* 23 séries/).first().click();
  assert.match(await body(page), /Rosca direta na barra W/);
  await context.close();
});

test('navegar entre exercícios, ver como fazer, e Recomeçar apaga só as séries de hoje', {skip}, async () => {
  const {context, page} = await open();
  await startWorkout(page);
  await setBtn(page, 2).click(); await settle(page, 200);
  await page.getByLabel('Como fazer o movimento').click();
  assert.match(await body(page), /Segure a barra W|barra/i);
  await page.getByRole('button', {name: 'Próximo exercício', exact: true}).click();
  await page.getByText(/EXERCÍCIO 2\/6/).first().waitFor();
  await page.getByLabel('Exercício anterior').click();
  await page.getByText(/EXERCÍCIO 1\/6/).first().waitFor();
  await page.getByLabel('Sair do modo execução').click();
  assert.match(await body(page), /CONTINUAR/);
  await context.close();
});

/* ================= ilustração inteira e zoom ================= */
test('ilustração inteira (contain) no cartão, nas listas, na edição e na galeria', {skip}, async () => {
  const {context, page, errors} = await open();
  const fits = (sel) => page.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('div') || e).backgroundSize));
  await openTreino(page, 'A');
  let f = await fits('[aria-label^="Ilustração de "]');
  assert.ok(f.length >= 6 && f.every((x) => x === 'contain'), 'lista: ' + JSON.stringify(f));
  await startWorkout(page);
  f = await fits('[aria-label="Ilustração de Rosca direta na barra W"]');
  assert.ok(f.length >= 1 && f.every((x) => x === 'contain'), 'cartão: ' + JSON.stringify(f));
  await page.getByLabel('Sair do modo execução').click();
  await page.getByLabel('Editar Rosca direta na barra W').click();
  f = await fits('[aria-label="Ilustração de Rosca direta na barra W"]');
  assert.ok(f.every((x) => x === 'contain'), 'edição');
  await closeSheet(page);
  await page.getByLabel('Voltar ao início').click();
  await openSettings(page);
  await page.getByText('VER COLEÇÃO COMPLETA').click();
  await page.getByText('Coleção ilustrada').waitFor(); await settle(page, 500);
  f = await fits('[aria-label^="Ilustração de "]');
  assert.ok(f.length >= 14 && f.every((x) => x === 'contain'), 'galeria: ' + f.length);
  assert.deepEqual(errors, []);
  await context.close();
});

const pct = async (page) => parseInt(await page.locator('[aria-label^="Zoom "]').first().innerText(), 10);
const pctIs = (page, fn) => page.waitForFunction((src) => { const el = document.querySelector('[aria-label^="Zoom "]'); return el && new Function('v', 'return ' + src)(parseInt(el.innerText, 10)); }, fn.toString().replace(/^\(?v\)?\s*=>\s*/, ''), {timeout: 4000});

test('zoom: tocar na ilustração abre por cima; +, −, AJUSTAR e fechar funcionam; máximo 600%', {skip}, async () => {
  const {context, page} = await open();
  await startWorkout(page);
  await page.getByLabel(/^Ampliar a ilustração/).last().click();
  await page.getByLabel('Aumentar zoom').waitFor();
  assert.equal(await pct(page), 100);
  await page.getByLabel('Aumentar zoom').click(); await pctIs(page, (v) => v === 150);
  await page.getByLabel('Aumentar zoom').click(); await pctIs(page, (v) => v === 225);
  await page.getByLabel('Diminuir zoom').click(); await pctIs(page, (v) => v === 150);
  await page.getByLabel('Ajustar à tela').click(); await pctIs(page, (v) => v === 100);
  for (let i = 0; i < 9; i++) { await page.getByLabel('Aumentar zoom').click(); await settle(page, 260); }
  await pctIs(page, (v) => v === 600);
  await page.getByLabel('Fechar imagem ampliada').click();
  assert.equal(await page.getByLabel('Aumentar zoom').count(), 0);
  assert.match(await body(page), /EXERCÍCIO 1\/6/, 'continua no modo execução');
  await context.close();
});

test('zoom com os dedos: pinça amplia (centrada), toque duplo alterna, arrastar move a imagem', {skip}, async () => {
  const {context, page} = await open({touch: true});
  await page.getByLabel(/^Começar treino/).first().tap();
  await page.getByText(/EXERCÍCIO 1\/6/).first().waitFor();
  await page.getByLabel(/^Ampliar a ilustração/).last().tap();
  await page.getByLabel('Aumentar zoom').waitFor(); await settle(page, 400);
  assert.equal(await pct(page), 100);
  const cdp = await context.newCDPSession(page);
  const two = (d) => [{x: 195 - d, y: 400, id: 1}, {x: 195 + d, y: 400, id: 2}];
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: two(30)});
  for (let d = 30; d <= 110; d += 10) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: two(d)}); await page.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await settle(page, 300);
  const zoomed = await pct(page);
  assert.ok(zoomed >= 150 && zoomed <= 600, `a pinça deveria ampliar, ficou em ${zoomed}%`);
  const left = () => page.locator('img[aria-label^="Ilustração de Rosca direta"], [aria-label^="Ilustração de Rosca direta"]').last().evaluate((e) => e.getBoundingClientRect().left);
  const before = await left();
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 200, y: 400, id: 1}]});
  for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 200 - k * 14, y: 400, id: 1}]}); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await settle(page, 250);
  assert.ok((await left()) < before - 20, 'arrastar com a imagem ampliada move a imagem');
  await page.getByLabel('Ajustar à tela').tap(); await pctIs(page, (v) => v === 100);
  await page.touchscreen.tap(195, 400); await page.waitForTimeout(80); await page.touchscreen.tap(195, 400);
  await pctIs(page, (v) => v >= 200);
  await page.touchscreen.tap(195, 400); await page.waitForTimeout(80); await page.touchscreen.tap(195, 400);
  await pctIs(page, (v) => v === 100);
  await context.close();
});

test('zoom: a ilustração da lista e da galeria também amplia', {skip}, async () => {
  const {context, page} = await open();
  await openTreino(page, 'A');
  await page.getByLabel('Editar Rosca direta na barra W').click();
  await page.getByLabel(/^Ampliar a ilustração de Rosca direta/).first().click();
  await page.getByLabel('Aumentar zoom').waitFor();
  await page.getByLabel('Fechar imagem ampliada').click();
  await closeSheet(page);
  await page.getByLabel('Voltar ao início').click();
  await openSettings(page);
  await page.getByText('VER COLEÇÃO COMPLETA').click();
  await page.getByText('Coleção ilustrada').waitFor();
  await page.getByLabel(/^Ampliar a ilustração/).first().click();
  await page.getByLabel('Aumentar zoom').waitFor();
  await context.close();
});

/* ================= música: fitas com as músicas do celular ================= */
test('música: fitas padrão A, B e Favoritas; fita vazia explica como adicionar; sem importar nada', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'Músicas');
  const t = await body(page);
  for (const n of ['Treino A', 'Treino B', 'Favoritas']) assert.match(t, new RegExp(n));
  assert.match(t, /Esta fita está vazia/);
  assert.match(t, /Sem importar, sem copiar/);
  await page.getByLabel('Tocar ou pausar').first().waitFor();
  await context.close();
});

test('músicas do celular: lista o aparelho, busca, adiciona à fita e persiste só referências', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  await page.getByLabel('Adicionar músicas do celular').click();
  await page.getByText('Adicionar à Treino A').waitFor();
  for (const t of TRACKS) assert.match(await body(page), new RegExp(t.title));
  await page.getByLabel('Buscar música').fill('lose');
  await settle(page, 200);
  assert.equal(await page.getByRole('checkbox').count(), 1);
  await page.getByRole('checkbox', {name: 'Lose Yourself'}).click();
  await page.getByLabel('Buscar música').fill('');
  await page.getByRole('checkbox', {name: 'Stronger'}).click();
  await page.getByLabel('ADICIONAR 2').click();
  await page.getByLabel('Tocar Lose Yourself').waitFor();
  await page.getByLabel('Tocar Stronger').waitFor();
  const m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:1', 'dev:3']);
  assert.ok(m.tracks.every((x) => x.source === 'device' && x.uri.startsWith('file://')), 'guarda a referência do arquivo do celular, sem cópia');
  await context.close();
});

test('tirar da fita NÃO apaga a música: ela continua disponível no celular e pode voltar (desfazer)', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  await page.getByLabel('Editar fita').click();
  await page.getByLabel('Tirar Lose Yourself da fita').click();
  await page.getByText(/saiu da fita/).waitFor();
  let m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:0', 'dev:2']);
  await page.getByText('DESFAZER').click(); await settle(page, 250);
  m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:0', 'dev:1', 'dev:2'], 'voltou à mesma posição');
  await page.getByLabel('Tirar Eye of the Tiger da fita').click();
  await page.getByLabel('Concluir edição da fita').click();
  await page.getByLabel('Adicionar músicas do celular').click();
  await page.getByText('Adicionar à Treino A').waitFor();
  assert.equal(await page.getByRole('checkbox', {name: 'Eye of the Tiger'}).getAttribute('aria-disabled'), null, 'a música tirada aparece de novo, livre para adicionar');
  assert.match(await body(page), /Eye of the Tiger/);
  await context.close();
});

test('uma música pode estar em várias fitas; tirar de uma não mexe nas outras', {skip}, async () => {
  const lib = musicLib(); lib.tapes[1].ids = ['dev:0'];
  const {context, page} = await open({seed: {[MUSIC]: lib}});
  await tab(page, 'Músicas');
  await page.getByLabel('Editar fita').click();
  await page.getByLabel('Tirar Eye of the Tiger da fita').click();
  const m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'b').ids, ['dev:0']);
  assert.ok(m.tracks.some((x) => x.id === 'dev:0'), 'continua guardada porque a fita B usa');
  await context.close();
});

test('reordenar a fita e criar fita nova persistem', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}});
  await tab(page, 'Músicas');
  await page.getByLabel('Editar fita').click();
  await page.getByLabel('Descer Eye of the Tiger').click();
  assert.deepEqual((await store(page, MUSIC)).tapes[0].ids, ['dev:1', 'dev:0', 'dev:2']);
  await page.getByLabel('Subir Till I Collapse').click();
  assert.deepEqual((await store(page, MUSIC)).tapes[0].ids, ['dev:1', 'dev:2', 'dev:0']);
  await page.getByLabel('Concluir edição da fita').click();
  await page.getByLabel('Criar nova fita').click();
  await page.getByLabel('Nome da fita').fill('Pesado');
  await page.getByLabel('SALVAR').click();
  const m = await store(page, MUSIC);
  assert.equal(m.tapes.length, 4); assert.equal(m.tapes[3].name, 'Pesado'); assert.equal(m.selected, m.tapes[3].id);
  await context.close();
});

test('permissão negada/bloqueada: explica e oferece abrir configurações, sem travar', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'blocked', tracks: []}});
  await tab(page, 'Músicas');
  await page.getByLabel('Adicionar músicas do celular').click();
  await page.getByText('Permita o acesso às músicas').waitFor();
  assert.match(await body(page), /bloqueou o pedido/);
  await page.getByLabel('ABRIR CONFIGURAÇÕES').waitFor();
  await context.close();
});

test('biblioteca antiga (arquivos copiados, sem "source") continua funcionando', {skip}, async () => {
  const old = {tracks: [{id: 'x1', title: 'Minha música', uri: 'file:///doc/x1.mp3'}], tapes: [{id: 'a', name: 'Treino A', ids: ['x1']}, {id: 'b', name: 'Treino B', ids: []}], selected: 'a', fade: 3, shuffle: false, repeat: false};
  const {context, page, errors} = await open({seed: {[MUSIC]: old}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Minha música').waitFor();
  assert.match(await body(page), /Arquivo copiado para o app/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('player compacto: aparece nas telas, some na aba Músicas e fica no modo execução e no descanso', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}});
  assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1);
  await tab(page, 'Progresso'); assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1);
  await tab(page, 'Músicas'); await settle(page, 400); assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 0);
  await tab(page, 'Início');
  await startWorkout(page);
  assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1, 'no cartão');
  await setBtn(page, 5).click();
  await page.getByText('ENTRE EXERCÍCIOS').waitFor();
  assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1, 'no descanso');
  await page.getByLabel('Pular descanso').click();
  await page.getByRole('button', {name: /^Abrir músicas/}).click();
  await page.getByText('Suas fitas,', {exact: false}).waitFor();
  await context.close();
});
