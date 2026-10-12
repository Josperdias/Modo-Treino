/** Rádios do mundo via Radio Browser (diretório aberto e comunitário: https://www.radio-browser.info).
 * O app só toca o stream que cada rádio publica; nada é baixado nem hospedado por nós. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Track} from '../music/MusicProvider';

export type Station = {i: string; n: string; u: string; cc: string; co: string; st: string; tg: string; lat: number; lng: number; c: number; br: number};

const SERVERS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
const CACHE = 'modotreino-radio-v2';
const FRESH_MS = 3 * 24 * 3600 * 1000;
const UA = {'User-Agent': 'ModoTreino/1.2 (+https://github.com/Josperdias/Modo-Treino)'};

async function getJson(path: string, ms = 12000): Promise<any> {
  let lastError: unknown;
  for (const base of SERVERS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const r = await fetch(base + path, {signal: controller.signal, headers: UA});
      if (r.ok) return await r.json();
      lastError = new Error('HTTP ' + r.status);
    } catch (e) { lastError = e; } finally { clearTimeout(timer); }
  }
  throw lastError instanceof Error ? lastError : new Error('Sem resposta do diretório de rádios');
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function normalize(raw: any[]): Station[] {
  const out: Station[] = [];
  for (const r of raw) {
    const lat = num(r.geo_lat), lng = num(r.geo_long);
    const url = String(r.url_resolved || r.url || '');
    if (!url || !/^https?:\/\//i.test(url) || (!lat && !lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out.push({
      i: String(r.stationuuid), n: String(r.name || '').trim().slice(0, 60) || 'Rádio sem nome', u: url,
      cc: String(r.countrycode || '').toUpperCase().slice(0, 2), co: String(r.country || '').slice(0, 40), st: String(r.state || '').slice(0, 40),
      tg: String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 4).join(','), lat, lng, c: num(r.clickcount), br: num(r.bitrate),
    });
  }
  return out;
}

/** Estações com localização, as mais ouvidas primeiro. Guarda uma cópia por 3 dias (abre rápido e funciona sem rede). */
export async function loadStations(force = false): Promise<{stations: Station[]; fromCache: boolean}> {
  let cached: {ts: number; list: Station[]} | null = null;
  try { const raw = await AsyncStorage.getItem(CACHE); if (raw) cached = JSON.parse(raw); } catch { /* cache ilegível */ }
  if (cached && !force && Date.now() - cached.ts < FRESH_MS && cached.list.length) return {stations: cached.list, fromCache: true};
  try {
    const raw = await getJson('/json/stations/search?has_geo_info=true&hidebroken=true&order=clickcount&reverse=true&limit=3500');
    const list = normalize(raw);
    if (list.length) AsyncStorage.setItem(CACHE, JSON.stringify({ts: Date.now(), list})).catch(() => {});
    return {stations: list, fromCache: false};
  } catch (e) {
    if (cached?.list.length) return {stations: cached.list, fromCache: true};
    throw e;
  }
}

/** Boa prática do Radio Browser: avisar que a estação foi ouvida (ajuda o ranking). */
export function countClick(id: string) { getJson('/json/url/' + encodeURIComponent(id), 6000).catch(() => {}); }

export const toTrack = (s: Station): Track => ({id: 'radio:' + s.i, title: s.n, uri: s.u, source: 'radio', cc: s.cc, country: s.co});

export function search(stations: Station[], query: string, tag?: string | null, limit = 40): Station[] {
  const q = query.trim().toLowerCase();
  const out: Station[] = [];
  for (const s of stations) {
    if (tag && !s.tg.toLowerCase().split(',').includes(tag)) continue;
    if (q && !(s.n.toLowerCase().includes(q) || s.co.toLowerCase().includes(q) || s.st.toLowerCase().includes(q) || s.tg.toLowerCase().includes(q))) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export const GENRES = ['pop', 'rock', 'jazz', 'hip hop', 'electronic', 'classical', 'reggae', 'news', 'sertanejo', 'samba'];
