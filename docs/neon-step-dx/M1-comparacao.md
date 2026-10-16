# NEON STEP DX — M1: comparação com o protótipo HTML

M1 = vertical slice jogável (Cidade Neon, Josperd e Camila, toque/inclinação, pausa, recorde, desbloqueio). Tudo abaixo foi **medido** (scripts em `baseline/`); o que não pude medir está marcado.

![protótipo × nativo](../../screenshots/m1-neon-step/comparacao-prototipo-vs-nativo.png)

## 1. Física (o modelo físico adotado e a paridade)

Referência teórica do salto: v²/2g = 690²/2400 = **198,375 un.**

| | Protótipo (semi-implícito, dt variável) | Nativo M1 (Verlet exato, passo fixo 1/120 s) |
|---|---|---|
| Ápice a 30 Hz | 187,0 | **198,375** |
| Ápice a 60 Hz | 192,7 | **198,375** |
| Ápice a 120 Hz | 195,5 | **198,375** |
| Ápice a 240 Hz | 196,9 | **198,375** |
| Mesma partida em 30/60/120/144/240 Hz | resultados diferentes | **mesmo estado final** (hash idêntico, teste) |
| Abaixo de ~31 fps | câmera lenta (dt limitado a 32 ms) | segue em tempo real (até 24 passos por quadro) |
| Ápice após pousar (qualquer altura) | — | 198,375 ± 0,02 (sub-passo exato, teste com 5 alturas) |

Os números aprovados (g 1200, salto 690, mola 930, impulso 835, velocidade lateral 282+) **não mudaram**. O salto sobe 3 % a mais que o protótipo a 60 Hz (192,7 → 198,375); os degraus do mundo foram dimensionados para o novo modelo (nunca passam de 78 % do ápice).

## 2. Distribuição de plataformas (a queixa: "distribuição de piso muito ruim")

Protótipo: cada plataforma sorteada sozinha (lateral aleatória, largura quase fixa). Nativo: **padrões** (degraus, torre, bifurcação, móveis, zigue-zague, mola, quebráveis, plataforma larga de respiro) com ritmo de tensão/respiro por altitude e primeiros 28 m só de degraus fáceis. 40 sementes × 1 500 plataformas cada.

**Protótipo**

| Altitude (m) | Degrau (un.) | Desvio lateral (un.) | Laterais > 120 | Seq. média p/ o mesmo lado | Seq. ≥ 3 | Largura (un.) | Plataformas especiais |
|---|---|---|---|---|---|---|---|
| 0-70 | 103.3 ± 7.4 | 49.2 ± 32.9 | 0 % | 1.53 | 10.9 % | 92 (mín. 92) | 0 % |
| 70-145 | 106.9 ± 9.1 | 41.2 ± 34.5 | 0 % | 1.61 | 14.1 % | 86.9 (mín. 74) | 16.5 % |
| 145-245 | 111.2 ± 9.7 | 48.1 ± 37.6 | 0 % | 1.73 | 15.8 % | 82.5 (mín. 71) | 27.5 % |
| 245-360 | 115.5 ± 11.5 | 52.5 ± 38.2 | 3.5 % | 1.5 | 9.8 % | 78.2 (mín. 62) | 29.1 % |
| 360-∞ | 119.4 ± 12.4 | 50.3 ± 39.3 | 4.4 % | 1.71 | 17.8 % | 73.4 (mín. 58) | 32.5 % |

**Nativo M1**

| Altitude (m) | Degrau (un.) | Desvio lateral (un.) | Laterais > 120 | Seq. média p/ o mesmo lado | Seq. ≥ 3 | Largura (un.) | Plataformas especiais |
|---|---|---|---|---|---|---|---|
| 0-70 | 96.6 ± 7.7 | 40.4 ± 23.5 | 0 % | 2.18 | 36.1 % | 102.9 (mín. 93) | 0 % |
| 70-145 | 98.9 ± 8.5 | 43 ± 25 | 0 % | 1.92 | 25.7 % | 98.2 (mín. 87) | 0 % |
| 145-245 | 105.7 ± 14.6 | 47.4 ± 34.5 | 4.5 % | 1.81 | 25 % | 90.2 (mín. 70) | 6.8 % |
| 245-360 | 113.6 ± 21.8 | 54.4 ± 40.8 | 9.9 % | 1.82 | 22.8 % | 81.9 (mín. 65) | 17 % |
| 360-∞ | 115.1 ± 21.9 | 60 ± 42.4 | 12.4 % | 1.93 | 25.5 % | 79.8 (mín. 57) | 13.8 % |

Leitura:
- A **estrutura** está nas sequências: no nativo 23–36 % das plataformas formam sequências de 3 ou mais para o mesmo lado (escadas legíveis) contra 10–18 % no protótipo, e há zigue-zagues deliberados, bifurcações com escolha e respiros garantidos (a regra força um respiro depois de 6 padrões tensos; o teste tolera até 8).
- **Largura** das plataformas varia com a altitude (103 → 80 un.), em vez de quase fixa; **desvios laterais** maiores (até 160) só aparecem em zigue-zague, com degrau menor.
- Degraus de 225–268 un. nas faixas altas são o **lançamento da mola** (ápice 360), sempre com plataforma larga no destino e fitas no caminho.
- Ainda não há esteira nem plataforma estreita (virão com os mundos, M2).

## 3. Jogabilidade provada por robôs (testes automáticos, 100 % reprodutíveis)

| Robô | Reação / erro de mira | Resultado |
|---|---|---|
| Ideal | imediata, sem erro | 0 quedas em 25 sementes × 240 s (> 1 500 m em todas) |
| Humano | 150 ms, ±14 un., 6 % de descuido | ≤ 3 quedas em 25 sementes × 240 s |
| Descuidado | 250 ms, ±30 un., 10 % de descuido | 15 a 29 quedas em 30 sementes × 300 s; mediana > 300 m |

(O robô do protótipo do baseline é outro e o protótipo não tem semente: comparar números absolutos entre os dois seria enganoso. O que vale é: no nativo o mundo é **provadamente** alcançável; no protótipo isso nunca foi provado.)

## 4. Desempenho

| Medida | Protótipo (desktop) | Nativo M1 |
|---|---|---|
| Custo da simulação | ≈ 0,007 ms/quadro (Chromium) | **2.03 µs por passo** (≈ 4.05 µs por quadro a 60 Hz, Node) |
| Custo de desenho (lado JS) | ≈ 1,3 ms/quadro (canvas 2D, Chromium) | ≈ 1.24 ms/quadro (gravar o `Picture`, Chromium + SwiftShader) |
| Memória em sessão longa | não medido | **estável**: heap 7.52 → 7.53 MB em 30 min simulados (23463 m); ≤ 22 plataformas e ≤ 10 itens vivos |
| FPS em celular | não medido | **NÃO MEDIDO** — o APK traz o medidor (Pausa → Medidor de desempenho); preciso do número do seu aparelho |

O FPS do Chromium sem GPU (≈ 34.3 fps, p95 83.4 ms) é limitado pelo WebGL por **software** do ambiente de teste e **não representa um celular**. Também não verifiquei em aparelho: inclinação, toque multi-dedo real, vibração e o consumo de memória nativa do Skia (por isso os `Picture` antigos são liberados com `dispose()`).

## 5. Telas cobertas por teste de interface (12 testes no Chromium, Skia/CanvasKit real)

Desbloqueio (6 toques não bastam; dica só a partir do 4º; pausa > 1,5 s zera; persiste ao recarregar) · seleção e recordes por personagem · o Skia **pinta de verdade** (cores, plataformas) · teclado · **toque multi-dedo** (direita +1, esquerda −1, os dois 0, soltar um dedo com o outro na tela) · pausa congela e retoma sem salto de tempo · medidor e configurações salvos · fim de jogo grava o recorde e permite jogar de novo · layout em 360×640, 393×852 e 412×915 · sair · desempenho. Esse conjunto achou **um bug real de controle** (soltar um dedo com o outro apoiado não atualizava o eixo), já corrigido.

## 6. Capturas

`screenshots/m1-neon-step/`: `00-ajustes-fliperama`, `01-selecao`, `01b-selecao-camila`, `02-jogando`, `03-pausa`, `04-medidor`, `05-fim`, `06-layout-*`, `comparacao-prototipo-vs-nativo`.

## 7. O que ficou de fora de propósito (M2 em diante)

Inimigos/projéteis/poderes/portais e os outros mundos · checkpoint na Cidade Neon · Papel com itens e portal espelhados e regras de troca de personagem por mundo · áudio e música · arte nova (continuam desenhos simples; nada experimental reintroduzido).
