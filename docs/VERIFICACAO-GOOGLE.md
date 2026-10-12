# Registrar o Modo Treino no Google (para o Play Protect parar de bloquear)

**Problema:** o Android mostra *"App blocked to protect your device — Play Protect hasn't seen an app from this developer before"*.
Segundo o que a imprensa divulgou (Google, 06/2026), desde **30/09/2026** o Brasil exige que apps instalados fora da Play Store
venham de **desenvolvedor verificado**. Isso **não se resolve no código**: depende de uma conta Google do dono.
(Não consegui abrir a página oficial do Google daqui; confira os passos lá.)

## O que você precisa (já está pronto)
| Campo | Valor |
|---|---|
| Nome do pacote | `art.josperd.modotreino` |
| SHA-256 do certificado de assinatura | `5F:68:FF:14:07:2B:0E:C2:81:BE:B6:DA:27:30:58:64:75:E6:C3:68:02:72:23:64:7A:B1:B5:E2:46:1D:44:73` |
| Nome do app | Modo Treino |
| Site | https://josperdias.github.io/Modo-Treino/ |
| Código | https://github.com/Josperdias/Modo-Treino |

## Passo a passo (resumo)
1. Procure **"Android Developer Console"** / **"Android developer verification"** (developer.android.com) e entre com a sua conta Google.
2. Escolha a conta **gratuita de hobby/estudante** (a imprensa cita até 20 aparelhos, sem taxa e sem documento; confirme na página do Google).
   Para distribuir a qualquer pessoa, é a conta de desenvolvedor completa (verificação de identidade).
3. **Registre o pacote** `art.josperd.modotreino` e **comprove a chave** (o certificado acima).
4. Aguarde a aprovação. Depois disso, os aparelhos instalam normalmente, sem o bloqueio.

## Enquanto o registro não sai
- Em **More details**, procure **Install anyway**.
- Se não aparecer: Play Store → sua foto → **Play Protect** → ⚙ → desligue **Scan apps with Play Protect** só durante a instalação.
- Segundo o Google, apps não registrados ainda podem ser instalados pelo **fluxo avançado** (opções de desenvolvedor) ou por **ADB**.

## O que o app já faz para ser o mais "limpo" possível
- Assinado sempre com a **mesma chave própria** (nunca a de depuração).
- Só pede o que usa: internet, ler músicas, notificações, áudio em segundo plano. **Sem** microfone, SMS, contatos, localização, acessibilidade, nem as permissões de "badge" de launchers que uma biblioteca trazia.
- Código aberto no GitHub e SHA-256 de cada APK na release.
