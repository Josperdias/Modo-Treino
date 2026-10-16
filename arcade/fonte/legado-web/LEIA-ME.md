# NEON STEP DX — Multiverso 1.2

Abra `index.html` num servidor local para carregar os arquivos separados, ou use o HTML único offline que acompanha a entrega. Para testes locais: `python -m http.server 8000` e abra `http://localhost:8000`.

## Novidades

- Inimigos a partir de ~21s de tempo ativo, e disparos após ~32s. Estão presentes drones, zigue-zague, torres, clipes de papel e guardiões (mais os orbes anteriores).
- Primeiro poder raro após ~66s; primeiro portal após pelo menos ~92s e progresso suficiente; próximos portais após ~112s de exploração.
- Checkpoint automático a cada novo universo: uma recuperação por mundo, com duas vidas.
- Oito frames da Camila novamente extraídos da sprite sheet original, sem cortes de cabelo, mãos ou botas.
- Quatro músicas originais exclusivas do Universo de Papel: OGG para o jogo e MIDI editável na pasta assets/audio/paper/.
- Estrutura modular: progression.js, worlds.js, game.js, music-director.js, paper-soundtrack.js, audio-effects.js, audio-catalog.js e styles.css.

A música não é trocada a cada poder coletado. A mudança de mundo utiliza crossfade. O player de músicas exclusivo está em `OUVIR_MUSICAS_UNIVERSO_DE_PAPEL.html`.

Consulte `GUIA_V12_E_PROXIMOS_PASSOS.md` para análise técnica e prioridades da próxima etapa.
