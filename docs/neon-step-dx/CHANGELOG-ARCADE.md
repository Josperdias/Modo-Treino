# NEON STEP DX — histórico de mudanças

O texto público da release fica em `CHANGELOG.md` (só uma dica, o jogo é um segredo). Aqui ficam os detalhes.

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

