# NEON STEP DX — Arquitetura nativa recomendada

## 1. Stack do Modo Treino (verificado no repositório)

- **Expo SDK 54 / React Native 0.81.5**, nova arquitetura ligada (`newArchEnabled=true`), TypeScript, Reanimated 4.1 + worklets 0.5.1, react-native-svg 15.12, WebView 13.15 (já usado no globo da Rádio).
- **Android é o alvo real**: não existe pasta `ios/`, o CI só compila APK, e os módulos próprios em Kotlin (`modo-playback` Media3, `modo-notif`, `modo-apk`) são Android-only. As quatro ABIs saem num APK universal (v1.4.4 = **55,7 MB**).
- Música do usuário = **Media3** (`TapePlaybackService` é o único dono do ExoPlayer). Regra do projeto: nunca tocar expo-audio e Media3 juntos; sons do app são **opcionais, desligados por padrão** (`SoundFX.ts`).
- Testes: `node --test` sobre lógica pura (CI `check.yml`), Playwright sobre react-native-web, `tsc` + `expo export` + APK.

Consequência: o jogo precisa **(a)** conviver com o player Media3 sem derrubá-lo, **(b)** respeitar "som desligado por padrão", **(c)** ser testável no CI como o resto do app.

## 2. Opções avaliadas

Notas de 1 (ruim) a 5 (ótimo). Tamanho e desempenho são **estimativas a confirmar no M1**; só o peso do APK atual e do áudio foram medidos.

| Critério | A. WebView (HTML atual) | B. Godot 4 embutido | **C. Motor TS + Skia + áudio Kotlin** | D. Kotlin puro (SurfaceView) | E. Reanimated + Views |
|---|---|---|---|---|---|
| Fidelidade (física/gameplay já aprovados) | 5 | 2 (reescrita total) | 4 (porte número a número, com testes de paridade) | 3 (reescrita) | 4 |
| Integração com o app (tema, navegação, salvar, ciclo de vida) | 4 | 1 (Activity separada, exportação própria) | **5** | 3 | 5 |
| Tamanho no APK | 5 | 1 (runtime grande por ABI) | 3 (Skia adiciona libs nativas por ABI) | 5 | 5 |
| Desempenho de quadro | 3 (WebView, entrada com latência) | 5 | 4 (desenho na GPU; laço sem ponte por quadro) | 5 | 3 (dezenas de views animadas) |
| Áudio de baixa latência | 2 (`new Audio`) | 4 | 4 (módulo Kotlin) | 5 | 4 (módulo Kotlin) |
| Offline | 5 | 5 | 5 | 5 | 5 |
| Testável no CI | 3 (Chromium) | 2 (precisa Godot headless) | **5** (motor em Node + robôs) | 2 (sem emulador; Robolectric não roda no proxy) | 5 |
| Manutenção | 2 | 2 (outra linguagem/editor) | 4 | 3 | 4 |
| iOS no futuro | 4 | 5 | 4 (Skia e motor portáveis; áudio por módulo) | 0 | 5 |
| "É nativo?" (pedido do briefing) | **não** | sim | sim | sim | sim |

Leitura:
- **A** serve só como ponte (e é rejeitada como entrega final pelo briefing).
- **B** é a melhor em potência bruta, mas é a pior integração com Expo: exige exportar/embutir o Godot, outra cadeia de build no CI, e dobra a manutenção. O jogo (um scroller vertical 2D com ~30 sprites) não precisa dela.
- **D** dá o menor APK e o melhor desempenho, mas joga fora a testabilidade que o projeto já exige no CI e separa a lógica do resto do app.
- **E** é o plano B sem dependência nova; fica limitado em partículas e plataformas simultâneas.

## 3. Recomendação: **C**, com o renderizador atrás de uma interface

```
native/src/arcade/
  core/        TS puro, sem React nem Skia. É o jogo.
    sim.ts         passo fixo 1/120 s, integração exata (Verlet: a altura do salto não depende do dt)
    rng.ts         PRNG semeado (mulberry32); mundo gerado em *blocos* por (semente, índice do bloco)
    physics.ts     salto, vento do Cristal, esteira, deriva do Mecânico, colisões por caixas
    worldgen.ts    plataformas/itens/inimigos por bloco + validador de alcance
    director.ts    ritmo (PACING), calma/respiro, portais, checkpoints, níveis
    entities.ts    drone, zigue-zague, torre, clipe, orbe, guardião, projéteis
    modes/         arcade, desafio, sobrevivência, fitas, dobra dupla, fantasma…
  data/        JSON: mundos, ritmo, plataformas, inimigos, poderes, cues de música
  render/      DrawList (o que desenhar) + SkiaRenderer; atlas com pivô/hitbox/fps por quadro
  input/       zonas de toque, inclinação (opcional), esquema canhoto, sensibilidade
  audio/       fachada JS → módulo Kotlin `modo-arcade-audio`
  ui/          ArcadeScreen, seleção, HUD, pausa, fim de jogo (componentes do app: C, R, INK, Barlow/DM Sans)
  save.ts      recordes/cosméticos/ajustes (AsyncStorage) + entrada no backup
  unlock.ts    desbloqueio
modules/modo-arcade-audio/   Kotlin: SoundPool (efeitos) + dois players com crossfade (música)
```

Decisões:

1. **Motor separado do desenho.** O `core` produz uma *DrawList* por quadro (sprite, x, y, quadro, espelho, camada). Se o Skia falhar num aparelho, troca-se só o renderizador (E) sem tocar na física. É também o que permite o robô, o fantasma e os testes de paridade.
2. **Passo fixo + interpolação.** Lógica a 120 Hz, desenho na taxa da tela. Corrige P-01 (o ápice do salto hoje varia 187→197 entre 30 e 240 Hz) e acaba com a câmera lenta a baixo fps. Os números aprovados (g=1200, salto 690, mola 930, impulso 835) **não mudam**; o teste de paridade exige ápice 198,75 ± 0,3 em qualquer taxa.
3. **Mundo determinístico.** Cada bloco de plataformas nasce de `(semente, bloco)`, independente do tempo e do quadro (corrige P-02). Um **validador de alcance** roda em CI sobre milhares de sementes e prova que toda plataforma é alcançável do patamar anterior, nos quatro mundos (P-04).
4. **Dados fora do código.** Ritmo, tamanhos, velocidades, recompensas e cronograma de inimigos vão para JSON (`progression.js` já é o embrião). Rebalancear não exige mexer em física.
5. **Quem roda o laço (JS × thread de UI) decide-se por medição no M1**, não por palpite: o `core` é escrito sem fechamentos nem objetos de React para poder rodar nos dois. Meta: 60 fps estáveis (p95 do tempo de quadro ≤ 16,7 ms) no Android de entrada e no seu aparelho; o APK do M1 traz um medidor de FPS escondido para você me devolver o número. **Eu não tenho aparelho aqui**: sem esse retorno, desempenho real fica "não verificado".
6. **Áudio nativo próprio** (`modo-arcade-audio`), separado do `TapePlaybackService`:
   - Efeitos: `SoundPool` (pré-carregado, latência baixa), prioridade e polifonia por tipo, volume por canal, sem pedir foco de áudio → **não pausa a música do usuário**.
   - Música: dois players com **crossfade ancorado no compasso** (cada faixa traz `bpm`, `compassos`, `loopStart/loopEnd` num JSON de *cue*), trocada só em evento grande (mudança de mundo, chefe) — nunca por pulo, escudo, fita ou mola.
   - Mix: sliders separados (música/efeitos), *ducking* leve da música sob efeitos de alto impacto.
   - **Padrão: tudo desligado** até o usuário ligar (regra do projeto). Se o Media3 estiver tocando, a música do jogo fica desligada e só os efeitos opcionais valem.
   - Ciclo de vida: `AppState` → pausa o laço e o áudio ao ir para segundo plano; volta pausado.
7. **Visual.** A moldura (seleção, HUD, pausa, fim de jogo, ajustes) usa o design do Modo Treino (cartões com contorno de tinta, Barlow Condensed/DM Sans). O campo de jogo mantém a identidade do NEON STEP DX (magenta/ciano; Papel em creme). Josperd e Camila entram como no pacote, com atlas e pivôs; inimigos/portais/checkpoint continuam **desenhos simples em vetor** (como no protótipo limpo) até aprovação de arte nova.
8. **Desbloqueio** (decisão minha, já adiantada): tocar **7 vezes seguidas no número da versão** em Ajustes; aparece "Fliperama" e o estado fica salvo. Os outros dois easter eggs ficam reservados.
9. **Persistência.** `arcade.v1` no AsyncStorage: recorde por modo × personagem × mundo, cosméticos desbloqueados, ajustes. Entra no backup/exportação junto com o resto; por regra do projeto, o esquema novo de backup vai em `shared/logic.js` **com teste**.

## 4. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Versão do `@shopify/react-native-skia` compatível com Expo 54 / worklets 0.5.1 (a 2.14 pede worklets ≥ 0.7) | fixar a série compatível com RN 0.81; provar no M1 com `tsc`, `expo export` e APK no CI; se não fechar, cair para E |
| Peso (Skia por ABI + áudio) sobre um APK de 55,7 MB | medir no M1; orçamento de áudio ≤ 12 MB (hoje 26,8 MB); avaliar divisão por ABI no release |
| Laço no JS com tranco de GC | `core` sem alocação por quadro (pools); mede-se no M1; plano de mover para a thread de UI |
| Verificação visual limitada: não tenho aparelho nem emulador | prints via Skia-web (CanvasKit) no Playwright + você testa cada APK; marco "não verificado em aparelho" no changelog |
| HyperOS/Xiaomi (já nos mordeu em instalador e fonte de notificação) | teste no seu aparelho em cada marco; nada de `REQUEST_INSTALL_PACKAGES` |
| Direitos da música | ver `00-AUDITORIA.md` §4 e Fase 3 do plano |
