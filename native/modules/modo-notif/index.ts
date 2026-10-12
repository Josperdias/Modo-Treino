/** Notificações nativas do Modo Treino (Android): o cartão do player de música e o cartão do exercício.
 * No navegador (testes) e em aparelhos sem o módulo, tudo vira "não faz nada" sem erro. */
import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';

export type MusicCard = {
  title: string; subtitle: string; kicker: string;
  /** 0..7 = cor da fita; -1 = globo da rádio. */
  art: number; playing: boolean; live: boolean; position: number; duration: number; fav: boolean; skip: boolean;
};
export type WorkoutCard = {
  kicker: string; title: string; persona: 'vinho' | 'loira';
  /** Ilustração do exercício: `Image.resolveAssetSource(...).uri` (nome do recurso no APK de release). Vazio = só o personagem. */
  image: string;
  /** Texto do selo verde-limão, ex.: "Séries feitas: 2/5". Durante o descanso o selo vira a contagem regressiva. */
  pill: string;
  /** Descanso: instante (ms desde 1970) em que acaba (0 = não está descansando); em pausa, `restPaused` + segundos que faltam. */
  restEndsAt: number; restPaused: boolean; restLeft: number;
  primaryAction: 'serie' | 'pause' | 'resume'; primaryLabel: string;
  secondaryAction: 'next' | 'skip'; secondaryLabel: string;
};
export type CardAction = {kind: 'music' | 'workout'; action: string};
export type Diagnose = {enabled: boolean; music: number; workout: number; sdk: number; device: string};
export type Permission = {granted: boolean; canAskAgain: boolean};

type Native = {
  music(d: MusicCard): boolean; musicStop(): boolean; workout(d: WorkoutCard): boolean; workoutStop(): boolean;
  diagnose(): Diagnose; permission(): Promise<Permission>; requestPermission(): Promise<Permission>; openSettings(): boolean;
  addListener(name: 'onAction', cb: (e: CardAction) => void): {remove: () => void};
};

const native: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('ModoNotif') : null;
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export const ModoNotif = {
  available: native != null,
  music: (d: MusicCard) => (native ? safe(() => native.music(d), false) : false),
  musicStop: () => (native ? safe(() => native.musicStop(), false) : false),
  workout: (d: WorkoutCard) => (native ? safe(() => native.workout(d), false) : false),
  workoutStop: () => (native ? safe(() => native.workoutStop(), false) : false),
  diagnose: (): Diagnose | null => (native ? safe(() => native.diagnose(), null) : null),
  permission: async (): Promise<Permission | null> => { try { return native ? await native.permission() : null; } catch { return null; } },
  requestPermission: async (): Promise<Permission | null> => { try { return native ? await native.requestPermission() : null; } catch { return null; } },
  openSettings: () => (native ? safe(() => native.openSettings(), false) : false),
  onAction: (cb: (e: CardAction) => void): (() => void) => {
    if (!native) return () => {};
    try { const sub = native.addListener('onAction', cb); return () => { try { sub.remove(); } catch { /* já removido */ } }; } catch { return () => {}; }
  },
};
