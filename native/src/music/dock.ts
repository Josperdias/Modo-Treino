/** Estado mínimo e compartilhado: "o player grande da aba Fitas já saiu da tela?". Quando sai, o miniplayer desliza para baixo da lista. */
import {useSyncExternalStore} from 'react';

let heroGone = false;
const listeners = new Set<() => void>();
export function setHeroGone(v: boolean) {
  if (v === heroGone) return;
  heroGone = v;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useHeroGone = () => useSyncExternalStore(subscribe, () => heroGone, () => false);

/** O rádio dourado pode ser recolhido numa tirinha (setinha). Vale enquanto o app está aberto; volta a abrir sozinho em outra música? Não: a escolha do usuário é respeitada. */
let miniCollapsed = false;
const collapseListeners = new Set<() => void>();
export function setMiniCollapsed(v: boolean) {
  if (v === miniCollapsed) return;
  miniCollapsed = v;
  collapseListeners.forEach((l) => l());
}
const subscribeCollapsed = (l: () => void) => { collapseListeners.add(l); return () => { collapseListeners.delete(l); }; };
export const useMiniCollapsed = () => useSyncExternalStore(subscribeCollapsed, () => miniCollapsed, () => false);
