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
