# NEON STEP DX — histórico de mudanças

O texto público da release fica em `CHANGELOG.md` (só uma dica, o jogo é um segredo). Aqui ficam os detalhes.

## [Em desenvolvimento] — M2 (parte 2): mais Doodle Jump, portais longe, Papel espelhado

Pedido do dono: "muito mais aleatório, desorganizado e difícil; portais longe uns dos outros e com ideias novas (o Papel: duas personagens espelhadas e a troca); mais elementos que chamem a atenção; otimizar tudo".

### Distribuição (gerador reescrito)
- `core/worldgen.ts`: cada plataforma sorteia o X no **campo todo** (com volta pela lateral), vãos irregulares e humores (calmo/normal/tenso) por padrão; nada de degraus em sequência. O **alcance continua garantido** (distância circular com a volta pela lateral; `validate.ts` com margem) e provado por robôs.
- Mais difícil: vãos mais altos nos humores tensos, mais plataformas móveis/quebráveis e **plataforma-fantasma** (some e volta; avisa piscando antes de sumir; só conta como chão no trecho sólido do ciclo).

### Portais (bem longe e com tipos)
- Primeiro portal entre 700 e 1000 m; depois 750 a 1250 m entre um e outro (antes ~150 m). Nunca dois por perto.
- **Mundo**: Neon → Cristal → Mecânico → **Cosmos** (novo: inimigos disco voador, meteoro em laço e buraco negro que puxa; estrelas de 150 pts; ímã de fitas).
- **Papel**: desvio com portal próprio. Faixa estreita (x 44–168) e o **outro herói é o espelho (W − x)**; tudo é desenhado espelhado na dobra do caderno. O portal **VOLTAR** devolve ao mundo de origem e **troca de personagem**.
- **Bônus**: zona dourada de 90 m só de fitas, volta sozinho. **Atalho**: hélice turbo (2,6 s a 900 un./s).

### Mais lugares e sistemas (pedido: "mais locais, mais portais e sistemas")
- **Fundo do Mar** (correnteza que alterna e empurra de lado; águas-vivas que atiram bolhas) e **Vulcão** (a **lava sobe sozinha**: parar demais queima — dano, quique para cima e a lava recua; fagulhas que saltam do chão; aviso vermelho quando ela chega perto). Ciclo: Neon → Cristal → Mecânico → Cosmos → Mar → Vulcão → Neon.
- **Portal Cronos**: câmera lenta (35 %) para inimigos e tiros por 8 s (relógio `sim.etime`). **Portal Salto**: pula um mundo inteiro (só depois do primeiro portal).
- Visual: fundos, plataformas e portais de cada lugar; sprites novos (água-viva, fagulha); tom azul-gelo e barra no Cronos.

### Ideias do dono (queda livre, rascunho e sala do portal)
- **Queda livre (portal QUEDA)**: descida de verdade. O herói continua de pé e o mundo DESCE: a gravidade puxa para baixo, cada pouso é só um saltinho (≈ 45 un.) e o objetivo é cair de plataforma em plataforma. Um **teto de tempestade desce sozinho** atrás de você e esmaga quem fica parado (causa "O teto te alcançou."); a hélice vira mergulho; o tiro sai dos pés para baixo; pisar nos inimigos de cima funciona. As plataformas são geradas para serem alcançáveis *caindo* (`canDrop`, sem plataforma coberta por outra) e as fitas ficam acima delas. Dura 180 m e volta pelo portal VOLTAR (sem trocar de personagem). (A 1ª versão só espelhava o desenho e deixava o herói de cabeça para baixo; foi refeita.)
- **Rascunho (dentro do Papel)**: aos ~110 m do Papel aparece o portal RASCUNHO, que rasga a dobra: campo inteiro jogável (sem volta pela lateral). **Pousar do outro lado da dobra troca o personagem e INVERTE o controle** (direita anda para a esquerda); pousar de volta desinverte. No ar nada muda (senão segurar a direção prenderia o herói na dobra). Ao sair, você continua sendo o personagem em que terminou.
- **Sala do portal (estilo Portal 2)**: botão (plataforma vermelha) no caminho → pisar nele destranca o **portal azul** e abre a **barreira** de laser; o portal azul leva ao **portal laranja** do outro lado. Sem o botão, a barreira bloqueia a subida (o herói bate e desce); a hélice atravessa. O gerador garante que o botão nunca fica coberto pela plataforma do portal (senão seria inalcançável) e o robô de teste resolve a sala.

### Visual e desempenho
- Fundos novos (Cosmos: nebulosas, planeta com anel, estrela cadente; Papel: caderno pautado com dobra, furos e rabiscos), plataformas por mundo, buraco negro procedural, clipe de papel, meteoro com cauda de fogo, ímã, estrela, marcos de 100 m, **linha dourada do recorde** e aviso "NOVO RECORDE" ao passar dele, riscos de velocidade no atalho, anéis/explosões por tipo de portal.
- Camadas estáticas (estrelas, skyline) viram `Picture` uma vez e rolam com 1–2 comandos; caminhos e shaders reaproveitados (sem alocar por quadro).

## [Em desenvolvimento] — M2 (parte 1): mais jogo, mais desafio, inimigos em pixel

Pedido do dono: refinar o jogo, **menos fácil e com mais cara de Doodle Jump**, **sem aviso de fase**, com **portais**, ideias do protótipo HTML, **inimigos** e mais coisas divertidas, tudo estilizado e em pixel.

### Sem avisos de fase
- Saiu o banner "NÍVEL xx" e as pílulas "NEON · LV 01 · AQUECIMENTO". O nível continua existindo só por dentro (velocidade lateral e dos tiros); o motor não emite mais o evento `level`. Mundo novo = só o visual e a mecânica mudando (nenhum texto).

### Mais difícil
- Rampa até a dificuldade máxima em 220 m (era 300), respiros mais raros (piso do ritmo 0,68), degraus até 168 un. (≈ 85 % do ápice; antes 146), plataformas mais estreitas (88→44 em vez de 100→64), móveis/quebráveis/mola entram mais cedo (fork 18 m, móveis 34, quebráveis 54, mola 76, zigue-zague 100). O validador de alcance aceita até 86 % do ápice e 90 % do alcance horizontal; **os 300 mapas × 3000 m continuam 100 % alcançáveis**.
- Robôs medidos (240 s, 25 sementes): o IDEAL nunca cai (no máx. 1–2 morrem por dano); o HUMANO (150 ms de reação, erro de 14 un.) fica de 0 a 3 mortes; o DESCUIDADO (250 ms, erro de 30 un.) morre em 80–90 % das partidas, em ~2 min.

### Combate (novo)
- **Vidas**: 2 corações (máx. 3), escudos (máx. 2) e 1,8 s de invencibilidade depois de um golpe; coração extra cura.
- **Pisar de cima derruba** o inimigo e quica (770), como no Doodle Jump. **Tiro para cima** pelo botão redondo do centro (ou espaço no teclado), com cooldown de 0,38 s; o botão não move o herói e dá para atirar com um dedo e andar com o outro.
- **Inimigos em pixel** (arte nova desenhada no código, `render/pixelart.ts`; nenhum dos sprites experimentais descartados voltou): **drone** (patrulha e atira), **zigue-zague** (varre a tela), **torre** (2 vidas, atira), **orbe** (circula, espinhos) e **guardião** (chefe de 3 vidas, tiro duplo, a partir de 200 m). Os que atiram só começam a partir de 50 m e **avisam 0,72 s antes** (piscam e mostram "!"). No máximo 4 tiros inimigos no ar.
- Inimigos nascem a partir de 38 m, mais frequentes com a altitude, **sempre fora das plataformas** (testado), no vão da rota ("bloqueio") ou ao lado dela.

### Poderes e checkpoint
- **Escudo**, **sapatos de mola** (9 s de pulo 835), **hélice** (2,1 s subindo sozinho, imune, destrói quem tocar) e **coração**: aparecem a cada 150–230 m (nunca em cascata).
- **Bandeira de checkpoint também na Cidade Neon** (a cada ~220 m, a partir de ~95 m): guarda **uma** recuperação; cair ou ficar sem vidas gasta a carga e o herói volta numa plataforma firme da tela, com vidas cheias, 3 s de invencibilidade e a tela limpa de ameaças. Cada portal também dá uma carga.

### Portais e mundos
- **Portal por contato** (sem janela de confirmação), nunca antes de 100 m (≥ 565 un. de subida, testado), ao lado de uma plataforma larga de apoio e com o caminho seguindo para o lado oposto: **desviar = continuar no mundo**; um portal perdido some e outro vem 90 m adiante. Atravessar limpa o que estava à frente, cria um chão seguro e dá 2,5 s de invencibilidade.
- Mundos: **Cidade Neon** → **Dimensão Cristal** (vento que alterna, plataformas de vidro, cristais e feixes de luz) → **Mundo Mecânico** (esteiras que empurram no pouso, engrenagens, torres) → volta ao Neon. O **Universo de Papel** (dois heróis espelhados) fica para a parte 2.
- Transição do portal: clarão, anéis, o fundo antigo some por cima do novo.

### Visual
- HUD novo no canto (corações, escudos, bandeira de recuperação e barras de poder) e botão de tiro em pixel; plataformas e fundos por mundo; balas, portais animados, anéis de abate, "+60" flutuante e hélice/chama/bolha de escudo no herói. Tudo em Skia, sem imagem nova.
- Ferramenta: `node scripts/prever-pixelart.mjs saida.png` gera a folha de prévia dos sprites de pixel.

### Testes
- `tests/arcade-m2.test.mjs` (20 testes: movimento dos inimigos, pisar, dano, escudo, hélice, tiro e cooldown, aviso antes do tiro, recuperação, poderes, portal, portal perdido, vento/esteira, geração fora das plataformas, tipos por mundo) + e2e de tiro (toque e teclado), vidas/causa do fim e portal.

## [Em desenvolvimento] — M1.6 novo menu de seleção (nativo, Skia)

Refinado a partir do **V3.5 FLUIDO** do Drive (a linha principal; o V4 experimental fica de referência em `arcade/fonte/menu/`).
- **Cena Skia** (`native/src/arcade/menu/scene.ts`): painéis divididos por polígonos, personagens na faixa deles, raio, brilhos, padrões à deriva, rastro de luz ao trocar, logo que respira, botão de setas e dica de deslizar. Toda a geometria e o movimento (760 ms, `cubic-bezier(.22,1,.36,1)`) estão em `pose.ts`, **puro e testado** (`tests/arcade-menu.test.mjs`).
- **Gesto**: o dedo acompanha o menu e solta no personagem mais próximo (passou de 32 px, vai para o lado do arrasto); toque curto no miolo da tela escolhe o lado; botão de setas alterna; teclado ←/→/Enter/Esc na web.
- **Fluxo (pedido do dono)**: tela neutra com **só o aviso de deslizar** (sem texto de "selecionado"); ao escolher aparece **PRESS START** (com o recorde do personagem); depois a **tela de carregamento estilizada** (fundo e arte do personagem escolhido, logo pulsando, medidor em blocos) que espera os sprites de verdade (mín. ~1,1 s). Quem já jogou volta com o último personagem pré-selecionado.
- **Animações**: a dica de deslizar faz o gesto da direita para a esquerda em laço suave (2,8 s, easeInOut) para ensinar sem texto; ao apertar PRESS START o personagem escolhido **avança para a tela** (escala + saída da faixa, o outro apaga, clarão) e entra na tela de carregamento continuando a avançar devagar. Com "reduzir movimento" tudo fica parado.
- **PRESS START em pixels**: fonte 5×7 própria (`pixelfont.ts`, testada), desenhada em Skia com contorno preto, degradê branco→cor do personagem, sombra dura e setas que piscam em contratempo; aparece varrendo da esquerda, fica, pisca e some (ciclo de 1,9 s). Sem caixa e sem recorde embaixo (o recorde segue no rótulo de acessibilidade).
- **PRESS START mais arcade (v2)**: letreiro grosso (pixel de 5 px), contorno preto, degradê branco→amarelo→cor do personagem, bloco 3D, brilho diagonal passando, estrelinhas e setas; ao apertar, **pisca rápido e os pixels se espalham**, o personagem avança, vem o clarão e o **"CARREGANDO..." se monta a partir de pixels que voam até o lugar**.
- **Dois carregandos**: o **de pixels** (padrão, 85 %: estrelas caindo, piso de grade em perspectiva, personagem grande, "CARREGANDO..." em pixels, barra de blocos com o **sprite do jogo pulando** pela barra, porcentagem, dicas, cortina de barras e linhas de varredura) e o **clássico ilustrado** (15 %, `loadingStyle.ts`). Os testes forçam um dos dois com `__MODO_LOADING_STYLE__`.
- **Acessibilidade**: dois "rádios" invisíveis (`arcade-hero-*`, `aria-checked`) e uma região viva que anuncia "X selecionado" só para leitor de tela.
- **Assets**: `scripts/preparar-menu-arcade.py` recomprime a arte do V3.5 em WebP (`native/assets/arcade/menu/`); a arte dos personagens não é alterada. A música do menu (`character_select.ogg`) **não** foi incluída (espera o áudio nativo do M3).
- Testes e2e: 17 no Chromium (menu neutro/escolher/trocar/salvar, pré-seleção, teclado, arrastar, controle + carregando, layouts 360×640 e 412×915).

## [1.4.5] — marco M1 (jogo nativo)

Easter egg novo, **escondido** e sem mudar nada do resto do app. Lançado junto com o app 1.4.5.

### Como desbloquear
- **Ajustes → toque 7 vezes seguidas no número da versão** (no rodapé). Cada toque precisa vir até 1,5 s depois do anterior; a dica "Faltam N toques…" só aparece a partir do 4º. Aparece o cartão **Fliperama** com o botão JOGAR AGORA; o desbloqueio fica salvo no aparelho.

### O jogo
- **NEON STEP DX nativo** (Josperd ou Camila): pulo automático, você guia para os lados. **Toque** (segure a metade esquerda ou direita; os dois lados = parado) ou **inclinação** do celular (opcional, com opção de inverter). Cidade Neon com céu em camadas (skyline que some conforme a altitude), plataformas normais, móveis, quebráveis e mola, fitas e combo; pontuação igual à do protótipo. Pausa, tela de fim de jogo e recorde **por personagem**, tudo salvo só no aparelho.
- Pausa sozinho ao sair do app ou bloquear a tela; tela sempre ligada só enquanto joga; vibração leve **desligada por padrão**; sem som nesta etapa (áudio nativo é o marco M3).
- **Visual estilizado (identidade do app)**: HUD "adesivo" (cartão de pontos com bolinhas, sombra dura rosa e o símbolo ★ de Josperd / ✿ de Camila), pílulas de nível e combo, aviso "NÍVEL" ao subir, seleção e cartões com **padrões** (bolinhas, listras de obra), estrelinhas piscando e personagens flutuando. No campo: **padrões** em ladrilho (meio-tom rosa/roxo, faixas amarelas e xadrez nas bordas), estrelas ✦ e flores ✿ à deriva, skyline que some com a altitude; plataformas com contorno de tinta, brilho neon e um **desenho por tipo** (bolinhas, setas que andam nas móveis, rachaduras nas quebráveis, mola, xadrez de largada); fitas com brilho e cintilar; **aura na cor do personagem**, sombra no chão, rastro em alta velocidade e partículas em forma de estrela.
- **Variedade cedo**: cada novidade (bifurcação, móveis, quebráveis, mola, zigue-zague) é apresentada uma vez, em ordem, nos primeiros ~200 m.
- **Arte**: os 16 sprites de Josperd e Camila são os originais, copiados byte a byte (um teste confere o SHA-256). O alinhamento vem de metadados de pivô por quadro, sem recortar nem redesenhar; o brilho/rastro/sombra são efeitos desenhados por cima, sem tocar nos PNG.
- **Medidor de desempenho** opcional na pausa (FPS, p50/p95/p99 do quadro, tempo de passo e de desenho).

### Motor (o que mudou em relação ao protótipo HTML)
- **Passo fixo de 120 Hz** com integração exata: o salto sempre sobe 198,375 un. (v²/2g), em qualquer taxa de quadros (o protótipo variava de 187 a 197 entre 30 e 240 Hz e ficava em câmera lenta abaixo de 31 fps).
- **Mundo determinístico por semente** (nenhum `Math.random` no motor): mesma semente e mesmas entradas dão o mesmo jogo, do 30 Hz ao 240 Hz.
- **Distribuição das plataformas refeita por padrões** (degraus, torre, bifurcação, móveis, zigue-zague, mola, quebráveis e plataforma larga de respiro) com ritmo de tensão e respiro por altitude, em vez do sorteio plataforma a plataforma. Um **validador de alcance** prova que toda plataforma é alcançável com folga (300 sementes × 3 000 m) e que nada se sobrepõe.
- Jogabilidade provada por robôs: o robô ideal não cai em 25 sementes × 240 s; o "humano" quase nunca; o "descuidado" cai com frequência.
- Memória estável numa sessão simulada de 30 minutos (≈ 7,5 MB de heap, 15 plataformas vivas).
- Fonte do pacote original preservada em `arcade/fonte/`; documentos e medições em `docs/neon-step-dx/`.

### Ainda não existe (próximos marcos)
Inimigos, poderes, portais e os outros universos (M2), checkpoint na Cidade Neon e Papel espelhado (M2), áudio e músicas (M3/M4).

