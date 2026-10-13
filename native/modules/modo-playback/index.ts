/** Bridge EXPERIMENTAL para um único player Android nativo.
 * Nenhuma alteração na UI de fitas e bags; não importado por MusicProvider por padrão. */
import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';

export type NativeTrack = {id: string; uri: string; title: string; artist?: string; source: 'file' | 'device' | 'radio'};
export type NativeState = {mediaId: string | null; title?: string | null; artist?: string | null; uri?: string | null; index: number; playing: boolean; playWhenReady: boolean; status: number; positionMs: number; durationMs: number; count: number; repeat: boolean; shuffle: boolean; rate: number; volume: number};
type Native = {
  loadQueue(items: NativeTrack[], index: number, autoplay: boolean): Promise<NativeState>;
  insertNext(item: NativeTrack): Promise<NativeState>;
  play(): Promise<NativeState>;
  pause(): Promise<NativeState>;
  next(): Promise<NativeState>;
  previous(): Promise<NativeState>;
  seekTo(ms: number): Promise<NativeState>;
  setRepeat(value: boolean): Promise<NativeState>;
  setShuffle(value: boolean): Promise<NativeState>;
  setVolume(volume: number): Promise<NativeState>;
  setRate(rate: number): Promise<NativeState>;
  getState(): Promise<NativeState>;
  clear(): Promise<NativeState>;
  addListener(name: 'onState', cb: (state: NativeState) => void): {remove(): void};
};
const android: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('ModoPlayback') : null;
function requirePlayer(): Native {
  if (!android) throw new Error('O motor nativo não está disponível nesta build.');
  return android;
}
export const ModoPlayback = {
  available: android !== null,
  loadQueue: (items: NativeTrack[], index: number, autoplay = false) => requirePlayer().loadQueue(items, index, autoplay),
  insertNext: (item: NativeTrack) => requirePlayer().insertNext(item),
  play: () => requirePlayer().play(),
  pause: () => requirePlayer().pause(),
  next: () => requirePlayer().next(),
  previous: () => requirePlayer().previous(),
  seekTo: (ms: number) => requirePlayer().seekTo(ms),
  setRepeat: (repeat: boolean) => requirePlayer().setRepeat(repeat),
  setShuffle: (shuffle: boolean) => requirePlayer().setShuffle(shuffle),
  setVolume: (volume: number) => requirePlayer().setVolume(volume),
  setRate: (rate: number) => requirePlayer().setRate(rate),
  getState: () => requirePlayer().getState(),
  clear: () => requirePlayer().clear(),
  onState: (cb: (state: NativeState) => void) => {
    if (!android) return () => {};
    const sub = android.addListener('onState', cb);
    return () => sub.remove();
  },
};
