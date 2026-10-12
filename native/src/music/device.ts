/** Músicas do próprio celular (Android MediaStore) — sem copiar nem importar nada. */
import {Platform} from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export type DeviceTrack = {id: string; title: string; uri: string; duration: number; source: 'device'};
export type Permission = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';

const MIN_SECONDS = 30; // descarta toques, notificações e efeitos curtos
const MAX_TRACKS = 6000;

const titleOf = (filename: string) => filename.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Música sem nome';

type WebHook = {permission?: Permission; tracks?: DeviceTrack[]};
// Navegador (testes de interface e site): sem MediaStore. Um objeto global opcional pode simular o aparelho.
const webHook = (): WebHook | null => (Platform.OS === 'web' ? ((globalThis as any).__MODO_DEVICE__ as WebHook) || null : null);

export async function readPermission(): Promise<Permission> {
  const hook = webHook();
  if (hook) return hook.permission || 'unavailable';
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const r = await MediaLibrary.getPermissionsAsync(false, ['audio']);
    return r.granted ? 'granted' : r.canAskAgain ? 'unknown' : 'denied';
  } catch { return 'unavailable'; }
}

export async function askPermission(): Promise<Permission> {
  const hook = webHook();
  if (hook) return hook.permission || 'unavailable';
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const r = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
    return r.granted ? 'granted' : r.canAskAgain ? 'denied' : 'blocked';
  } catch { return 'unavailable'; }
}

export async function scanDevice(): Promise<DeviceTrack[]> {
  const hook = webHook();
  if (hook) return hook.tracks || [];
  const out: DeviceTrack[] = [];
  let after: string | undefined;
  for (let page = 0; page < 40 && out.length < MAX_TRACKS; page++) {
    const r = await MediaLibrary.getAssetsAsync({mediaType: 'audio', first: 300, after, sortBy: [[MediaLibrary.SortBy.modificationTime, false]]});
    for (const a of r.assets) {
      if (a.duration >= MIN_SECONDS) out.push({id: `dev:${a.id}`, title: titleOf(a.filename), uri: a.uri, duration: a.duration, source: 'device'});
    }
    if (!r.hasNextPage) break;
    after = r.endCursor;
  }
  return out;
}
