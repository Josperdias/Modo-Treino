// Nome da faixa que uma rádio está tocando, lido dos metadados ICY (SHOUTcast/Icecast).
// O servidor só manda os metadados se o cliente pedir com o cabeçalho `Icy-MetaData: 1`; aí ele
// intercala um bloco a cada `icy-metaint` bytes de áudio: [1 byte = tamanho/16][texto "StreamTitle='…';"].
// Abrimos uma conexão curta SÓ para ler 1–3 blocos (poucos KB) e fechamos; o áudio em si toca pelo player nativo.
// Rádios sem ICY (HLS, alguns AAC) simplesmente não têm nome de faixa: o resultado vem com title = null.

const utf8 = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');

/** Texto do bloco de metadados → título limpo (ou null). */
export function extrairTitulo(bytes) {
  let texto;
  try { texto = utf8.decode(bytes); } catch (e) { texto = latin1.decode(bytes); }
  const m = /StreamTitle='([\s\S]*?)';/.exec(texto) || /StreamTitle='([\s\S]*)$/.exec(texto);
  if (!m) return null;
  const t = m[1].replace(/\0+$/g, '').replace(/\s+/g, ' ').trim();
  return t && t !== '-' && !/^(unknown|desconhecido)$/i.test(t) ? t.slice(0, 140) : null;
}

function junta(partes, total) {
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Lê o título atual. Devolve { title, name, metaint } ou lança erro de rede.
 * opts: { timeout (ms), blocos (máx. de blocos lidos), fetch (para testes) }
 */
export async function lerFaixa(url, opts = {}) {
  const doFetch = opts.fetch || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 12000);
  try {
    const r = await doFetch(url, { headers: { 'Icy-MetaData': '1' }, signal: ctrl.signal, cache: 'no-store' });
    const metaint = parseInt(r.headers.get('icy-metaint') || '0', 10) || 0;
    const name = (r.headers.get('icy-name') || '').trim() || null;
    if (!r.ok || !r.body || !metaint || metaint > 1 << 20) return { title: null, name, metaint: 0 };
    const reader = r.body.getReader();
    let partes = [], total = 0, titulo = null;
    const maxBlocos = opts.blocos || 3;
    for (let bloco = 0; bloco < maxBlocos && titulo == null; bloco++) {
      // precisa de metaint bytes de áudio + 1 byte de tamanho
      while (total < metaint + 1) {
        const { done, value } = await reader.read();
        if (done) return { title: titulo, name, metaint };
        partes.push(value); total += value.length;
      }
      let buf = junta(partes, total);
      const len = buf[metaint] * 16;
      while (buf.length < metaint + 1 + len) {
        const { done, value } = await reader.read();
        if (done) return { title: titulo, name, metaint };
        partes.push(value); total += value.length;
        buf = junta(partes, total);
      }
      if (len > 0) titulo = extrairTitulo(buf.subarray(metaint + 1, metaint + 1 + len));
      const resto = buf.subarray(metaint + 1 + len);
      partes = resto.length ? [resto.slice()] : []; total = resto.length;
    }
    try { await reader.cancel(); } catch (e) { /* já fechou */ }
    return { title: titulo, name, metaint };
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}
