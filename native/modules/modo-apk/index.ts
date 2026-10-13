/** Download do APK da atualização pelo gerenciador do Android (Android apenas; no navegador e sem o módulo tudo vira "não faz nada"). */
import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';

export type ApkState = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'missing';
export type ApkStatus = {state: ApkState; received: number; total: number; reason: number};
type Native = {
  enqueue(url: string, fileName: string, title: string): number;
  status(id: number): ApkStatus;
  remove(id: number): boolean;
  sha256(id: number): Promise<string>;
  openDownloads(): boolean;
};
const native: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('ModoApk') : null;
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export const ModoApk = {
  available: native != null,
  enqueue: (url: string, fileName: string, title: string) => (native ? safe(() => native.enqueue(url, fileName, title), -1) : -1),
  status: (id: number): ApkStatus => (native ? safe(() => native.status(id), {state: 'missing' as ApkState, received: 0, total: 0, reason: 0}) : {state: 'missing', received: 0, total: 0, reason: 0}),
  remove: (id: number) => (native ? safe(() => native.remove(id), false) : false),
  sha256: async (id: number) => { try { return native ? await native.sha256(id) : ''; } catch { return ''; } },
  openDownloads: () => (native ? safe(() => native.openDownloads(), false) : false),
};
