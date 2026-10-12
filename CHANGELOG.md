# Changelog — Modo Treino

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/). Versionamento semântico.

## [1.1.1] — em desenvolvimento

### Novo
- **Zoom de verdade na ilustração** (site e app): toque na imagem do card (e das listas, da galeria e da janela de edição) para
  ampliar até 600% com **pinça**, **toque duplo**, **roda do mouse**, **arrastar** (respeita as bordas) e botões **+ / − / AJUSTAR**.
  Esc fecha só o zoom. No app o zoom abre por cima do modo execução e da edição.
- **Música no treino**: o modo execução mostra um **mini player** (faixa atual, fita, ⏮ ▶/Ⅱ ⏭) no card e no descanso, sem sair do treino.
  O app mostra o mesmo player compacto dentro do modo execução.

### Corrigido
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
