/* MODO TREINO — service worker (offline real).
 * - Núcleo (HTML/JS/CSS/fontes): stale-while-revalidate → abre rápido offline e se atualiza sozinho.
 * - Mídia (ilustrações e sons): cache-first, pré-carregada na instalação (falha parcial não derruba a instalação).
 * - Requisições Range (áudio) são atendidas a partir do cache, como exige o Safari.
 * Troque VERSION a cada release para descartar caches antigos. */
const VERSION = '1.4.15';
const CORE = `modo-treino-core-${VERSION}`;
const MEDIA = `modo-treino-media-${VERSION}`;
const CORE_FILES = [
  './', './index.html', './app.js', './logic.js', './updates.js', './sounds.js', './music.js', './data.js', './styles.css',
  './manifest.webmanifest', './exercises.json', './baixar/', './baixar/index.html', './baixar/baixar.js', './baixar/baixar.css',
  './assets/brand/icone.svg', './assets/brand/icon-192.png', './assets/brand/icon-512.png',
  ...[500, 600, 700, 800, 900].map((w) => `./assets/fonts/barlow-condensed-latin-${w}-normal.woff2`),
  './assets/fonts/dm-sans-latin-wght-normal.woff2',
];
const SOUND_FILES = [];
for (const pack of ['suave', 'arcade', 'minimal']) for (const ev of ['button', 'series', 'rest', 'finish', 'count']) SOUND_FILES.push(`./assets/sounds/${pack}/${ev}.wav`);
for (const n of [1, 2, 3]) SOUND_FILES.push(`./assets/sounds/voice/${n}.wav`);

async function putAll(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(urls.map((u) => cache.add(u).catch(() => {}))); // um arquivo ausente não impede a instalação
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await putAll(CORE, CORE_FILES);
    let images = [];
    try {
      const list = await (await fetch('./exercises.json')).json();
      images = [...new Set(list.flatMap((e) => [e.imagem, e.imagemAlternativa]).filter(Boolean))].map((p) => './' + p);
    } catch (e) { /* offline na instalação: as imagens entram no cache quando forem vistas */ }
    images.push('./assets/exercicios/lateral_vinho.png', './assets/exercicios/lateral_loira.png', './assets/exercicios/frontal_vinho.png', './assets/exercicios/concentrada_vinho.png', './assets/exercicios/concentrada_loira.png');
    await putAll(MEDIA, [...new Set(images)].concat(SOUND_FILES));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([CORE, MEDIA]);
    for (const k of await caches.keys()) if (k.startsWith('modo-treino-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function rangeFrom(request, response) {
  const header = request.headers.get('range');
  if (!header || !response || response.status !== 200) return response;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m) return response;
  const buf = await response.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start > end || start >= size) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}`},
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isMedia = /\/assets\/(exercicios|sounds)\//.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(isMedia ? MEDIA : CORE);
    // ignoreSearch: ?utm=… e afins não furam o cache; navegação para "/baixar" cai em "/baixar/".
    const cached = await cache.match(req, {ignoreSearch: true});
    if (cached && isMedia) return rangeFrom(req, cached); // mídia imutável: cache-first, sem rede
    const refresh = fetch(req.headers.has('range') ? new Request(req.url) : req).then((res) => {
      if (res && res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    });
    if (cached) { refresh.catch(() => {}); return rangeFrom(req, cached); } // núcleo: serve o cache e atualiza em segundo plano
    try { return await rangeFrom(req, await refresh); }
    catch (e) { return req.mode === 'navigate' ? (await caches.match('./index.html')) || Response.error() : Response.error(); }
  })());
});
