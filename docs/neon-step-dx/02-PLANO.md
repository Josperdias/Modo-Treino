# NEON STEP DX — Plano de implementação por etapas

> **Status (2026-10-16):** M0 concluído · **M1 entregue** (ver `M1-comparacao.md`; APK jogável pelo CI do PR #17, sem publicar) · M2 em diante aguardam o teste do M1 no aparelho.

## Decisões aprovadas pelo dono (valem para todos os marcos)

1. **Checkpoint também na Cidade Neon**, sem aparecer em excesso e sem facilitar o jogo (M2).
2. **Papel**: os dois personagens participam de verdade — itens, obstáculos, colisões e portais respeitam o espelhamento, **sem duplicar recompensas** (M2).
3. **Troca de personagem entre universos vira mecânica intencional, com regras próprias de cada mundo** (não some). Portais por contato, sem confirmação; evitar = não encostar (M2).
4. **Combate**: só tiro para cima por enquanto; armas e ataques novos em marcos futuros.
5. **Áudio**: orçamento inicial de 12 MB, **preservando o catálogo original de 57 músicas** (o restante poderá virar pacotes de trilhas instaláveis offline); preservar a identidade musical de cada personagem e universo (M3/M4).
6. **Desbloqueio**: 7 toques no número da versão em Ajustes (feito no M1).
7. **Física**: referência v²/2g = 198,375; testes de paridade seguem o modelo adotado (feito no M1).
8. **Sprites**: Josperd e Camila originais; pivôs/alinhamento só por metadados e renderização (feito no M1).
9. Liberdade total de arquitetura/jogo concedida ao Claude, desde que a identidade visual e a estabilidade sejam preservadas. As músicas foram geradas por pedido do dono (via GPT); um prompt de continuidade do dono para a Fase 3 está a caminho.

Cada marco termina num **APK jogável** (artefato do CI no PR), com testes, prints, changelog e comparação com o protótipo web. **Nada é publicado como release sem você mandar** (e, quando mandar, sai publicado, nunca rascunho). Nenhuma arte nova é ligada e nenhuma música existente é substituída sem sua aprovação.

Regra de entrada em cada marco: o anterior está verde no CI e a lista de verificação do briefing (§5) do que ele toca passou.

| Marco | Fase do briefing | Entrega | Critério de saída (o que prova que está pronto) |
|---|---|---|---|
| **M0** | 0 Auditoria | `00-AUDITORIA.md`, `01-ARQUITETURA.md`, este plano, `baseline/` (script + resultado). **Concluído agora.** | você aprova arquitetura e respostas da §5 da auditoria |
| **M1** | 1 Motor + equivalência | **Vertical slice jogável**: fonte preservada em `arcade/fonte/` (protótipo, 16 sprites, MIDI, scripts; **sem** os OGG/MP3, que ficam no Drive até a curadoria); `core` (passo fixo 120 Hz, Verlet, PRNG, mundo por blocos); Cidade Neon com plataformas normais e móveis, itens, fita; seleção Josperd/Camila; toque (e inclinação opcional); HUD/pausa/fim em componentes do app; ciclo de vida; recorde local; desbloqueio por 7 toques na versão; medidor de FPS escondido | testes: **paridade** com o protótipo (ápice 198,375 ± 0,3 a 30/60/120/240 Hz; período do salto; movimento horizontal), **determinismo** (mesma semente ⇒ mesmo estado após N passos), **alcance** (milhares de sementes, 0 plataformas inalcançáveis), desbloqueio; `tsc` + `expo export` + APK no CI; prints; **você me devolve o FPS** do seu aparelho |
| **M2** | 2 Universos e progressão | quatro mundos, todos os tipos de plataforma/inimigo/projétil/poder, portais por contato, checkpoint por mundo **incluindo a Cidade Neon**, Papel com itens e portal espelhados (P-05, P-06), telégrafo de ataque, ondas com respiro, parâmetros em JSON | bateria automática do briefing: início, pausa, troca de personagem, morte por queda, morte por dano, recuperação, 2ª derrota = fim, portal (contato e desvio), Papel (sem travessia do centro), sessão simulada de 30 min sem crescer memória, robôs de 3 níveis dentro dos orçamentos de dificuldade; portal nunca antes de 92 s/565 un. e nunca sem plataforma de chegada |
| **M3** | 3 (áudio nativo) | módulo Kotlin `modo-arcade-audio`: 30 efeitos com prioridade/polifonia/volumes, música com crossfade no compasso, sliders separados, ducking, **tudo desligado por padrão**, não derruba o Media3, pausa em segundo plano | testes de fila/prioridade em JS; APK compila; checklist de aparelho que você roda (efeito durante música do usuário, bloqueio de tela, chamada, fone) |
| **M4** | 3 (direção musical) | relatório de análise por faixa (tonalidade/modo, frases, ritmo harmônico, conflitos de timbre), **piloto no Papel (4 faixas)** com A/B + MIDI; depois temas longos por mundo (≥ 90–120 s sem repetir o mesmo laço), transições e catálogo versionado, **ledger de licenças**, curadoria até ≤ 12 MB | você escuta o A/B e aprova faixa por faixa; nenhuma original é sobrescrita (ficam versionadas); loop sem clique e transição no compasso verificados por script |
| **M5** | 4 Arte de produção | bíblia visual, padrão de sprite-sheet (grade, pivô, hitbox, fps, nomenclatura), **propostas isoladas** de inimigos/portais/checkpoint/guardiões em `arcade/propostas/` ao lado dos personagens, parallax discreto | validação visual sua antes de qualquer integração; a integração só do que você aprovar |
| **M6** | 5 Expansões | modos (arcade, desafio cronometrado, sobrevivência, missão de fitas, dobra dupla, fantasma local), guardião por mundo, missões, cosméticos sem paywall, recordes por modo | cada modo atrás de sinalizador e com testes próprios; o modo principal não regride (suíte do M2 continua verde) |
| **M7** | 6 Produto | perfis de desempenho (entrada/médio), acessibilidade (contraste, reduzir tremor/flash, tamanho de toque, canhoto), logs de falha só locais, backup, orçamento de APK, bateria de QA no aparelho, candidato a release | seu teste no aparelho real; você decide publicar |

## O que entra no repositório e quando

- **Já (M0):** só documentos e o script de baseline (pequenos).
- **M1:** código-fonte do protótipo, sprites oficiais, MIDI e scripts em `arcade/fonte/` (controle de versão do que não pode se perder). Áudio renderizado **não** entra até a curadoria (27 MB de binário em Git é caminho sem volta); ele continua na sua pasta do Drive.
- **Convenções:** `CLAUDE.md` ganha uma seção "Arcade" no M1 (estrutura, regras de determinismo, áudio opcional); a regra de "versão única" e o CI continuam valendo.

## Lista priorizada de melhorias (entregável 6 do briefing)

1. Passo fixo + semente + alcance provado (P-01/02/04): base de tudo.
2. Checkpoint na Cidade Neon e itens/portal espelhados no Papel (P-05/06).
3. Áudio nativo com tudo desligado por padrão e sem tocar o Media3 (P-18/19/20).
4. Música: temas longos e troca no compasso (P-15/16/17) + faixas especiais ligadas (P-27).
5. Orçamento de peso (P-21) e ledger de licenças (P-22).
6. Atlas com pivô por quadro, hitboxes explícitas (P-09/12/13).
7. Controles: inclinação, canhoto, sensibilidade, reduzir tremor/flash (P-25).
8. Arte nova (inimigos/portais/checkpoint/chefes), só como proposta.
9. Modos extras, cosméticos, fantasma.

## Decisões que preciso de você (ou assumo o padrão indicado)

Ver `00-AUDITORIA.md` §5. Resumo do que assumo se você só disser "pode seguir":
checkpoint também na Cidade Neon · itens e portal espelhados no Papel · sem troca automática de personagem ao atravessar portal · tiro só para cima · áudio ≤ 12 MB · stack do `01-ARQUITETURA.md` (opção C, com a E como plano B se o Skia não fechar no M1).
