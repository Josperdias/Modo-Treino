# MODO TREINO — by Josperd

Um diário de treino pessoal, autoral e ilustrado. Treino A (6 exercícios) e Treino B (8 exercícios), personagens Josperd e Camila Camomila, a ruivinha. Desenvolvido como site/PWA offline e aplicativo React Native/Expo (base instalável a compilar).

## Site

Abra `site/index.html` para inspeção básica. Para usar o PWA, a biblioteca musical persistente e o service worker com segurança, **sirva o diretório `site/` via HTTPS ou localhost**:

```bash
cd site
python3 -m http.server 8000
# depois: http://localhost:8000
```

Em um navegador compatível, menu > Instalar aplicativo / Adicionar à tela inicial. O site não exige cadastro, guarda registros dos treinos em localStorage e arquivos de áudio em IndexedDB. Músicas locais permanecem somente neste dispositivo e podem ser removidas. A página "Música" permite importar faixas, criar/renomear fitas, colocar faixas em ordem, reproduzir, pausar, avançar e aplicar crossfade de 0–8 segundos. Os links de YouTube / YouTube Music são atalhos externos, reproduzidos somente pelo player oficial. **O site não baixa músicas do YouTube ou Morphe.**

## Aplicativo Android / iOS

Projeto em `native/` (Expo SDK 54). Instale Node 20+ e rode:

```bash
cd native
npm install
npx expo start
```

Use Expo Go ou development build para validar no aparelho. Gerar APK/AAB ou TestFlight exige configuração local/EAS da conta do desenvolvedor. **Nenhum APK/IPA foi compilado nesta entrega**, tampouco houve verificação em dispositivo real. O app native usa `expo-audio` (dois canais para crossfade), `expo-document-picker` e `expo-file-system` para copiar músicas escolhidas pelo usuário ao armazenamento privado. Metadados e playlists salvos com AsyncStorage. Os controles compactos ficam visíveis nas telas de treino. Background playback está configurado para builds nativas, mas precisa ser verificado em aparelhos físicos.

## Ilustrações e personagem

- Arte do autor recebida na conversa, utilizada apenas neste projeto do usuário.
- Camila é chamada de **ruivinha** no conteúdo; nomes de arquivo antigos `*_loira.png` foram preservados por compatibilidade técnica.
- Se não houver imagem de Camila para um exercício, o app usa a versão de Josperd e mostra aviso.
- Se não houver imagem de movimento para nenhum dos dois, exibe capa decorativa de Josperd com o rótulo **SEM IMAGEM DO EXERCÍCIO**, não uma demonstração incorreta.
- O Treino B tem séries/repetições provisórias de teste, editáveis; a notação ambígua no treino A também está sinalizada.

## Dependências / créditos

A ideia de crossfade toma como referências conceituais [howler.js](https://github.com/goldfire/howler.js) (MIT) e [Gapless-5](https://github.com/regosen/Gapless-5) (MIT). O mecanismo entregue é implementação própria com elementos `Audio` independentes na web e com Expo Audio nativamente; **não há código desses repositórios copiado ou distribuído**.

A família Le Cartoonie não está embutida; para utilizar a fonte exata, forneça um arquivo de fonte com licença adequada. O site aplica Barlow Condensed / DM Sans com fallbacks locais. Esta entrega não inclui font files de terceiros.

## Estrutura

```text
site/                Site responsivo / PWA / toca-fitas e treino
native/              React Native + Expo com leitor de música nativa
screenshots/         Capturas renderizadas da interface web
CLAUDE.md            Regras para colaboração por pull requests
.github/workflows/   Verificação estática no GitHub Actions
```

## GitHub

Este pacote contém repositório Git local com branch `main`. Não foi criado nem configurado um remoto no GitHub; configure com um repositório privado de sua propriedade. Consulte `CLAUDE.md` antes de liberar PRs de bots ou agentes. Recomenda-se permitir merges apenas de PRs com CI verde e revisão humana, não autorizar push direto na branch principal.

## Privacidade e limitações

Site e app guardam treino e música localmente. Sem servidor ou sincronização entre dispositivos. O navegador pode suspender reprodução em segundo plano, especialmente no iOS; a versão nativa exige build e testes específicos. Nenhuma imagem precisa ser perfeita para orientar um exercício, consulte um profissional para cargas e execução adequada.

## Biblioteca de sons (v1.0.1)

Acesse **Ajustes → Biblioteca de sons**. Todos os efeitos começam desativados e podem ser silenciados com um toque. São fornecidos três pacotes locais originais (`Suave`, `Arcade`, `Minimal`), com prévia, volume e controles individuais para:

- feedback opcional nos botões;
- confirmação de uma série;
- conclusão de todo o treino;
- aviso ao terminar descanso;
- contagem 3, 2, 1, em bipes ou voz sintetizada em português.

Os sons são arquivos WAV próprios, sem faixas comerciais. A biblioteca de músicas importadas pelo usuário permanece separada; as playlists continuam sob controle do usuário. Gerar os arquivos novamente: `python3 scripts/generate_sounds.py` (requer `numpy` e `espeak` para voz).

## GitHub Actions para APK de teste e releases

Ao criar o repositório **Josperdias/modo-treino** e enviar o projeto (incluindo `.github/workflows/`):

1. Abra **Actions → Android - APK de teste → Run workflow**.
2. Aguarde o job `Build Android APK debug`; baixe o artefato `modo-treino-android-debug`.
3. Extraia `app-debug.apk` e instale em um aparelho Android de teste, após conferir a origem. Não é APK de produção.
4. Opcionalmente crie uma tag `v1.0.1` para publicar uma prerelease com o APK anexado.

Se preferir Expo/EAS, `native/eas.json` contém um perfil `preview` para APK. `npx eas-cli build --platform android --profile preview` exige login/configuração no Expo. **Nenhum APK foi gerado neste ambiente.**

### Como autenticar no GitHub com segurança

Não registre senhas, chaves de API ou tokens no código, no Drive ou com o Claude. Em sua máquina, `gh auth login` usa o fluxo oficial e `gh repo create Josperdias/modo-treino --private --source=. --remote=origin --push` cria o remoto e envia o código. Se preferir SSH, crie sua chave no computador com `ssh-keygen -t ed25519 -C "seu-email"`, adicione **somente a chave pública** (`id_ed25519.pub`) em GitHub → Settings → SSH and GPG keys. Guarde a chave privada fora de qualquer pasta compartilhada. A instalação GitHub App do Claude deve ter o menor conjunto de permissões necessário; permita branches/PRs, não dê bypass de `main`.

**Avisos de versão:** A consulta busca releases públicas (incluindo prereleases) e consulta o commit mais recente na web. No Android a checagem ocorre ao abrir/retomar o app conectado; não é push em tempo real e não faz instalação automática. Para manter o repositório privado, implementar um backend autenticado para avisos; nunca inserir token de GitHub no cliente.
