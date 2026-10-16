# NEON STEP DX — Auditoria da base (Fase 0)

Entrada: `NEON_STEP_DX_CLAUDE_PARTE_1` e `PARTE_2` (protótipo HTML5 "V1.3 limpa", sprites, 57 faixas, 30 efeitos, 93 MIDI, scripts de composição).
Nada do pacote foi alterado nem importado ao app nesta etapa. Tudo abaixo foi **lido no código ou medido**; o que não pude verificar está marcado como *não verificado*.

Reproduzir as medições: `docs/neon-step-dx/baseline/baseline-web.mjs` (resultado salvo em `baseline/resultado-baseline.json`).

## 1. O que existe (e vai ser preservado)

| Item | Estado verificado |
|---|---|
| Sprites | 16 PNG (8 Josperd + 8 Camila), todos carregam; sem erro de JavaScript em 9 corridas simuladas + abertura em 393×852 |
| Mundos | Cidade Neon, Universo de Papel, Dimensão Cristal, Mundo Mecânico (`worlds.js`) |
| Plataformas | normal, móvel, estreita, quebrável, esteira, mola (`game.js › addPlatform`) |
| Inimigos | drone, zigue-zague, torre, clipe, orbe, guardião (3 PV) + projéteis |
| Poderes | escudo, super salto, fitas (combo até x5) |
| Portais | por contato, sem janela de confirmação; só após 92 s (1º) / 112 s (demais) **e** 565 un. de subida (`progression.js`) |
| Checkpoint | 1 recuperação por mundo, por dano fatal **ou** queda, volta com 2 vidas — funcionou nas corridas simuladas (ex.: 141 s e 341 s) |
| Papel | dois heróis espelhados (`W − x`), barreira central em x=207–213, jogador limitado a 38–151 → nunca cruza o centro |
| Música | `audio-catalog.js`: 1 seleção + 23 Josperd + 25 Camila + 4 "especiais" = 53; `paper-soundtrack.js`: +4 do Papel → **57 arquivos**, todos referenciados; `Salto de Bolso` reservada (não está no catálogo) |

Os 4 conjuntos experimentais (portal, drone, clipe, checkpoint) **não estão** no runtime; só em `REFERENCIAS_VISUAIS_DESCARTADAS_nao_usar_no_jogo/`. Confirmado: nenhuma referência a `FX_SHEETS`/`drawFxFrame`/`assets/fx` no código.

## 2. Problemas encontrados

Gravidade: **A** = bloqueia a versão nativa · **M** = corrigir no caminho · **B** = polimento.

### Motor e física
| # | G | Problema | Evidência |
|---|---|---|---|
| P-01 | A | **Passo de tempo variável** (`dt = min(Δ, 0,032)`). A altura do salto depende da taxa de quadros; abaixo de ~31 fps o jogo fica em câmera lenta | Ápice do 1º salto (exato = 198,375): 30 Hz → 187,0 · 60 Hz → 192,7 · 120 Hz → 195,5 · 240 Hz → 196,9 |
| P-02 | A | **Sem semente aleatória** (`Math.random`): nenhuma partida é reproduzível, impossível regredir balanceamento | leitura do código; no baseline precisei injetar semente |
| P-03 | A | **Estado global + DOM dentro do laço** (`updateHud` escreve 6 `textContent` por quadro; `setToast`/`worldPortalEnter` mexem em `document`). Só dá para testar rodando no navegador | leitura de `game.js:107-115`, `:48` |
| P-04 | A | Não há **garantia de alcance** das plataformas: a regra é "intervalo ≤ 142" + um patamar seguro a cada 6, mas nada prova (com mundos, esteira, vento do Cristal, drift do Mecânico) que todo salto é possível | leitura; *não verificado por prova*, só por robô |
| P-05 | M | **Sem checkpoint no 1º universo**: `prepare()` zera `state.checkpoint`; ele só nasce em `worldPortalEnter`. Quem cai na Cidade Neon antes do 1º portal tem game over direto | 7 de 9 corridas do robô terminaram em `over` sem nenhuma recuperação (o robô é simples, mas o caminho de código é esse) |
| P-06 | M | **Itens e portal não são espelhados no Papel**: plataformas e inimigos são desenhados dos dois lados; fitas, escudos, impulsos, portal e checkpoint existem só no lado esquerdo (`render()` desenha `state.items`/`drawPortal` uma vez; coleta usa só `p.x`). A Camila/Josperd da direita nunca "pega" nada | `QA_393x852_paper.png`: a fita só aparece ao lado do herói da esquerda |
| P-07 | M | **Troca de personagem ao atravessar portal** (neon→papel mantém; papel→cristal, cristal→mecânico, mecânico→neon trocam): regra não documentada, muda também a playlist (que é por personagem) | `worldPortalEnter` |
| P-08 | M | **Dificuldade presa ao relógio, não à habilidade**: o nível = `min(nível por altura, 1 + ⌊tempo/65⌋)`. Robô bom chegou a 1 646–4 509 m com nível 3–5, mas a distância não é limitada em nenhum mundo | baseline |
| P-09 | M | Hitboxes são constantes soltas no código (`size+7`, `size+21`, 39 × 64 para itens, folga de 19 px nas plataformas), sem caixa por sprite | `game.js:170,184,194` |
| P-10 | B | `Escape` e o botão ♧ chamam `showSelection()` → `prepare()` e **descartam a partida sem confirmar** | `game.js:20-23,355` |
| P-11 | B | Pausa só em `blur` da janela; não há ciclo de vida do app (segundo plano, tela bloqueada) | `game.js:357` |

### Sprites
| # | G | Problema | Evidência |
|---|---|---|---|
| P-12 | M | **Quadros recortados rente ao corpo, sem pivô**: tamanhos de 70–96 px (largura) × 92–130 px (altura); o âncora é "centro da caixa, base da caixa". O centro de massa horizontal varia ~7% da largura entre quadros (≈ 6 px) → risco de o herói "tremer" no ar | análise de alfa dos 16 PNG. *A confirmar visualmente em aparelho; não é veredito* |
| P-13 | B | Arte pintada em alta resolução, desenhada com `imageSmoothing=false` num canvas 420×690 ampliado por CSS → serrilhado/ruído (visível no QA). Fica melhor com atlas + escala inteira + filtro escolhido por arte | `QA_393x852_paper.png` |
| P-14 | B | Faixas de velocidade vertical duplicadas (`vy>250` e `vy>40` ambas = quadro 4); quadro 7 serve para "fim de jogo" e "queda rápida" | `spriteFrame` |

> Camila continua como no pacote (versão anterior à tentativa V1.2): não mexi, não vou redesenhar nem recortar sem comparação aprovada.

### Áudio e música
| # | G | Problema | Evidência |
|---|---|---|---|
| P-15 | A | **Música dura pouco e repete**: 21 das 57 faixas têm ≤ 35 s, 36 ≤ 45 s (mínima 16,7 s; mediana ≈ 43 s; só 3 passam de 60 s). O diretor troca a cada 99 s (85 s no Papel) → a mesma faixa toca **~2,3× em média (até 5,9×)** antes de trocar | `ffprobe` das 57 faixas; `music-director.js:updateAudio` |
| P-16 | A | A troca **não respeita compasso nem frase**: `playNextTrack()` dispara por relógio, crossfade de 2,4 s corta no meio da frase | `music-director.js` |
| P-17 | M | **Playlists por mundo montadas por regex no nome** (`/Velocity|Boardwalk|…/`) com sobreposição (ex.: "Circuit" cai em Neon e Cristal) e `songIndex` único compartilhado entre mundos → ordem pseudo-aleatória; se o filtro der < 3 faixas, usa todas | `getWorldPlaylist` |
| P-18 | A | **Efeitos com `new Audio()` por disparo** (latência de dezenas a centenas de ms no celular, lixo de memória) e **`beep()` do WebAudio sobreposto** ao efeito (`subir_nivel` + `beep`, `escudo` + `beep`…) | `audio-effects.js`, `game.js:49,121-123,175` |
| P-19 | A | **Som ligado por padrão** (`soundOn=true`). No Modo Treino o padrão é desligado e a música do usuário nunca pode parar | contraste com `CLAUDE.md` (Sons opcionais) |
| P-20 | M | Sem mix bus, ducking, prioridades nem sliders separados (música/efeitos); volumes são constantes por nome | `audio-effects.js` |
| P-21 | A | **Peso**: 26,8 MB de áudio (7 MP3 192 kbps = 8,1 MB; 50 OGG) contra o **APK atual de 55,7 MB** (v1.4.4). Embutir tudo = +48% | `ffprobe`; release v1.4.4 |
| P-22 | M | **Licenças/proveniência** — ver §4 | scripts de composição |
| P-27 | M | **As 4 faixas "especiais" (`SPECIAL_TRACKS`, 2 por personagem) nunca tocam**: `playSpecial()` é um `return` vazio e nada mais lê a lista. O handoff as conta como conteúdo do jogo | `grep` em todos os `.js`; `music-director.js:55` |

### Conteúdo/UX
| # | G | Problema |
|---|---|---|
| P-23 | M | Interface é de página web (cabeçalho "MODO TREINO / ARCADE", rodapé "ONLINE OFFLINE", textos "protótipo", `styles.css` 96 KB, HTML offline de 36 MB com áudio em base64): nada disso vai para o app; HUD/seleção/pausa precisam ser reescritos em componentes do Modo Treino |
| P-24 | B | Nomes legados: título "Josperd Jump", chave de recorde `josperd_jump_best_v1` (um recorde único para tudo; sem recorde por personagem/mundo/modo) |
| P-25 | M | Controles: só metades da tela + botões; sem inclinação, sem esquema para canhoto, sem ajuste de sensibilidade; sem opção de reduzir tremor/flash (`shake`, `flash`) |
| P-26 | B | O tiro só sobe, então inimigos abaixo do herói nunca são alvo — intencional? (perguntar) |

### O que está **bom** e deve ser mantido
- Física-base (g=1200, salto 690, impulso 835/930, vx alvo 282+): sensação já aprovada.
- Checkpoint por queda/dano, portal por contato, "patamar seguro a cada 6", pós-resgate com 5 plataformas de graça e inimigos pausados.
- Ritmo `PACING` já está **separado em dados** (`progression.js`): é o embrião da camada de dados que a Fase 2 pede.
- Sem erros de JS, sem requisições falhas; `update` ≈ 0,007 ms e `render` ≈ 1,3 ms por quadro no Chromium desktop sem GPU (não representa celular; *não verificado em aparelho*).

## 3. Música — situação para a Fase 3

- **93 MIDI** (V3, V6, V7/Melody Rush, Expansão 24, Seleção, Salto de Bolso, 4 do Papel) com 16,7–66 s de duração, 98–182 BPM e até ~2 000 notas (lidos com `mido`).
- O pacote avisa: **nem todo MIDI corresponde ao áudio final**. Vou cotejar catálogo × MIDI × OGG faixa a faixa antes de substituir qualquer coisa, e **nenhuma música existente é sobrescrita** sem comparação A/B e sua aprovação.
- As trilhas do Papel (4) têm MIDI ao lado do OGG e `catalogo_papel.json`; são as melhores candidatas ao primeiro "refino-piloto".
- "Salto de Bolso" (MIDI + MP3): fica reservada para o título.

## 4. Licenças e direitos (pendente de decisão do dono)

- **Fontes clássicas** (Beethoven, Mozart, Grieg, Pachelbel, Petzold, Offenbach, Brahms, Tchaikovsky, Joplin 1902, "Greensleeves", "Frère Jacques", "Ah! vous dirai-je"): composições em domínio público no Brasil (autores mortos há > 70 anos). Os scripts dizem que o áudio é sintetizado por código, sem gravação de terceiros, e eu li as menções a isso nos scripts — **não auditei amostra por amostra**.
- **Faixas "originais"** (série S e 4 do Papel) foram geradas por código a partir de tabelas de motivos em sessões anteriores. **Nada no pacote prova ausência de semelhança acidental com músicas conhecidas**: recomendo uma checagem de ouvido (a minha não conta) nas que você pretende manter.
- Banco `AMOSTRAS/` não veio no zip, mas é recriado pelo script (`compor_v7.py`, funções `create_samples`).
- Fontes de texto: o protótipo usa fontes do sistema; no app usarei Barlow Condensed e DM Sans (OFL), como já é regra do projeto.
- Nada do pacote entra no repositório/app antes de você aprovar o catálogo final (ver plano, Fase 3).

## 5. Perguntas que dependem de você (com o que assumo se não disser nada)

1. **Checkpoint também na Cidade Neon?** → assumo **sim** (uma recuperação, mesma regra dos outros mundos).
2. **Itens/portal espelhados no Papel?** → assumo **sim**: cada fita nasce nos dois lados, e qualquer herói pode pegar; portal único no centro-esquerda, atravessado pelos dois.
3. **Troca automática de personagem ao atravessar portal** (P-07) → assumo **não trocar**: o herói escolhido continua até você mandar o contrário.
4. **Tiro só para cima** (P-26) → mantenho.
5. **Orçamento de áudio** → meta ≤ 12 MB no APK (hoje 26,8 MB), por curadoria + re-codificação (Opus/Vorbis), nunca cortando faixa sem sua aprovação.
