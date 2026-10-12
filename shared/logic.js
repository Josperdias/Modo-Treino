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

  /* ---------- treino: snapshot, volume e recordes ---------- */

  /**
   * Congela o que foi feito em um treino. `getConf(e)` devolve {series,reps,peso} efetivos
   * e `getDone(e)` o vetor de séries marcadas hoje. Nada é inventado: só séries marcadas contam.
   */
  function snapshotSession(o) {
    const items = [];
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
      if (done > 0) {
        const reps = Math.max(1, Math.min(MAX_REPS, Math.trunc(Number(c.reps)) || 1));
        const peso = Math.max(0, Math.min(MAX_WEIGHT, toNumber(c.peso)));
        volume += done * reps * peso;
        items.push({ id: e.id, nome: e.nome, series: done, reps, peso });
      }
    }
    return {
      date: o.date,
      time: o.time || '',
      treino: o.treino,
      sets,
      percent: Math.min(100, Math.round((100 * sets) / Math.max(1, total))),
      volume: round1(volume),
      items,
    };
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

  /** Situação de cada exercício de um treino: [{id,total,done,complete}] + totais e percentual. */
  function workoutProgress(o) {
    const list = [];
    let sets = 0;
    let total = 0;
    for (const e of o.exercises) {
      if (e.treino !== o.treino) continue;
      const t = clampSeries((o.getConf(e) || {}).series);
      const d = doneCount(o.getDone(e), t);
      list.push({id: e.id, total: t, done: d, complete: d >= t});
      sets += d;
      total += t;
    }
    return {list, sets, total, percent: Math.min(100, Math.round((100 * sets) / Math.max(1, total))), firstIncomplete: list.findIndex((x) => !x.complete)};
  }

  /**
   * O que mostrar depois do descanso (ou ao concluir uma série):
   *  - 'same'     : o exercício atual ainda tem séries (índice igual)
   *  - 'exercise' : próximo exercício incompleto (primeiro depois do atual; se não houver, o primeiro antes dele)
   *  - 'done'     : tudo completo
   */
  function nextStep(list, i) {
    if (!list.length) return {type: 'done', index: -1};
    if (list[i] && !list[i].complete) return {type: 'same', index: i};
    for (let k = 1; k < list.length; k++) {
      const j = (i + k) % list.length;
      if (!list[j].complete) return {type: 'exercise', index: j};
    }
    return {type: 'done', index: -1};
  }

  /* ---------- CSV ---------- */
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
      if (items.length) {
        out.items = items;
        out.volume = round1(items.reduce((a, it) => a + it.series * it.reps * it.peso, 0));
      }
      sessions.push(out);
    }
    return {
      persona: obj.persona === 'loira' ? 'loira' : 'vinho',
      rest: REST_OPTIONS.includes(obj.rest) ? obj.rest : 60,
      sets,
      override,
      sessions,
    };
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
    sessionsToCsv,
    validateBackup,
  };
});
