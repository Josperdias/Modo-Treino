const NAME='modo-treino-cache-v5';
const STATIC=['./','./index.html','./app.js','./updates.js','./sounds.js','./music.js','./data.js','./styles.css','./manifest.webmanifest','./assets/brand/icone.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(NAME).then(c=>c.addAll(STATIC)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==NAME).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(r.ok){let clone=r.clone();caches.open(NAME).then(cache=>cache.put(e.request,clone))}return r}).catch(()=>c)))});
