# Manutenção do Modo Treino

## Lançar uma versão nova (e fazer o app/site avisarem)

O aviso só aparece quando o número da release é **maior** que o instalado, então a versão precisa subir.

1. `node scripts/bump-version.mjs 1.3.0` (muda os 6 lugares: `package.json`, `native/package.json`, `native/app.json`, `native/App.tsx`, `site/updates.js`, `site/sw.js`).
2. `python3 tests/verify.py` (confere que a versão é única) e atualize o `CHANGELOG.md`.
3. Abra o PR e espere o CI ficar verde. Dê o merge (o site é republicado sozinho pelo `pages.yml`).
4. **Actions → "Android - APK" → Run workflow**, marcando **publicar**. O workflow compila o APK (`modo-treino-X.Y.Z.apk`), confere pacote/assinatura, calcula o **SHA-256** e cria a **release `vX.Y.Z`** com o APK anexado e as **novidades** (a seção da versão no `CHANGELOG.md`, antes da linha `---`; o app mostra esse trecho no aviso). (Empurrar uma tag `v*` faz o mesmo.)
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

## Rádio do mundo (globo 3D)
- O globo é **uma página HTML única e autocontida**: `native/assets/globe/globe.html` (three.js + globe.gl + mapa Natural Earth, sem rede). O app a carrega numa WebView só na tela de Rádio.
- Para regenerar depois de mexer em `scripts/globe/*`: `npm ci && node scripts/build-globe.mjs` (usa esbuild). Créditos em `native/assets/globe/LICENSES.txt`.
- Estações vêm do **Radio Browser** (`native/src/radio/api.ts`): servidores `de1/de2/fi1/nl1/at1.api.radio-browser.info`, cópia local por 3 dias. O app avisa o diretório de cada estação ouvida (boa prática do serviço).
- `app.json` libera tráfego `http` (`usesCleartextTraffic`) porque muitas rádios ainda não têm https.
- Para testar sem internet: abra `globe.html?demo=1` no navegador.
- **Nome da faixa (ICY)**: a própria página do globo (`scripts/globe/icy.js`) abre uma conexão curta ao stream com `Icy-MetaData: 1`, lê 1–3 blocos de metadados e fecha. No Android a página é aberta como `file://` (cópia em cache) com `allowUniversalAccessFromFileURLs`, senão o CORS das rádios bloquearia a leitura. Rádios sem ICY (HLS, alguns AAC) não têm nome de faixa; isso é esperado. Teste: `node --test tests/icy.test.mjs`.
- **Desempenho**: a aba Rádio manda `pause`/`resume` ao globo ao entrar/sair; sem isso o WebGL continua desenhando escondido e trava as outras abas.
- **versionCode**: `node scripts/bump-version.mjs X.Y.Z` também grava `android.versionCode` (X*10000+Y*100+Z).
- Fontes (Barlow Condensed e DM Sans, OFL) vêm dos pacotes `@expo-google-fonts/*`.

## Vocabulário da música (app)
- **Fita** = cada música do celular (um cassete por música). **Bag** = playlist de fitas e/ou rádios. **Rádio** = globo 3D; rádios entram nas bags.
- No código, a bag é o tipo `Tape` em `native/src/music/MusicProvider.tsx` (nome histórico, guardado no armazenamento; não renomear sem migração).

## Atualização dentro do app
- O app consulta `api.github.com/.../releases`, mostra o aviso no topo (`native/src/UpdateBanner.tsx`) e, no Android, baixa o APK para o cache e abre o instalador (`expo-intent-launcher`, permissão `REQUEST_INSTALL_PACKAGES`). Confere só o **tamanho**; quem garante a autenticidade é o Android, que só aceita atualização assinada com a mesma chave.
- **Não renomeie o APK** de forma que o app deixe de achá-lo: ele procura o primeiro asset `*.apk` da release.

## Verificação de desenvolvedor do Google (Play Protect "App blocked")
- Desde 30/09/2026 (Brasil, Indonésia, Singapura e Tailândia) o Google bloqueia nos aparelhos certificados apps de desenvolvedores não verificados. Para registrar: **Android Developer Console** → verificar a conta → registrar o pacote **`art.josperd.modotreino`** com o certificado de assinatura (SHA-256 `5F:68:FF:14:07:2B:0E:C2:81:BE:B6:DA:27:30:58:64:75:E6:C3:68:02:72:23:64:7A:B1:B5:E2:46:1D:44:73`). Isso depende da conta Google do dono; não dá para resolver só no código.
