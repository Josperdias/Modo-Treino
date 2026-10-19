# Colaboração com Claude — Modo Treino

Projeto proprietário/pessoal de Josperd. Preservar o universo dos personagens, a identidade editorial, e as ilustrações. Personagem Camila Camomila = **ruivinha**. Não renomear a personagem para "loira" em elementos visíveis.

## Fluxo Git

- `main` é estável; criar branches `feat/*`, `fix/*`, `art/*`, `chore/*`.
- Pull requests pequenos com: resumo, lista de telas afetadas, testes e screenshots responsivas.
- Nunca mesclar automaticamente mudanças não testadas em `main`.
- O CI (`check.yml`) roda: estrutura e lógica, site no Chromium e app (typecheck, bundle Android e interface via react-native-web). PRs só entram com tudo verde.
- Antes de aceitar código de GitHub externo, conferir licença e arquivos de licença; nunca copiar grandes trechos indiscriminadamente.
- Nunca tentar integrar o Morphe, baixar áudio do YouTube ou tocar áudio invisível em segundo plano a partir do YouTube.
- Nunca apresentar capa decorativa como demonstração de exercício ausente.
- A fonte `Le Cartoonie` só pode ser incluída com direito de uso e sem redistribuir font files a terceiros.

## Prioridades

1. Acessibilidade e funcionamento de treinos, salvar e exportar dados.
2. Arte e fallback de personagens, depois animações de cassete e experiência móvel.
3. Importação e permanência de playlists locais no próprio dispositivo.
4. Testes reais de áudio e modo offline.

## Comandos

- Web: `python3 -m http.server 8000 -d site`
- Native: `cd native && npm ci && npx expo start`
- Testes rápidos: `npm test` (estrutura + lógica) — `python3 tests/verify.py`, `node --test "tests/*.test.mjs"`
- Site no Chromium: `npm ci && npx playwright install chromium && npm run test:e2e`
- Arcade no navegador (Skia real): `cd native && npx expo export --platform web --output-dir /tmp/web && NATIVE_WEB_DIR=/tmp/web node --test ../tests/e2e/arcade-web.e2e.mjs` (capturas: `ARCADE_SHOTS=<pasta>`)
- App (typecheck + bundle): `cd native && npx tsc --noEmit && npx expo export --platform android`
- Prints reais das telas: `node scripts/capturar-prints.mjs screenshots/<versao> --native <pasta do expo export --platform web>`

## Regras de código (aprendidas em testes)

- **Estrutura do app** (`native/`): `App.tsx` só monta as abas; telas em `src/screens`, música em `src/music`, estado em `src/store.tsx`, componentes em `src/ui.tsx`, zoom em `src/ZoomView.tsx`.
- **Descanso**: padrão **só entre exercícios**; entre séries só se o usuário configurar (`restPlan` em `shared/logic.js`).
- **Fitas**: guardam só referências. Tirar da fita **nunca** apaga arquivo; só cópias importadas pelo seletor podem ser apagadas (`forgetTrack`). Sem importar para ouvir as músicas do celular (MediaStore).
- **Animações**: reanimated. Evite `withSpring` encadeado em `withSequence` (oscila sem parar no navegador); prefira `withTiming`.
- **Lógica compartilhada**: edite SOMENTE `shared/logic.js` e rode `node scripts/sync-shared.mjs` (copia para `site/` e `native/`).
  O CI falha se as cópias divergirem. Toda regra nova de série/volume/versão/backup entra aqui **com teste**.
- **Ilustração inteira**: nunca use `object-fit: cover` / `resizeMode="cover"` em arte de exercício. As artes têm proporções diferentes;
  use `contain`. O selo "JOSPERD / CAMILA" fica **fora** da arte, nunca por cima.
- **Camadas do site**: modo execução (z 90) < player (100) < cronômetro (110) < aviso (120) < janela de edição (140). O aviso
  (`.toast`) tem `pointer-events:none`; um elemento invisível que captura toques é bug.
- **Globo (Rádio)**: pausa o desenho quando a aba não está visível (comandos `pause`/`resume`); o nome da faixa vem de `scripts/globe/icy.js` dentro da própria página. Visual retrô de fita (planeta de pontinhos neon rosa/roxo/azul, espaço estrelado; NÃO use atlas/sépia nem cores 'doces' amarelo/menta: o dono não gostou); rádio = pino índigo, escolhida vermelha, tocando verde. Vizinhos nunca repetem a cor. Regenere com `node scripts/build-globe.mjs`.
- **Notificações**: são DUAS e nativas (módulo próprio `native/modules/modo-notif`, Kotlin; `expo-notifications` e `setActiveForLockScreen` NÃO são mais usados). Música = serviço em primeiro plano + `MediaSession` (fone/Bluetooth) + cartão azul-céu (rádio: rosa); Treino = cartão verde-menta com a ilustração do exercício, selo "Séries feitas" e contagem regressiva por `Chronometer`. Tudo é `RemoteViews` com `DecoratedCustomViewStyle`: só vale `FrameLayout/LinearLayout/TextView/ImageView/ProgressBar/Chronometer` (nada de `View` puro, `SeekBar` ou `Switch`), altura recolhida ≤ 48 dp, drawables/fontes do próprio módulo. O texto e as ações já chegam prontos do JavaScript (`src/notify.ts`, `MusicProvider`, `WorkoutScreen`); o Kotlin só desenha. Botões → evento `onAction` → JS (se o app morreu, o cartão some). Artes: `node scripts/gerar-arte-notificacao.mjs`. **Conferir o visual** com `docs/MANUTENCAO.md` (prévia por conversor de layout) e `aapt2` — Robolectric não roda no proxy do ambiente.
- **Motor de música (1.4.2+)**: no Android o padrão é o **Media3** (`native/modules/modo-playback`: `TapePlaybackService` = único dono do ExoPlayer; JS só espelha o estado). Nunca deixe expo-audio e Media3 tocarem juntos. `EXPO_PUBLIC_MODO_NATIVE_AUDIO=0` compila com o motor antigo (expo-audio + `modo-notif` com cartões ilustrados). No Media3 a notificação de música tem dois estilos (Ajustes → Notificação da música): **cartão ilustrado** (padrão; `NotificationStyleProvider.kt` desenha os layouts `card_*` de `modo-notif` pelo NOME, sem dependência de código) e **player do sistema** (barra arrastável). O **crossfade ainda não existe no Media3**; o cartão de treino (modo-notif) é independente. O APK piloto `.pilot` (`android-media3-pilot.yml`, só manual) serve para testar sem tocar no app principal.
- **Permissões**: NÃO declare `REQUEST_INSTALL_PACKAGES` (o 1.3.2 com ela não abriu num Xiaomi/HyperOS: "problem parsing the package"; sem ela o 1.3.1 abriu). Atualização = baixar pelo `DownloadManager` (módulo `modo-apk`: progresso e SHA-256 no app) e abrir a tela de Downloads; o app nunca abre o instalador sozinho.
- **Listas grandes** (fitas): sempre `FlatList` virtualizada com linhas leves e memoizadas; nada de `ScrollView` com centenas de itens nem animação por linha.
- **Versão única**: `native/package.json`, `native/app.json`, `package.json`, `native/App.tsx`, `site/updates.js` e `site/sw.js`
  precisam ter o mesmo número (o `verify.py` confere); `android.versionCode` = X*10000+Y*100+Z (`bump-version.mjs` cuida).
- **Saídas de job e secrets**: o GitHub descarta qualquer saída de job que contenha o valor de um secret. O alias da chave (`modo-treino`) é secret e faz parte do nome do APK, então o job de publicação calcula o nome do APK sozinho (`ls dist/*.apk`) em vez de receber por `needs.apk.outputs`.
- **APK de teste** = `assembleRelease` (JS embutido). Nunca volte para `assembleDebug`: sem Metro, o app abre em tela vermelha.
- Fontes: só OFL embutidas (Barlow Condensed, DM Sans). Não adicione Le Cartoonie sem licença.

## Sons opcionais (v1.0.1)

- O usuário deve optar explicitamente por ativar sons. **Padrão: desligado**.
- Preservar toggles independentes: botão, série, fim de descanso, conclusão de treino, contagem 3-2-1, voz/bipe e volume.
- Pacotes `suave`, `arcade` e `minimal` são sinais originais gerados com `scripts/generate_sounds.py`, WAV local para site e nativo. Voz 3-2-1 gerada em pt-br por espeak; não adicionar músicas comerciais embutidas.
- Regressões importantes: música de usuário não deve parar ao tocar um efeito; ausência de permissão de áudio nunca impede salvar uma série.
- Testar com aparelho Android real: áudio em primeiro e segundo plano, troca de personagem, upload de MP3/M4A, retomada do player e cronômetro.
- O aplicativo apresenta sugestões/avisos ao **abrir/retomar** com internet; notificações push remotas em tempo real exigem backend dedicado e ainda NÃO estão implementadas.

## Arcade — NEON STEP DX (easter egg, `native/src/arcade/`)

- **Desbloqueio**: 7 toques seguidos no número da versão (Ajustes), `unlock.ts`. Salvo em `arcade.v1` (AsyncStorage). O jogo é carregado sob demanda (`React.lazy`); nada dele pesa na abertura do app.
- **Camadas**: `core/` é TypeScript **puro** (sem React, Skia nem `Math.random`): passo fixo 120 Hz, física exata (Verlet), PRNG semeado, mundo por padrões (`worldgen.ts`) e validador de alcance (`validate.ts`). `data/neon.ts` guarda os parâmetros: rebalancear = mexer ali. `session.ts`, `fx.ts`, `perf.ts`, `save.ts`, `unlock.ts` também são puros. `render/` (Skia), `GameCanvas.tsx` e `ArcadeScreen.tsx` são a parte de tela.
- **Testes do motor rodam no Node** (`tests/arcade-core.test.mjs`, `tests/arcade-app.test.mjs`): o Node 22 executa `.ts` direto, por isso os imports relativos de arquivos testados **terminam em `.ts`** (o `tsconfig` tem `allowImportingTsExtensions`; o Metro aceita). Sem enum nem parameter properties nesses arquivos.
- **Física**: nunca mude `PHYS` (g 1200, salto 690, mola 930, impulso 835) sem rodar a paridade (ápice = v²/2g = 198,375 em qualquer taxa). Todo gerador novo precisa passar em `validate()` e nos testes de alcance e de robôs.
- **Sprites**: os 16 PNG de `native/assets/arcade/sprites/` são **cópias byte a byte** de `arcade/fonte/legado-web/assets/sprites/`. Nunca recortar, redesenhar nem editar; correções de pivô/alinhamento só em `data/sprites.json` (`python3 scripts/gerar-atlas-arcade.py`). Sprites experimentais de inimigos/portais/checkpoint **não podem voltar** sem aprovação visual do dono.
- **Menu de seleção** (`native/src/arcade/menu/`): `pose.ts` (geometria/movimento, puro, testado em `tests/arcade-menu.test.mjs`), `scene.ts` (desenho Skia), `SelectMenu.tsx` (gestos, PRESS START, carregando). O toque do menu é do `PanResponder` da tela (sem Pressables concorrentes por cima do arrasto: eles roubavam o responder); botões só para fechar, controle, setas e PRESS START. **Sem texto de "selecionado" na tela** (pedido do dono): só a dica de deslizar antes e PRESS START depois; o anúncio fica na região viva para leitor de tela. Contexto de teste que falha precisa fechar (um contexto Chromium aberto trava os seguintes).
- **Toque**: tratar `onResponderStart/Move/End/Release` (não só Grant/Move/Release), senão soltar um dedo com o outro ainda na tela não atualiza o controle.
- **Skia na web (testes)**: o `.wasm` precisa ser o de `canvaskit-wasm/bin/full/` (a versão "leve" derruba a página com `Uncaught Infinity`). O e2e `tests/e2e/arcade-web.e2e.mjs` já serve o certo. Os quadros viram `Picture`; os antigos são liberados com `dispose()` com 2 quadros de atraso.
- **Som/vibração**: tudo **desligado por padrão**; o jogo não toca áudio ainda (M3: módulo Kotlin próprio, sem derrubar o Media3). Direitos de música: ver `docs/neon-step-dx/00-AUDITORIA.md` §4.
- Documentos: `docs/neon-step-dx/` (auditoria, arquitetura, plano, baseline, medições do M1 e `CHANGELOG-ARCADE.md` com o histórico detalhado; o `CHANGELOG.md` público só traz uma dica, o jogo é um segredo).

## APK de teste

- O projeto contém `.github/workflows/android-apk.yml` com `workflow_dispatch` e tags `v*`.
- Workflow gera APK debug, publicado em Actions > Artifacts. Tag gera prerelease com APK de teste.
- Para release Android público, usar APK assinado com distribuição adequada e revisão de permissões. Não confundir debug com versão de produção.
- `native/eas.json` permite `eas build --platform android --profile preview` depois que o proprietário autenticar e configurar o projeto no Expo.
