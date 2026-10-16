# NEON STEP DX — BASE WEB LIMPA PARA MIGRAÇÃO NATIVA

## Objetivo
Protótipo vertical de pulo automático. Esta versão é a V1.3 com OS QUATRO conjuntos experimentais de sprites REMOVIDOS **somente do runtime**. Os 16 PNGs originais (8 Josperd + 8 Camila) e a identidade de UI permanecem.

## Executar
Abra um terminal nesta pasta e use `python -m http.server 8000`; acesse `http://localhost:8000`. Para abrir diretamente sem servidor, use o HTML único offline enviado em paralelo.

## Organização
- `index.html`: tela de seleção e HUD
- `styles.css`: aparência antiga preservada
- `game.js`: física, jogador, plataformas, colisões, inimigos desenhados por canvas, checkpoints
- `worlds.js`: quatro mundos, portais automáticos, combate e cenários simples em Canvas
- `progression.js`: ritmo de inimigos, recompensas, powers e portais
- `music-director.js`: playlist e transições
- `audio-catalog.js`, `paper-soundtrack.js`, `audio-effects.js`: referências de música e SFX
- `assets/sprites/`: SOMENTE os 16 sprites jogáveis originais
- `assets/ui/`: imagens da seleção/identidade visual; não são inimigos nem portais
- `assets/audio/`: trilhas e efeitos locais

## Removido intencionalmente
- `assets/fx/paperPortal_*.png`, `drone_*.png`, `paperclip_*.png`, `checkpoint_*.png`: NÃO incluídos na versão jogável.
- Todo `FX_SHEETS` e `drawFxFrame`: excluídos da lógica.
- Portal, drones, clipes e checkpoint continuam FUNCIONANDO com desenho simples em Canvas.
- Scripts de manutenção antigos que reinstalavam os FX foram excluídos.

## Regra de transferência
O objetivo NÃO é 'corrigir' automaticamente os sprites de Josperd/Camila com AI. Primeiro portar a física e a lógica, depois criar novos sprite sheets em etapa separada com conferência visual humana.

## Validação
`node --check *.js` passou. Testes automatizados de navegador acompanham a entrega. Não assumir que o jogo está pronto para publicação comercial sem QA prolongado, compatibilidade Android/iOS e auditoria das licenças musicais.
