// Testes das regras puras. Rode: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const L = createRequire(import.meta.url)('../shared/logic.js');

/* ---------- versões ---------- */
test('compareVersions: ordem numérica, não textual', () => {
  assert.equal(L.compareVersions('1.0.10', '1.0.9'), 1);
  assert.equal(L.compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(L.compareVersions('2.0.0', '10.0.0'), -1);
  assert.equal(L.compareVersions('v1.1.0', '1.1.0'), 0);
});
test('compareVersions: pré-release é menor que a final', () => {
  assert.equal(L.compareVersions('1.1.0-beta.1', '1.1.0'), -1);
  assert.equal(L.compareVersions('1.1.0', '1.1.0-rc.1'), 1);
  assert.equal(L.compareVersions('1.1.0-beta.2', '1.1.0-beta.10'), -1);
  assert.equal(L.compareVersions('1.1.0-alpha', '1.1.0-alpha.1'), -1);
});
test('compareVersions: tag inválida nunca é mais nova', () => {
  assert.equal(L.compareVersions('latest', '1.0.0'), -1);
  assert.equal(L.compareVersions('1.0', '1.0.0'), -1);
  assert.equal(L.compareVersions('x', 'y'), 0);
});
test('pickLatestRelease: ignora rascunho e tag inválida, não depende da ordem da API', () => {
  const r = L.pickLatestRelease([
    {tag_name: 'v1.0.2', draft: false},
    {tag_name: 'v9.9.9', draft: true},
    {tag_name: 'nightly', draft: false},
    {tag_name: 'v1.1.0', draft: false},
    {tag_name: 'v1.0.9', draft: false},
  ]);
  assert.equal(r.tag_name, 'v1.1.0');
  assert.equal(L.pickLatestRelease([]), null);
  assert.equal(L.pickLatestRelease(null), null);
  assert.equal(L.pickLatestRelease([{tag_name: 'v1.0.0', draft: true}]), null);
});
test('evaluateUpdate: newer / current / ahead / none', () => {
  const rel = (t) => [{tag_name: t, draft: false}];
  assert.equal(L.evaluateUpdate('1.1.0', rel('v1.2.0')).state, 'newer');
  assert.equal(L.evaluateUpdate('1.1.0', rel('v1.1.0')).state, 'current');
  assert.equal(L.evaluateUpdate('1.1.0', rel('v1.0.9')).state, 'ahead');
  assert.equal(L.evaluateUpdate('1.1.0', []).state, 'none');
  assert.equal(L.evaluateUpdate('1.1.0', rel('v1.2.0')).tag, '1.2.0');
});
test('evaluateUpdate: um commit novo não vira atualização (só release instalável conta)', () => {
  // A API de commits nem é consultada pela lógica: sem release, o estado é "none".
  assert.equal(L.evaluateUpdate('1.1.0', []).state, 'none');
});
test('safeGithubUrl: só https://github.com/<repo>/…', () => {
  const repo = 'Josperdias/Modo-Treino';
  assert.ok(L.safeGithubUrl('https://github.com/josperdias/modo-treino/releases/tag/v1', repo));
  assert.equal(L.safeGithubUrl('http://github.com/Josperdias/Modo-Treino/releases', repo), null);
  assert.equal(L.safeGithubUrl('https://evil.com/Josperdias/Modo-Treino/', repo), null);
  assert.equal(L.safeGithubUrl('https://github.com.evil.com/Josperdias/Modo-Treino/', repo), null);
  assert.equal(L.safeGithubUrl('https://github.com/Outro/Repo/releases', repo), null);
  assert.equal(L.safeGithubUrl('javascript:alert(1)', repo), null);
  assert.equal(L.safeGithubUrl(undefined, repo), null);
});
test('apkAsset: acha o .apk, valida URL e extrai SHA-256', () => {
  const sha = 'a'.repeat(64);
  const release = {assets: [
    {name: 'SHA256SUMS.txt', browser_download_url: 'https://github.com/Josperdias/Modo-Treino/releases/download/v1/SHA256SUMS.txt'},
    {name: 'modo-treino-1.1.0-debug.apk', size: 1234, digest: 'sha256:' + sha.toUpperCase(), browser_download_url: 'https://github.com/Josperdias/Modo-Treino/releases/download/v1/modo-treino-1.1.0-debug.apk'},
  ]};
  const a = L.apkAsset(release, 'Josperdias/Modo-Treino');
  assert.equal(a.name, 'modo-treino-1.1.0-debug.apk');
  assert.equal(a.sha256, sha);
  assert.equal(a.size, 1234);
  assert.equal(L.apkAsset({assets: []}, 'Josperdias/Modo-Treino'), null);
  assert.equal(L.apkAsset({assets: [{name: 'x.apk', browser_download_url: 'https://evil.com/x.apk'}]}, 'Josperdias/Modo-Treino'), null);
  assert.equal(L.apkAsset(null), null);
});

/* ---------- treino ---------- */
const EX = [
  {id: 'a1', nome: 'Rosca direta', treino: 'A'},
  {id: 'a2', nome: 'Rosca martelo', treino: 'A'},
  {id: 'b1', nome: 'Supino', treino: 'B'},
];
const snap = (confs, dones, treino = 'A', date = '2026-10-10') =>
  L.snapshotSession({exercises: EX, treino, date, time: '07:30', getConf: (e) => confs[e.id], getDone: (e) => dones[e.id] || []});

test('snapshotSession: conta só séries marcadas; volume = séries × reps × carga', () => {
  const s = snap({a1: {series: 4, reps: 10, peso: '20'}, a2: {series: 3, reps: 12, peso: ''}}, {a1: [true, true, false, true], a2: []});
  assert.equal(s.sets, 3);
  assert.equal(s.percent, Math.round((100 * 3) / 7));
  assert.equal(s.volume, 600);
  assert.deepEqual(s.items, [{id: 'a1', nome: 'Rosca direta', series: 3, reps: 10, peso: 20}]);
});
test('snapshotSession: séries marcadas além do configurado são ignoradas', () => {
  const s = snap({a1: {series: 2, reps: 10, peso: 5}, a2: {series: 2, reps: 10, peso: 5}}, {a1: [true, true, true, true]});
  assert.equal(s.sets, 2);
  assert.equal(s.percent, 50);
});
test('snapshotSession: vírgula decimal, treino B não mistura com A, nada marcado = vazio', () => {
  const s = snap({a1: {series: 3, reps: 10, peso: '7,5'}, a2: {series: 3, reps: 10, peso: 5}, b1: {series: 3, reps: 8, peso: 40}}, {a1: [true], b1: [true, true]}, 'A');
  assert.equal(s.volume, 75);
  assert.equal(s.items.length, 1);
  const b = snap({b1: {series: 3, reps: 8, peso: 40}}, {b1: [true, true]}, 'B');
  assert.equal(b.volume, 640);
  const none = snap({a1: {series: 3, reps: 10, peso: 5}, a2: {series: 3, reps: 10, peso: 5}}, {});
  assert.equal(none.sets, 0);
  assert.deepEqual(none.items, []);
});
test('snapshotSession: peso absurdo é limitado a 999 e texto vira zero', () => {
  const s = snap({a1: {series: 1, reps: 1, peso: '5000'}, a2: {series: 1, reps: 1, peso: 'abc'}}, {a1: [true], a2: [true]});
  assert.equal(s.items[0].peso, 999);
  assert.equal(s.items[1].peso, 0);
});

test('annotateRecords: 1º registro não é recorde; só carga estritamente maior', () => {
  const mk = (peso, id = 'a1') => ({date: 'd', treino: 'A', sets: 1, percent: 1, items: [{id, nome: 'x', series: 1, reps: 1, peso}]});
  const sessions = [mk(10), mk(10), mk(12), mk(11), mk(12.5), {date: 'd', treino: 'A', sets: 0, percent: 0}, mk(0), mk(20, 'a2')];
  assert.deepEqual(L.annotateRecords(sessions), [[], [], ['a1'], [], ['a1'], [], [], []]);
});
test('personalBests: maior carga por exercício', () => {
  const b = L.personalBests([
    {date: '2026-01-01', items: [{id: 'a1', nome: 'Rosca', peso: 10}]},
    {date: '2026-02-01', items: [{id: 'a1', nome: 'Rosca', peso: 15}, {id: 'a2', nome: 'Martelo', peso: 0}]},
    {date: '2026-03-01', items: [{id: 'a1', nome: 'Rosca', peso: 12}]},
  ]);
  assert.deepEqual(b, {a1: {peso: 15, date: '2026-02-01', nome: 'Rosca'}});
});
test('totalVolume soma e ignora sessões antigas sem volume', () => {
  assert.equal(L.totalVolume([{volume: 100.5}, {}, {volume: 20.25}]), 120.8);
  assert.equal(L.totalVolume([]), 0);
});
test('streak: conta até hoje, ou até ontem se hoje ainda não treinou', () => {
  const s = (...d) => d.map((date) => ({date}));
  assert.equal(L.streak(s('2026-10-12', '2026-10-11', '2026-10-10'), '2026-10-12'), 3);
  assert.equal(L.streak(s('2026-10-11', '2026-10-10'), '2026-10-12'), 2);
  assert.equal(L.streak(s('2026-10-09'), '2026-10-12'), 0);
  assert.equal(L.streak([], '2026-10-12'), 0);
  assert.equal(L.streak(s('2026-10-12'), 'lixo'), 0);
  assert.equal(L.streak(s('2026-03-01', '2026-02-28', '2026-02-27'), '2026-03-01'), 3); // virada de mês
});

/* ---------- CSV ---------- */
test('sessionsToCsv: cabeçalho, uma linha por exercício, aspas e linha resumo para sessão antiga', () => {
  const csv = L.sessionsToCsv([
    {date: '2026-10-10', time: '07:30', treino: 'A', sets: 3, percent: 50, volume: 600, items: [{id: 'a1', nome: 'Rosca "direta", W', series: 3, reps: 10, peso: 20}]},
    {date: '2026-10-09', time: '', treino: 'B', sets: 5, percent: 40},
  ]);
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[0], 'data,hora,treino,exercicio,series_feitas,repeticoes,carga_kg,volume_kg');
  assert.equal(lines[1], '2026-10-10,07:30,A,"Rosca ""direta"", W",3,10,20,600');
  assert.equal(lines[2], '2026-10-09,,B,,5,,,');
  assert.equal(lines.length, 3);
});
test('sessionsToCsv: neutraliza injeção de fórmula', () => {
  const csv = L.sessionsToCsv([{date: '2026-10-10', treino: 'A', sets: 1, percent: 1, items: [{id: 'a1', nome: '=HYPERLINK("http://x")', series: 1, reps: 1, peso: 0}]}]);
  assert.match(csv, /"'=HYPERLINK/);
});

/* ---------- backup ---------- */
const goodBackup = () => ({
  persona: 'loira', rest: 90,
  sets: {'2026-10-10:A': {a1: [true, false, true]}},
  override: {a1: {peso: '12,5', series: 4, reps: 8}},
  sessions: [{date: '2026-10-10', time: '07:30', treino: 'A', sets: 2, percent: 50, items: [{id: 'a1', nome: 'Rosca', series: 2, reps: 8, peso: 12.5}]}],
});
test('validateBackup: aceita backup válido e normaliza', () => {
  const b = L.validateBackup(goodBackup());
  assert.equal(b.persona, 'loira');
  assert.equal(b.rest, 90);
  assert.deepEqual(b.sets['2026-10-10:A'].a1, [true, false, true]);
  assert.deepEqual(b.override.a1, {peso: '12.5', series: 4, reps: 8});
  assert.equal(b.sessions[0].volume, 200);
});
test('validateBackup: backup antigo (v1.0.1, sem items) continua válido', () => {
  const old = {persona: 'vinho', rest: 60, sets: {}, override: {}, sessions: [{date: '2026-10-01', time: '08:00', treino: 'B', sets: 10, percent: 80}], sounds: {enabled: false}};
  const b = L.validateBackup(old);
  assert.equal(b.sessions.length, 1);
  assert.equal(b.sessions[0].items, undefined);
});
test('validateBackup: rejeita estrutura inválida', () => {
  for (const bad of [null, 5, 'x', [], {}, {sessions: [], sets: {}}, {sessions: {}, sets: {}, override: {}}, {sessions: [], sets: [], override: {}}]) {
    assert.throws(() => L.validateBackup(bad), /Estrutura inválida/);
  }
});
test('validateBackup: descarta lixo, valores fora de faixa e chaves perigosas', () => {
  const evil = JSON.parse('{"sets":{"__proto__":{"a1":[true]},"2026-10-10:A":{"__proto__":[true],"a1":[1,0,"x"],"zz":[true]},"2026-10-10:Z":{}},"override":{"a1":{"peso":"9999","series":99,"reps":-4},"__proto__":{"series":3},"x9":{"series":3}},"sessions":[{"date":"ontem","treino":"A"},{"date":"2026-10-10","treino":"C"},{"date":"2026-10-10","treino":"A","sets":-5,"percent":500,"items":[{"id":"../../x"},{"id":"a1","series":100,"reps":0,"peso":-3}]},"lixo",null],"rest":7,"persona":"hacker"}');
  const b = L.validateBackup(evil);
  assert.equal(({}).a1, undefined, 'não polui Object.prototype');
  assert.deepEqual(Object.keys(b.sets), ['2026-10-10:A']);
  assert.deepEqual(b.sets['2026-10-10:A'], {a1: [true, false, true]});
  assert.deepEqual(b.override, {a1: {peso: '', series: 12, reps: 1}});
  assert.equal(b.sessions.length, 1);
  assert.equal(b.sessions[0].sets, 0);
  assert.equal(b.sessions[0].percent, 100);
  assert.deepEqual(b.sessions[0].items, [{id: 'a1', nome: '', series: 12, reps: 1, peso: 0}]);
  assert.equal(b.rest, 60);
  assert.equal(b.persona, 'vinho');
});
test('validateBackup: limita séries por exercício e quantidade de sessões', () => {
  const b = goodBackup();
  b.sets['2026-10-10:A'].a1 = new Array(50).fill(true);
  b.sessions = new Array(6000).fill(goodBackup().sessions[0]);
  const out = L.validateBackup(b);
  assert.equal(out.sets['2026-10-10:A'].a1.length, 12);
  assert.equal(out.sessions.length, 5000);
});
test('validateBackup: round-trip de JSON.stringify do próprio estado', () => {
  const b = L.validateBackup(goodBackup());
  assert.deepEqual(L.validateBackup(JSON.parse(JSON.stringify(b))), b);
});

/* ---------- modo execução ---------- */
test('tapSeries: tocar em k marca as k primeiras; tocar de novo no total feito desmarca a última', () => {
  assert.deepEqual(L.tapSeries([], 3, 5), [true, true, true, false, false]);
  assert.deepEqual(L.tapSeries([true, true, true], 5, 5), [true, true, true, true, true]);
  assert.deepEqual(L.tapSeries([true, true, true], 3, 5), [true, true, false, false, false]); // corrige toque errado
  assert.deepEqual(L.tapSeries([true], 1, 3), [false, false, false]);
  assert.deepEqual(L.tapSeries([true, true, true, true, true], 2, 5), [true, true, false, false, false]); // diminuir
  assert.deepEqual(L.tapSeries(undefined, 2, 3), [true, true, false]);
});
test('tapSeries/withCount: limites e entradas ruins', () => {
  assert.deepEqual(L.withCount(99, 3), [true, true, true]);
  assert.deepEqual(L.withCount(-4, 3), [false, false, false]);
  assert.deepEqual(L.withCount('x', 2), [false, false]);
  assert.deepEqual(L.tapSeries([], 0, 3), [false, false, false]);
  assert.equal(L.tapSeries([], 7, 3).length, 3);
});
test('doneCount: conta marcadas (mesmo não consecutivas) e ignora o que passa do total', () => {
  assert.equal(L.doneCount([true, false, true, true], 3), 2);
  assert.equal(L.doneCount(null, 3), 0);
});
const wp = (confs, dones, treino = 'A') => L.workoutProgress({exercises: EX, treino, getConf: (e) => confs[e.id], getDone: (e) => dones[e.id] || []});
test('workoutProgress: totais, percentual e primeiro exercício incompleto', () => {
  const p = wp({a1: {series: 3}, a2: {series: 2}}, {a1: [true, true, true], a2: [true]});
  assert.deepEqual(p.list, [{id: 'a1', total: 3, done: 3, complete: true, skipped: false}, {id: 'a2', total: 2, done: 1, complete: false, skipped: false}]);
  assert.equal(p.sets, 4); assert.equal(p.total, 5); assert.equal(p.percent, 80); assert.equal(p.firstIncomplete, 1);
  assert.equal(wp({a1: {series: 1}, a2: {series: 1}}, {a1: [true], a2: [true]}).firstIncomplete, -1);
  assert.equal(wp({a1: {series: 4}, a2: {series: 4}}, {}).percent, 0);
});
test('nextStep: mesma série, próximo exercício, volta ao pulado e fim', () => {
  const item = (done, total = 2, skipped = false) => ({id: 'x', total, done, complete: done >= total, skipped});
  assert.deepEqual(L.nextStep([item(1), item(0)], 0), {type: 'same', index: 0});
  assert.deepEqual(L.nextStep([item(2), item(0), item(0)], 0), {type: 'exercise', index: 1});
  assert.deepEqual(L.nextStep([item(0), item(2), item(2)], 2), {type: 'exercise', index: 0}); // volta ao exercício pulado
  assert.deepEqual(L.nextStep([item(2), item(2)], 1), {type: 'done', index: -1});
  assert.deepEqual(L.nextStep([], 0), {type: 'done', index: -1});
});

/* ---------- "não vou fazer este exercício" ---------- */
test('exercício pulado conta como resolvido: o treino pode terminar, mas não soma séries nem percentual', () => {
  const pw = (skipIds) => L.workoutProgress({exercises: EX, treino: 'A', getConf: (e) => ({a1: {series: 3}, a2: {series: 2}})[e.id], getDone: (e) => ({a1: [true, true, true]})[e.id] || [], getSkipped: (e) => skipIds.includes(e.id)});
  const p = pw(['a2']);
  assert.equal(p.list[1].skipped, true); assert.equal(p.firstIncomplete, -1); assert.equal(p.skippedCount, 1);
  assert.equal(p.sets, 3); assert.equal(p.percent, 60, 'o percentual NÃO sobe por pular');
  assert.equal(pw([]).firstIncomplete, 1); assert.equal(pw([]).skippedCount, 0);
  // um exercício já completo nunca conta como "pulado"
  assert.equal(pw(['a1']).skippedCount, 0);
});
test('nextStep: pula os exercícios pulados e termina quando só sobram pulados', () => {
  const item = (done, total = 2, skipped = false) => ({id: 'x', total, done, complete: done >= total, skipped});
  assert.deepEqual(L.nextStep([item(2), item(0, 2, true), item(0)], 0), {type: 'exercise', index: 2});
  assert.deepEqual(L.nextStep([item(2), item(0, 2, true)], 0), {type: 'done', index: -1});
  assert.deepEqual(L.nextStep([item(0, 2, true), item(2)], 0), {type: 'done', index: -1});
});
test('setSkipped: marca e desmarca sem repetir e sem alterar o vetor original', () => {
  const base = ['a'];
  assert.deepEqual(L.setSkipped(base, 'b', true), ['a', 'b']);
  assert.deepEqual(L.setSkipped(['a', 'b'], 'b', true), ['a', 'b']);
  assert.deepEqual(L.setSkipped(['a', 'b'], 'a', false), ['b']);
  assert.deepEqual(L.setSkipped(undefined, 'x', true), ['x']);
  assert.deepEqual(base, ['a']);
});
test('snapshotSession e backup guardam os exercícios que a pessoa disse que não ia fazer', () => {
  const sn = L.snapshotSession({exercises: EX, treino: 'A', date: '2026-10-14', time: '07:30', getConf: (e) => ({series: 2, reps: 5, peso: 10}), getDone: (e) => (e.id === 'a1' ? [true, true] : []), getSkipped: (e) => e.id === 'a2'});
  assert.deepEqual(sn.skipped, [{id: 'a2', nome: EX.find((x) => x.id === 'a2').nome}]);
  const sem = L.snapshotSession({exercises: EX, treino: 'A', date: '2026-10-14', getConf: () => ({series: 2, reps: 5, peso: 10}), getDone: () => []});
  assert.ok(!('skipped' in sem), 'sem pulados o campo nem aparece (sessões antigas ficam iguais)');
  const b = L.validateBackup({sessions: [{...sn, skipped: [...sn.skipped, {id: '../x'}, 7]}], sets: {}, override: {}});
  assert.deepEqual(b.sessions[0].skipped, sn.skipped, 'backup descarta ids inválidos');
});

/* ---------- descanso ---------- */
test('restPlan: por padrão só descansa ao terminar o exercício; entre séries só se configurado', () => {
  assert.equal(L.restPlan({exerciseDone: false}), 0);                       // entre séries: nada
  assert.equal(L.restPlan({exerciseDone: true}), 60);                       // entre exercícios: 60 s
  assert.equal(L.restPlan({exerciseDone: true, restExercise: 90}), 90);
  assert.equal(L.restPlan({exerciseDone: false, restSet: 30}), 30);         // configurou descanso entre séries
  assert.equal(L.restPlan({exerciseDone: true, restSet: 30, restExercise: 120}), 120);
  assert.equal(L.restPlan({exerciseDone: true, workoutDone: true}), 0);    // acabou o treino: sem descanso
  assert.equal(L.restPlan({exerciseDone: true, restExercise: 0}), 0);      // pode desligar também entre exercícios
});
test('normalizeRest: migra o ajuste antigo e limita valores absurdos', () => {
  assert.deepEqual(L.normalizeRest({rest: 90}), {restExercise: 90, restSet: 0}); // antigo "rest" vira descanso entre exercícios
  assert.deepEqual(L.normalizeRest({}), {restExercise: 60, restSet: 0});
  assert.deepEqual(L.normalizeRest(null), {restExercise: 60, restSet: 0});
  assert.deepEqual(L.normalizeRest({restExercise: 99999, restSet: -5}), {restExercise: 600, restSet: 0});
  assert.deepEqual(L.normalizeRest({restExercise: 'abc', restSet: 45}), {restExercise: 60, restSet: 45});
});
test('validateBackup: guarda os dois descansos e aceita backup antigo só com "rest"', () => {
  const base = {sessions: [], sets: {}, override: {}};
  assert.equal(L.validateBackup({...base, rest: 120}).restExercise, 120);
  const n = L.validateBackup({...base, restExercise: 45, restSet: 20});
  assert.equal(n.restExercise, 45); assert.equal(n.restSet, 20);
});

/* ---------- fitas ---------- */
const TAPES = () => [{id: 'a', name: 'Treino A', ids: ['m1', 'm2']}, {id: 'b', name: 'Treino B', ids: ['m2']}];
test('tapeAdd: adiciona sem duplicar e só na fita escolhida', () => {
  const out = L.tapeAdd(TAPES(), 'a', ['m2', 'm3', 'm3', '', 7]);
  assert.deepEqual(out[0].ids, ['m1', 'm2', 'm3']);
  assert.deepEqual(out[1].ids, ['m2']);
});
test('tapeRemove: tira só da fita escolhida; a música continua nas outras fitas', () => {
  const t = TAPES(); const out = L.tapeRemove(t, 'a', 'm2');
  assert.deepEqual(out[0].ids, ['m1']); assert.deepEqual(out[1].ids, ['m2']);
  assert.deepEqual(t[0].ids, ['m1', 'm2'], 'não altera a entrada');
});
test('tapeRemove nunca mexe na lista de músicas (não apaga arquivo)', () => {
  const lib = {tracks: [{id: 'm1', title: 'Um'}, {id: 'm2', title: 'Dois'}], tapes: TAPES()};
  const tapes = L.tapeRemove(lib.tapes, 'a', 'm1');
  assert.equal(lib.tracks.length, 2);
  assert.equal(tapes.some((t) => t.ids.includes('m1')), false);
});
test('forgetTrack (cópia importada): sai da biblioteca e de todas as fitas', () => {
  const lib = {tracks: [{id: 'm1', title: 'Um'}, {id: 'm2', title: 'Dois'}], tapes: TAPES(), x: 1};
  const out = L.forgetTrack(lib, 'm2');
  assert.deepEqual(out.tracks.map((x) => x.id), ['m1']);
  assert.deepEqual(out.tapes.map((t) => t.ids), [['m1'], []]);
  assert.equal(out.x, 1);
});
test('tapeMove: troca de lugar e respeita os limites', () => {
  const t = [{id: 'a', name: 'A', ids: ['1', '2', '3']}];
  assert.deepEqual(L.tapeMove(t, 'a', '3', -1)[0].ids, ['1', '3', '2']);
  assert.deepEqual(L.tapeMove(t, 'a', '1', -1)[0].ids, ['1', '2', '3']);
  assert.deepEqual(L.tapeMove(t, 'a', '3', 1)[0].ids, ['1', '2', '3']);
  assert.deepEqual(L.tapeMove(t, 'a', 'zz', 1)[0].ids, ['1', '2', '3']);
});
test('resolveTape: ignora músicas que sumiram do celular e conta quantas', () => {
  const r = L.resolveTape({id: 'a', name: 'A', ids: ['m1', 'gone', 'm2']}, [{id: 'm2', title: 'Dois'}, {id: 'm1', title: 'Um'}]);
  assert.deepEqual(r.tracks.map((x) => x.id), ['m1', 'm2']); assert.equal(r.missing, 1);
});
test('nextTrackId: sequência, fim, repetir e aleatório sem repetir a atual', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(L.nextTrackId(ids, 'a', 1), 'b');
  assert.equal(L.nextTrackId(ids, 'c', 1), null);
  assert.equal(L.nextTrackId(ids, 'c', 1, {repeat: true}), 'a');
  assert.equal(L.nextTrackId(ids, 'a', -1, {repeat: true}), 'c');
  assert.equal(L.nextTrackId(ids, 'a', -1), null);
  assert.equal(L.nextTrackId(ids, null, 1), 'a');
  assert.equal(L.nextTrackId([], 'a', 1), null);
  for (const r of [0, 0.5, 0.99]) assert.notEqual(L.nextTrackId(ids, 'b', 1, {shuffle: true, rand: () => r}), 'b');
  assert.equal(L.nextTrackId(['x'], 'x', 1, {shuffle: true}), null);
});
test('searchTracks e formatClock', () => {
  const tr = [{id: '1', title: 'Eye of the Tiger', artist: 'Survivor'}, {id: '2', title: 'Lose Yourself'}];
  assert.deepEqual(L.searchTracks(tr, '  surv').map((x) => x.id), ['1']);
  assert.equal(L.searchTracks(tr, '').length, 2);
  assert.equal(L.formatClock(65), '1:05'); assert.equal(L.formatClock(-3), '0:00'); assert.equal(L.formatClock('x'), '0:00');
});
test('busca: foldText tira acento/caixa; searchRank exige TODAS as palavras e ordena por relevância', () => {
  assert.equal(L.foldText('  Bíceps   NA  Barra '), 'biceps na barra');
  assert.equal(L.foldText(null), '');
  const it = [{n: 'Rosca martelo', d: 'bíceps'}, {n: 'Bíceps na barra', d: ''}, {n: 'Supino reto', d: 'peito'}];
  const r = L.searchRank(it, 'biceps', (x) => [x.n, x.d]);
  assert.deepEqual(r.map((x) => x.n), ['Bíceps na barra', 'Rosca martelo']);   // nome começando com a palavra vem antes de achar só na descrição
  assert.deepEqual(L.searchRank(it, 'rosca bic', (x) => [x.n, x.d]).map((x) => x.n), ['Rosca martelo']);
  assert.deepEqual(L.searchRank(it, 'rosca peito', (x) => [x.n, x.d]), []);
  assert.deepEqual(L.searchRank(it, '   ', (x) => [x.n]), []);
});
test('busca: exercícios, bags, fitas e treinos feitos (sem acento, por grupo/código/treino/data)', () => {
  const ex = [
    {id: 'a1', treino: 'A', grupo: 'Bíceps', nome: 'Rosca direta na barra W', codigo: 'A1', nota: '', orientacao: 'Mantenha o cotovelo junto ao corpo'},
    {id: 'b2', treino: 'B', grupo: 'Ombro', nome: 'Elevação lateral', codigo: 'B2', nota: 'leve', orientacao: ''},
  ];
  assert.deepEqual(L.searchExercises(ex, 'biceps').map((x) => x.id), ['a1']);
  assert.deepEqual(L.searchExercises(ex, 'a1').map((x) => x.id), ['a1']);
  assert.deepEqual(L.searchExercises(ex, 'b2').map((x) => x.id), ['b2']);
  assert.deepEqual(L.searchExercises(ex, 'cotovelo').map((x) => x.id), ['a1']);
  assert.deepEqual(L.searchExercises(ex, 'elevacao lat').map((x) => x.id), ['b2']);
  assert.deepEqual(L.searchExercises(ex, 'xyz'), []);
  assert.deepEqual(L.searchBags([{id: '1', name: 'Treino A'}, {id: '2', name: 'Favoritas'}], 'fav').map((x) => x.id), ['2']);
  assert.deepEqual(L.searchTracks([{id: '1', title: 'Pagode do Zé', artist: 'Grupo'}], 'ze pag').map((x) => x.id), ['1']);
  const ss = [
    {date: '2026-10-01', treino: 'A', sets: 10, items: [{nome: 'Rosca direta na barra W'}]},
    {date: '2026-10-05', treino: 'B', sets: 8, items: [{nome: 'Elevação lateral'}]},
    {date: '2026-10-09', treino: 'A', sets: 12, items: [{nome: 'Rosca direta na barra W'}]},
  ];
  assert.deepEqual(L.searchSessions(ss, 'rosca').map((x) => x.date), ['2026-10-09', '2026-10-01']);   // mais recentes primeiro
  assert.deepEqual(L.searchSessions(ss, '05/10').map((x) => x.date), ['2026-10-05']);
  assert.deepEqual(L.searchSessions(ss, 'treino a').map((x) => x.date), ['2026-10-09', '2026-10-01']);
});
test('tapeInsert: devolve a música à posição original (desfazer) sem duplicar', () => {
  const t = [{id: 'a', name: 'A', ids: ['1', '3']}];
  assert.deepEqual(L.tapeInsert(t, 'a', '2', 1)[0].ids, ['1', '2', '3']);
  assert.deepEqual(L.tapeInsert(t, 'a', '2', 99)[0].ids, ['1', '3', '2']);
  assert.deepEqual(L.tapeInsert(t, 'a', '2', -5)[0].ids, ['2', '1', '3']);
  assert.deepEqual(L.tapeInsert(t, 'a', '1', 0)[0].ids, ['1', '3'], 'já está na fita: não duplica');
  assert.deepEqual(L.tapeInsert(t, 'zz', '2', 0)[0].ids, ['1', '3']);
});

test('releaseNotes: pega só o trecho antes do "---", sem markdown, limitado', () => {
  const body = '### Rádio\n- **Planeta neon** com `países` em [português](https://x.y)\n- Pinos menores\n\n---\n\nModo Treino 1.3.2 para Android\n**SHA-256:** `abc`';
  assert.deepEqual(L.releaseNotes(body), ['Rádio', 'Planeta neon com países em português', 'Pinos menores']);
  assert.deepEqual(L.releaseNotes(''), []);
  assert.deepEqual(L.releaseNotes(null), []);
  assert.deepEqual(L.releaseNotes('---\nsó instalação'), []);
  const longo = L.releaseNotes('- ' + 'a'.repeat(50) + '\n- ' + 'b'.repeat(50), 60);
  assert.equal(longo.length, 2); assert.ok(longo[1].endsWith('…') && longo[1].length <= 12);
});

/* ---------- personalização das fitas ---------- */
test('cleanDeco: só guarda campos válidos e devolve null quando não sobra nada', () => {
  assert.equal(L.cleanDeco(null), null);
  assert.equal(L.cleanDeco({}), null);
  assert.equal(L.cleanDeco({color: 14, pattern: 'xadrez', note: '   ', stickers: [1, '', {e: ''}]}), null);
  assert.equal(L.cleanDeco({edge: 'serrilhada'}), null, 'borda desconhecida é descartada');
  assert.deepEqual(L.cleanDeco({edge: 'hazard'}), {edge: 'hazard'});
  assert.deepEqual(L.cleanDeco({color: '3', pattern: 'dots', note: 'supino 3x10  ', stickers: ['⭐'], image: 'file:///capa.png', lixo: 1}),
    {color: 3, pattern: 'dots', stickers: [{e: '⭐', x: 0.88, y: 0.2, s: 1, r: 0}], note: 'supino 3x10', image: 'file:///capa.png'});
});
test('cleanDeco: figurinhas guardam posição e tamanho dentro dos limites; no máximo 6; anotação até 280; cor 0 vale', () => {
  const d = L.cleanDeco({color: 0, stickers: [{e: '🔥', x: 2, y: -1, s: 9}, {e: '💪', x: 0.5, y: 0.5}, '1', '2', '3', '4', '5'], note: 'x'.repeat(500)});
  assert.equal(d.color, 0);
  assert.equal(d.stickers.length, 6);
  assert.deepEqual(d.stickers[0], {e: '🔥', x: 1, y: 0, s: 2.2, r: 0});
  assert.deepEqual(d.stickers[1], {e: '💪', x: 0.5, y: 0.5, s: 1, r: 0});
  assert.equal(L.cleanDeco({stickers: [{e: '⭐', r: 500.6}]}).stickers[0].r, 180, 'o giro fica entre -180 e 180');
  assert.equal(L.cleanDeco({stickers: [{e: '⭐', r: -45.4}]}).stickers[0].r, -45);
  assert.equal(d.note.length, 280);
});
test('setDeco: junta campos, apaga com null e some quando fica vazia', () => {
  let m = L.setDeco({}, 'dev:1', {color: 2});
  m = L.setDeco(m, 'dev:1', {note: 'fazer 5 séries'});
  assert.deepEqual(m['dev:1'], {color: 2, note: 'fazer 5 séries'});
  const before = m;
  m = L.setDeco(m, 'dev:2', {stickers: [{e: '🔥', x: 0.3, y: 0.4, s: 1.2}]});
  assert.deepEqual(before, {'dev:1': {color: 2, note: 'fazer 5 séries'}}, 'não altera o mapa antigo');
  m = L.setDeco(m, 'dev:1', {color: null, note: ''});
  assert.equal(m['dev:1'], undefined, 'sem nada, a fita volta ao padrão');
  assert.deepEqual(Object.keys(L.setDeco(m, 'dev:2', null)), []);
});
test('cleanDecoMap: limpa o mapa carregado do armazenamento', () => {
  assert.deepEqual(L.cleanDecoMap('x'), {});
  assert.deepEqual(L.cleanDecoMap({a: {color: 1}, b: {color: 99}, c: null, d: {color: 13}}), {a: {color: 1}, d: {color: 13}});
});

test('cleanDeco: enquadramento da imagem só vale com imagem, fica nos limites e some quando é o padrão', () => {
  assert.equal(L.cleanDeco({imgFit: {z: 2, x: 0.5, y: 0}}), null, 'sem imagem não há enquadramento');
  assert.deepEqual(L.cleanDeco({image: 'file:///a.jpg', imgFit: {z: 9, x: -5, y: 0.333}}), {image: 'file:///a.jpg', imgFit: {m: 'cover', z: 3, x: -1, y: 0.33}});
  assert.deepEqual(L.cleanDeco({image: 'file:///a.jpg', imgFit: {z: 1, x: 0, y: 0}}), {image: 'file:///a.jpg'});
});

test('cleanDeco: imagem menor que a área (zoom abaixo de 1) e modos inteira/esticar são guardados', () => {
  assert.deepEqual(L.cleanDeco({image: 'file:///a.jpg', imgFit: {m: 'contain', z: 0.1}}), {image: 'file:///a.jpg', imgFit: {m: 'contain', z: 0.25, x: 0, y: 0}});
  assert.deepEqual(L.cleanDeco({image: 'file:///a.jpg', imgFit: {m: 'stretch'}}), {image: 'file:///a.jpg', imgFit: {m: 'stretch', z: 1, x: 0, y: 0}});
  assert.deepEqual(L.cleanDeco({image: 'file:///a.jpg', imgFit: {m: 'qualquer', z: 1}}), {image: 'file:///a.jpg'}, 'modo desconhecido vira preencher e some');
});
