// Gera as artes das notificações do app:
//  - native/assets/notif/radio.png (512x512): o globo de pontinhos no espaço (usado também no cartão "Tocando agora" do app);
//  - native/modules/modo-notif/.../drawable-nodpi/: as 8 fitas (cassete) com fundo transparente, o planeta da rádio (transparente)
//    e os ladrilhos de pontinhos/estrelas dos cartões (azul-céu, amarelo, rosa, menta, espaço).
//   node scripts/gerar-arte-notificacao.mjs        (precisa de Chromium via Playwright)
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); } })();
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'native');
const OUT = join(RAIZ, 'assets', 'notif');
const MOD = join(RAIZ, 'modules', 'modo-notif', 'android', 'src', 'main', 'res', 'drawable-nodpi');
mkdirSync(OUT, {recursive: true}); mkdirSync(MOD, {recursive: true});

// mesmas cores do MiniTape (native/src/music/Cassette.tsx)
const TAPES = [
  {body: '#F0568A', label: '#FFD3E3', ink: '#7A1740'}, {body: '#3F7BEA', label: '#CFE0FF', ink: '#173E8F'},
  {body: '#F5B71F', label: '#FFEDB0', ink: '#7A5200'}, {body: '#2DB67C', label: '#C9F3DF', ink: '#0F5E3E'},
  {body: '#8A5CE6', label: '#E2D4FF', ink: '#42218F'}, {body: '#F2793A', label: '#FFD9C2', ink: '#8A3410'},
  {body: '#1FB5C9', label: '#C7F1F7', ink: '#0B5D69'}, {body: '#E0453F', label: '#FFD0CD', ink: '#7C1814'},
];
const INK = '#0B1033';

// cassete com fundo transparente (mesmo desenho do MiniTape do app), 320x205
const cassete = (t) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="205" viewBox="-4 -4 108 72">
    <rect x="2" y="2" width="96" height="60" rx="9" fill="${t.body}" stroke="${INK}" stroke-width="3.2"/>
    <rect x="9" y="7" width="82" height="24" rx="4" fill="${t.label}" stroke="${INK}" stroke-width="1.6"/>
    <rect x="9" y="22" width="82" height="9" fill="#F6A4C1" opacity=".45"/>
    <rect x="16" y="13" width="44" height="3.2" rx="1.6" fill="${t.ink}" opacity=".8"/>
    <rect x="16" y="19" width="28" height="3.2" rx="1.6" fill="${t.ink}" opacity=".5"/>
    <rect x="16" y="34" width="68" height="20" rx="10" fill="${INK}"/>
    <circle cx="32" cy="44" r="6.5" fill="#F7F3EA"/><circle cx="32" cy="44" r="2.4" fill="${t.body}"/>
    <circle cx="68" cy="44" r="6.5" fill="#F7F3EA"/><circle cx="68" cy="44" r="2.4" fill="${t.body}"/>
    <path d="M34 62 L40 55 H60 L66 62Z" fill="${INK}" opacity=".85"/>
    <circle cx="42" cy="59.4" r="1.3" fill="#53629D"/><circle cx="58" cy="59.4" r="1.3" fill="#53629D"/>
  </svg>`;

// ladrilho 40x40 com dois pontinhos em quincôncio (fundo dos cartões das notificações)
const ladrilho = (cor) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="10" cy="10" r="1.8" fill="${cor}"/><circle cx="30" cy="30" r="1.8" fill="${cor}"/></svg>`;

// globo de pontinhos (países em rosa/azul/amarelo/menta/lilás) no espaço, com halo rosa→azul e um pino vermelho
const globo = () => {
  const cores = ['#F29BC0', '#8FB8F5', '#FFD369', '#8EE0C0', '#BFA8F5', '#FFB58A'];
  let s = 20261012; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let estrelas = '';
  for (let i = 0; i < 90; i++) estrelas += `<circle cx="${(rnd() * 512).toFixed(0)}" cy="${(rnd() * 512).toFixed(0)}" r="${(0.8 + rnd() * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
  const cx = 256, cy = 236, R = 150;
  let pontos = '';
  // manchas de "continentes": sorteia centros e preenche com pontos dentro da esfera
  const manchas = Array.from({length: 7}, (_, i) => ({x: cx + (rnd() - 0.5) * 220, y: cy + (rnd() - 0.5) * 220, r: 38 + rnd() * 46, c: cores[i % cores.length]}));
  for (let y = cy - R; y <= cy + R; y += 9) for (let x = cx - R; x <= cx + R; x += 9) {
    const xx = x + ((Math.round((y - cy) / 9)) % 2 ? 4.5 : 0);
    if ((xx - cx) ** 2 + (y - cy) ** 2 > (R - 5) ** 2) continue;
    const m = manchas.find((k) => (xx - k.x) ** 2 + (y - k.y) ** 2 < k.r ** 2);
    if (m) pontos += `<circle cx="${xx.toFixed(1)}" cy="${y}" r="3.1" fill="${m.c}"/>`;
  }
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080C24"/><stop offset=".55" stop-color="#17104A"/><stop offset="1" stop-color="#0E2250"/></linearGradient>
      <radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#E9A0BF" stop-opacity=".0"/><stop offset=".86" stop-color="#E9A0BF" stop-opacity=".55"/><stop offset=".94" stop-color="#4674DB" stop-opacity=".25"/><stop offset="1" stop-color="#4674DB" stop-opacity="0"/></radialGradient>
      <radialGradient id="o" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#1B2A66"/><stop offset="1" stop-color="#0A1033"/></radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#g)"/>${estrelas}
    <circle cx="${cx}" cy="${cy}" r="${R * 1.35}" fill="url(#h)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#o)" stroke="#E9A0BF" stroke-width="2.5" stroke-opacity=".8"/>
    ${pontos}
    <g transform="translate(${cx + 28} ${cy - 18})"><circle r="22" fill="none" stroke="#2EE06E" stroke-width="3" opacity=".55"/><circle r="11" fill="#22B35E" stroke="#fff" stroke-width="3"/></g>
    <text x="256" y="462" text-anchor="middle" font-family="Barlow Condensed, Impact, Arial Narrow, sans-serif" font-weight="900" font-size="40" letter-spacing="4" fill="#FFD369">RÁDIO DO MUNDO</text>
  </svg>`;
};

// planeta de pontinhos com halo e fundo transparente (cartão da rádio); mesmas cores e semente do globo
const planeta = () => {
  const cores = ['#F29BC0', '#8FB8F5', '#FFD369', '#8EE0C0', '#BFA8F5', '#FFB58A'];
  let s = 20261012; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const cx = 160, cy = 160, R = 108;
  let pontos = '';
  const manchas = Array.from({length: 7}, (_, i) => ({x: cx + (rnd() - 0.5) * 150, y: cy + (rnd() - 0.5) * 150, r: 26 + rnd() * 34, c: cores[i % cores.length]}));
  for (let y = cy - R; y <= cy + R; y += 7) for (let x = cx - R; x <= cx + R; x += 7) {
    const xx = x + ((Math.round((y - cy) / 7)) % 2 ? 3.5 : 0);
    if ((xx - cx) ** 2 + (y - cy) ** 2 > (R - 4) ** 2) continue;
    const m = manchas.find((k) => (xx - k.x) ** 2 + (y - k.y) ** 2 < k.r ** 2);
    if (m) pontos += `<circle cx="${xx.toFixed(1)}" cy="${y}" r="2.5" fill="${m.c}"/>`;
  }
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
    <defs>
      <radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset=".66" stop-color="#E9A0BF" stop-opacity="0"/><stop offset=".78" stop-color="#E9A0BF" stop-opacity=".6"/><stop offset=".9" stop-color="#6B5BFF" stop-opacity=".3"/><stop offset="1" stop-color="#4674DB" stop-opacity="0"/></radialGradient>
      <radialGradient id="o" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#2A3A8C"/><stop offset="1" stop-color="#0A1033"/></radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${R * 1.42}" fill="url(#h)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#o)" stroke="#E9A0BF" stroke-width="3" stroke-opacity=".9"/>
    ${pontos}
    <g transform="translate(${cx + 22} ${cy - 14})"><circle r="16" fill="none" stroke="#2EE06E" stroke-width="3" opacity=".55"/><circle r="8" fill="#22B35E" stroke="#fff" stroke-width="2.5"/></g>
  </svg>`;
};
// ladrilho 64x64 de estrelinhas (fundo do cartão da rádio)
const estrelas = () => {
  let s = 777; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let o = '';
  for (let i = 0; i < 7; i++) o += `<circle cx="${(rnd() * 64).toFixed(1)}" cy="${(rnd() * 64).toFixed(1)}" r="${(0.7 + rnd() * 1.1).toFixed(1)}" fill="${['#FFFFFF', '#F7A8C8', '#AAC8F8'][i % 3]}" opacity="${(0.4 + rnd() * 0.5).toFixed(2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${o}</svg>`;
};

const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page = await browser.newPage({deviceScaleFactor: 1});
const pngEm = async (dir, svg, w, h, nome, transparente = false) => {
  await page.setViewportSize({width: w, height: h});
  await page.setContent(`<html><body style="margin:0;background:${transparente ? 'transparent' : '#000'}">${svg}</body></html>`);
  await page.screenshot({path: join(dir, nome), omitBackground: transparente, clip: {x: 0, y: 0, width: w, height: h}});
  console.log('ok', nome);
};
const png = (svg, w, h, nome, transparente = false) => pngEm(OUT, svg, w, h, nome, transparente);
await png(globo(), 512, 512, 'radio.png');
for (let i = 0; i < TAPES.length; i++) await pngEm(MOD, cassete(TAPES[i]), 320, 205, `art_fita_${i}.png`, true);
await pngEm(MOD, ladrilho('rgba(120,160,230,.59)'), 40, 40, 'dots_sky.png', true);
await pngEm(MOD, ladrilho('rgba(225,160,20,.51)'), 40, 40, 'dots_yellow.png', true);
await pngEm(MOD, ladrilho('rgba(225,110,160,.51)'), 40, 40, 'dots_rose.png', true);
await pngEm(MOD, ladrilho('rgba(70,170,120,.47)'), 40, 40, 'dots_mint.png', true);
await pngEm(MOD, planeta(), 320, 320, 'art_planet.png', true);
await pngEm(MOD, estrelas(), 64, 64, 'dots_space.png', true);
await browser.close();
