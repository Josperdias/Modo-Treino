// Leitor de "faixa tocando" (metadados ICY) contra um servidor de verdade, em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { lerFaixa, extrairTitulo } from '../scripts/globe/icy.js';

const bloco = (texto) => {
  const t = Buffer.from(texto, 'utf8');
  const len = Math.ceil(t.length / 16);
  return Buffer.concat([Buffer.from([len]), t, Buffer.alloc(len * 16 - t.length)]);
};

function servidor({ metaint = 2000, blocos = [], icy = true } = {}) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const cab = { 'Content-Type': 'audio/mpeg', 'icy-name': 'Rádio Teste' };
      if (icy && req.headers['icy-metadata'] === '1') cab['icy-metaint'] = String(metaint);
      res.writeHead(200, cab);
      let i = 0;
      const enviar = () => {
        if (res.destroyed) return;
        res.write(Buffer.alloc(metaint, 0x55));                   // "áudio"
        res.write(icy && req.headers['icy-metadata'] === '1' ? (blocos[i] ?? Buffer.from([0])) : Buffer.alloc(0));
        i++;
        setTimeout(enviar, 5);
      };
      enviar();
    });
    s.listen(0, '127.0.0.1', () => ok({ s, url: `http://127.0.0.1:${s.address().port}/live` }));
  });
}

test('lê o título do primeiro bloco de metadados e fecha a conexão', async () => {
  const { s, url } = await servidor({ blocos: [bloco("StreamTitle='Legião Urbana - Tempo Perdido';StreamUrl='';")] });
  const r = await lerFaixa(url, { timeout: 4000 });
  assert.equal(r.title, 'Legião Urbana - Tempo Perdido');
  assert.equal(r.name, 'Rádio Teste');
  assert.equal(r.metaint, 2000);
  s.closeAllConnections(); s.close();
});

test('pula blocos vazios (sem mudança de faixa) até achar um título', async () => {
  const { s, url } = await servidor({ blocos: [Buffer.from([0]), Buffer.from([0]), bloco("StreamTitle='Anitta - Envolver';")] });
  const r = await lerFaixa(url, { timeout: 4000, blocos: 3 });
  assert.equal(r.title, 'Anitta - Envolver');
  s.closeAllConnections(); s.close();
});

test('rádio sem ICY: devolve só o nome da estação, título nulo', async () => {
  const { s, url } = await servidor({ icy: false });
  const r = await lerFaixa(url, { timeout: 4000 });
  assert.equal(r.title, null);
  assert.equal(r.metaint, 0);
  s.closeAllConnections(); s.close();
});

test('extrairTitulo: UTF-8, latin1, vazio e "-"', () => {
  assert.equal(extrairTitulo(Buffer.from("StreamTitle='Jorge & Mateus - Pássaro';")), 'Jorge & Mateus - Pássaro');
  assert.equal(extrairTitulo(Buffer.from("StreamTitle='Caf\xe9 - Noite';", 'latin1')), 'Café - Noite');
  assert.equal(extrairTitulo(Buffer.from("StreamTitle='';")), null);
  assert.equal(extrairTitulo(Buffer.from("StreamTitle=' - ';")), null);
  assert.equal(extrairTitulo(Buffer.from('lixo')), null);
});
