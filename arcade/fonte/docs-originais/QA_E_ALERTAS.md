# QA realizado e pontos em aberto — NEON STEP DX

## Validado nesta entrega
- Verificação de sintaxe de todos os `.js` com `node --check`.
- Nenhum `FX_SHEETS`, `drawFxFrame` ou `assets/fx/` permanece no código de execução.
- Os 8 PNGs do Josperd e 8 da Camila foram carregados com dimensões positivas em Chromium.
- Início com Camila, mudança para universo de papel e checkpoint recuperado por queda (vidas=2, mesmo mundo, checkpoint marcado usado); modo continuou `playing`.
- Fluxos acima rodaram em viewport 393x852 e 1280x800, sem erros de JavaScript; há screenshots e JSON no pacote.

## Ainda NÃO significa que esteja pronto para publicar
- Testes acima são automatizados e curtos, com cenários induzidos por funções; NÃO cobrem longas sessões, todos os tipos de inimigos, todos os poderes, dispositivos físicos, bateria, memória ou equilíbrio real.
- Os sprites restaurados de Camila são os antigos, a pedido do autor. Qualquer dificuldade de recorte/movimentação **fica pendente para revisão humana**, não para mudança automática.
- Quatro conjuntos de artes rejeitadas ficaram isolados fora do runtime para referência; elas NÃO são assets aprovados de produção.
- Músicas: revisão artística e de licenças pendentes. A presença dos arquivos no pacote não prova licença comercial irrestrita. É preciso auditar qualquer composição em domínio público, sample, plugin, soundfont, autoria e direitos relacionados.
- Teste também no navegador web estruturado servido por HTTP, não apenas no HTML inline.

## Testes adicionais exigidos antes da migração final
- Direção e animação: ambos lados, 8 frames, pivô e proporções, sem clipping de cabelo/botas.
- Checkpoint em hit fatal e queda, nova derrota após resgate usado, checkpoint novo após portal.
- Portal por contato/evitação e tempo de permanência em cada mundo; risco de spawn inalcançável.
- Modo Papel: ambos personagens sempre visíveis, espelho, nenhuma travessia pelo centro, plataformas correspondentes.
- Colisões com inimigos/turret/drone, projéteis, dano invulnerável, power-ups.
- Música não reinicia sem motivo, troca graduada no universo, 30 SFX sem saturar, controles de volume independentes.
- Tela pequena Android, teclado desktop, suspensão/retomada do app e áudio offline.
