# HANDOFF PARA CLAUDE — NEON STEP DX / MODO TREINO

**Projeto:** NEON STEP DX (antigo Josperd Jump), minigame easter egg do aplicativo Modo Treino — by Josperd. **Idioma de interface:** português brasileiro. **Estado de partida:** protótipo HTML5/CSS/Canvas/JavaScript estruturado, derivado da V1.3, com limpeza de assets experimentais. **Objetivo final:** aplicativo nativo, mantendo a direção artística original e a jogabilidade que foi construída.

## Mensagem para o Claude — LEIA PRIMEIRO

Você receberá um ZIP com a base web executável, sprites originais, músicas, efeitos sonoros, MIDI de composição e documentação. **Não recrie o projeto do zero e não substitua os personagens por desenhos de IA.** Antes de codificar, audite todos os arquivos, mapeie dependências, identifique bugs e elabore um plano de migração para um jogo/aplicativo NATIVO, com entregas incrementais verificáveis. A estrutura web deve servir como referência funcional, não como desculpa para empacotar o mesmo HTML sem adaptações.

**Decisões já fechadas:**
- Os 16 sprites originais (8 Josperd + 8 Camila) foram preservados. A versão da Camila escolhida pelo usuário é a anterior à tentativa de recorte/correção V1.2. **Não redesenhe nem recorte novamente sem demonstrar comparação e obter aprovação.**
- Todos os sprites experimentais recentemente gerados para inimigos, portais e checkpoints foram REMOVIDOS do runtime. Esses recursos NÃO podem ser reintegrados automaticamente. O código conserva desenhos simplificados em Canvas para os elementos correspondentes, mantendo todas as mecânicas.
- Os conceitos gráficos antigos rejeitados estão numa pasta à parte, como referências **não aprovadas**; não confundir com assets destinados ao app.
- Identidade visual pixel art retrô, neon magenta/ciano, com exceção do Universo de Papel, que usa papelaria/recortes em tons creme, e de outros mundos específicos.
- O áudio deve evoluir musicalmente: composição, motivos, progressões, condução de vozes, baixo, bateria, mixagem, arranjo e transições; **não apenas EQ e compressão**.
- Os poderes e portais não devem tumultuar a gameplay. Cada universo precisa de tempo para se desenvolver; trilhas devem tocar por longos trechos sem trocas frequentes.
- O usuário quer **mais modos de jogo, locais, portais, inimigos e conteúdos**, mas exige estabilidade e preservação do que já funciona.

## 1 — O que existe e não pode ser perdido

- Josperd: cabelo volumoso roxo-escuro, contorno magenta, olhos laranja, jaqueta vermelha, camiseta azul e calça/botas roxas.
- Camila Camomila: cabelo laranja-dourado volumoso, blusa verde e calça roxa; mesma identidade do sprite original.
- Salto automático de plataforma em plataforma, movimento horizontal e orientação por direção (Josperd/Camila podem usar orientações-base diferentes).
- Cidade Neon, Universo de Papel, Dimensão Cristal e Mundo Mecânico.
- No Universo de Papel: os dois personagens simultaneamente, deslocamento espelhado e barreira central (sem colisão entre os dois).
- Portais surgem ao longo da subida e **são atravessados por contato físico**, sem modal de confirmação. É possível evitar o contato e continuar no mesmo mundo.
- Plataformas normais, móveis, estreitas, quebráveis, transportadoras e molas.
- Inimigos: drones, zigue-zague, torres, clipes de papel e guardiões; projéteis; escudos e vida.
- Checkpoint por universo: ao perder a última vida por dano OU por queda, oferece **uma recuperação por checkpoint**, mantendo pontuação/mundo e duas vidas. Depois de usado, game over na derrota seguinte. Não é salvamento permanente.
- HUD, seleção de personagem, pausa, pontuação e recorde local.
- Acervo de 53 faixas no catálogo (seleção + 48 normais + 4 especiais), incluindo as quatro músicas do Universo de Papel, e 30 efeitos sonoros. A "Salto de Bolso" permanece reservada, possivelmente para uma tela de título.

## 2 — Como utilizar o pacote

- `projeto_web/`: código executável SEM os quatro conjuntos visuais experimentais. `README_MIGRACAO.md` explica cada módulo.
- `NEON_STEP_DX_BASE_LIMPA_PARA_CLAUDE_OFFLINE.html`: cópia stand-alone, offline, para auditoria visual rápida.
- `MIDI_E_FONTES_PARA_REFINO/`: MIDI e scripts originais/revisados de diferentes sessões. **Nem todo MIDI corresponde exatamente ao áudio final integrado**; coteje catálogo e versões antes de substituir uma música.
- `REFERENCIA_CAMILA_ORIGINAL.png`: referência de identidade, não asset jogável adicional.
- `REFERENCIAS_VISUAIS_DESCARTADAS_nao_usar_no_jogo/`: NÃO IMPORTAR, apenas observar por que os sprites experimentais ficaram visualmente incoerentes.
- `QA_RESULTADOS.json` e capturas `QA_*`: testes automatizados básicos (não substituem teste humano longo).

## 3 — Migração nativa: decidir a arquitetura com evidências

**Primeiro, investigar o stack nativo do Modo Treino**, onde esse easter egg será integrado: Android nativo Kotlin, iOS Swift, Flutter, React Native ou outra base. Não presumir a tecnologia.

Avaliar duas estratégias e explicar o custo da integração:
1. **Godot 4.x / 2D:** apropriado para jogo com física, colisões, animações, renderização pixel-perfect, áudio e exportação Android/iOS. Se for integrado dentro de outro aplicativo nativo, detalhar a forma de abertura/módulo e o ciclo de vida; não prometer integração simples onde houver limites.
2. **Flutter + Flame** (caso o app seja Flutter) ou **motor/Canvas nativo apropriado ao stack existente**, reaproveitando a lógica e importando sprites/áudio organizados.

**Capacitor/WebView** pode ser um passo provisório, mas não deve ser chamado de "jogo nativo" se for apenas um wrapper para HTML. Ao escolher a arquitetura, apresentar matriz de trade-offs (fidelidade, integração, tamanho, desempenho, áudio, offline, manutenção, Android/iOS). Não exigir credenciais ou assinaturas de publicação até chegar à etapa de distribuir o app.

## 4 — Roteiro obrigatório de execução

**Fase 0: Auditoria e baseline.** Executar a base, mapear código/sprites e testes atuais; escrever lista de problemas reproduzíveis. Não lançar conteúdo novo antes de restaurar comportamentos essenciais em testes.

**Fase 1: Motor nativo e equivalência funcional.** Reproduzir física, colisões e câmera; direção correta, oito frames por personagem, escala consistente e atualização a delta time fixo; tela de seleção, controles teclado/toque e HUD. Construir testes automatizados para cálculos determinísticos e testes visuais em aparelhos.

**Fase 2: Universos e progressão.** Portais automáticos por contato, permanência razoável por mundo, checkpoints, dois heróis espelhados em Papel, inimigos com padrão de ataque legível, perigos em ondas com descansos. Centralizar parâmetros em dados externos (ex.: JSON/resources) para rebalancear sem alterar código.

**Fase 3: Direção musical.** Fazer análise das faixas e dos MIDI: tonalidade/modos, frases A/B, ritmo harmônico, voz principal, notas de passagem, cadências, condução de vozes e conflitos de instrumentos; exportar comparativos A/B e relatório. Preservar composições anteriores até aprovadas. Playlists coerentes por universo e personagem, crossfades sutis apenas em mudanças relevantes; não reiniciar música por pulo, escudo, fita ou mola. Efeitos com prioridades, polifonia limitada, mix bus, ducking comedido e sliders separados.

**Fase 4: Conteúdo visual de produção.** Criar uma bíblia visual do jogo (paleta, contorno, escala, referência Camila/Josperd), padrão de sprite-sheet (grid, hitbox, pivô, transparência, direção, nomenclatura, fps, frame bounds). Criar ARTES NOVAS de inimigos, portais, checkpoints e chefes apenas como propostas isoladas. Validar contra sprites dos personagens; nunca ativar assets novos sem aprovação visual e teste in-game. Cenários em parallax discreto, respeitando contraste e legibilidade das plataformas.

**Fase 5: Expansões de gameplay.** Incluir novos modos, fases e inimigos de forma modular e testável: desafio cronometrado, sobrevivência, missão de fitas, modo de duplas espelhadas, guardiões por mundo, objetivos específicos de cada universo e eventos raros. Criar desbloqueáveis cosméticos sem paywall ou obrigatoriedade. Guardar recordes localmente, e eventualmente cloud save somente se o app e usuário desejarem.

**Fase 6: Produto.** Perfil de desempenho Android de entrada e médio, funcionamento offline, salvamento, acessibilidade (contraste, áudio, controles ajustáveis), ciclo de vida (pausa/retorno ao app), compressão de áudio/textura, crash logs sem dados sensíveis, baterias de QA e geração de builds assináveis conforme plataforma.

## 5 — Restrições de estabilidade e qualidade

- Não reintroduzir efeitos visuais retirados, não redesenhar Camila e não perder o checkpoint de queda/dano.
- Preservar os sprites e dados fonte em diretórios separados, com controle de versões.
- Portais não podem surgir cedo demais, nem deixar jogador sem plataforma ao atravessar.
- Música não deve ficar "pá-pá-pá" com troca a cada item. A experiência tem momentos de respiro.
- Visibilidade das projéteis, telegraph de ataques, spawn justo e hitboxes menores que a arte visível.
- Não chamar de "pronto" sem testar início, pausa, troca de personagem, morte por queda, morte por dano, recuperação, entrada em portal, gameplay prolongada, memória e dispositivo real.
- Não usar gravações ou melodias comerciais conhecidas sem licença; conferir status de direitos das composições, arranjos, samples e soundfonts. Analisar separadamente remixes de temas clássicos e faixas inéditas.

## 6 — Entregáveis esperados do Claude

1. Diagnóstico organizado da base e proposta de stack nativo adequada ao Modo Treino.
2. Projeto-fonte nativo gerenciado em repositório, instruções de compilação e assets editáveis.
3. Milestones jogáveis com testes e changelog; comparação com a versão web.
4. Catálogo musical versionado, com notas de revisão, áudio renderizado e MIDI quando possível.
5. Documentação de sprites, animações, colisões, mundos, save, checkpoints, portais e parâmetros de balanceamento.
6. Uma lista priorizada de melhorias possíveis, sem exigir que todas sejam feitas ao mesmo tempo.

**Instrução de partida:** antes de escrever código novo, leia `projeto_web/README_MIGRACAO.md`, revise `game.js`, `worlds.js`, `progression.js` e `music-director.js`; identifique as funções existentes; proponha um plano de migração e apresente o primeiro pequeno vertical slice com controles, saltos e seleção fiéis à base. Não omitir nenhum sistema do escopo final, mas entregar e testar em etapas.
