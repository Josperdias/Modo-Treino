// Gera as artes das notificações do app (PNG, 512x512): uma fita (cassete) para cada uma das 8 cores, a arte da rádio (globo
// de pontinhos no espaço) e o ícone pequeno branco da barra de status. Saída: native/assets/notif/.
//   node scripts/gerar-arte-notificacao.mjs        (precisa de Chromium via Playwright)
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright'); } })();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'native', 'assets', 'notif');
mkdirSync(OUT, {recursive: true});

// mesmas cores do MiniTape (native/src/music/Cassette.tsx)
const TAPES = [
  {body: '#F0568A', label: '#FFD3E3', ink: '#7A1740'}, {body: '#3F7BEA', label: '#CFE0FF', ink: '#173E8F'},
  {body: '#F5B71F', label: '#FFEDB0', ink: '#7A5200'}, {body: '#2DB67C', label: '#C9F3DF', ink: '#0F5E3E'},
  {body: '#8A5CE6', label: '#E2D4FF', ink: '#42218F'}, {body: '#F2793A', label: '#FFD9C2', ink: '#8A3410'},
  {body: '#1FB5C9', label: '#C7F1F7', ink: '#0B5D69'}, {body: '#E0453F', label: '#FFD0CD', ink: '#7C1814'},
];
const INK = '#0B1033';

const cassete = (t, esc = 1) => `
  <g transform="scale(${esc})">
    <rect x="2" y="2" width="96" height="60" rx="9" fill="${t.body}" stroke="${INK}" stroke-width="3"/>
    <rect x="9" y="7" width="82" height="24" rx="4" fill="${t.label}" stroke="${INK}" stroke-width="1.5"/>
    <rect x="16" y="14" width="44" height="3" rx="1.5" fill="${t.ink}" opacity=".75"/>
    <rect x="16" y="20" width="28" height="3" rx="1.5" fill="${t.ink}" opacity=".45"/>
    <rect x="16" y="34" width="68" height="20" rx="10" fill="${INK}"/>
    <circle cx="32" cy="44" r="6.5" fill="#F7F3EA"/><circle cx="32" cy="44" r="2.4" fill="${t.body}"/>
    <circle cx="68" cy="44" r="6.5" fill="#F7F3EA"/><circle cx="68" cy="44" r="2.4" fill="${t.body}"/>
  </g>`;

const fundoFita = (t) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="2.2" fill="#fff" opacity=".13"/></pattern>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2547"/><stop offset="1" stop-color="#101733"/></linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#p)"/>
    <g transform="translate(256 250) rotate(-6) translate(-224 -143)">
      <rect x="10" y="12" width="448" height="286" rx="40" fill="#000" opacity=".35"/>
      ${cassete(t, 4.48)}
    </g>
    <text x="256" y="470" text-anchor="middle" font-family="Barlow Condensed, Impact, Arial Narrow, sans-serif" font-weight="900" font-size="40" letter-spacing="4" fill="#FFD369">MODO TREINO</text>
  </svg>`;

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

// ícone da barra de status: silhueta branca de cassete em fundo transparente (Android usa só o canal alfa)
const icone = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <g fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"><rect x="8" y="22" width="80" height="52" rx="9"/></g>
    <rect x="20" y="30" width="56" height="16" rx="3" fill="#fff"/>
    <circle cx="34" cy="60" r="6" fill="#fff"/><circle cx="62" cy="60" r="6" fill="#fff"/>
  </svg>`;

const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page = await browser.newPage({deviceScaleFactor: 1});
const png = async (svg, w, h, nome, transparente = false) => {
  await page.setViewportSize({width: w, height: h});
  await page.setContent(`<html><body style="margin:0;background:${transparente ? 'transparent' : '#000'}">${svg}</body></html>`);
  await page.screenshot({path: join(OUT, nome), omitBackground: transparente, clip: {x: 0, y: 0, width: w, height: h}});
  console.log('ok', nome);
};
for (let i = 0; i < TAPES.length; i++) await png(fundoFita(TAPES[i]), 512, 512, `fita-${i}.png`);
await png(globo(), 512, 512, 'radio.png');
await png(icone(), 96, 96, 'icone.png', true);
await browser.close();
