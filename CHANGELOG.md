# Changelog — Modo Treino

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/). Versionamento semântico.

## [1.2.0] — 2026-10-12

### App Android refeito
- **Interface nova, mais limpa**: **3 abas** (Início, Músicas, Progresso) em vez de 6. Ajustes e a coleção de ilustrações abrem em folhas
  a partir do perfil. Visual editorial mantido (cabeçalho azul-marinho, hero "VAI LÁ. FAZ VALER.", cartões rosa e azul com contorno), agora com
  **texturas** (pontos e listras), pôsteres inclinados que flutuam, contagem animada nas estatísticas, transições entre telas,
  botões com mola e anel de progresso.
- **Descanso só entre um exercício e outro.** Entre séries do mesmo exercício não há mais contagem, a não ser que você ligue em
  Ajustes → Descanso (entre exercícios: Sem/30/45/60/90/120/180 s; entre séries: Sem/15/30/45/60/90 s). O ajuste antigo vira "entre exercícios".
- **Fitas com as músicas do próprio celular, sem importar nem copiar** (permissão de leitura de áudio do Android; nada de foto/vídeo).
  Busca, seleção múltipla, **tirar da fita não apaga o arquivo** (com **Desfazer**), reordenar, várias fitas com a mesma música, fitas novas e
  renomear. "Escolher arquivos" continua existindo para o que não aparece na lista. Bibliotecas da versão anterior são migradas.
- **Zoom com os dedos de verdade** (gesture-handler + reanimated, na thread de UI): pinça centrada nos dedos, arrastar com limites,
  toque duplo, botões +/−/AJUSTAR; máximo 600%.
- Cassete animado (carretéis giram, a fita passa de um lado ao outro), controles da tela de bloqueio quando o sistema permite.
- Acabamento: confete no treino completo, equalizador na música tocando, segmentos de progresso que enchem, ícones das abas que saltam, brilhos no hero,
  "respiração" no cronômetro e no botão principal, faixa **Últimos 7 dias** no Progresso e texturas no cabeçalho e nos cartões.
  Tudo respeita **"remover animações"** do sistema (as animações em laço ficam paradas).
- Modo execução com a barra azul-marinho no topo (sempre abaixo da barra de status) e os botões do rodapé como antes: anterior, **CONCLUIR SÉRIE ✓** e próximo.
- Acessibilidade: o fundo some para leitores de tela quando o modo execução está aberto; papéis e estados também no navegador.
- Permissões enxutas: removido o microfone (que o `expo-audio` pedia por padrão) e as de foto/vídeo/janela sobreposta.

### Lógica compartilhada (`shared/logic.js`, com testes)
- `restPlan`, `normalizeRest`, e as operações de fita `tapeAdd/tapeRemove/tapeInsert/tapeMove/forgetTrack/resolveTape/nextTrackId/searchTracks`.
- Backup agora guarda `restExercise` e `restSet` (e continua lendo o `rest` antigo).

### Testes
- Interface do app reescrita (27 testes), incluindo **pinça e toque duplo com toques reais** simulados no Chromium e o caso "tirar da fita não apaga".
- 41 testes de lógica.

### Não verificado
- Reprodução, permissão de áudio, lista de músicas e segundo plano **em Android real** (o ambiente de desenvolvimento não tem aparelho).

## [1.1.1] — 2026-10-12

### Novo
- **Cartão "Baixe o app Android"** na página inicial do site e link **"Baixar o app"** na barra lateral (com versão e tamanho quando
  existe uma release com APK; escondidos no app instalado). A página `/baixar/` já tinha as instruções e o SHA-256.
- **README para visitantes** (com prints, links de site/download e como funcionam os avisos) e `docs/MANUTENCAO.md`.
- `scripts/bump-version.mjs`: sobe a versão nos 6 lugares de uma vez (o aviso de versão nova só dispara com número maior).
- **Zoom de verdade na ilustração** (site e app): toque na imagem do card (e das listas, da galeria e da janela de edição) para
  ampliar até 600% com **pinça**, **toque duplo**, **roda do mouse**, **arrastar** (respeita as bordas) e botões **+ / − / AJUSTAR**.
  Esc fecha só o zoom. No app o zoom abre por cima do modo execução e da edição.
- **Música no treino**: o modo execução mostra um **mini player** (faixa atual, fita, ⏮ ▶/Ⅱ ⏭) no card e no descanso, sem sair do treino.
  O app mostra o mesmo player compacto dentro do modo execução.

### Corrigido
- **APK (causa raiz 2)**: as 25 ilustrações de exercício do app eram **JPEG com extensão `.png`**; o `aapt2` do Android recusa isso
  ("AAPT: error: file failed to compile"). Os arquivos de `native/assets/exercicios/` foram renomeados para `.jpg` (formato real, nenhum
  pixel alterado); as chaves técnicas `*_loira.png` / `*_vinho.png` no código continuam as mesmas. `tests/verify.py` agora confere que
  a extensão de cada asset do app bate com o formato real. (No site os arquivos continuam com o nome antigo: navegador não liga.)
- **Workflow do APK**: `android-actions/setup-android@v3` falhava com "Failed to find package 'tools'". Agora usa o Android SDK que
  já vem no runner (`$ANDROID_HOME`) e aceita as licenças com `sdkmanager`.
- `setPointerCapture` com ponteiro inválido abortava o gesto; agora é protegido.

## [1.1.0] — 2026-10-12

### Novo
- **Modo Execução** (site e app): um card por exercício em tela cheia, botões para marcar **quantas séries você fez**
  (tocar em "3" registra 3; tocar de novo corrige), descanso em tela própria com **+15s**, **Pular** e **Editar tempo**,
  navegação entre exercícios, ajuda "como fazer", ajuste de séries na hora e tela de **Treino completo** que salva no histórico.
  Painel "Continuar · x% feito / Recomeçar" na ficha de cada treino.
- **Ilustração sempre inteira**: card, listas, galeria e janela de edição usam `contain` (as artes têm proporções 2:3, 3:4 e 4:5);
  o selo "JOSPERD / CAMILA" fica **abaixo** da arte; no modo execução, toque na imagem para ampliar.
- **Histórico detalhado**: volume por treino (séries × repetições × carga), detalhe por exercício, **recordes pessoais** e
  exportação em **CSV** (site e app). Treinos antigos (sem detalhe) continuam funcionando.
- **Backup validado** (JSON): importação rejeita arquivo fora do formato e ignora chaves perigosas (`__proto__`), limites por campo.
- **Página de download** (`/baixar/`): última versão, tamanho, **SHA-256**, instruções de instalação do APK e instalação do PWA.
- **GitHub Pages** (`.github/workflows/pages.yml`) e **APK standalone** com SHA-256 (`.github/workflows/android-apk.yml`).
- **Offline de verdade**: service worker novo (stale-while-revalidate), ilustrações e sons pré-carregados, suporte a `Range` de áudio.
- **PWA instalável**: ícones PNG 192/512/maskable (selo "MT" do site) e atalhos para Treino A, Treino B e Música.
- Player web: **Media Session** (título e controles na tela de bloqueio) e pedido de armazenamento persistente para as músicas.
- App: opção **manter a tela ligada** nos treinos (desligada por padrão), exportar/importar backup e planilha.
- Avisos de versão: usa a **maior** release (não a primeira da lista), entende pré-releases, oferece o link do APK; um commit novo
  continua **não** sendo "versão disponível".

### Corrigido
- App: `expo-audio` exigia o peer `expo-asset`, que não estava declarado; o npm instalou `expo-asset@57` (de outro SDK) e duplicou
  módulos nativos. Agora `expo-asset ~12.0.13` e `expo-constants ~18.0.14` estão declarados.
- Site: importar **vários arquivos de música de uma vez** só importava o primeiro (a `FileList` era esvaziada antes do fim do laço).
- Site: o player cobria os botões **+15s / PULAR** do cronômetro; o aviso "Série marcada" ficava atrás do menu; em celulares a arte
  do exercício invadia o início do texto (coluna de 85 px para arte de 98 px).
- Site: o aviso (toast) invisível continuava interceptando toques e bloqueava botões atrás dele.
- Site: o cronômetro recriava os botões a cada segundo (cliques perdidos); a janela de edição não gerenciava foco (agora entra no
  botão fechar, prende o Tab e devolve o foco).
- Site: dependência do Google Fonts (quebrava a tipografia offline e enviava o IP a terceiros); agora Barlow Condensed e DM Sans
  (licença OFL) são servidas localmente. Erro 404 da Le Cartoonie (arquivo propositalmente ausente) removido.
- Site: importação de backup descartava o repositório e a preferência de avisos.
- App: "Verificar atualização agora" não fazia nada com os avisos desativados; cronômetro cobria o player; botões de série com
  29 px (agora 38 px); hero cortava "FAZ VALER."; "repetir" não repetia uma fita de uma única faixa; não havia como apagar
  músicas importadas; sem rótulos de acessibilidade nos controles.
- **APK**: `assembleDebug` gera um APK **sem o JavaScript embutido** (exige servidor Metro) e abriria com tela vermelha. O workflow
  agora compila `assembleRelease` (standalone, assinado com a chave de depuração do template) e confere o pacote com `apksigner` e `aapt2`.

### Infraestrutura
- Lógica pura compartilhada em `shared/logic.js` (cópias sincronizadas por `scripts/sync-shared.mjs`, conferidas no CI).
- Testes: 29 unitários, 41 de ponta a ponta do site (Chromium), 16 da interface do app (react-native-web), verificações estruturais
  e varredura de segredos. CI em três jobs.

## [1.0.1]
Versão recebida: site/PWA, app Expo SDK 54, Modo Música com fitas e crossfade, biblioteca de sons opcional (Suave, Arcade, Minimal),
avisos de versão pelo GitHub.
