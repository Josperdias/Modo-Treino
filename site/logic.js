/* MODO TREINO — regras puras (sem DOM, sem React Native, sem rede).
 * FONTE ÚNICA: edite SOMENTE este arquivo e rode `node scripts/sync-shared.mjs`
 * para copiá-lo para site/logic.js e native/logic.js. O CI confere se as cópias são idênticas.
 * Funciona no navegador (window.ModoLogic), no React Native (CommonJS) e no Node (testes).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModoLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- números e limites ---------- */
  const MAX_SETS = 12;
  const MAX_REPS = 100;
  const MAX_WEIGHT = 999;
  const REST_OPTIONS = [30, 45, 60, 90, 120, 180];

  function toNumber(value) {
    const n = Number(String(value == null ? '' : value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function clampSeries(value) {
    const n = Math.trunc(Number(value));
    return Math.max(1, Math.min(MAX_SETS, Number.isFinite(n) ? n : 1));
  }
  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  /* ---------- versões (semver simplificado) ---------- */
  const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

  function parseVersion(tag) {
    const m = SEMVER.exec(String(tag == null ? '' : tag).trim());
    if (!m) return null;
    return {
      major: Number(m[1]),
      minor: Number(m[2]),
      patch: Number(m[3]),
      pre: m[4] ? m[4].split('.') : [],
    };
  }

  /** -1 se a < b, 0 se iguais, 1 se a > b. Versão inválida é tratada como menor que qualquer válida. */
  function compareVersions(a, b) {
    const x = parseVersion(a);
    const y = parseVersion(b);
    if (!x && !y) return 0;
    if (!x) return -1;
    if (!y) return 1;
    for (const k of ['major', 'minor', 'patch']) {
      if (x[k] !== y[k]) return x[k] > y[k] ? 1 : -1;
    }
    if (!x.pre.length && !y.pre.length) return 0;
    if (!x.pre.length) return 1; // 1.0.0 > 1.0.0-beta
    if (!y.pre.length) return -1;
    const len = Math.max(x.pre.length, y.pre.length);
    for (let i = 0; i < len; i++) {
      const p = x.pre[i];
      const q = y.pre[i];
      if (p === undefined) return -1;
      if (q === undefined) return 1;
      const pn = /^\d+$/.test(p);
      const qn = /^\d+$/.test(q);
      if (pn && qn) {
        if (Number(p) !== Number(q)) return Number(p) > Number(q) ? 1 : -1;
      } else if (pn !== qn) {
        return pn ? -1 : 1; // numérico < alfanumérico
      } else if (p !== q) {
        return p > q ? 1 : -1;
      }
    }
    return 0;
  }

  /** Maior release publicada (não-rascunho) com tag semver válida. Não confia na ordem da API. */
  function pickLatestRelease(releases) {
    if (!Array.isArray(releases)) return null;
    let best = null;
    for (const r of releases) {
      if (!r || typeof r !== 'object' || r.draft) continue;
      if (!parseVersion(r.tag_name)) continue;
      if (!best || compareVersions(r.tag_name, best.tag_name) > 0) best = r;
    }
    return best;
  }

  /**
   * Resultado da checagem de atualização.
   *  - 'newer'   : existe release mais nova que a instalada
   *  - 'current' : mesma versão
   *  - 'ahead'   : instalada é mais nova que a última release (build de desenvolvimento)
   *  - 'none'    : nenhuma release válida publicada
   * Um commit novo NUNCA vira 'newer': só uma release instalável conta.
   */
  function evaluateUpdate(installed, releases) {
    const release = pickLatestRelease(releases);
    if (!release) return { state: 'none', release: null, tag: '' };
    const tag = String(release.tag_name).replace(/^v/i, '');
    const c = compareVersions(tag, installed);
    return { state: c > 0 ? 'newer' : c === 0 ? 'current' : 'ahead', release, tag };
  }

  /** Aceita apenas links https do próprio GitHub (nunca abre URL arbitrária vinda da API). */
  function safeGithubUrl(url, repo) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || u.hostname !== 'github.com') return null;
      if (repo && !u.pathname.toLowerCase().startsWith('/' + String(repo).toLowerCase() + '/')) return null;
      return u.toString();
    } catch (e) {
      return null;
    }
  }

  /** Encontra o APK anexado a uma release (com SHA-256 quando a API informar `digest`). */
  function apkAsset(release, repo) {
    const assets = release && Array.isArray(release.assets) ? release.assets : [];
    const a = assets.find((x) => x && /\.apk$/i.test(String(x.name || '')));
    if (!a) return null;
    const url = safeGithubUrl(a.browser_download_url, repo);
    if (!url) return null;
    const digest = /^sha256:([0-9a-f]{64})$/i.exec(String(a.digest || ''));
    return { name: String(a.name), url, size: Number(a.size) || 0, sha256: digest ? digest[1].toLowerCase() : null };
  }

  /**
   * "Novidades" de uma release: o trecho do corpo antes da primeira linha '---' (o workflow coloca ali a seção do CHANGELOG),
   * sem markdown (negrito, crase, títulos, links) e limitado a `max` caracteres. Devolve [] se não houver nada.
   * Cada item é uma linha de texto simples.
   */
  function releaseNotes(body, max) {
    const limit = max > 0 ? max : 700;
    const text = String(body == null ? '' : body).split(/^\s*---\s*$/m)[0];
    const lines = [];
    let used = 0;
    for (const raw of text.split(/\r?\n/)) {
      let t = raw.trim();
      if (!t) continue;
      t = t.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (used + t.length > limit) { lines.push(t.slice(0, Math.max(0, limit - used)).trimEnd() + '…'); break; }
      lines.push(t); used += t.length;
    }
    return lines.filter((l) => l !== '…');
  }

  /* ---------- treino: snapshot, volume e recordes ---------- */

  /**
   * Congela o que foi feito em um treino. `getConf(e)` devolve {series,reps,peso} efetivos
   * e `getDone(e)` o vetor de séries marcadas hoje. Nada é inventado: só séries marcadas contam.
   */
  function snapshotSession(o) {
    const items = [];
    const skippedList = [];
    let sets = 0;
    let total = 0;
    let volume = 0;
    for (const e of o.exercises) {
      if (e.treino !== o.treino) continue;
      const c = o.getConf(e) || {};
      const n = clampSeries(c.series);
      total += n;
      const done = (o.getDone(e) || []).slice(0, n).filter(Boolean).length;
      sets += done;
      if (typeof o.getSkipped === 'function' && o.getSkipped(e) && done < n) skippedList.push({ id: e.id, nome: e.nome });
      if (done > 0) {
        const reps = Math.max(1, Math.min(MAX_REPS, Math.trunc(Number(c.reps)) || 1));
        const peso = Math.max(0, Math.min(MAX_WEIGHT, toNumber(c.peso)));
        volume += done * reps * peso;
        items.push({ id: e.id, nome: e.nome, series: done, reps, peso });
      }
    }
    const out = {
      date: o.date,
      time: o.time || '',
      treino: o.treino,
      sets,
      percent: Math.min(100, Math.round((100 * sets) / Math.max(1, total))),
      volume: round1(volume),
      items,
    };
    if (skippedList.length) out.skipped = skippedList;   // só aparece quando a pessoa disse "não vou fazer"
    return out;
  }

  /**
   * Para cada sessão (em ordem cronológica = ordem do array), lista os ids de exercícios cuja
   * carga superou TODAS as anteriores. A primeira vez que um exercício é registrado não é recorde.
   */
  function annotateRecords(sessions) {
    const best = {};
    return sessions.map((s) => {
      const hits = [];
      for (const it of Array.isArray(s.items) ? s.items : []) {
        const w = Number(it.peso) || 0;
        if (w <= 0) continue;
        if (Object.prototype.hasOwnProperty.call(best, it.id) && w > best[it.id]) hits.push(it.id);
        if (!Object.prototype.hasOwnProperty.call(best, it.id) || w > best[it.id]) best[it.id] = w;
      }
      return hits;
    });
  }

  /** Maior carga já registrada por exercício: { id: { peso, date, nome } }. */
  function personalBests(sessions) {
    const out = {};
    for (const s of sessions) {
      for (const it of Array.isArray(s.items) ? s.items : []) {
        const w = Number(it.peso) || 0;
        if (w > 0 && (!out[it.id] || w > out[it.id].peso)) out[it.id] = { peso: w, date: s.date, nome: it.nome };
      }
    }
    return out;
  }

  function totalVolume(sessions) {
    return round1(sessions.reduce((a, s) => a + (Number(s.volume) || 0), 0));
  }

  /** Dias seguidos com treino finalizado, contando até hoje (ou até ontem, se hoje ainda não treinou). */
  function streak(sessions, todayKey) {
    const days = new Set(sessions.map((s) => s.date));
    const key = (d) =>
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const d = new Date(todayKey + 'T12:00:00');
    if (isNaN(d.getTime())) return 0;
    if (!days.has(key(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(key(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }


  /* ---------- modo execução (um card por exercício) ---------- */

  /** Quantas séries estão marcadas (conta os `true`, mesmo que não sejam consecutivos). */
  function doneCount(done, total) {
    const n = (Array.isArray(done) ? done : []).slice(0, total).filter(Boolean).length;
    return Math.max(0, Math.min(total, n));
  }

  /** Vetor com exatamente as `k` primeiras séries marcadas (k limitado a 0..total). */
  function withCount(k, total) {
    const n = Math.max(0, Math.min(total, Math.trunc(Number(k)) || 0));
    return Array.from({length: total}, (_, i) => i < n);
  }

  /**
   * Toque no botão da série `k` (1..total): "fiz k séries".
   * Tocar de novo no número que já é o total feito desmarca a última (k-1), para corrigir toques errados.
   */
  function tapSeries(done, k, total) {
    const cur = doneCount(done, total);
    const target = Math.max(0, Math.min(total, Math.trunc(Number(k)) || 0));
    return withCount(target === cur ? cur - 1 : target, total);
  }

  /**
   * Situação de cada exercício de um treino: [{id,total,done,complete,skipped}] + totais e percentual.
   * `skipped` = a pessoa disse "não vou fazer este exercício" (opcional: `getSkipped`). Pulado conta como RESOLVIDO (o treino pode terminar),
   * mas não soma séries nem percentual. `firstIncomplete` = primeiro exercício que não está feito nem pulado.
   */
  function workoutProgress(o) {
    const list = [];
    let sets = 0;
    let total = 0;
    for (const e of o.exercises) {
      if (e.treino !== o.treino) continue;
      const t = clampSeries((o.getConf(e) || {}).series);
      const d = doneCount(o.getDone(e), t);
      const skipped = typeof o.getSkipped === 'function' ? !!o.getSkipped(e) : false;
      list.push({id: e.id, total: t, done: d, complete: d >= t, skipped});
      sets += d;
      total += t;
    }
    return {
      list, sets, total,
      percent: Math.min(100, Math.round((100 * sets) / Math.max(1, total))),
      firstIncomplete: list.findIndex((x) => !x.complete && !x.skipped),
      skippedCount: list.filter((x) => x.skipped && !x.complete).length,
    };
  }

  /** Marca/desmarca um exercício como "não vou fazer" (devolve um NOVO vetor de ids, sem repetir). */
  function setSkipped(ids, id, on) {
    const base = (Array.isArray(ids) ? ids : []).filter((x) => x !== id);
    return on ? [...base, id] : base;
  }

  /**
   * O que mostrar depois do descanso (ou ao concluir uma série):
   *  - 'same'     : o exercício atual ainda tem séries (índice igual)
   *  - 'exercise' : próximo exercício incompleto e NÃO pulado (primeiro depois do atual; se não houver, o primeiro antes dele)
   *  - 'done'     : tudo completo ou pulado
   */
  function nextStep(list, i) {
    if (!list.length) return {type: 'done', index: -1};
    if (list[i] && !list[i].complete && !list[i].skipped) return {type: 'same', index: i};
    for (let k = 1; k < list.length; k++) {
      const j = (i + k) % list.length;
      if (!list[j].complete && !list[j].skipped) return {type: 'exercise', index: j};
    }
    return {type: 'done', index: -1};
  }

  /* ---------- CSV ---------- */
  /* ---------- descanso ---------- */
  const REST_MAX = 600;
  const REST_EXERCISE_DEFAULT = 60;
  function restSecs(v, fallback) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(REST_MAX, n) : fallback;
  }
  // Migra o ajuste antigo (um único "rest" aplicado a toda série) para: descanso ENTRE EXERCÍCIOS + descanso entre séries (desligado).
  function normalizeRest(o) {
    const src = o && typeof o === 'object' ? o : {};
    return {
      restExercise: restSecs(src.restExercise != null ? src.restExercise : src.rest, REST_EXERCISE_DEFAULT),
      restSet: restSecs(src.restSet, 0),
    };
  }
  // Quanto descansar depois de marcar uma série. 0 = sem descanso.
  // Padrão: só descansa ao terminar um exercício (entre um exercício e outro); entre séries só se restSet > 0.
  function restPlan(o) {
    const c = normalizeRest(o);
    if (o && o.workoutDone) return 0;
    return o && o.exerciseDone ? c.restExercise : c.restSet;
  }

  /* ---------- fitas (listas de músicas) ----------
   * Uma fita guarda só REFERÊNCIAS (ids de músicas). Tirar uma música da fita nunca apaga o arquivo do aparelho.
   * Funções puras: devolvem novas listas e não alteram a entrada. */
  function uniqueIds(ids) {
    const seen = new Set();
    const out = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (typeof id === 'string' && id && !seen.has(id)) { seen.add(id); out.push(id); }
    }
    return out;
  }
  function tapeAdd(tapes, tapeId, trackIds) {
    return tapes.map((t) => (t.id === tapeId ? Object.assign({}, t, {ids: uniqueIds(t.ids.concat(trackIds))}) : t));
  }
  function tapeRemove(tapes, tapeId, trackId) {
    return tapes.map((t) => (t.id === tapeId ? Object.assign({}, t, {ids: t.ids.filter((id) => id !== trackId)}) : t));
  }
  // Põe a música de volta numa posição (usado pelo "Desfazer" de tirar da fita).
  function tapeInsert(tapes, tapeId, trackId, index) {
    return tapes.map((t) => {
      if (t.id !== tapeId || t.ids.includes(trackId)) return t;
      const ids = t.ids.slice();
      ids.splice(Math.max(0, Math.min(ids.length, Math.trunc(index) || 0)), 0, trackId);
      return Object.assign({}, t, {ids});
    });
  }
  function tapeMove(tapes, tapeId, trackId, delta) {
    return tapes.map((t) => {
      if (t.id !== tapeId) return t;
      const ids = t.ids.slice();
      const i = ids.indexOf(trackId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= ids.length) return t;
      ids.splice(j, 0, ids.splice(i, 1)[0]);
      return Object.assign({}, t, {ids});
    });
  }
  // Esquecer uma música da biblioteca do app (só cópias importadas): sai de todas as fitas.
  function forgetTrack(lib, trackId) {
    return Object.assign({}, lib, {
      tracks: lib.tracks.filter((x) => x.id !== trackId),
      tapes: lib.tapes.map((t) => Object.assign({}, t, {ids: t.ids.filter((id) => id !== trackId)})),
    });
  }
  // Faixas da fita que ainda existem (o arquivo pode ter sido apagado do celular) + quantas sumiram.
  function resolveTape(tape, tracks) {
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const found = [];
    let missing = 0;
    for (const id of tape.ids) { const x = byId.get(id); if (x) found.push(x); else missing++; }
    return {tracks: found, missing};
  }
  // Próxima faixa dentro da fita. dir = +1/-1. rand injetável para teste. null = acabou.
  function nextTrackId(ids, currentId, dir, opts) {
    const o = opts || {};
    if (!ids.length) return null;
    const ix = ids.indexOf(currentId);
    if (o.shuffle && ids.length > 1) {
      const pool = ids.filter((id) => id !== currentId);
      return pool[Math.floor((o.rand ? o.rand() : Math.random()) * pool.length)];
    }
    if (ix < 0) return ids[0];
    const n = ix + dir;
    if (n >= 0 && n < ids.length) return ids[n];
    return o.repeat ? ids[(n + ids.length) % ids.length] : null;
  }
  /** Texto sem acento e em minúsculas ("Bíceps" → "biceps"), para buscar sem se preocupar com acentos nem maiúsculas. */
  function foldText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Busca com pontuação. `textsOf(item)` devolve os textos do item, do mais importante (nome) ao menos (descrição).
   * TODAS as palavras da busca precisam aparecer em algum texto. Quanto mais cedo e mais importante o texto, maior a nota:
   * começo do texto > começo de palavra > no meio. Empates mantêm a ordem original. Busca vazia devolve [].
   */
  function searchRank(items, query, textsOf) {
    const tokens = foldText(query).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    // nota de um texto para uma palavra: começo do texto > começo de palavra > no meio (palavra de 1 letra só vale no começo de palavra)
    const hit = (t, tk) => {
      if (t.startsWith(tk)) return 6;
      if (t.includes(' ' + tk)) return 4;
      return tk.length > 1 && t.includes(tk) ? 2 : 0;
    };
    const scored = [];
    items.forEach((item, index) => {
      const texts = (textsOf(item) || []).map(foldText);
      let total = 0;
      let all = true;
      for (const tk of tokens) {
        let best = 0;
        texts.forEach((t, k) => {
          if (!t) return;
          const v = hit(t, tk) * (k === 0 ? 10 : 1);
          if (v > best) best = v;
        });
        if (!best) { all = false; break; }
        total += best;
      }
      if (all) scored.push({item, score: total, index});
    });
    scored.sort((x, y) => y.score - x.score || x.index - y.index);
    return scored.map((x) => x.item);
  }

  /** Músicas (fitas) por título ou artista; busca vazia devolve todas (como a lista). */
  function searchTracks(tracks, query) {
    if (!foldText(query)) return tracks;
    return searchRank(tracks, query, (x) => [x.title, x.artist || '']);
  }
  /** Exercícios por nome, grupo muscular, código (A1), treino, nota e orientação. */
  function searchExercises(exercises, query) {
    return searchRank(exercises, query, (e) => [e.nome, e.grupo + ' ' + e.codigo + ' treino ' + e.treino, e.nota || '', e.orientacao || '']);
  }
  /** Bags (playlists) pelo nome. */
  function searchBags(bags, query) {
    return searchRank(bags, query, (b) => [b.name]);
  }
  /** Treinos já feitos: por exercício feito, treino (A/B) ou data (AAAA-MM-DD ou DD/MM). Mais recentes primeiro. */
  function searchSessions(sessions, query) {
    const found = searchRank(sessions, query, (x) => {
      const items = Array.isArray(x.items) ? x.items.map((i) => i.nome).join(' ') : '';
      const [y, m, d] = String(x.date || '').split('-');
      return ['treino ' + x.treino, items, String(x.date || '') + ' ' + d + '/' + m + '/' + y + ' ' + d + '/' + m];
    });
    return found.sort((x, y) => String(y.date).localeCompare(String(x.date)));
  }
  function formatClock(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita injeção de fórmula em planilhas
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Uma linha por exercício de cada treino. Sessões antigas (sem detalhe) viram uma linha resumo. */
  function sessionsToCsv(sessions) {
    const rows = [['data', 'hora', 'treino', 'exercicio', 'series_feitas', 'repeticoes', 'carga_kg', 'volume_kg']];
    for (const s of sessions) {
      const items = Array.isArray(s.items) ? s.items : [];
      if (!items.length) {
        rows.push([s.date, s.time || '', s.treino, '', s.sets, '', '', s.volume != null ? s.volume : '']);
        continue;
      }
      for (const it of items) {
        rows.push([s.date, s.time || '', s.treino, it.nome, it.series, it.reps, it.peso, round1(it.series * it.reps * it.peso)]);
      }
    }
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- backup: validação estrita ---------- */
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_RE = /^[ab]\d{1,2}$/;

  function cleanItem(it) {
    if (!isObj(it) || !ID_RE.test(String(it.id))) return null;
    return {
      id: String(it.id),
      nome: String(it.nome == null ? '' : it.nome).slice(0, 80),
      series: clampSeries(it.series),
      reps: Math.max(1, Math.min(MAX_REPS, Math.trunc(Number(it.reps)) || 1)),
      peso: Math.max(0, Math.min(MAX_WEIGHT, toNumber(it.peso))),
    };
  }

  /**
   * Valida e normaliza um backup JSON. Descarta qualquer chave/valor fora do formato esperado
   * (inclusive `__proto__`). Lança Error('Estrutura inválida') se o essencial não existir.
   */
  function validateBackup(obj) {
    if (!isObj(obj) || !Array.isArray(obj.sessions) || !isObj(obj.sets) || !isObj(obj.override)) {
      throw new Error('Estrutura inválida');
    }
    const sets = {};
    for (const [k, row] of Object.entries(obj.sets)) {
      if (!/^\d{4}-\d{2}-\d{2}:[AB]$/.test(k) || !isObj(row)) continue;
      const clean = {};
      for (const [id, arr] of Object.entries(row)) {
        if (!ID_RE.test(id) || !Array.isArray(arr)) continue;
        clean[id] = arr.slice(0, MAX_SETS).map(Boolean);
      }
      sets[k] = clean;
    }
    const override = {};
    for (const [id, v] of Object.entries(obj.override)) {
      if (!ID_RE.test(id) || !isObj(v)) continue;
      const peso = String(v.peso == null ? '' : v.peso).trim().replace(',', '.');
      override[id] = {
        peso: peso !== '' && Number.isFinite(Number(peso)) && Number(peso) >= 0 && Number(peso) <= MAX_WEIGHT ? peso : '',
        series: clampSeries(v.series),
        reps: Math.max(1, Math.min(MAX_REPS, Math.trunc(Number(v.reps)) || 1)),
      };
    }
    const sessions = [];
    for (const s of obj.sessions.slice(0, 5000)) {
      if (!isObj(s) || !DATE_RE.test(String(s.date)) || (s.treino !== 'A' && s.treino !== 'B')) continue;
      const items = (Array.isArray(s.items) ? s.items.slice(0, 30) : []).map(cleanItem).filter(Boolean);
      const out = {
        date: String(s.date),
        time: String(s.time == null ? '' : s.time).slice(0, 8),
        treino: s.treino,
        sets: Math.max(0, Math.min(500, Math.trunc(Number(s.sets)) || 0)),
        percent: Math.max(0, Math.min(100, Math.trunc(Number(s.percent)) || 0)),
      };
      const skippedClean = (Array.isArray(s.skipped) ? s.skipped.slice(0, 30) : [])
        .filter((x) => isObj(x) && ID_RE.test(String(x.id)))
        .map((x) => ({ id: String(x.id), nome: String(x.nome == null ? '' : x.nome).slice(0, 80) }));
      if (skippedClean.length) out.skipped = skippedClean;
      if (items.length) {
        out.items = items;
        out.volume = round1(items.reduce((a, it) => a + it.series * it.reps * it.peso, 0));
      }
      sessions.push(out);
    }
    return {
      persona: obj.persona === 'loira' ? 'loira' : 'vinho',
      rest: REST_OPTIONS.includes(obj.rest) ? obj.rest : 60,
      restExercise: normalizeRest(obj).restExercise,
      restSet: normalizeRest(obj).restSet,
      sets,
      override,
      sessions,
    };
  }


  /* ---------- personalização das fitas (cor, padrão, figurinhas arrastáveis, imagem no rótulo e anotação) ---------- */
  var DECO_COLORS = 14, DECO_MAX_STICKERS = 6, DECO_MAX_NOTE = 280;
  var DECO_PATTERNS = ['dots', 'stripes', 'check', 'stars'];
  // Posições iniciais (fração da largura e da altura da fita) das figurinhas que chegam sem posição.
  var DECO_SLOTS = [[0.88, 0.2], [0.12, 0.8], [0.88, 0.82], [0.12, 0.2], [0.5, 0.9], [0.5, 0.1]];
  function clampN(v, lo, hi, dflt) { var n = Number(v); if (v === null || v === '' || v === undefined || !isFinite(n)) return dflt; return Math.max(lo, Math.min(hi, n)); }
  function round2(n) { return Math.round(n * 100) / 100; }
  // Limpa o que veio do armazenamento ou do formulário: só guarda campos válidos e devolve null quando não sobra nada.
  // Figurinha: {e: emoji, x, y (0 a 1 sobre a fita), s: tamanho 0.6 a 2.2}. Texto solto vira figurinha numa posição padrão.
  function cleanDeco(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var out = {};
    var c = Number(raw.color);
    if (raw.color !== null && raw.color !== undefined && raw.color !== '' && Number.isInteger(c) && c >= 0 && c < DECO_COLORS) out.color = c;
    if (typeof raw.pattern === 'string' && DECO_PATTERNS.indexOf(raw.pattern) >= 0) out.pattern = raw.pattern;
    if (Array.isArray(raw.stickers)) {
      var list = [];
      raw.stickers.forEach(function (x) {
        if (list.length >= DECO_MAX_STICKERS) return;
        var slot = DECO_SLOTS[list.length % DECO_SLOTS.length];
        if (typeof x === 'string') {
          var e0 = x.trim().slice(0, 8);
          if (e0) list.push({e: e0, x: slot[0], y: slot[1], s: 1});
        } else if (x && typeof x === 'object' && typeof x.e === 'string') {
          var e1 = x.e.trim().slice(0, 8);
          if (e1) list.push({e: e1, x: round2(clampN(x.x, 0, 1, slot[0])), y: round2(clampN(x.y, 0, 1, slot[1])), s: round2(clampN(x.s, 0.6, 2.2, 1))});
        }
      });
      if (list.length) out.stickers = list;
    }
    if (typeof raw.note === 'string') { var n = raw.note.replace(/\s+$/g, '').slice(0, DECO_MAX_NOTE); if (n.trim()) out.note = n; }
    if (typeof raw.image === 'string' && raw.image.length > 0 && raw.image.length <= 600) out.image = raw.image;
    return Object.keys(out).length ? out : null;
  }
  // deco: {idDaFita: {...}}. patch === null apaga a personalização daquela fita; um objeto troca os campos informados.
  function setDeco(deco, id, patch) {
    var next = {};
    Object.keys(deco || {}).forEach(function (k) { next[k] = deco[k]; });
    if (patch === null) { delete next[id]; return next; }
    var merged = cleanDeco(Object.assign({}, next[id] || {}, patch || {}));
    if (merged) next[id] = merged; else delete next[id];
    return next;
  }
  // Normaliza o mapa inteiro (ao carregar) e descarta o que é lixo.
  function cleanDecoMap(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (k) { var d = cleanDeco(map[k]); if (d) out[k] = d; });
    return out;
  }

  return {
    MAX_SETS,
    MAX_REPS,
    MAX_WEIGHT,
    REST_OPTIONS,
    toNumber,
    clampSeries,
    parseVersion,
    compareVersions,
    pickLatestRelease,
    evaluateUpdate,
    safeGithubUrl,
    apkAsset,
    releaseNotes,
    snapshotSession,
    annotateRecords,
    personalBests,
    totalVolume,
    streak,
    doneCount,
    withCount,
    tapSeries,
    workoutProgress,
    nextStep,
    setSkipped,
    REST_MAX,
    normalizeRest,
    restPlan,
    tapeAdd,
    tapeRemove,
    tapeInsert,
    tapeMove,
    forgetTrack,
    resolveTape,
    nextTrackId,
    foldText,
    searchRank,
    searchTracks,
    searchExercises,
    searchBags,
    searchSessions,
    formatClock,
    sessionsToCsv,
    validateBackup,
    cleanDeco,
    setDeco,
    cleanDecoMap,
  };
});
