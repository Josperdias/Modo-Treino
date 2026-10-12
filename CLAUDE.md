# Colaboração com Claude — Modo Treino

Projeto proprietário/pessoal de Josperd. Preservar o universo dos personagens, a identidade editorial, e as ilustrações. Personagem Camila Camomila = **ruivinha**. Não renomear a personagem para "loira" em elementos visíveis.

## Fluxo Git

- `main` é estável; criar branches `feat/*`, `fix/*`, `art/*`, `chore/*`.
- Pull requests pequenos com: resumo, lista de telas afetadas, testes e screenshots responsivas.
- Nunca mesclar automaticamente mudanças não testadas em `main`.
- GitHub Actions verifica JavaScript, JSON e presença das 14 fichas; futuras ações CI nativas podem rodar typecheck com dependências instaladas.
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
- Native: `cd native && npm install && npx expo start`
- Quick check: `python3 tests/verify.py`

## Sons opcionais (v1.0.1)

- O usuário deve optar explicitamente por ativar sons. **Padrão: desligado**.
- Preservar toggles independentes: botão, série, fim de descanso, conclusão de treino, contagem 3-2-1, voz/bipe e volume.
- Pacotes `suave`, `arcade` e `minimal` são sinais originais gerados com `scripts/generate_sounds.py`, WAV local para site e nativo. Voz 3-2-1 gerada em pt-br por espeak; não adicionar músicas comerciais embutidas.
- Regressões importantes: música de usuário não deve parar ao tocar um efeito; ausência de permissão de áudio nunca impede salvar uma série.
- Testar com aparelho Android real: áudio em primeiro e segundo plano, troca de personagem, upload de MP3/M4A, retomada do player e cronômetro.
- O aplicativo apresenta sugestões/avisos ao **abrir/retomar** com internet; notificações push remotas em tempo real exigem backend dedicado e ainda NÃO estão implementadas.

## APK de teste

- O projeto contém `.github/workflows/android-apk.yml` com `workflow_dispatch` e tags `v*`.
- Workflow gera APK debug, publicado em Actions > Artifacts. Tag gera prerelease com APK de teste.
- Para release Android público, usar APK assinado com distribuição adequada e revisão de permissões. Não confundir debug com versão de produção.
- `native/eas.json` permite `eas build --platform android --profile preview` depois que o proprietário autenticar e configurar o projeto no Expo.
