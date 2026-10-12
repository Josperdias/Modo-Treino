#!/usr/bin/env node
// Gera native/assets/globe/globe.html: página ÚNICA e autocontida (JS, CSS e dados inline)
// com o globo 3D de rádios. Nenhuma requisição de rede em execução.
//
// Uso:  node scripts/build-globe.mjs
// Requer (devDependencies da RAIZ): esbuild globe.gl three topojson-client world-atlas iso-3166-1

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const saida = join(raiz, 'native', 'assets', 'globe', 'globe.html');

// 1) Países: topojson 110m do world-atlas (Natural Earth, domínio público).
//    O id numérico ISO 3166-1 de cada país vira alpha-2 aqui, no build, para o cliente ficar leve.
const topology = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
const iso = require('iso-3166-1');
const mapaIso = {};
for (const g of topology.objects.countries.geometries) {
  if (g.id == null) continue;
  const achado = iso.whereNumeric(String(g.id).padStart(3, '0'));
  if (achado) mapaIso[g.id] = achado.alpha2;
}
// O h3-js (usado pelos hexágonos do three-globe) lança erro em anéis degenerados (ex.: uma ilhota
// da Coreia do Norte no 110m) e isso abortaria TODOS os países seguintes. Detecta aqui, com a mesma
// chamada do three-globe (resolução 3, GeoJSON), os polígonos problemáticos para o cliente pulá-los.
const { polygonToCells } = require('h3-js');
const semHex = {}; // { "<id ou nome>": [índices de polígono] }
const fc = feature(topology, topology.objects.countries);
for (const f of fc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  polys.forEach((p, k) => {
    try { polygonToCells(p, 3, true); } catch (e) { (semHex[f.properties.name] ||= []).push(k); }
  });
}
// Kosovo (sem id numérico oficial) é tratado no cliente como 'XK'; Somalilândia/N. Chipre ficam sem iso2.

// 2) Cliente: esbuild → um único IIFE minificado.
//    target conservador para WebViews Android um pouco antigas (Chromium >= 80).
const resultado = await build({
  entryPoints: [join(raiz, 'scripts', 'globe', 'entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome80'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
});
// Evita fechar o <script> inline por acidente se algum literal contiver "</script" ou "<!--".
const js = resultado.outputFiles[0].text
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

const css = readFileSync(join(raiz, 'scripts', 'globe', 'style.css'), 'utf8');
const dadosJson = JSON.stringify({ topology, iso: mapaIso, semHex }).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Globo de rádios</title>
<style>${css}</style>
</head>
<body>
<div id="globe"></div>
<div id="tip"></div>
<div id="rotulos"></div>
<script>window.__GLOBE_DATA__=${dadosJson};</script>
<script>${js}</script>
</body>
</html>
`;

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, html);
console.log(`globe.html gerado: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB -> ${saida}`);
