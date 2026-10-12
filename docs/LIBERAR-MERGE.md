# Como liberar o merge automático (Claude pode mergear sozinho, com CI verde)

Há **duas camadas independentes**. Faça as duas; a segunda é a que realmente protege a `main`.

## 1) Do lado do Claude (permissão da ferramenta)

Crie o arquivo **`.claude/settings.json`** na raiz do repositório (na `main`) com:

```json
{
  "permissions": {
    "allow": [
      "mcp__github__merge_pull_request",
      "mcp__github__enable_pr_auto_merge",
      "mcp__github__update_pull_request_branch"
    ]
  }
}
```

- Só vale para sessões com **um** repositório (é o caso do Modo Treino).
- Na tela da sessão, no seletor de modo ao lado da caixa de texto, escolha **Auto** (se a sua organização permitir).
- Documentação: <https://code.claude.com/docs/en/settings> (seção *Permissions*) e <https://code.claude.com/docs/en/claude-code-on-the-web>.
- Ainda vale dizer no chat, por escrito: *"pode mergear PRs quando o CI estiver verde"*. É a autorização explícita.

## 2) Do lado do GitHub (o que impede merge de código quebrado)

| O que fazer | Onde |
|---|---|
| Permitir merge automático | <https://github.com/Josperdias/Modo-Treino/settings> → *General* → *Pull Requests* → **Allow auto-merge** |
| Proteger a `main` (exigir PR + CI verde) | <https://github.com/Josperdias/Modo-Treino/settings/branches> → *Add branch ruleset / rule* para `main` |
| Marcar como obrigatórios | os checks **Verificações rápidas (estrutura, lógica, JS)**, **Site/PWA no Chromium (ponta a ponta)** e **App Expo (typecheck, bundle Android, testes de interface)** |
| Aprovações | deixe **0** se quiser que o Claude mergeie sem revisão humana; ponha **1** para você aprovar antes |
| Garantir que o app do Claude pode mergear | <https://claude.ai/connect-github> e <https://github.com/apps/claude/installations/select_target> → permissões *Contents: write* e *Pull requests: write* |
| **Ativar o site (Pages)** | <https://github.com/Josperdias/Modo-Treino/settings/pages> → *Build and deployment* → **Source: GitHub Actions** |

Com a `main` protegida e esses checks obrigatórios, "merge à vontade" só acontece quando tudo está verde: o próprio GitHub
recusa o resto, mesmo que o Claude tente.

## Depois de ligar
O site fica em **https://josperdias.github.io/Modo-Treino/** e a página de download em **.../Modo-Treino/baixar/**.
