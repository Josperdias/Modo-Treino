// Globo 3D de rádios do mundo (estilo Radio Garden) — cliente da WebView/iframe do Modo Treino.
// Este arquivo é empacotado por scripts/build-globe.mjs em um único globe.html (sem rede).
//
// Protocolo (ver README do build): comandos entram por window.postToGlobe(msg) ou 'message';
// eventos saem por ReactNativeWebView.postMessage (app) ou parent.postMessage (iframe/web).

import Globe from 'globe.gl';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, FrontSide,
  LineSegments, LineBasicMaterial, Mesh, Points, ShaderMaterial, SphereGeometry, AmbientLight,
  DirectionalLight, Float32BufferAttribute, Vector3,
} from 'three';
import { feature, neighbors } from 'topojson-client';
import { gerarDemo } from './demo.js';
import { lerFaixa } from './icy.js';

// ---------------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------------
const R = 100;                     // raio do globo em unidades three-globe
const COR_OCEANO = '#0c1236';         // espaço profundo: azul-marinho quase roxo
// Visual retrô de fita cassete: planeta de pontinhos (hexágonos) em rosa, azul, amarelo, menta, lilás e pêssego, num espaço
// estrelado azul-roxo com halo rosa→azul. Países vizinhos nunca repetem a cor (coloração de grafo). As rádios são pinos
// índigo com contorno creme (leem bem sobre qualquer tom); a escolhida fica vermelha e a que está tocando, verde.
const PALETA = ['#F29BC0', '#8FB8F5', '#FFD369', '#8EE0C0', '#BFA8F5', '#FFB58A'];   // rosa, azul, amarelo, menta, lilás, pêssego
const PREFERIDA = { BR: 3 };                                                           // Brasil: menta/verde
const COR_ESTACAO = rgb('#1D1F66');
const COR_TOCANDO = rgb('#22B35E');
const COR_SELECIONADA = rgb('#E63950');
const ROSA = '#E9A0BF';
const AZUL = '#4674DB';
const ALT_ESTACAO = 0.014;         // estações ficam logo acima dos hexágonos (altitude 0.004)
const ZOOM_MIN_ALT = 0.32;         // altitude mínima/máxima da câmera (em raios do globo)
const ZOOM_MAX_ALT = 2.6;
const ALT_INICIAL = 1.75;
const VOLTA_ROTACAO_MS = 4000;     // tempo ocioso antes de voltar a girar sozinho

// Os shaders próprios escrevem direto no canvas (sem conversão de espaço de cor), então as cores
// precisam ser valores sRGB "crus" — não THREE.Color, que converte para linear.
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
const v3 = (hex) => { const c = rgb(hex); return new Vector3(c.r, c.g, c.b); };

const params = new URLSearchParams(location.search);
const dados = window.__GLOBE_DATA__ || { topology: null, iso: {} };

// ---------------------------------------------------------------------------
// Saída de eventos
// ---------------------------------------------------------------------------
function post(msg) {
  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  } catch (e) { /* nunca derrubar a página por causa de mensagem */ }
}

// ---------------------------------------------------------------------------
// Países (topojson → features com iso2)
// ---------------------------------------------------------------------------
function carregarPaises() {
  if (!dados.topology) return [];
  const geoms = dados.topology.objects.countries.geometries;
  const fc = feature(dados.topology, dados.topology.objects.countries);
  // coloração de grafo (gulosa, mais vizinhos primeiro): países que se tocam nunca ficam com a mesma cor
  const viz = neighbors(geoms);
  const cor = new Array(geoms.length).fill(-1);
  const ordem = geoms.map((_, i) => i).sort((a, b) => viz[b].length - viz[a].length);
  const iso2De = (f) => dados.iso[f.id] || dados.iso[String(f.id)] || (f.properties.name === 'Kosovo' ? 'XK' : null);
  ordem.forEach((i) => {
    const usadas = new Set(viz[i].map((j) => cor[j]));
    const pref = PREFERIDA[iso2De(fc.features[i])];
    const livre = [...PALETA.keys()].find((c) => !usadas.has(c));
    cor[i] = pref != null && !usadas.has(pref) ? pref : (livre != null ? livre : i % PALETA.length);
  });
  return fc.features
    .map((f, i) => {
      f.properties = { iso2: iso2De(f), name: f.properties.name, cor: cor[i] };
      return f;
    })
    .filter((f) => f.properties.name !== 'Antarctica'); // sem rádios, só poluiria a base do globo
}

const paises = carregarPaises();
const paisPorIso = new Map();
paises.forEach((f) => { if (f.properties.iso2) paisPorIso.set(f.properties.iso2, f); });

// Ponto-em-polígono (raycasting) com caixa delimitadora pré-calculada — leve para 177 países.
function prepararGeometria(f) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  f.__polys = polys.map((rings) => {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    rings[0].forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    });
    return { rings, bbox: [minX, minY, maxX, maxY] };
  });
}
paises.forEach(prepararGeometria);

function dentroDoAnel(x, y, ring) {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function paisEm(lat, lng) {
  for (const f of paises) {
    for (const p of f.__polys) {
      const b = p.bbox;
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      if (!dentroDoAnel(lng, lat, p.rings[0])) continue;
      let buraco = false;
      for (let k = 1; k < p.rings.length; k++) if (dentroDoAnel(lng, lat, p.rings[k])) { buraco = true; break; }
      if (!buraco) return f;
    }
  }
  // Tolerância costeira: os hexágonos "sangram" um pouco além do litoral, então aceita ≤1,2° do contorno.
  let melhor = null, melhorD = 1.2 * 1.2;
  for (const f of paises) {
    for (const p of f.__polys) {
      const b = p.bbox;
      if (lng < b[0] - 1.3 || lng > b[2] + 1.3 || lat < b[1] - 1.3 || lat > b[3] + 1.3) continue;
      const ring = p.rings[0];
      for (let i = 0; i < ring.length; i++) {
        const dx = (ring[i][0] - lng) * Math.cos((lat * Math.PI) / 180), dy = ring[i][1] - lat;
        const d = dx * dx + dy * dy;
        if (d < melhorD) { melhorD = d; melhor = f; }
      }
    }
  }
  return melhor;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Globo
// ---------------------------------------------------------------------------
const root = document.getElementById('globe');
const dprParam = parseFloat(params.get('dpr'));
const globe = Globe({
  rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' },
  animateIn: false,
})(root)
  .backgroundColor('rgba(0,0,0,0)')
  .showAtmosphere(false)        // halo próprio (rosa → azul), mais bonito que o padrão de cor única
  .showGraticules(false)        // grade própria, mais discreta e escondida sob a terra
  // base: planeta de pontinhos (hexágonos) coloridos por país
  .hexPolygonResolution(3)
  .hexPolygonMargin(0.3)
  .hexPolygonAltitude(0.004)
  .hexPolygonColor((f) => PALETA[f.properties.cor % PALETA.length])
  .hexPolygonsTransitionDuration(0)
  // fronteiras finas por cima (sem preenchimento: só a linha)
  .polygonsTransitionDuration(0)
  .polygonAltitude(0.0062)
  .polygonCapCurvatureResolution(4)
  .polygonCapColor(() => 'rgba(0,0,0,0)')
  .polygonSideColor(() => 'rgba(0,0,0,0)')
  .polygonStrokeColor(() => 'rgba(16,14,60,0.5)')
  // contorno do país destacado: linha com espessura de verdade (o stroke de polígono é sempre 1 px)
  .pathPointLat((p) => p[1]).pathPointLng((p) => p[0]).pathPointAlt(0.0095)
  .pathColor((d) => (d.papel === 'sel' ? '#ffffff' : 'rgba(255,255,255,0.65)'))
  .pathStroke((d) => (d.papel === 'sel' ? 0.6 : 0.4))
  .pathTransitionDuration(0)
  .pathPoints('pts')
  .ringAltitude(0.009)
  .ringResolution(48)
  .enablePointerInteraction(false); // toques tratados à mão (mais confiável para dedo grosso)

const renderer = globe.renderer();
const camera = globe.camera();
const controls = globe.controls();
if (dprParam > 0) renderer.setPixelRatio(dprParam);

// Oceano: esfera azul-marinho escuro; sem textura.
const matOceano = globe.globeMaterial();
matOceano.color = new Color(COR_OCEANO);
matOceano.emissive = new Color('#03050f');
matOceano.shininess = 10;
matOceano.specular = new Color('#141d44');

// Luzes: ambiente forte (o amarelo da terra não pode escurecer) + uma direcional suave para dar volume.
const luzAmb = new AmbientLight(0xffffff, Math.PI * 0.82);
const luzDir = new DirectionalLight(0xfff3df, Math.PI * 0.32);
luzDir.position.set(-1.2, 1.1, 1.6);
globe.lights([luzAmb, luzDir]);

// Câmera: near maior = menos z-fighting entre hexágonos e destaque do país.
camera.near = 1;
camera.updateProjectionMatrix();

// ---- Grade (graticule) própria: acima do oceano, abaixo da terra → só aparece no mar ----
(function grade() {
  const pos = [];
  const passo = 15, seg = 4;
  const ponto = (lat, lng, r) => {
    const phi = ((90 - lat) * Math.PI) / 180, th = ((90 - lng) * Math.PI) / 180;
    return [r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
  };
  for (let lng = -180; lng < 180; lng += passo) {
    for (let lat = -90; lat < 90; lat += seg) pos.push(...ponto(lat, lng, R * 1.0012), ...ponto(lat + seg, lng, R * 1.0012));
  }
  for (let lat = -75; lat <= 75; lat += passo) {
    for (let lng = -180; lng < 180; lng += seg) pos.push(...ponto(lat, lng, R * 1.0012), ...ponto(lat, lng + seg, R * 1.0012));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const m = new LineBasicMaterial({ color: AZUL, transparent: true, opacity: 0.2, depthWrite: false });
  const linhas = new LineSegments(g, m);
  linhas.renderOrder = 1;
  globe.scene().add(linhas);
})();

// ---- Halo de atmosfera (esfera maior vista por dentro) rosa-azulado ----
// A intensidade depende da distância do RAIO DA CÂMERA ao centro do globo, não da normal:
// assim o halo tem a mesma largura relativa em qualquer zoom/FOV.
const VERT_VISTA = `
  varying vec3 vP; varying vec3 vC; varying vec3 vN;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vP = mv.xyz;
    vC = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
(function halo() {
  const largura = R * 0.26; // espessura do halo em unidades do globo
  const mat = new ShaderMaterial({
    transparent: true, side: BackSide, depthWrite: false,
    uniforms: { uRosa: { value: v3(ROSA) }, uAzul: { value: v3(AZUL) } },
    vertexShader: VERT_VISTA,
    fragmentShader: `
      uniform vec3 uRosa; uniform vec3 uAzul; varying vec3 vP; varying vec3 vC; varying vec3 vN;
      void main(){
        float b = length(cross(normalize(vP), vC));          // distância do raio ao centro do globo
        float t = clamp((b - ${R.toFixed(1)}) / ${largura.toFixed(1)}, 0.0, 1.0);   // 0 no contorno do globo → 1 na borda do halo
        float I = pow(1.0 - t, 2.8);
        vec3 c = mix(uRosa, uAzul, smoothstep(0.0, 0.55, t));  // rosa junto ao globo, azul para fora
        gl_FragColor = vec4(c, I * 0.62);
      }`,
  });
  const m = new Mesh(new SphereGeometry(R + largura * 1.15, 64, 64), mat);
  m.renderOrder = 0;
  globe.scene().add(m);

  // Brilho de borda (Fresnel) sobre a própria esfera: aro fino azul/rosa, aditivo.
  const rim = new ShaderMaterial({
    transparent: true, side: FrontSide, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uRosa: { value: v3(ROSA) }, uAzul: { value: v3(AZUL) } },
    vertexShader: VERT_VISTA,
    fragmentShader: `
      uniform vec3 uRosa; uniform vec3 uAzul; varying vec3 vP; varying vec3 vC; varying vec3 vN;
      void main(){
        float f = 1.0 - clamp(dot(normalize(-vP), normalize(vN)), 0.0, 1.0);   // 1 no contorno, 0 no centro
        float I = pow(f, 3.6);
        vec3 c = mix(uAzul, uRosa, smoothstep(0.7, 1.0, f));
        gl_FragColor = vec4(c * I * 0.32, 1.0);
      }`,
  });
  const r = new Mesh(new SphereGeometry(R * 1.006, 64, 64), rim);
  r.renderOrder = 2;
  globe.scene().add(r);
})();

// ---- Estrelinhas discretas ao fundo ----
const uStarTime = { value: 0 };
(function estrelas() {
  const n = 1500;
  const pos = new Float32Array(n * 3), tam = new Float32Array(n), cor = new Float32Array(n * 3), sem = new Float32Array(n);
  let s = 1234567;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const tons = [rgb('#ffffff'), rgb('#cfe0ff'), rgb(ROSA), rgb('#ffe9b0')];
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u), rr = 3000;
    pos.set([rr * q * Math.cos(a), rr * u, rr * q * Math.sin(a)], i * 3);
    tam[i] = 1.2 + rnd() * rnd() * 3.2;
    const t = tons[(rnd() * tons.length) | 0];
    cor.set([t.r, t.g, t.b], i * 3);
    sem[i] = rnd();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSize', new BufferAttribute(tam, 1));
  g.setAttribute('aColor', new BufferAttribute(cor, 3));
  g.setAttribute('aSeed', new BufferAttribute(sem, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: uStarTime, uPR: { value: 1 } },
    vertexShader: `
      attribute float aSize; attribute vec3 aColor; attribute float aSeed;
      uniform float uTime; uniform float uPR; varying vec3 vC; varying float vA;
      void main(){
        vC = aColor;
        vA = 0.5 + 0.4 * aSeed + 0.25 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d) * vA;
        gl_FragColor = vec4(vC, a);
      }`,
  });
  const p = new Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = -1;
  p.onBeforeRender = () => { mat.uniforms.uPR.value = renderer.getPixelRatio(); uStarTime.value = performance.now() / 1000; };
  globe.scene().add(p);
})();

// ---------------------------------------------------------------------------
// Camada de estações: um único THREE.Points com shader (pontos de tamanho fixo em pixels,
// com brilho e contorno). Dois objetos: o conjunto inteiro e uma camada de destaque
// (tocando/selecionada) desenhada por cima. Suporta milhares de pontos com 1 draw call.
// ---------------------------------------------------------------------------
const uEst = { uTime: { value: 0 }, uPR: { value: 1 }, uScale: { value: 1 } };
const matEst = new ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: uEst,
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aSeed; attribute float aPulse;
    uniform float uTime; uniform float uPR; uniform float uScale;
    varying vec3 vC; varying float vTw; varying float vHi; varying float vFase;
    const float G = 3.4;                     // o quadro do ponto é G vezes o diâmetro do núcleo
    void main(){
      vC = aColor;
      vHi = aPulse;
      vFase = fract(uTime * 0.7);              // fase do anel pulsante (0..1)
      vTw = 0.82 + 0.18 * sin(uTime * (1.2 + aSeed * 1.6) + aSeed * 50.0);   // brilho "respirando"
      float pulse = 1.0 + aPulse * 0.16 * sin(uTime * 4.2);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = min(aSize * uScale * uPR * pulse * G, 140.0);
    }`,
  fragmentShader: `
    precision mediump float;
    varying vec3 vC; varying float vTw; varying float vHi; varying float vFase;
    const float G = 3.4;
    void main(){
      float r = length(gl_PointCoord - 0.5) * 2.0 * G;     // r = 1 na borda do núcleo
      float core = 1.0 - smoothstep(0.86, 1.0, r);
      float ring = (1.0 - smoothstep(1.12, 1.5, r)) * (1.0 - core);   // contorno escuro: dá contraste sobre a terra amarela
      float escuro0 = 1.0 - smoothstep(0.30, 0.42, dot(vC, vec3(0.299, 0.587, 0.114)));
      float glow = exp(-r * r * 0.34) * (0.55 + 0.25 * vHi) * vTw * (1.0 - 0.65 * escuro0);
      // anel: pulsa para fora (estação tocando, vHi=1) ou fica fixo e suave (selecionada, vHi=0.5)
      float fase = vFase;
      float rr = vHi > 0.75 ? 1.15 + fase * 2.0 : 1.9;
      float aneis = (vHi > 0.75 ? (1.0 - fase) : 0.55) * smoothstep(0.22, 0.0, abs(r - rr)) * step(0.01, vHi);
      vec3 centro = mix(vC, vec3(1.0), 0.3 - 0.12 * vHi);
      vec3 corNucleo = mix(vC, centro, smoothstep(1.0, 0.0, r));
      float escuro = 1.0 - smoothstep(0.30, 0.42, dot(vC, vec3(0.299, 0.587, 0.114)));
      vec3 navy = mix(vec3(0.05, 0.08, 0.2), vec3(1.0, 0.96, 0.86), escuro);   // pino escuro: contorno creme
      // composição "over": halo colorido → contorno escuro → núcleo claro
      float a = glow + aneis * (1.0 - glow);
      vec3 c = vC * glow + vC * aneis * (1.0 - glow);
      c = c / max(a, 0.001) * a;
      float ao = ring * 0.92;
      c = navy * ao + c * (1.0 - ao); a = ao + a * (1.0 - ao);
      c = corNucleo * core + c * (1.0 - core); a = core + a * (1.0 - core);
      if (a < 0.01) discard;
      gl_FragColor = vec4(c / a, a);
    }`,
});

function criarPontos(ordem) {
  const g = new BufferGeometry();
  const p = new Points(g, matEst);
  p.frustumCulled = false;
  p.renderOrder = ordem;
  p.onBeforeRender = () => {
    uEst.uPR.value = renderer.getPixelRatio();
    uEst.uTime.value = performance.now() / 1000;
    // pontos crescem um pouco ao aproximar (mantém tamanho geográfico razoável) e encolhem ao afastar
    const z = Math.min(1, Math.max(0, (camera.position.length() - R * (1 + ZOOM_MIN_ALT)) / (R * (ZOOM_MAX_ALT - ZOOM_MIN_ALT))));
    uEst.uScale.value = 1.5 - 0.65 * z;
  };
  globe.scene().add(p);
  return { p, g };
}
const camadaTodas = criarPontos(10);
const camadaDestaque = criarPontos(11);

function cart(lat, lng, alt) {
  // Mesma convenção do three-globe (polar2Cartesian).
  const phi = ((90 - lat) * Math.PI) / 180, th = ((90 - lng) * Math.PI) / 180, r = R * (1 + alt);
  return [r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
}

function preencher(g, itens) {
  const n = itens.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), tam = new Float32Array(n),
    sem = new Float32Array(n), pul = new Float32Array(n);
  itens.forEach((it, k) => {
    pos.set(cart(it.lat, it.lng, it.alt), k * 3);
    col.set([it.cor.r, it.cor.g, it.cor.b], k * 3);
    tam[k] = it.tam; sem[k] = it.sem; pul[k] = it.pulso || 0;
  });
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aColor', new BufferAttribute(col, 3));
  g.setAttribute('aSize', new BufferAttribute(tam, 1));
  g.setAttribute('aSeed', new BufferAttribute(sem, 1));
  g.setAttribute('aPulse', new BufferAttribute(pul, 1));
  g.setDrawRange(0, n);
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let estacoes = [];            // [{i,n,lat,lng,cc,c, x,y,z, seed}]
let idxPorId = new Map();
let tocandoId = null;
let selecionadaId = null;
let paisSel = null;           // iso2 destacado por comando/toque
let paisHover = null;         // iso2 sob o mouse
let filtroIds = null;         // Set de ids visíveis (filtro por estilo/busca); null = todas

function tamanhoEstacao(c) {
  return 4.2 + 2.4 * Math.min(1, Math.log10((c || 0) + 1) / 4);   // 4,2 – 6,6 px (diâmetro do núcleo)
}

function reconstruirTodas() {
  preencher(camadaTodas.g, estacoes.filter((e) => e.on).map((e) => ({
    lat: e.lat, lng: e.lng, alt: ALT_ESTACAO, tam: tamanhoEstacao(e.c), sem: e.seed,
    cor: COR_ESTACAO,
  })));
}

function reconstruirDestaque() {
  const it = [];
  const sel = selecionadaId != null ? estacoes[idxPorId.get(selecionadaId)] : null;
  const tocando = tocandoId != null ? estacoes[idxPorId.get(tocandoId)] : null;
  // vermelho = selecionada (a que você tocou); verde = tocando agora (se for a mesma, fica verde)
  if (sel && sel !== tocando) it.push({ lat: sel.lat, lng: sel.lng, alt: ALT_ESTACAO + 0.002, tam: 10, sem: 0.3, cor: COR_SELECIONADA, pulso: 0.5 });
  if (tocando) it.push({ lat: tocando.lat, lng: tocando.lng, alt: ALT_ESTACAO + 0.003, tam: 11, sem: 0.7, cor: COR_TOCANDO, pulso: 1 });
  preencher(camadaDestaque.g, it);
  atualizarAneis();
}

let escalaAnel = 1;
function atualizarAneis() {
  const aneis = [];
  const t = tocandoId != null ? estacoes[idxPorId.get(tocandoId)] : null;
  const s = selecionadaId != null ? estacoes[idxPorId.get(selecionadaId)] : null;
  if (t) aneis.push({ lat: t.lat, lng: t.lng, tipo: 'tocando' });
  if (s && s !== t) aneis.push({ lat: s.lat, lng: s.lng, tipo: 'sel' });
  globe.ringsData(aneis);
}
globe
  .ringLat('lat').ringLng('lng')
  .ringColor((d) => (d.tipo === 'tocando'
    ? (t) => `rgba(46,224,110,${Math.max(0, 1 - t)})`
    : (t) => `rgba(255,51,85,${Math.max(0, 1 - t) * 0.9})`))
  .ringMaxRadius((d) => (d.tipo === 'tocando' ? 5.2 : 3.6) * escalaAnel)
  .ringPropagationSpeed((d) => (d.tipo === 'tocando' ? 3.4 : 2.4) * escalaAnel)
  .ringRepeatPeriod((d) => (d.tipo === 'tocando' ? 1500 : 2200));

// Muitas rádios têm a MESMA coordenada (a do centro da cidade ou do país). Para não virarem um único ponto, as que se
// empilham são espalhadas em espiral dentro do próprio país (o raio cresce com a quantidade; a posição é determinística).
// A localização continua aproximada; o ponto só deixa de esconder as outras.
function dentroDoPais(f, lat, lng) {
  for (const p of f.__polys) {
    const b = p.bbox;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    if (!dentroDoAnel(lng, lat, p.rings[0])) continue;
    let buraco = false;
    for (let k = 1; k < p.rings.length; k++) if (dentroDoAnel(lng, lat, p.rings[k])) { buraco = true; break; }
    if (!buraco) return true;
  }
  return false;
}
function espalhar(lista) {
  const grupos = new Map();
  lista.forEach((e) => {
    const k = Math.round(e.lat / 0.05) + ',' + Math.round(e.lng / 0.05);
    (grupos.get(k) || grupos.set(k, []).get(k)).push(e);
  });
  grupos.forEach((g) => {
    if (g.length < 3) return;
    g.sort((a, b) => (a.i < b.i ? -1 : 1));
    const rMax = Math.min(7, 0.55 * Math.sqrt(g.length));       // graus
    const f = g[0].cc ? paisPorIso.get(g[0].cc) : null;
    const lat0 = g[0].lat, lng0 = g[0].lng;
    g.forEach((e, k) => {
      const base = rMax * Math.sqrt((k + 0.5) / g.length);
      const ang0 = k * 2.399963 + (hashStr(e.i) % 628) / 100;
      for (let t = 0; t < 4; t++) {                                // se cair fora do país, tenta mais perto do centro
        const r = base * Math.pow(0.6, t), ang = ang0 + t * 0.9;
        const la = Math.max(-85, Math.min(85, lat0 + r * Math.sin(ang)));
        const lo = lng0 + (r * Math.cos(ang)) / Math.max(0.2, Math.cos((lat0 * Math.PI) / 180));
        if (!f || dentroDoPais(f, la, lo)) { e.lat = la; e.lng = lo; break; }
      }
      const a = (e.lat * Math.PI) / 180, b = (e.lng * Math.PI) / 180;
      e.x = Math.cos(a) * Math.cos(b); e.y = Math.cos(a) * Math.sin(b); e.z = Math.sin(a);
    });
  });
}

function setStations(arr) {
  const lista = [];
  (Array.isArray(arr) ? arr : []).forEach((e) => {
    if (!e || e.i == null || !isFinite(e.lat) || !isFinite(e.lng)) return;
    const lat = Math.max(-90, Math.min(90, +e.lat)), lng = +e.lng;
    const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
    lista.push({
      i: String(e.i), n: e.n || '', lat, lng, cc: e.cc || '', c: +e.c || 0,
      x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la),
      seed: (hashStr(String(e.i)) % 1000) / 1000, on: true,
    });
  });
  espalhar(lista);
  estacoes = lista;
  idxPorId = new Map(lista.map((e, k) => [e.i, k]));
  if (tocandoId != null && !idxPorId.has(tocandoId)) tocandoId = null;
  if (selecionadaId != null && !idxPorId.has(selecionadaId)) selecionadaId = null;
  aplicarFiltro(filtroIds ? [...filtroIds] : null, false);
  reconstruirTodas();
  reconstruirDestaque();
}

// Estações (visíveis) a até maxDeg graus de (lat,lng), da mais próxima para a mais distante.
function proximas(lat, lng, maxDeg, max = 12) {
  const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
  const x = Math.cos(la) * Math.cos(lo), y = Math.cos(la) * Math.sin(lo), z = Math.sin(la);
  const minDot = Math.cos((maxDeg * Math.PI) / 180);
  const achadas = [];
  for (let k = 0; k < estacoes.length; k++) {
    const e = estacoes[k];
    if (!e.on) continue;
    const d = e.x * x + e.y * y + e.z * z;
    if (d > minDot) achadas.push([d, e]);
  }
  achadas.sort((a, b) => b[0] - a[0]);
  return achadas.slice(0, max).map((a) => a[1]);
}
const maisProxima = (lat, lng, maxDeg) => proximas(lat, lng, maxDeg, 1)[0] || null;

// Filtro por estilo/busca: só as estações da lista continuam visíveis (e tocáveis) no globo.
function aplicarFiltro(ids, reconstruir = true) {
  filtroIds = ids ? new Set(ids.map(String)) : null;
  estacoes.forEach((e) => { e.on = !filtroIds || filtroIds.has(e.i); });
  if (reconstruir) reconstruirTodas();
}

// Tolerância de toque em graus: ~20 px na tela (dedo grosso), limitada a 1,5°–4,5°.
function toleranciaGraus() {
  const h = root.clientHeight || 700;
  const dist = camera.position.length() - R;
  const pxPorUnidade = h / 2 / (Math.tan((camera.fov * Math.PI) / 360) * Math.max(dist, 1));
  const pxPorGrau = pxPorUnidade * R * (Math.PI / 180);
  return Math.min(4.5, Math.max(1.5, 20 / Math.max(pxPorGrau, 0.1)));
}

// ---------------------------------------------------------------------------
// Países: base preenchida (uma vez) + destaque do país escolhido (pontinhos claros e contorno grosso)
// ---------------------------------------------------------------------------
const semHex = dados.semHex || {};
function atualizarPaises() {
  const fh = paisHover && paisHover !== paisSel ? paisPorIso.get(paisHover) : null;
  const fs = paisSel ? paisPorIso.get(paisSel) : null;
  // contornos (linhas com espessura de verdade) do país escolhido e, com mouse, do país sob o cursor
  const caminhos = [];
  [[fh, 'hover'], [fs, 'sel']].forEach(([f, papel]) => {
    if (f) f.__polys.forEach((p) => p.rings.forEach((ring) => caminhos.push({ papel, pts: ring })));
  });
  globe.pathsData(caminhos);
  agendarRotulos(true);
}

function construirTerra() {
  // O h3-js lança erro em anéis degenerados do 110m; esses polígonos ficam fora dos hexágonos (mas mantêm a fronteira).
  const hexPaises = paises.map((f) => {
    const ruins = semHex[f.properties.name];
    if (!ruins) return f;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const ok = polys.filter((_, k) => !ruins.includes(k));
    return ok.length ? { type: 'Feature', properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: ok } } : null;
  }).filter(Boolean);
  globe.hexPolygonsData(hexPaises);
  globe.polygonsData(paises);
}

// ---------------------------------------------------------------------------
// Câmera / controles
// ---------------------------------------------------------------------------
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = false;
controls.minDistance = R * (1 + ZOOM_MIN_ALT);
controls.maxDistance = R * (1 + ZOOM_MAX_ALT);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;       // ~110 s por volta
globe.pointOfView({ lat: 12, lng: -38, altitude: ALT_INICIAL });

let timerRotacao = null;
let focoAnimando = false;
function pararRotacao() {
  controls.autoRotate = false;
  clearTimeout(timerRotacao);
}
function agendarRotacao(ms) {
  clearTimeout(timerRotacao);
  timerRotacao = setTimeout(() => { if (!pointers.size) controls.autoRotate = true; }, ms == null ? VOLTA_ROTACAO_MS : ms);
}
controls.addEventListener('start', pararRotacao);
controls.addEventListener('end', () => agendarRotacao());

function focus({ lat, lng, altitude, ms, id }) {
  const est = id != null && idxPorId.has(String(id)) ? estacoes[idxPorId.get(String(id))] : null;
  if (est) { lat = est.lat; lng = est.lng; }                    // a posição do ponto no globo (já espalhada)
  if (!isFinite(lat) || !isFinite(lng)) return;
  const alt = Math.min(2.5, Math.max(0.6, isFinite(altitude) ? +altitude : globe.pointOfView().altitude));
  const dur = isFinite(ms) ? Math.max(0, +ms) : 1200;
  pararRotacao();
  globe.pointOfView({ lat: +lat, lng: +lng, altitude: alt }, dur);
  // depois de focar, deixa o usuário ver a estação por mais tempo antes de voltar a girar
  agendarRotacao(dur + 7000);
}

// ---------------------------------------------------------------------------
// Tamanho da tela. Em retrato o FOV vertical é aumentado para o globo caber na largura.
// ---------------------------------------------------------------------------
function redimensionar() {
  const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
  if (!w || !h) return;
  globe.width(w).height(h);
  const aspecto = w / h;
  // FOV horizontal de referência = 50° (o do FOV vertical padrão em tela quadrada)
  const tanH = Math.tan((50 * Math.PI) / 360);
  camera.fov = aspecto >= 1 ? 50 : (2 * Math.atan(tanH / aspecto) * 180) / Math.PI;
  camera.aspect = aspecto;
  camera.updateProjectionMatrix();
}
redimensionar();
if (window.ResizeObserver) new ResizeObserver(redimensionar).observe(root);
window.addEventListener('resize', redimensionar);

// ---------------------------------------------------------------------------
// Toques e mouse (toque curto sem arrastar = seleção)
// ---------------------------------------------------------------------------
const canvas = renderer.domElement;
const pointers = new Map();
let inicio = null, multi = false;

function coordsDoEvento(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function tocar(e) {
  const { x, y } = coordsDoEvento(e);
  const p = globe.toGlobeCoords(x, y);
  if (!p) return;
  const perto = proximas(p.lat, p.lng, toleranciaGraus(), 12);
  if (perto.length) {
    const est = perto[0];
    selecionadaId = est.i;
    reconstruirDestaque();
    // várias rádios sob o dedo: o app mostra "+N aqui" para escolher pelo nome
    post({ type: 'near', ids: perto.map((e) => e.i) });
    post({ type: 'station', id: est.i });
    return;
  }
  const f = paisEm(p.lat, p.lng);
  if (f && f.properties.iso2) {
    paisSel = f.properties.iso2;
    atualizarPaises();
    post({ type: 'country', iso2: f.properties.iso2, name: f.properties.name });
  }
}

canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, true);
  if (pointers.size === 1) { inicio = { x: e.clientX, y: e.clientY, t: performance.now() }; multi = false; }
  else multi = true;
}, true);
const fim = (e, cancelado) => {
  const unico = pointers.size === 1 && pointers.has(e.pointerId);
  pointers.delete(e.pointerId);
  if (unico && !multi && !cancelado && inicio) {
    const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
    if (dx * dx + dy * dy < 100 && performance.now() - inicio.t < 800) tocar(e);
  }
  if (!pointers.size) { inicio = null; multi = false; }
};
canvas.addEventListener('pointerup', (e) => fim(e, false), true);
canvas.addEventListener('pointercancel', (e) => fim(e, true), true);

// Hover com mouse: realça o país e mostra uma etiqueta.
const tip = document.getElementById('tip');
let hoverPendente = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) { if (tip) tip.classList.remove('on'); return; }
  const jaAgendado = !!hoverPendente;
  hoverPendente = e;
  if (jaAgendado) return;
  requestAnimationFrame(() => {
    const ev = hoverPendente; hoverPendente = null;
    if (!ev) return;
    const { x, y } = coordsDoEvento(ev);
    const p = globe.toGlobeCoords(x, y);
    let texto = '', iso = null;
    if (p) {
      const est = maisProxima(p.lat, p.lng, toleranciaGraus());
      const f = paisEm(p.lat, p.lng);
      if (f) iso = f.properties.iso2;
      texto = est ? est.n : (f ? f.properties.name : '');
    }
    if (iso !== paisHover) { paisHover = iso; atualizarPaises(); }
    if (tip) {
      tip.textContent = texto;
      tip.style.left = ev.clientX + 'px';
      tip.style.top = ev.clientY + 'px';
      tip.classList.toggle('on', !!texto);
    }
  });
}, true);
canvas.addEventListener('pointerleave', () => { if (tip) tip.classList.remove('on'); if (paisHover) { paisHover = null; atualizarPaises(); } });

// ---------------------------------------------------------------------------
// Rótulos dos países (HTML por cima do canvas, em português). Quanto mais perto, mais nomes aparecem;
// nomes que se sobrepõem são omitidos. O país escolhido sempre aparece.
// ---------------------------------------------------------------------------
let nomesRegiao = null;
try { nomesRegiao = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch (e) { /* WebView antiga: nomes em inglês */ }
function nomePais(iso2, ingles) {
  if (iso2 === 'XK') return 'Kosovo';
  const curto = (t) => t.replace(/\s*\(.*\)\s*/, '').trim() || t;   // "Mianmar (Birmânia)" -> "Mianmar"
  try { const n = nomesRegiao && nomesRegiao.of(iso2); if (n && n !== iso2) return curto(n); } catch (e) { /* código desconhecido */ }
  return ingles;
}
function centroide(f) {
  // centro do maior polígono (média ponderada pela área do anel externo) e "área" para ordenar por tamanho
  let melhor = null, areaTotal = 0;
  f.__polys.forEach((p) => {
    const ring = p.rings[0];
    const cruza = p.bbox[2] - p.bbox[0] > 180;              // anel que atravessa a linha de data (ex.: Fiji)
    const X = (x) => (cruza && x < 0 ? x + 360 : x);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xj = X(ring[j][0]), xi = X(ring[i][0]);
      const f2 = xj * ring[i][1] - xi * ring[j][1];
      a += f2; cx += (xj + xi) * f2; cy += (ring[j][1] + ring[i][1]) * f2;
    }
    const area = Math.abs(a) / 2;
    const lat0 = (p.bbox[1] + p.bbox[3]) / 2;
    areaTotal += area * Math.cos((lat0 * Math.PI) / 180);
    if (a && (!melhor || area > melhor.area)) {
      let lng = cx / (3 * a); if (lng > 180) lng -= 360;
      melhor = { area, lng, lat: cy / (3 * a) };
    }
  });
  const ref = melhor || { lng: f.__polys[0].bbox[0], lat: f.__polys[0].bbox[1] };
  return { lat: ref.lat, lng: ref.lng, area: areaTotal };
}
const camadaRot = document.getElementById('rotulos');
const rotulos = paises.filter((f) => f.properties.iso2).map((f) => {
  const c = centroide(f);
  const u = cart(c.lat, c.lng, 0), n = Math.hypot(u[0], u[1], u[2]) || 1;
  return { iso2: f.properties.iso2, nome: nomePais(f.properties.iso2, f.properties.name), lat: c.lat, lng: c.lng, area: c.area, u: [u[0] / n, u[1] / n, u[2] / n], el: null };
}).sort((a, b) => b.area - a.area);

let ultimaChaveRot = '', rotAgendado = false, ultimoRot = 0;
function desenharRotulos(forca) {
  rotAgendado = false;
  if (!camadaRot) return;
  const cp = camera.position, d = cp.length();
  const chave = cp.x.toFixed(1) + cp.y.toFixed(1) + cp.z.toFixed(1) + (paisSel || '') + (filtroIds ? 1 : 0);
  if (!forca && chave === ultimaChaveRot) return;
  ultimaChaveRot = chave; ultimoRot = performance.now();
  const alt = d / R - 1;
  const max = alt > 1.4 ? 16 : alt > 1.0 ? 30 : alt > 0.7 ? 52 : alt > 0.5 ? 90 : 150;
  const w = root.clientWidth, h = root.clientHeight;
  const nx = cp.x / d, ny = cp.y / d, nz = cp.z / d;
  const caixas = [];
  let usados = 0;
  for (const p of rotulos) {
    const sel = p.iso2 === paisSel;
    let mostrar = false, x = 0, y = 0, op = 0;
    const dot = p.u[0] * nx + p.u[1] * ny + p.u[2] * nz;
    if ((usados < max || sel) && dot > 0.22) {
      const sc = globe.getScreenCoords(p.lat, p.lng, 0.006);
      if (sc && sc.x > -20 && sc.x < w + 20 && sc.y > 20 && sc.y < h - 20) {
        const largura = p.nome.length * (sel ? 8 : 6.6) + 12, altura = sel ? 20 : 16;
        const cx = sc.x, cy = sc.y;
        const r = [cx - largura / 2, cy - altura / 2, cx + largura / 2, cy + altura / 2];
        const bate = !sel && caixas.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        if (!bate) { caixas.push(r); mostrar = true; x = cx; y = cy; op = Math.min(1, (dot - 0.22) / 0.3); usados++; }
      }
    }
    if (mostrar && !p.el) {
      p.el = document.createElement('div'); p.el.className = 'rotulo'; p.el.textContent = p.nome; camadaRot.appendChild(p.el);
    }
    if (p.el) {
      if (mostrar) {
        p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
        p.el.style.opacity = sel ? 1 : op * 0.92;
        p.el.classList.toggle('sel', sel);
      } else p.el.style.opacity = 0;
    }
  }
}
function agendarRotulos(forca) {
  if (forca) ultimaChaveRot = '';
  if (rotAgendado) return;
  rotAgendado = true;
  requestAnimationFrame(() => {
    if (!forca && performance.now() - ultimoRot < 90) { rotAgendado = false; return; }
    desenharRotulos(forca);
  });
}
controls.addEventListener('change', () => agendarRotulos(false));

// Nome da faixa tocando (metadados ICY): uma leitura curta a cada 20 s enquanto uma rádio toca.
const faixa = { id: null, url: null, timer: null, n: 0 };
function pararFaixa() { clearInterval(faixa.timer); faixa.timer = null; faixa.id = null; faixa.url = null; faixa.n++; }
function lerAgora() {
  const id = faixa.id, url = faixa.url, n = ++faixa.n;
  lerFaixa(url, { timeout: 10000 })
    .then((r) => { if (faixa.id === id && faixa.n === n) post({ type: 'track', id, title: (r && r.title) || null, name: (r && r.name) || null, icy: !!(r && r.metaint) }); })
    .catch(() => { if (faixa.id === id && faixa.n === n) post({ type: 'track', id, title: null, name: null, icy: false, error: true }); });
}
function iniciarFaixa(id, url) {
  pararFaixa();
  if (id == null || !url) return;
  faixa.id = String(id); faixa.url = String(url);
  lerAgora();
  faixa.timer = setInterval(lerAgora, 20000);
}

// ---------------------------------------------------------------------------
// Comandos de entrada
// ---------------------------------------------------------------------------
function escolherAleatoria() {
  if (!estacoes.length) return null;
  // peso por popularidade (log) para favorecer rádios conhecidas sem excluir as pequenas
  let total = 0;
  const pesos = estacoes.map((e) => { const w = 1 + Math.pow(Math.log10(e.c + 1), 2); total += w; return w; });
  let alvo = Math.random() * total;
  for (let k = 0; k < estacoes.length; k++) { alvo -= pesos[k]; if (alvo <= 0) return estacoes[k]; }
  return estacoes[estacoes.length - 1];
}

function handle(msg) {
  if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
  if (!msg || typeof msg !== 'object' || !msg.cmd) return;
  switch (msg.cmd) {
    case 'setStations': setStations(msg.data); break;
    case 'focus': focus(msg); break;
    case 'playing':
      tocandoId = msg.id != null && idxPorId.has(String(msg.id)) ? String(msg.id) : null;
      reconstruirDestaque();
      break;
    case 'selected':
      selecionadaId = msg.id != null && idxPorId.has(String(msg.id)) ? String(msg.id) : null;
      reconstruirDestaque();
      break;
    case 'country':
      paisSel = msg.iso2 && paisPorIso.has(String(msg.iso2).toUpperCase()) ? String(msg.iso2).toUpperCase() : null;
      atualizarPaises();
      break;
    case 'random': {
      const e = escolherAleatoria();
      if (!e) break;
      selecionadaId = e.i;
      reconstruirDestaque();
      focus({ lat: e.lat, lng: e.lng, altitude: 1.1, ms: 1400 });
      post({ type: 'station', id: e.i });
      break;
    }
    case 'filter': aplicarFiltro(Array.isArray(msg.ids) ? msg.ids : null); agendarRotulos(true); break;
    case 'track': iniciarFaixa(msg.id, msg.url); break;
    case 'pause': globe.pauseAnimation(); break;
    case 'resume': globe.resumeAnimation(); agendarRotulos(true); break;
    default: break;
  }
}

window.postToGlobe = handle;
// No Android o react-native-webview entrega 'message' em `document`; no iframe/web em `window`.
const vistos = new WeakSet();
const ouvir = (e) => { if (vistos.has(e)) return; vistos.add(e); handle(e.data); };
window.addEventListener('message', ouvir);
document.addEventListener('message', ouvir);

// ---------------------------------------------------------------------------
// Atualiza o raio dos anéis conforme o zoom e sinaliza "ready"
// ---------------------------------------------------------------------------
globe.onZoom((pov) => { escalaAnel = Math.min(1.4, Math.max(0.35, pov.altitude / 1.6)); });

// ---------------------------------------------------------------------------
// Qualidade adaptativa: em aparelhos lentos reduz a resolução do canvas (nunca aumenta de volta).
// Mede o tempo médio de quadro em janelas de 45 quadros; duas janelas seguidas lentas → -25 % de DPR.
// Desligue com ?adapt=0 (ou fixe um valor com ?dpr=1.5).
// ---------------------------------------------------------------------------
if (params.get('adapt') !== '0' && !(dprParam > 0)) {
  let n = 0, t0 = performance.now(), lentas = 0;
  const medir = (agora) => {
    n++;
    if (n >= 45) {
      const ms = (agora - t0) / n;
      lentas = ms > 34 ? lentas + 1 : 0;   // < ~30 fps
      if (lentas >= 2 && renderer.getPixelRatio() > 1.01) {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * 0.75));
        renderer.setSize(root.clientWidth, root.clientHeight);
        lentas = 0;
      }
      n = 0; t0 = agora;
    }
    requestAnimationFrame(medir);
  };
  // começa só depois do carregamento inicial (os hexágonos pesam no 1º segundo)
  setTimeout(() => { t0 = performance.now(); requestAnimationFrame(medir); }, 2500);
}

// Hooks para teste/diagnóstico (não fazem parte do protocolo).
window.__globeDebug = {
  globe, camera, estacoes: () => estacoes, toleranciaGraus, lerFaixa, rotulos: () => rotulos.filter((p) => p.el && +p.el.style.opacity > 0).map((p) => p.nome),
  tela: (lat, lng) => globe.getScreenCoords(lat, lng, ALT_ESTACAO),
};

function iniciar() {
  const t0 = performance.now();
  construirTerra();
  window.__globeDebug.msTerra = Math.round(performance.now() - t0);
  if (params.get('demo') === '1') setStations(gerarDemo(1500));
  post({ type: 'ready' });
  const nomes = {};
  rotulos.forEach((p) => { nomes[p.iso2] = p.nome; });
  post({ type: 'names', map: nomes });
  agendarRotulos(true);
  window.__globeReady = true;
}
// espera o 1º quadro antes de gerar os hexágonos (evita tela em branco enquanto calcula)
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(iniciar, 0)));
