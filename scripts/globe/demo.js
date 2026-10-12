// Estações de demonstração (?demo=1): ~1500 pontos espalhados em cidades reais.
// Só serve para testar o globo sem dados externos; o app envia as estações reais
// pelo comando `setStations`.

// [nome, ISO2, lat, lng, peso, espalhamento em graus]
const CIDADES = [
  ['São Paulo', 'BR', -23.55, -46.63, 10, 1.2], ['Rio de Janeiro', 'BR', -22.9, -43.2, 7, 0.8],
  ['Brasília', 'BR', -15.78, -47.93, 3, 0.7], ['Salvador', 'BR', -12.97, -38.5, 3, 0.7],
  ['Fortaleza', 'BR', -3.73, -38.52, 3, 0.7], ['Belo Horizonte', 'BR', -19.92, -43.94, 3, 0.8],
  ['Manaus', 'BR', -3.12, -60.02, 2, 0.8], ['Porto Alegre', 'BR', -30.03, -51.23, 3, 0.9],
  ['Recife', 'BR', -8.05, -34.9, 3, 0.6], ['Curitiba', 'BR', -25.43, -49.27, 2, 0.8],
  ['Belém', 'BR', -1.46, -48.5, 2, 0.6], ['Goiânia', 'BR', -16.68, -49.25, 2, 0.8],
  ['Buenos Aires', 'AR', -34.6, -58.38, 6, 1], ['Córdoba', 'AR', -31.42, -64.18, 2, 1],
  ['Santiago', 'CL', -33.45, -70.67, 4, 0.8], ['Lima', 'PE', -12.05, -77.04, 4, 1],
  ['Bogotá', 'CO', 4.71, -74.07, 4, 1], ['Medellín', 'CO', 6.24, -75.58, 2, 0.6],
  ['Caracas', 'VE', 10.48, -66.9, 2, 0.8], ['Quito', 'EC', -0.18, -78.47, 2, 0.6],
  ['La Paz', 'BO', -16.5, -68.15, 2, 0.8], ['Montevidéu', 'UY', -34.9, -56.16, 2, 0.6],
  ['Assunção', 'PY', -25.26, -57.58, 1, 0.6], ['Cidade do México', 'MX', 19.43, -99.13, 8, 1.2],
  ['Guadalajara', 'MX', 20.66, -103.35, 2, 0.8], ['Monterrey', 'MX', 25.69, -100.32, 2, 0.8],
  ['Havana', 'CU', 23.11, -82.37, 2, 1], ['Santo Domingo', 'DO', 18.49, -69.93, 1, 0.5],
  ['Cidade da Guatemala', 'GT', 14.63, -90.51, 1, 0.5], ['Panamá', 'PA', 8.98, -79.52, 1, 0.5],
  ['Nova York', 'US', 40.71, -74.0, 14, 1.4], ['Los Angeles', 'US', 34.05, -118.24, 10, 1.4],
  ['Chicago', 'US', 41.88, -87.63, 7, 1.4], ['Houston', 'US', 29.76, -95.37, 6, 1.4],
  ['Miami', 'US', 25.76, -80.19, 5, 1], ['Atlanta', 'US', 33.75, -84.39, 5, 1.2],
  ['Seattle', 'US', 47.61, -122.33, 3, 1], ['Denver', 'US', 39.74, -104.99, 3, 1.2],
  ['Dallas', 'US', 32.78, -96.8, 5, 1.2], ['Boston', 'US', 42.36, -71.06, 3, 0.8],
  ['San Francisco', 'US', 37.77, -122.42, 4, 1], ['Nashville', 'US', 36.16, -86.78, 3, 1.2],
  ['Toronto', 'CA', 43.65, -79.38, 5, 1], ['Montreal', 'CA', 45.5, -73.57, 3, 0.8],
  ['Vancouver', 'CA', 49.28, -123.12, 2, 0.8], ['Calgary', 'CA', 51.05, -114.07, 1, 0.8],
  ['Londres', 'GB', 51.5, -0.12, 12, 1], ['Manchester', 'GB', 53.48, -2.24, 4, 0.8],
  ['Glasgow', 'GB', 55.86, -4.25, 2, 0.6], ['Dublin', 'IE', 53.35, -6.26, 3, 0.7],
  ['Paris', 'FR', 48.85, 2.35, 10, 1.2], ['Marselha', 'FR', 43.3, 5.37, 3, 0.8],
  ['Lyon', 'FR', 45.76, 4.84, 3, 0.7], ['Madri', 'ES', 40.42, -3.7, 7, 1.2],
  ['Barcelona', 'ES', 41.39, 2.17, 5, 0.8], ['Sevilha', 'ES', 37.39, -5.98, 2, 0.8],
  ['Lisboa', 'PT', 38.72, -9.14, 5, 0.6], ['Porto', 'PT', 41.15, -8.61, 2, 0.5],
  ['Berlim', 'DE', 52.52, 13.4, 8, 1.2], ['Munique', 'DE', 48.14, 11.58, 4, 0.9],
  ['Hamburgo', 'DE', 53.55, 9.99, 3, 0.8], ['Frankfurt', 'DE', 50.11, 8.68, 3, 0.8],
  ['Roma', 'IT', 41.9, 12.5, 6, 1], ['Milão', 'IT', 45.46, 9.19, 5, 0.9],
  ['Nápoles', 'IT', 40.85, 14.27, 2, 0.6], ['Amsterdã', 'NL', 52.37, 4.9, 4, 0.6],
  ['Bruxelas', 'BE', 50.85, 4.35, 3, 0.6], ['Zurique', 'CH', 47.37, 8.54, 3, 0.7],
  ['Viena', 'AT', 48.21, 16.37, 3, 0.8], ['Estocolmo', 'SE', 59.33, 18.07, 3, 1.2],
  ['Oslo', 'NO', 59.91, 10.75, 2, 1], ['Copenhague', 'DK', 55.68, 12.57, 2, 0.8],
  ['Helsinque', 'FI', 60.17, 24.94, 2, 1], ['Varsóvia', 'PL', 52.23, 21.01, 4, 1.4],
  ['Praga', 'CZ', 50.08, 14.43, 2, 0.8], ['Budapeste', 'HU', 47.5, 19.04, 2, 0.8],
  ['Bucareste', 'RO', 44.43, 26.1, 3, 1], ['Sófia', 'BG', 42.7, 23.32, 1, 0.8],
  ['Atenas', 'GR', 37.98, 23.73, 3, 0.8], ['Belgrado', 'RS', 44.8, 20.47, 1, 0.6],
  ['Kiev', 'UA', 50.45, 30.52, 3, 1.4], ['Moscou', 'RU', 55.76, 37.62, 9, 1.6],
  ['São Petersburgo', 'RU', 59.93, 30.34, 3, 1], ['Novosibirsk', 'RU', 55.0, 82.93, 2, 1.5],
  ['Ecaterimburgo', 'RU', 56.84, 60.6, 2, 1.2], ['Vladivostok', 'RU', 43.12, 131.9, 1, 1],
  ['Istambul', 'TR', 41.01, 28.98, 6, 1], ['Ancara', 'TR', 39.93, 32.86, 3, 1],
  ['Tel Aviv', 'IL', 32.08, 34.78, 2, 0.4], ['Cairo', 'EG', 30.04, 31.24, 5, 0.8],
  ['Riad', 'SA', 24.71, 46.68, 3, 1.2], ['Dubai', 'AE', 25.2, 55.27, 3, 0.7],
  ['Teerã', 'IR', 35.69, 51.39, 3, 1.4], ['Bagdá', 'IQ', 33.31, 44.36, 2, 1],
  ['Beirute', 'LB', 33.89, 35.5, 1, 0.3], ['Amã', 'JO', 31.95, 35.93, 1, 0.5],
  ['Casablanca', 'MA', 33.57, -7.59, 3, 1], ['Argel', 'DZ', 36.75, 3.06, 2, 1],
  ['Túnis', 'TN', 36.81, 10.18, 1, 0.5], ['Lagos', 'NG', 6.52, 3.38, 5, 1.2],
  ['Abuja', 'NG', 9.08, 7.4, 2, 1], ['Acra', 'GH', 5.6, -0.19, 2, 0.6],
  ['Dacar', 'SN', 14.72, -17.47, 1, 0.5], ['Abidjan', 'CI', 5.36, -4.01, 1, 0.6],
  ['Nairóbi', 'KE', -1.29, 36.82, 3, 1], ['Adis Abeba', 'ET', 9.03, 38.74, 2, 1],
  ['Kampala', 'UG', 0.35, 32.58, 1, 0.5], ['Dar es Salaam', 'TZ', -6.79, 39.21, 1, 0.8],
  ['Kinshasa', 'CD', -4.44, 15.27, 2, 1], ['Luanda', 'AO', -8.84, 13.23, 1, 0.8],
  ['Maputo', 'MZ', -25.97, 32.57, 1, 0.6], ['Joanesburgo', 'ZA', -26.2, 28.05, 5, 1],
  ['Cidade do Cabo', 'ZA', -33.92, 18.42, 3, 0.7], ['Durban', 'ZA', -29.86, 31.02, 1, 0.5],
  ['Harare', 'ZW', -17.83, 31.05, 1, 0.5], ['Antananarivo', 'MG', -18.88, 47.51, 1, 0.5],
  ['Deli', 'IN', 28.61, 77.21, 8, 1.4], ['Mumbai', 'IN', 19.08, 72.88, 7, 1],
  ['Bangalore', 'IN', 12.97, 77.59, 4, 1], ['Calcutá', 'IN', 22.57, 88.36, 4, 1],
  ['Chennai', 'IN', 13.08, 80.27, 3, 0.8], ['Hyderabad', 'IN', 17.39, 78.49, 3, 0.8],
  ['Karachi', 'PK', 24.86, 67.0, 3, 0.8], ['Lahore', 'PK', 31.52, 74.36, 2, 0.7],
  ['Daca', 'BD', 23.81, 90.41, 3, 0.7], ['Colombo', 'LK', 6.93, 79.86, 1, 0.5],
  ['Catmandu', 'NP', 27.7, 85.32, 1, 0.5], ['Cabul', 'AF', 34.53, 69.17, 1, 0.8],
  ['Tashkent', 'UZ', 41.3, 69.24, 1, 0.8], ['Almaty', 'KZ', 43.24, 76.89, 1, 1],
  ['Pequim', 'CN', 39.9, 116.4, 8, 1.4], ['Xangai', 'CN', 31.23, 121.47, 8, 1.2],
  ['Guangzhou', 'CN', 23.13, 113.26, 5, 1], ['Chengdu', 'CN', 30.57, 104.07, 3, 1],
  ['Wuhan', 'CN', 30.59, 114.3, 3, 1], ['Xi\'an', 'CN', 34.34, 108.94, 2, 1],
  ['Hong Kong', 'HK', 22.32, 114.17, 3, 0.2], ['Taipé', 'TW', 25.03, 121.57, 3, 0.4],
  ['Tóquio', 'JP', 35.68, 139.69, 12, 1], ['Osaka', 'JP', 34.69, 135.5, 5, 0.7],
  ['Sapporo', 'JP', 43.06, 141.35, 1, 0.6], ['Fukuoka', 'JP', 33.59, 130.4, 2, 0.5],
  ['Seul', 'KR', 37.57, 126.98, 6, 0.8], ['Busan', 'KR', 35.18, 129.08, 2, 0.4],
  ['Bangcoc', 'TH', 13.76, 100.5, 5, 1], ['Hanói', 'VN', 21.03, 105.85, 2, 0.8],
  ['Ho Chi Minh', 'VN', 10.82, 106.63, 3, 0.7], ['Manila', 'PH', 14.6, 120.98, 4, 1],
  ['Cebu', 'PH', 10.32, 123.89, 1, 0.5], ['Jacarta', 'ID', -6.2, 106.85, 5, 1],
  ['Surabaya', 'ID', -7.25, 112.75, 2, 0.8], ['Medan', 'ID', 3.59, 98.67, 1, 0.8],
  ['Kuala Lumpur', 'MY', 3.14, 101.69, 3, 0.8], ['Singapura', 'SG', 1.35, 103.82, 2, 0.1],
  ['Sydney', 'AU', -33.87, 151.21, 5, 1], ['Melbourne', 'AU', -37.81, 144.96, 4, 1],
  ['Brisbane', 'AU', -27.47, 153.03, 2, 0.8], ['Perth', 'AU', -31.95, 115.86, 2, 0.8],
  ['Adelaide', 'AU', -34.93, 138.6, 1, 0.6], ['Auckland', 'NZ', -36.85, 174.76, 2, 0.6],
  ['Wellington', 'NZ', -41.29, 174.78, 1, 0.4], ['Reykjavik', 'IS', 64.15, -21.94, 1, 0.8],
  ['Anchorage', 'US', 61.22, -149.9, 1, 1], ['Honolulu', 'US', 21.31, -157.86, 1, 0.5],
  ['Luanda', 'AO', -8.84, 13.23, 1, 0.5], ['Ulan Bator', 'MN', 47.89, 106.91, 1, 1],
];

// Gerador pseudoaleatório determinístico (mulberry32): mesma demo a cada abertura.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarDemo(total = 1500) {
  const rnd = rng(20240607);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7; // ~N(0,1)
  const soma = CIDADES.reduce((s, c) => s + c[4], 0);
  const out = [];
  for (let k = 0; k < total; k++) {
    // sorteio da cidade proporcional ao peso
    let alvo = rnd() * soma;
    let cid = CIDADES[0];
    for (const c of CIDADES) { alvo -= c[4]; if (alvo <= 0) { cid = c; break; } }
    const lat = Math.max(-80, Math.min(80, cid[2] + gauss() * cid[5]));
    const lng = cid[3] + (gauss() * cid[5]) / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
    out.push({
      i: 'demo-' + k,
      n: 'Rádio ' + cid[0] + ' ' + (1 + Math.floor(rnd() * 99)),
      lat: +lat.toFixed(3),
      lng: +(((lng + 540) % 360) - 180).toFixed(3),
      cc: cid[1],
      c: Math.round(Math.pow(10, rnd() * rnd() * 4.2 + 0.3)),
    });
  }
  return out;
}
