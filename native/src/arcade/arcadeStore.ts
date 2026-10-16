import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSyncExternalStore} from 'react';
import {DEFAULT_SAVE, normalizeSave, SAVE_KEY, type ArcadeSave} from './save';

/** Save do arcade num mini-store: Ajustes (desbloqueio) e a tela do jogo leem o mesmo estado. */
let current: ArcadeSave = DEFAULT_SAVE;
let loaded = false;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit() { listeners.forEach((l) => l()); }

export function loadArcade(): Promise<void> {
  if (!loading) {
    loading = AsyncStorage.getItem(SAVE_KEY)
      .then((raw) => { current = normalizeSave(raw ? JSON.parse(raw) : null); })
      .catch(() => { current = DEFAULT_SAVE; })
      .then(() => { loaded = true; emit(); });
  }
  return loading;
}

export function getArcade(): ArcadeSave { return current; }

export function updateArcade(fn: (s: ArcadeSave) => ArcadeSave) {
  current = normalizeSave(fn(current));
  emit();
  AsyncStorage.setItem(SAVE_KEY, JSON.stringify(current)).catch(() => {}); // sem disco, o jogo continua
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useArcade(): {save: ArcadeSave; loaded: boolean} {
  const save = useSyncExternalStore(subscribe, getArcade, getArcade);
  const ready = useSyncExternalStore(subscribe, () => loaded, () => loaded);
  if (!loading) void loadArcade();
  return {save, loaded: ready};
}
