# Manutenção do Modo Treino

## Lançar uma versão nova (e fazer o app/site avisarem)

O aviso só aparece quando o número da release é **maior** que o instalado, então a versão precisa subir.

1. `node scripts/bump-version.mjs 1.3.0` (muda os 6 lugares: `package.json`, `native/package.json`, `native/app.json`, `native/App.tsx`, `site/updates.js`, `site/sw.js`).
2. `python3 tests/verify.py` (confere que a versão é única) e atualize o `CHANGELOG.md`.
3. Abra o PR e espere o CI ficar verde. Dê o merge (o site é republicado sozinho pelo `pages.yml`).
4. **Actions → "Android - APK de teste" → Run workflow**, marcando **publicar**. O workflow compila o APK, confere pacote/assinatura, calcula o **SHA-256** e cria a **pré-release `v1.2.0`** com o APK anexado. (Empurrar uma tag `v*` faz o mesmo.)
5. Pronto: a página `/baixar/` passa a mostrar o novo APK e o app/site avisam quem estiver numa versão menor.

## Ativar o site (GitHub Pages), uma vez só
Settings → Pages → **Build and deployment → Source: GitHub Actions**. Depois o `pages.yml` publica a pasta `site/` em
`https://josperdias.github.io/Modo-Treino/` (a página de download fica em `/baixar/`). Sem esse passo o job falha em *Configure Pages*.

## Proteger a `main` e liberar merge automático
Veja [LIBERAR-MERGE.md](LIBERAR-MERGE.md) e os JSONs prontos em [exemplos/](exemplos/).

## O que o app faz sobre atualizações (e o que não faz)
- Consulta `api.github.com/repos/Josperdias/Modo-Treino/releases` ao abrir/retomar, usa a **maior** release (não a primeira da lista) e só abre links `https://github.com/Josperdias/...`.
- **Repositório público:** a consulta não precisa de token. **Repositório privado** exigiria um serviço próprio e seguro de atualização; **nunca** coloque token do GitHub no app ou no site.
- Não há push em tempo real nem instalação automática.

## Autenticar no GitHub com segurança
Não registre senhas, chaves ou tokens no código, no Drive nem em conversa. Use `gh auth login` na sua máquina. Para SSH, crie a chave
localmente (`ssh-keygen -t ed25519`) e cadastre **somente a chave pública**. Dê ao app do Claude o menor conjunto de permissões necessário.

## APK: o que é e o que não é
- `assembleRelease` embute o JavaScript (um `assembleDebug` abriria em tela vermelha sem servidor Metro).
- **Assinatura**: com os 4 secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` o workflow assina com a chave própria (`scripts/assinar-android.mjs` ajusta o `build.gradle` gerado; o build falha se o certificado não for `CN=Modo Treino`). Sem eles (ex.: PR de fork) usa a chave de **depuração** do template Expo. Use sempre a **mesma** chave: trocar de chave impede atualizar por cima (precisa desinstalar). Guarde o `.jks` e as senhas fora do repositório (`*.jks` está no `.gitignore`); perdida a chave, não há como atualizar quem já instalou. Isto não é build da Play Store (faltaria revisão de permissões).
- ABIs: `arm64-v8a` e `armeabi-v7a` (aparelhos físicos; não roda em emulador x86).
- Os assets do app precisam ter a **extensão igual ao formato real** (`tests/verify.py` confere): JPEG com nome `.png` derruba o `aapt2`.

## Testes
- `npm test`: estrutura, lógica compartilhada, versão única, fontes, service worker e varredura de segredos.
- `npm run test:e2e`: site no Chromium (precisa de `npx playwright install chromium`).
- Interface do app: `cd native && npm i --no-save react-native-web@~0.21.0 react-dom@19.1.0 @expo/metro-runtime@~6.1.2 && npx expo export --platform web --output-dir ../dist-web`, depois `NATIVE_WEB_DIR=dist-web node --test tests/e2e/native-web.e2e.mjs`.
- **Não substitui** teste em aparelho Android (áudio nativo, seletor de arquivos, compartilhamento, segundo plano).

## Prints reais
`node scripts/capturar-prints.mjs screenshots/<versao> --native <pasta do expo export --platform web>`. Os prints do app vêm de react-native-web, **não de um aparelho**.

## Regras de código
Veja [CLAUDE.md](../CLAUDE.md).
