/** Músicas do próprio celular — sem importar nada: lista do Android (MediaStore) ou uma pasta escolhida uma vez (SAF). */
import {Platform} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

export type DeviceTrack = {id: string; title: string; uri: string; duration: number; source: 'device'};
export type Permission = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';

const MIN_SECONDS = 30; // descarta toques, notificações e efeitos curtos
const MAX_TRACKS = 6000;
const AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|amr|mka|webm)$/i;

const titleOf = (filename: string) => filename.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Música sem nome';

type WebHook = {permission?: Permission; tracks?: DeviceTrack[]; folder?: DeviceTrack[]};
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

/** Nome do arquivo a partir de um URI do seletor de pastas do Android (content://…/document/primary%3AMusic%2Fsong.mp3). */
const nameFromSaf = (uri: string) => {
  let d = uri;
  try { d = decodeURIComponent(decodeURIComponent(uri)); } catch { /* usa o bruto */ }
  return d.split(/[/:]/).filter(Boolean).pop() || d;
};

async function walk(dirUri: string, depth: number, out: DeviceTrack[], budget: {left: number}): Promise<void> {
  if (depth > 5 || budget.left <= 0) return;
  let children: string[] = [];
  try { children = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri); } catch { return; }
  for (const uri of children) {
    if (budget.left <= 0) return;
    budget.left--;
    const name = nameFromSaf(uri);
    if (AUDIO.test(name)) out.push({id: `saf:${uri}`, title: titleOf(name), uri, duration: 0, source: 'device'});
    else if (!/\.[A-Za-z0-9]{1,5}$/.test(name)) await walk(uri, depth + 1, out, budget); // sem extensão: provavelmente uma subpasta
  }
}

/** Abre o seletor de pastas do Android (uma vez) e lista as músicas dentro dela, em subpastas também. */
export async function pickMusicFolder(): Promise<{folder: string; tracks: DeviceTrack[]} | null> {
  const hook = webHook();
  if (hook) return hook.folder ? {folder: 'demo', tracks: hook.folder} : null;
  if (Platform.OS !== 'android') return null;
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  return {folder: perm.directoryUri, tracks: await scanFolder(perm.directoryUri)};
}

export async function scanFolder(folderUri: string): Promise<DeviceTrack[]> {
  const out: DeviceTrack[] = [];
  await walk(folderUri, 0, out, {left: MAX_TRACKS});
  return out;
}
