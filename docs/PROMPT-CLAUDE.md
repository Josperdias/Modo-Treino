# PROMPT PARA CLAUDE — MODO TREINO v1.0.1

Você atuará como desenvolvedor sênior full-stack/mobile e designer de produto no projeto **Modo Treino — by Josperd**. Trabalhe sobre o código REAL e os arquivos fornecidos na pasta Google Drive "Modo Treino — by Josperd" (ZIP `Modo-Treino-Codigo-Completo-v1.0.1.zip`). **Não reinicie o projeto, não substitua a identidade visual por um template genérico de IA e não descarte imagens existentes.** Leia `README.md`, `CLAUDE.md`, `site/`, `native/`, `tests/` e `.github/workflows/` antes de alterar qualquer coisa.

## Contexto e identidade

Criador/artista: Josperd. Nome do produto: **Modo Treino**. Personagens selecionáveis: **Josperd** e **Camila Camomila**, apelidada **a ruivinha**. A Camila não deve ser apresentada como loira nos textos — arquivos antigos `*_loira.png` são apenas identificadores técnicos. Manter fidelidade das ilustrações, cabelo, rosto, tom da pele e mãos. Quando não houver ilustração específica para Camila, mostrar imagem de Josperd COM aviso explícito; quando o movimento não tiver arte própria, mostrar capa decorativa do Josperd e o aviso `SEM IMAGEM DO EXERCÍCIO`. Jamais apresentar arte substituta como orientação do movimento. Há 14 exercícios, Treino A (6) e Treino B (8), com séries, repetições e cargas ajustáveis. Não invente prescrições médicas ou pesos.

Direção de UI: cartoon autoral sofisticado, revista editorial esportiva com tipografia expressiva, blocos com recortes, tons navy/azul, rosa, amarelo, cream, imagens das personagens e interface original. A fonte Le Cartoonie é preferência artística, mas **não inclui licença embutida**; não baixe/distribua fontes de terceiros sem permissão. Garantir contraste, acessibilidade, responsividade, modo offline para dados e visual refinado, sem aparência de dashboard pronto.

## Estado atual: preservar

- Site/PWA com fichas A/B, escolha das personagens, galeria, histórico, edição de peso, séries, repetições, botões de séries individuais, timer de descanso, backup JSON local e detecção de atualizações públicas do GitHub.
- App React Native/Expo SDK 54 (em `native/`) com funções correspondentes, dados locais AsyncStorage e player de músicas locais `expo-audio`, seleção de arquivos do telefone e fitas cassete.
- Modo Música com playlists/fita A, B e Favoritas, importação de músicas próprias, ajuste de crossfade e player compacto durante o treino. Respeitar regras de direitos autorais e APIs do YouTube/Morphe; sem download ou reprodução oculta não autorizada.
- Biblioteca de efeitos **opcional, desligada por padrão**, estilos original `Suave`, `Arcade` e `Minimal`, e contagem falada em português. Controles individuais de botões, série, finalização, descanso, contagem 3-2-1, fala/bipes, volume; salvo localmente. Arquivos em `*/assets/sounds/`, código `site/sounds.js` e `native/SoundFX.ts`.

## Suas prioridades de execução (não apenas planejamento)

1. Rodar os testes existentes, corrigir erros de compilação TypeScript, imports de Expo e possíveis problemas de compatibilidade de áudio. Testar em dispositivo Android físico/Emulador quando disponível. Validar responsividade em telas menores e evitar layout quebrado. Fazer testes práticos para salvar histórico, marcar série e transições de áudio.
2. Configurar o GitHub remoto `Josperdias/modo-treino` **somente após autenticação explícita do proprietário**. Se ainda não houver repositório, criar como privado (se autorizado). NÃO solicitar ou publicar tokens/chaves privadas. Nunca colocar segredos em código, prompt, logs, screenshots ou Drive. Criar branch `feat/...` e PR. Não autorizar merge direto em `main`; use revisão e CI verde. Se GitHub remoto não existir, não inventar URL nem afirmar que está publicado.
3. Executar workflow `.github/workflows/android-apk.yml` para gerar o **APK real de desenvolvimento**, baixar artefato `app-debug.apk` e fornecer ao proprietário com versão, data, SHA-256 e instruções de instalação no Android. Se Actions falhar, resolver logs e repetir com cuidado. Alternativa: EAS profile preview em `native/eas.json`. Não entregar ZIP renomeado como APK. Não publicar Play Store sem aprovação explícita.
4. Avisos de atualizações do GitHub: checagem com internet ao abrir/retomar o aplicativo, comparar `version` semântica, diferenciar release instalada de mero commit, oferecer link seguro de release; nenhuma instalação automática silenciosa. Repositório privado exige serviço seguro de atualização, nunca token embedado no app. Implementar testes.
5. Melhorar o player cassete: bobinas realmente animadas, controle na tela de treino, pause/play/skip, sem áudio interrompido em alterações de UI, transições suaves configuráveis (0–8 s), importação estável de músicas. Preservar música dos arquivos locais no telefone. Não incluir áudios de artistas sem licença.
6. Biblioteca de sons: todos opcionais; testar preview e persistência após reiniciar; não ativar sons inesperadamente; evitar sons excessivamente altos; opções para botões, série, descanso, voz contagem, finalização. Testar mistura com playlist e política de silêncio do telefone; garantir funcionamento sem internet.
7. Ideias posteriores, apenas após estabilidade: editor A/B drag-and-drop; notas pessoais por exercício; PR de cargas e séries; tempo total de treino; descanso personalizável por exercício; histórico e gráficos; exportação CSV/JSON; metas, recordes pessoais; conquistas ilustradas de Josperd/Camila; widgets e atalhos de celular; acessibilidade/háptica opcional.

## Entregáveis esperados

- Repositório com histórico Git limpo, PRs claros, changelog e instruções de manutenção.
- Site/PWA funcional com capturas reais das telas de início, A, B, coleção, fitas e ajustes de áudio; publicar em HTTPS só após consentimento.
- APK REAL testado, quando compilação possível; registrar explicitamente limitações se não houver build/assinatura.
- Testes automatizados e status de compilação; relatório curto do que funciona de fato e do que falta testar.
- Salvar o produto acabado na mesma pasta Drive e manter personagens, artwork e documentos atualizados.

**Inicie executando testes e inspeção do código; depois corrija, compile e produza artefatos. Não responda com um plano apenas.**
