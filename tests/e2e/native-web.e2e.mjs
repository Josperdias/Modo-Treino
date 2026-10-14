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
const bump = (v, k) => { const [a, b, c] = v.split('.').map(Number); return k < 0 && c === 0 ? `${a}.${b - 1}.9` : `${a}.${b}.${c + k}`; }; // k=-1 em x.y.0 vira x.(y-1).9 (nunca patch negativo)
const rel = (tag, extra = {}) => ({tag_name: tag, draft: false, prerelease: true, html_url: `https://github.com/${REPO}/releases/tag/${tag}`, assets: [], ...extra});
const APP = 'modo-treino-native-v1', MUSIC = 'modotreino-native-music-v1';
const TRACKS = [['Eye of the Tiger', 245], ['Lose Yourself', 326], ['Till I Collapse', 297], ['Stronger', 312]].map(([title, duration], i) => ({id: 'dev:' + i, title, uri: 'file:///musica/' + i + '.mp3', duration, source: 'device'}));

/** seed: {chave: valor} gravado no localStorage antes do app abrir (uma vez). device: simula o MediaStore (só no navegador). */
async function open({releases = [], status = 200, viewport = {width: 390, height: 844}, seed = null, device = null, clock = false, touch = false} = {}) {
  const context = await browser.newContext({viewport, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce'}); // sem animações em laço: o app respeita "remover animações" e o teste fica estável
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
// A biblioteca de música é gravada 0,5 s depois da última mudança (debounce do MusicProvider): espera isso antes de ler.
const store = async (page, key = APP) => { if (key === MUSIC) await page.waitForTimeout(700); return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key); };
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
test('app abre sem erro, com a identidade e 4 abas (Início, Músicas, Buscar, Progresso)', {skip}, async () => {
  const {context, page, errors} = await open();
  const t = await body(page);
  assert.match(t, /BY JOSPERD\s*\/\s*EDIÇÃO 001/);
  assert.match(t, /VAI LÁ\.\s*FAZ VALER\./);
  assert.deepEqual(await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Início', 'Músicas', 'Buscar', 'Progresso']);
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
  assert.match(visible, /ruivinha/i); assert.doesNotMatch(visible, /loira/i); assert.doesNotMatch(labels, /loira/i);
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

test('ajustes: notificação do exercício vem ligada e dá para desligar (persiste); abrir o treino não quebra sem suporte a notificações', {skip}, async () => {
  const {context, page, errors} = await open();
  await openSettings(page);
  assert.equal(await page.getByRole('switch', {name: 'Notificação do exercício'}).getAttribute('aria-checked'), 'true');
  await page.getByRole('switch', {name: 'Notificação do exercício'}).click();
  assert.equal((await store(page)).notifyWorkout, false);
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor();
  await openSettings(page);
  assert.equal(await page.getByRole('switch', {name: 'Notificação do exercício'}).getAttribute('aria-checked'), 'false');
  assert.deepEqual(errors, []);
  await context.close();
});

test('aviso de versão no topo do app: novidades, "depois" some e não volta, atualizar disponível', {skip}, async () => {
  const apk = {name: 'modo-treino-9.0.0.apk', browser_download_url: `https://github.com/${REPO}/releases/download/v9.0.0/modo-treino-9.0.0.apk`, size: 58000000, digest: 'sha256:' + 'a'.repeat(64)};
  const release = rel('v9.0.0', {prerelease: false, body: '### Rádio\n- **Planeta neon** com `países`\n- Pinos menores\n\n---\n\nModo Treino 9.0.0 para Android', assets: [apk]});
  const {context, page, errors} = await open({releases: [release]});
  await page.getByRole('alert', {name: /Nova versão 9\.0\.0 disponível/}).waitFor();
  const t = await body(page);
  assert.match(t, /9\.0\.0 CHEGOU!/); assert.match(t, new RegExp(`você está na ${INSTALLED.replace(/\./g, '\\.')}`)); assert.match(t, /55,3 MB/);
  assert.equal(await page.getByLabel('Atualizar agora').count(), 1);
  await page.getByLabel('Ver novidades').click();
  assert.match(await body(page), /Planeta neon com países/); assert.match(await body(page), /Pinos menores/);
  assert.doesNotMatch(await body(page), /para Android/, 'só o trecho antes do "---" aparece');
  await page.getByLabel('Depois').click();
  await page.getByRole('alert').waitFor({state: 'detached'});
  await page.reload(); await page.getByText('MODO', {exact: false}).first().waitFor(); await settle(page, 800);
  assert.equal(await page.getByRole('alert').count(), 0, 'dispensada: não volta ao reabrir');
  await openSettings(page);
  await page.getByLabel('VERIFICAR AGORA').click();
  await page.getByRole('alert', {name: /Nova versão 9\.0\.0/}).waitFor();   // verificar à mão mostra de novo
  assert.deepEqual(errors, []);
  await context.close();
});

test('avisos de versão: estado correto (mais nova, igual, mais antiga, nenhuma, offline)', {skip}, async () => {
  const cases = [
    [{releases: [rel('v1.0.0'), rel('v9.0.0'), rel('v1.5.0')]}, /Versão 9\.0\.0 disponível\./],
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
  const {context, page} = await open({viewport: {width: 320, height: 640}, seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  // ignora o que está dentro de listas que rolam na horizontal (fitas) ou recortado por um pai com overflow escondido (nome rolando no visor): ali passar da tela é o esperado
  const over = () => page.evaluate(() => {
    const scrollsX = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
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
  await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).waitFor();
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
  await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).waitFor();
  await page.getByLabel('Mais 15 segundos').click();
  await page.clock.fastForward(30000);
  assert.match(await body(page), /00:4\d|00:3\d|00:5\d/, 'passaram 30 s de 75');
  assert.equal(await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).count(), 1);
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
  await page.getByText('ENTRE SÉRIES', {exact: true}).waitFor();
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

/* ================= música: FITAS (músicas do celular), BAGS (playlists) e RÁDIO ================= */
const musicTab = (page, name) => page.getByRole('tab', {name}).click();

test('música: três modos (Fitas, Bags, Rádio); sem leitura do celular explica como trazer as fitas', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'Músicas');
  assert.deepEqual(await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter((n) => /^(Fitas|Bags|Rádio)/.test(n || ''))), ['Fitas: músicas do celular', 'Bags: playlists', 'Rádio do mundo']);
  let t = await body(page);
  assert.match(t, /suas fitas,/i); assert.match(t, /minhas fitas/i); assert.match(t, /Leitura automática indisponível/);
  await musicTab(page, 'Bags: playlists');
  t = await body(page);
  assert.match(t, /suas bags\./i); assert.match(t, /playlist/);
  for (const n of ['Treino A', 'Treino B', 'Favoritas']) assert.match(t, new RegExp(n, 'i'));
  await context.close();
});

test('fitas: cada música do celular vira uma fita (cassete), com busca; nada é importado nem guardado', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  for (const t of TRACKS) await page.getByLabel(`Tocar ${t.title}`, {exact: true}).waitFor();
  assert.match(await body(page), /4 fitas no seu celular/);
  await page.getByLabel('Buscar fita').fill('lose'); await settle(page, 200);
  assert.equal(await page.getByLabel('Tocar Lose Yourself', {exact: true}).count(), 1);
  assert.equal(await page.getByLabel('Tocar Stronger', {exact: true}).count(), 0);
  await page.getByLabel('Buscar fita').fill('');
  const m = await store(page, MUSIC);
  assert.ok(!m || m.tracks.length === 0, 'só listar as fitas não grava nem copia nada');
  await context.close();
});

test('fita → bag: "colocar na bag" guarda só a referência e uma fita pode estar em várias bags', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  await page.getByLabel('Mais opções de Lose Yourself').click();
  await page.getByLabel('COLOCAR NA BAG').click();
  await page.getByLabel('Colocar na bag Treino A').click();
  await page.getByText('“Lose Yourself” na bag Treino A').waitFor();
  await page.getByLabel('Mais opções de Lose Yourself').click();
  await page.getByLabel('COLOCAR NA BAG').click();
  assert.equal(await page.getByLabel('Já está na bag Treino A').count(), 1);
  await page.getByLabel('Colocar na bag Favoritas').click();
  const m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:1']);
  assert.deepEqual(m.tapes.find((x) => x.id === 'fav').ids, ['dev:1']);
  assert.ok(m.tracks.every((x) => x.source === 'device' && x.uri.startsWith('file://')), 'guarda a referência do arquivo do celular, sem cópia');
  await context.close();
});

test('bag: colocar fitas pelo seletor (com busca) e rádio vira item da bag', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas'); await musicTab(page, 'Bags: playlists');
  await page.getByLabel('Editar a bag Treino A').click();
  await page.getByLabel('Colocar fitas na bag', {exact: true}).click();
  await page.getByText('Colocar fitas na bag Treino A').waitFor();
  await page.getByLabel('Buscar música').fill('lose'); await settle(page, 200);
  assert.equal(await page.getByRole('checkbox').count(), 1);
  await page.getByRole('checkbox', {name: 'Lose Yourself'}).click();
  await page.getByLabel('Buscar música').fill('');
  await page.getByRole('checkbox', {name: 'Stronger'}).click();
  await page.getByLabel('ADICIONAR 2').click();
  await page.getByLabel('Tirar Lose Yourself da bag').waitFor();
  await page.getByLabel('Tirar Stronger da bag').waitFor();
  assert.deepEqual((await store(page, MUSIC)).tapes.find((x) => x.id === 'a').ids, ['dev:1', 'dev:3']);
  await context.close();
});

test('tirar da bag NÃO apaga a fita: ela continua na lista do celular e pode voltar (desfazer)', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas'); await musicTab(page, 'Bags: playlists');
  await page.getByLabel('Editar a bag Treino A').click();
  await page.getByLabel('Tirar Lose Yourself da bag').click();
  await page.getByText(/saiu da bag/).waitFor();
  let m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:0', 'dev:2']);
  await page.getByLabel('Desfazer').click(); await settle(page, 250);
  m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'a').ids, ['dev:0', 'dev:1', 'dev:2'], 'voltou à mesma posição');
  await page.getByLabel('Fechar').last().click();
  await musicTab(page, 'Fitas: músicas do celular');
  await page.getByLabel('Tocar Lose Yourself', {exact: true}).waitFor();
  await context.close();
});

test('uma fita pode estar em várias bags; tirar de uma não mexe nas outras', {skip}, async () => {
  const lib = musicLib(); lib.tapes[1].ids = ['dev:0'];
  const {context, page} = await open({seed: {[MUSIC]: lib}});
  await tab(page, 'Músicas'); await musicTab(page, 'Bags: playlists');
  await page.getByLabel('Editar a bag Treino A').click();
  await page.getByLabel('Tirar Eye of the Tiger da bag').click();
  const m = await store(page, MUSIC);
  assert.deepEqual(m.tapes.find((x) => x.id === 'b').ids, ['dev:0']);
  assert.ok(m.tracks.some((x) => x.id === 'dev:0'), 'continua guardada porque a bag B usa');
  await context.close();
});

test('bag: reordenar, renomear e criar bag nova persistem', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}});
  await tab(page, 'Músicas'); await musicTab(page, 'Bags: playlists');
  await page.getByLabel('Editar a bag Treino A').click();
  await page.getByLabel('Descer Eye of the Tiger').click();
  assert.deepEqual((await store(page, MUSIC)).tapes[0].ids, ['dev:1', 'dev:0', 'dev:2']);
  await page.getByLabel('Subir Till I Collapse').click();
  assert.deepEqual((await store(page, MUSIC)).tapes[0].ids, ['dev:1', 'dev:2', 'dev:0']);
  await page.getByLabel('Fechar').last().click();
  await page.getByLabel('Criar nova bag').click();
  await page.getByLabel('Nome da bag', {exact: true}).fill('Pesado');
  await page.getByLabel('CRIAR', {exact: true}).click();
  const m = await store(page, MUSIC);
  assert.equal(m.tapes.length, 4); assert.equal(m.tapes[3].name, 'Pesado'); assert.equal(m.selected, m.tapes[3].id);
  await page.getByText('Bag Pesado').waitFor();
  await context.close();
});

test('permissão negada/bloqueada: explica e oferece abrir configurações, sem travar', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'blocked', tracks: []}});
  await tab(page, 'Músicas');
  await page.getByText('Permita o acesso às músicas').waitFor();
  assert.match(await body(page), /bloqueou o pedido/);
  await page.getByLabel('ABRIR CONFIGURAÇÕES').waitFor();
  await page.getByLabel('Escolher uma pasta de músicas').waitFor();
  await context.close();
});

test('biblioteca antiga (arquivos copiados, sem "source") continua funcionando como fitas', {skip}, async () => {
  const old = {tracks: [{id: 'x1', title: 'Minha música', uri: 'file:///doc/x1.mp3'}], tapes: [{id: 'a', name: 'Treino A', ids: ['x1']}, {id: 'b', name: 'Treino B', ids: []}], selected: 'a', fade: 3, shuffle: false, repeat: false};
  const {context, page, errors} = await open({seed: {[MUSIC]: old}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Minha música', {exact: true}).waitFor();
  assert.match(await body(page), /Arquivo copiado para o app/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('rádio: estações do diretório, estilos em português e lista de países com contagem', {skip}, async () => {
  const {context, page} = await open();
  const mk = (i, cc, co, tags) => ({stationuuid: 'u' + i, name: `Rádio ${co} ${i}`, url_resolved: 'https://example.com/s' + i, countrycode: cc, country: co, state: '', tags, geo_lat: -10 + i, geo_long: -50 + i, clickcount: 100 - i, bitrate: 128});
  const radios = [...[1, 2, 3, 4, 5, 6].map((i) => mk(i, 'BR', 'Brazil', 'pop,hits')), ...[7, 8].map((i) => mk(i, 'PT', 'Portugal', 'rock')), mk(9, 'FR', 'France', 'jazz')];
  await context.route('**/*.api.radio-browser.info/**', (r) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(radios)}));
  await tab(page, 'Músicas'); await musicTab(page, 'Rádio do mundo');
  await page.getByText('9 estações').waitFor();
  assert.equal(await page.getByLabel('Estilo Pop', {exact: true}).count(), 0, 'os estilos ficam recolhidos até abrir o painel');
  await page.getByLabel('Escolher estilo').click();
  for (const g of ['Pop', 'Eletrônica', 'Clássica', 'Notícias', 'Esportes']) await page.getByLabel(`Estilo ${g}`, {exact: true}).waitFor();
  await page.getByText('BRASIL E LATINA').waitFor();
  await page.getByLabel('Estilo Rock', {exact: true}).click(); await settle(page, 300);
  assert.equal(await page.getByLabel('Estilo Pop', {exact: true}).count(), 0, 'escolher um estilo recolhe o painel');
  await page.getByLabel(/^Escolher estilo, agora Rock/).click(); await page.getByLabel('Recolher os estilos').click(); await settle(page, 300);
  await page.getByLabel('Limpar busca').click();
  await page.getByLabel('Ver rádios por país').click();
  await page.getByLabel(/^(Brazil|Brasil), 6 rádios$/).waitFor();
  await page.getByLabel(/^(Portugal), 2 rádios$/).waitFor();
  await context.close();
});

test('"Tocando agora": sem nada tocando não há player na tela; com música ele abre o cartão do player', {skip}, async () => {
  const {context, page, errors} = await open({seed: {[MUSIC]: musicLib()}});
  assert.equal(await page.getByRole('button', {name: /^Abrir músicas/}).count(), 0, 'nada tocando: nenhum rádio vazio');
  assert.deepEqual(errors, []);
  await context.close();
});

test('"Tocando agora": tocando uma fita, o cartão mostra o nome, os controles e o coração guarda em Favoritas', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Lose Yourself', {exact: true}).click();
  await settle(page, 500);
  await tab(page, 'Início');
  await page.getByRole('button', {name: /^Abrir músicas/}).click();
  await page.getByLabel('Faixa anterior').waitFor(); await page.getByLabel('Próxima faixa').last().waitFor(); await page.getByLabel('Ligar repetir').waitFor();
  assert.match(await body(page), /Lose Yourself/);
  await page.getByLabel('Favoritar').click();
  const m = await store(page, MUSIC);
  assert.ok(m.tapes.find((x) => x.id === 'fav').ids.includes('dev:1'), 'a fita foi para a bag Favoritas');
  await page.getByLabel('Tirar das favoritas').click();
  assert.ok(!(await store(page, MUSIC)).tapes.find((x) => x.id === 'fav').ids.includes('dev:1'));
  await context.close();
});

test('fitas: pesquisa com contagem e botão de limpar; "ir para a tocando" e progresso no miniplayer', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  for (const t of TRACKS) await page.getByLabel(`Tocar ${t.title}`, {exact: true}).waitFor();
  assert.match(await body(page), /4 fitas/);
  assert.equal(await page.getByLabel('Limpar a busca da fita').count(), 0, 'sem texto, sem botão de limpar');
  await page.getByLabel('Buscar fita').fill('lose'); await settle(page, 200);
  assert.match(await body(page), /1 de 4 fitas/);
  await page.getByLabel('Limpar a busca da fita').click(); await settle(page, 200);
  assert.match(await body(page), /4 fitas/);
  assert.equal(await page.getByLabel('Buscar fita').inputValue(), '', 'limpar esvazia o campo');
  assert.equal(await page.getByLabel('Ir para a fita que está tocando').count(), 0, 'nada tocando, sem atalho');
  await page.getByLabel('Tocar Stronger', {exact: true}).click(); await settle(page, 500);
  const go = page.getByLabel('Ir para a fita que está tocando');
  await go.waitFor();
  assert.match(await go.innerText(), /4/, 'mostra a posição da fita atual na lista');
  await go.click();
  // Buscando, o miniplayer (com a fita tocando) aparece mesmo com o player grande à vista e some ao limpar a busca.
  await page.getByLabel('Buscar fita').fill('lose'); await settle(page, 500);
  await page.getByRole('toolbar', {name: 'Player de música'}).waitFor();
  await page.getByLabel('Limpar a busca da fita').click(); await settle(page, 500);
  await tab(page, 'Início');
  await page.getByLabel('Progresso da música').waitFor();
  await context.close();
});

test('Fitas: ao rolar a lista, o miniplayer (com a fita tocando) desliza para baixo e volta ao subir', {skip}, async () => {
  const many = Array.from({length: 18}, (_, i) => ({id: 'dev:' + i, title: 'Faixa ' + (i + 1), uri: 'file:///musica/' + i + '.mp3', duration: 200 + i, source: 'device'}));
  const {context, page} = await open({device: {permission: 'granted', tracks: many}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Faixa 1', {exact: true}).waitFor();
  await page.getByLabel('Tocar Faixa 1', {exact: true}).click(); await settle(page, 500);
  const bar = page.getByLabel('Player de música');
  const scrollTo = (y) => page.evaluate((top) => {
    const el = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY !== 'visible').sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    el.scrollTop = top; el.dispatchEvent(new Event('scroll', {bubbles: true}));
  }, y);
  await scrollTo(0); await settle(page, 700);
  assert.equal(await bar.count(), 0, 'com o player grande à vista não precisa do miniplayer');
  await scrollTo(900); await settle(page, 700);
  await bar.waitFor();
  assert.match(await bar.innerText(), /faixa 1/i, 'o miniplayer mostra a música que está tocando');
  await page.getByLabel('Próxima faixa').last().click(); await settle(page, 400);
  await scrollTo(0); await settle(page, 700);
  assert.equal(await bar.count(), 0, 'voltando ao topo o miniplayer some de novo');
  await context.close();
});

test('Fitas: a busca de cima só aparece (com animação) ao passar pelas fitas e some ao voltar ao topo', {skip}, async () => {
  const many = Array.from({length: 18}, (_, i) => ({id: 'dev:' + i, title: 'Faixa ' + (i + 1), uri: 'file:///musica/' + i + '.mp3', duration: 200 + i, source: 'device'}));
  const {context, page} = await open({device: {permission: 'granted', tracks: many}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Faixa 1', {exact: true}).waitFor();
  const dock = page.getByLabel('Procurar fita aqui');
  const scrollTo = (y) => page.evaluate((top) => {
    const el = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY !== 'visible').sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    el.scrollTop = top; el.dispatchEvent(new Event('scroll', {bubbles: true}));
  }, y);
  await scrollTo(0); await settle(page, 500);
  assert.equal(await dock.count(), 0, 'no topo a busca é só a do cabeçalho');
  assert.equal(await page.getByLabel('Buscar fita').count(), 1);
  await scrollTo(1400); await settle(page, 600);
  await dock.waitFor();
  await dock.fill('faixa 1'); await settle(page, 400);
  assert.equal(await dock.inputValue(), 'faixa 1', 'o texto digitado na busca de cima fica');
  assert.match(await body(page), /\d+\/18/, 'contagem na busca de cima');
  await page.getByLabel('Limpar a busca (barra de cima)').click(); await settle(page, 400);
  await scrollTo(0); await settle(page, 600);
  assert.equal(await dock.count(), 0, 'voltando ao topo a busca de cima some');
  await context.close();
});

test('"não vou fazer este exercício": confirma ao pular, dá para se arrepender ao voltar e confirma de novo ao finalizar', {skip}, async () => {
  const {context, page} = await open();
  await openTreino(page, 'A'); await startWorkout(page);
  const fills = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Progresso do treino"] > div')].map((seg) => (seg.firstElementChild ? seg.firstElementChild.style.width : 'pulado')));
  // 1) pular pede confirmação; "Voltar" não pula
  await page.getByLabel('Não vou fazer Rosca direta na barra W').click();
  await page.getByText('Não fazer este exercício?').waitFor();
  await page.getByLabel('VOLTAR', {exact: true}).click(); await settle(page, 300);
  assert.match(await body(page), /EXERCÍCIO 1\/6/, 'cancelar a pergunta não pula');
  await page.getByLabel('Não vou fazer Rosca direta na barra W').click();
  await page.getByLabel('NÃO VOU FAZER', {exact: true}).click(); await settle(page, 500);
  assert.match(await body(page), /EXERCÍCIO 2\/6/, 'pulou e foi ao próximo');
  assert.match(await body(page), /1 pulado/);
  assert.equal((await fills())[0], 'pulado');
  // 2) voltar ao pulado: aviso e arrependimento
  await page.getByLabel('Exercício anterior').click(); await settle(page, 400);
  await page.getByText('VOCÊ MARCOU', {exact: true}).waitFor();
  await page.getByLabel('Fazer Rosca direta na barra W agora').click(); await settle(page, 400);
  assert.equal(await page.getByText('VOCÊ MARCOU', {exact: true}).count(), 0, 'se arrependeu: o exercício volta ao treino');
  assert.doesNotMatch(await body(page), /1 pulado/);
  // 3) pula de novo, faz todos os outros e finaliza: pede confirmação do que ficou de fora
  await page.getByLabel('Não vou fazer Rosca direta na barra W').click();
  await page.getByLabel('NÃO VOU FAZER', {exact: true}).click(); await settle(page, 500);
  for (const [nome, n] of A.slice(1)) {
    for (let k = 1; k <= n; k++) { await setBtn(page, k, nome).click(); await settle(page, 120); }
    const skipRest = page.getByLabel('Pular descanso'); if (await skipRest.count()) await skipRest.click();
    await settle(page, 300);
  }
  await page.getByText(/COMPLETO!/).waitFor();
  assert.match(await body(page), /NÃO FEITO: Rosca direta na barra W/);
  await page.getByLabel('FINALIZAR E SALVAR').click();
  await page.getByText('Confirmar o que ficou de fora?').waitFor();
  await page.getByLabel('VOLTAR E FAZER', {exact: true}).click(); await settle(page, 500);
  assert.match(await body(page), /EXERCÍCIO 1\/6/, 'voltar e fazer leva ao exercício pulado');
  await page.getByLabel('Não vou fazer Rosca direta na barra W').count(); // continua pulado
  await page.getByLabel('TERMINAR', {exact: true}).click(); await settle(page, 500);   // exercício pulado e último que falta: o botão vira TERMINAR
  await page.getByText(/COMPLETO!/).waitFor();
  await page.getByLabel('FINALIZAR E SALVAR').click();
  await page.getByLabel('CONFIRMAR E SALVAR').click(); await settle(page, 600);
  const saved = await store(page);
  assert.equal(saved.sessions.length, 1);
  assert.deepEqual(saved.sessions[0].skipped.map((x) => x.nome), ['Rosca direta na barra W'], 'o histórico guarda o que ficou de fora');
  assert.equal(saved.sessions[0].items.length, 5, 'só os 5 exercícios feitos entram');
  await context.close();
});

test('treino: abrir o player pelo mini rádio NÃO fecha o treino (volta ao mesmo exercício) e o "Tocando agora" cabe na tela', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Stronger', {exact: true}).click(); await settle(page, 600);
  await tab(page, 'Início');
  await openTreino(page, 'A'); await startWorkout(page);
  await page.getByLabel('Próximo exercício').first().click(); await settle(page, 400);
  assert.match(await body(page), /EXERCÍCIO 2\/6/);
  await page.getByRole('button', {name: /^Abrir músicas/}).click();
  await page.getByRole('heading', {name: 'Tocando agora'}).waitFor();
  await settle(page, 700); // espera a animação de subida do painel
  const head = await page.getByRole('heading', {name: 'Tocando agora'}).boundingBox();
  assert.ok(head && head.y >= 40, 'o painel não cobre a tela inteira: deixa o treino aparecendo no topo');
  const play = page.getByLabel('Tocar ou pausar').last();
  await play.scrollIntoViewIfNeeded();
  const box = await play.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 844, 'o botão de tocar/pausar é alcançável dentro da tela (painel rolável)');
  await page.getByLabel('Fechar').last().click(); await settle(page, 400);
  assert.match(await body(page), /EXERCÍCIO 2\/6/, 'o treino continua no mesmo exercício');
  await context.close();
});

test('rádio: o mundo fica atrás dos controles, o cartão da estação é compacto e o rádio dourado aparece na aba', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  const radios = [{stationuuid: 'u1', name: 'Rádio Lose Control', url_resolved: 'https://example.com/s1', countrycode: 'BR', country: 'Brazil', state: '', tags: 'pop', geo_lat: -10, geo_long: -50, clickcount: 5, bitrate: 128}];
  await context.route('**/*.api.radio-browser.info/**', (r) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(radios)}));
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Stronger', {exact: true}).click(); await settle(page, 500);
  await musicTab(page, 'Rádio do mundo');
  await page.getByText('1 estações').waitFor();
  await page.getByLabel('Surpreenda-me com uma rádio aleatória').click(); await settle(page, 600);
  const card = await page.getByRole('button', {name: 'Rádio Rádio Lose Control'}).boundingBox();
  assert.ok(card && card.height <= 130, `o cartão da estação é compacto (altura ${card && card.height})`);
  assert.equal(await page.getByLabel('Recolher o cartão da rádio').count(), 0, 'sem aba/recolher: o cartão é só uma faixa translúcida');
  await page.getByLabel('Guardar rádio numa bag').waitFor();
  await page.getByLabel('Ouvir rádio').waitFor();
  await page.getByLabel('Mais informações da rádio').click();
  await page.getByRole('heading', {name: 'Sobre a rádio'}).waitFor();
  assert.match(await body(page), /ESTILOS[\s\S]*pop[\s\S]*128 kbps/, 'o "i" mostra estilos e qualidade da rádio');
  await page.getByLabel('Fechar').last().click(); await settle(page, 500);
  const globe = await page.locator('iframe, webview').first().boundingBox();   // o globo começa logo abaixo do seletor FITAS/BAGS/RÁDIO, por trás da busca
  const surpresa = await page.getByLabel('Surpreenda-me com uma rádio aleatória').boundingBox();
  assert.ok(globe && surpresa && globe.y < surpresa.y, 'o globo passa por trás dos botões');
  assert.ok(await page.getByText('SURPREENDA', {exact: true}).isVisible(), 'o texto SURPREENDA aparece completo');
  await page.getByRole('toolbar', {name: 'Player de música'}).waitFor();   // música tocando: o rádio dourado também aparece na aba Rádio
  await context.close();
});

test('player compacto: só aparece com música tocando; some na aba Músicas; recolhe e abre; fica no modo execução e no descanso', {skip}, async () => {
  const {context, page} = await open({seed: {[MUSIC]: musicLib()}, device: {permission: 'granted', tracks: TRACKS}});
  const toolbar = page.getByRole('toolbar', {name: 'Player de música'});
  assert.equal(await toolbar.count(), 0, 'nada tocando: nada de rádio vazio na tela inicial');
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Stronger', {exact: true}).click(); await settle(page, 600);
  await tab(page, 'Início'); await settle(page, 500);
  assert.equal(await toolbar.count(), 1);
  await page.getByLabel('Recolher o player').click(); await settle(page, 500);
  assert.equal(await page.getByLabel('Abrir o player').count(), 1, 'recolhido: fica a tirinha com a setinha');
  assert.equal(await page.getByLabel('Voltar uma faixa').count(), 0, 'recolhido: sem teclas grandes');
  await page.getByLabel('Abrir o player').click(); await settle(page, 500);
  assert.equal(await page.getByLabel('Voltar uma faixa').count(), 1, 'aberto de novo');
  await tab(page, 'Progresso'); assert.equal(await toolbar.count(), 1);
  await tab(page, 'Músicas'); await settle(page, 400); assert.equal(await toolbar.count(), 0);
  await tab(page, 'Início');
  await startWorkout(page);
  assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1, 'no cartão');
  await setBtn(page, 5).click();
  await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).waitFor();
  assert.equal(await page.getByRole('toolbar', {name: 'Player de música'}).count(), 1, 'no descanso');
  await page.getByLabel('Pular descanso').click();
  await page.getByRole('button', {name: /^Abrir músicas/}).click();
  await page.getByRole('heading', {name: 'Tocando agora'}).waitFor();   // o treino continua por baixo
  await page.getByLabel('VER MINHAS FITAS').click();
  await page.getByText('Suas fitas,', {exact: false}).waitFor();
  await context.close();
});

/* ================= buscar, descanso pausável, voz e vídeo ================= */
const search = (page) => page.getByLabel('Campo de busca', {exact: true});

test('buscar: sem acento e por grupo; tocar no exercício começa o treino naquele exercício', {skip}, async () => {
  const {context, page, errors} = await open();
  await tab(page, 'Buscar');
  assert.match(await body(page), /ATALHOS/);
  await search(page).fill('trapezio');
  await page.getByText('EXERCÍCIOS', {exact: true}).waitFor();
  assert.equal(await page.getByLabel('Fazer Encolhimento para trapézio agora').count(), 1);
  assert.equal(await page.getByLabel('Fazer Remada alta na barra W agora').count(), 1);
  assert.equal(await page.getByLabel('Fazer Supino reto com halteres agora').count(), 0);
  await page.getByLabel('Fazer Encolhimento para trapézio agora').click();
  await page.getByText(/EXERCÍCIO 5\/6/).first().waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('buscar: atalho de grupo, sem resultado explica, e as buscas recentes ficam guardadas', {skip}, async () => {
  const {context, page} = await open();
  await tab(page, 'Buscar');
  await page.getByLabel('Buscar Ombro', {exact: true}).click();
  await page.getByLabel('Fazer Elevação lateral com halteres agora').waitFor();
  assert.equal(await search(page).inputValue(), 'Ombro');
  await search(page).fill('zzzxyz');
  await page.getByText('Nada com “zzzxyz”').waitFor();
  await search(page).fill('Remada alta'); await search(page).press('Enter');
  await page.getByLabel('Fazer Remada alta na barra W agora').click();
  await page.getByText(/EXERCÍCIO 6\/6/).first().waitFor();
  await page.getByLabel('Sair do modo execução').click();
  await search(page).fill('');
  await page.getByLabel('Buscar de novo Remada alta').waitFor();
  await context.close();
});

test('buscar: fitas, bags e rádios em seções; tocar uma fita toca na hora', {skip}, async () => {
  const {context, page} = await open({device: {permission: 'granted', tracks: TRACKS}, seed: {[MUSIC]: musicLib()}});
  const radios = [{stationuuid: 'u1', name: 'Rádio Lose Control', url_resolved: 'https://example.com/s1', countrycode: 'BR', country: 'Brazil', state: '', tags: 'pop', geo_lat: -10, geo_long: -50, clickcount: 5, bitrate: 128}];
  await context.route('**/*.api.radio-browser.info/**', (r) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(radios)}));
  await tab(page, 'Buscar');
  await search(page).fill('lose');
  await page.getByText('FITAS', {exact: true}).waitFor();
  assert.equal(await page.getByLabel('Tocar Lose Yourself', {exact: true}).count(), 1);
  assert.equal(await page.getByLabel('Tocar Stronger', {exact: true}).count(), 0);
  await page.getByLabel('Ouvir a rádio Rádio Lose Control').waitFor();
  await search(page).fill('treino a');
  await page.getByLabel('Abrir a bag Treino A').waitFor();
  await search(page).fill('lose');
  await page.getByLabel('Tocar Lose Yourself', {exact: true}).click();
  await settle(page, 500);
  await page.getByRole('toolbar', {name: 'Player de música'}).waitFor();
  assert.match(await body(page), /Lose Yourself/);
  await context.close();
});

test('buscar: treinos já feitos aparecem por exercício e por data, e levam ao Progresso', {skip}, async () => {
  const sessions = [{date: '2026-10-01', time: '07:30', treino: 'A', sets: 6, percent: 40, volume: 480, items: [{id: 'a1', nome: 'Rosca direta na barra W', series: 6, reps: 12, peso: 20}]}];
  const {context, page} = await open({seed: {[APP]: {sessions}}});
  await tab(page, 'Buscar');
  await search(page).fill('rosca direta');
  await page.getByText('TREINOS FEITOS', {exact: true}).waitFor();
  await page.getByLabel('Ver o treino A de 01/10 no progresso').waitFor();
  await search(page).fill('01/10');
  await page.getByLabel('Ver o treino A de 01/10 no progresso').click();
  await page.getByRole('tab', {name: 'Progresso', exact: true}).waitFor();
  assert.match(await body(page), /Rosca direta na barra W|Treino A|PROGRESSO/i);
  await context.close();
});

test('descanso: PAUSAR congela a contagem e RETOMAR continua de onde parou', {skip}, async () => {
  const {context, page} = await open({clock: true});
  await startWorkout(page);
  await setBtn(page, 5).click();
  await page.getByText('ENTRE EXERCÍCIOS', {exact: true}).waitFor();
  await page.clock.fastForward(10000);
  await page.getByLabel('Pausar o descanso').click();
  const frozen = (await body(page)).match(/\b0(\d):(\d\d)\b/);
  await page.clock.fastForward(30000);
  assert.equal((await body(page)).match(/\b0(\d):(\d\d)\b/)[0], frozen[0], 'pausado: o relógio não anda');
  assert.equal(await page.getByLabel('Retomar o descanso').count(), 1);
  await page.getByLabel('Retomar o descanso').click();
  await page.clock.fastForward(5000);
  assert.notEqual((await body(page)).match(/\b0(\d):(\d\d)\b/)[0], frozen[0], 'retomado: volta a contar');
  await page.getByLabel('Pular descanso').click();
  await page.getByText(/EXERCÍCIO 2\/6/).first().waitFor();
  await context.close();
});

test('ajustes: voz do treino vem desligada e persiste; edição do exercício oferece o vídeo próprio', {skip}, async () => {
  const {context, page, errors} = await open();
  await openSettings(page);
  assert.equal(await page.getByRole('switch', {name: 'Voz do treino'}).getAttribute('aria-checked'), 'false');
  assert.equal((await store(page)).voice === true, false);
  await page.getByRole('switch', {name: 'Voz do treino'}).click();
  assert.equal((await store(page)).voice, true);
  await closeSheet(page);
  await tab(page, 'Buscar');
  await search(page).fill('martelo');
  await page.getByLabel('Ver e ajustar Rosca martelo', {exact: true}).click();
  await page.getByText('Meu vídeo de execução', {exact: true}).waitFor();
  await page.getByLabel('ESCOLHER UM VÍDEO').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('barra do player: a bolinha acompanha o dedo ao arrastar (volume muda na hora, com toque e com arrasto)', {skip}, async () => {
  const {context, page, errors} = await open({device: {permission: 'granted', tracks: TRACKS}, touch: false});
  await tab(page, 'Músicas');
  await page.getByLabel('Tocar Lose Yourself', {exact: true}).click();
  await settle(page, 400);
  const bar = page.getByLabel('Volume', {exact: true});
  await bar.waitFor();
  await bar.scrollIntoViewIfNeeded(); await settle(page, 200);
  const box = await bar.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.95, y); await page.mouse.down();       // segura perto da bolinha (volume 100%)
  await page.mouse.move(box.x + box.width * 0.6, y, {steps: 6});
  await page.mouse.move(box.x + box.width * 0.25, y, {steps: 6});
  const during = (await store(page, MUSIC)) ? 1 : 0;                                  // (o volume é gravado enquanto arrasta)
  await page.mouse.up();
  await settle(page, 300);
  const vol = (await store(page, MUSIC)).volume;
  assert.ok(vol > 0.15 && vol < 0.4, `volume ficou perto de 25% depois do arrasto (veio ${vol})`);
  await page.mouse.click(box.x + box.width * 0.8, y);                                  // toque direto no ponto
  await settle(page, 300);
  const v2 = (await store(page, MUSIC)).volume;
  assert.ok(v2 > 0.7 && v2 < 0.9, `toque em 80% (veio ${v2})`);
  assert.ok(during >= 0);
  assert.deepEqual(errors.filter((e) => !/no supported source/.test(e)), []);   // o navegador não toca file:// de mentira
  await context.close();
});
