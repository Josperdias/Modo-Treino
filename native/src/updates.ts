import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import {apkAsset, evaluateUpdate, releaseNotes, safeGithubUrl} from '../logic';

export const GITHUB_REPO = 'Josperdias/Modo-Treino';
const PACKAGE = 'art.josperd.modotreino';
const DISMISSED = 'modo-treino-dismissed-release';

export type UpdateInfo = {tag: string; notes: string[]; apkUrl: string | null; size: number; releaseUrl: string | null};
export type UpdatePhase = 'idle' | 'downloading' | 'ready' | 'error';
export type UpdatesApi = ReturnType<typeof useUpdates>;

/** Avisa quando existe uma RELEASE nova (commit não conta), no topo do app. No Android baixa o APK aqui mesmo e abre o
 * instalador do sistema: quem confirma a instalação é você, e o Android só aceita uma atualização assinada com a MESMA chave. */
export function useUpdates(version: string, enabled: boolean, ready: boolean) {
  const [status, setStatus] = useState('Aguardando consulta ao GitHub.');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [received, setReceived] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<UpdateInfo | null>(null);
  const fileRef = useRef<string | null>(null);
  const dlRef = useRef<FileSystem.DownloadResumable | null>(null);
  const cancelled = useRef(false);

  const check = useCallback(async (force = false) => {
    if (!force && !enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`, {headers: {Accept: 'application/vnd.github+json'}, signal: controller.signal});
      if (!response.ok) throw new Error(response.status === 404 ? 'Sem release pública.' : `HTTP ${response.status}`);
      const up = evaluateUpdate(version, await response.json());
      if (up.state === 'none') { setStatus(`Versão ${version} · nenhuma release publicada ainda.`); return; }
      if (up.state === 'ahead') { setStatus(`Versão ${version} · mais nova que a última release (${up.tag}).`); return; }
      if (up.state === 'current') { setStatus(`Versão ${version} · tudo em dia.`); return; }
      const apk = apkAsset(up.release, GITHUB_REPO);
      const info: UpdateInfo = {tag: up.tag, notes: releaseNotes(up.release?.body), apkUrl: apk?.url ?? null, size: apk?.size ?? 0, releaseUrl: safeGithubUrl(up.release?.html_url, GITHUB_REPO)};
      updateRef.current = info; setUpdate(info);
      setStatus(`Versão ${up.tag} disponível. O aviso fica no topo do app.`);
      const dismissed = await AsyncStorage.getItem(DISMISSED);
      setVisible(force || dismissed !== up.tag);
    } catch { setStatus('GitHub indisponível, sem internet ou sem release pública.'); } finally { clearTimeout(timer); }
  }, [version, enabled]);

  useEffect(() => {
    if (!ready || !enabled) return;
    void check(false);
    const sub = AppState.addEventListener('change', (x) => { if (x === 'active') void check(false); });
    return () => sub.remove();
  }, [ready, enabled, check]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (updateRef.current) AsyncStorage.setItem(DISMISSED, updateRef.current.tag).catch(() => {});
  }, []);

  const install = useCallback(async () => {
    const file = fileRef.current;
    if (!file) return;
    try {
      const uri = await FileSystem.getContentUriAsync(file);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {data: uri, flags: 1, type: 'application/vnd.android.package-archive'});
    } catch {
      setPhase('error');
      setError('O Android não abriu o instalador. Permita “Instalar apps desconhecidos” para o Modo Treino e tente de novo.');
    }
  }, []);

  const download = useCallback(async () => {
    const u = updateRef.current;
    if (!u) return;
    if (Platform.OS !== 'android' || !u.apkUrl) { const url = u.apkUrl || u.releaseUrl; if (url) void Linking.openURL(url); return; }
    cancelled.current = false;
    setPhase('downloading'); setProgress(0); setReceived(0); setError(null);
    try {
      const dir = FileSystem.cacheDirectory || '';
      for (const f of await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[])) if (/^modo-treino-.*\.apk$/.test(f)) await FileSystem.deleteAsync(dir + f, {idempotent: true});
      const dest = `${dir}modo-treino-${u.tag}.apk`;
      const dl = FileSystem.createDownloadResumable(u.apkUrl, dest, {}, (p) => {
        const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : u.size;
        setReceived(p.totalBytesWritten); setProgress(total > 0 ? Math.min(1, p.totalBytesWritten / total) : 0);
      });
      dlRef.current = dl;
      const r = await dl.downloadAsync();
      if (cancelled.current) return;
      if (!r || r.status !== 200) throw new Error('HTTP ' + (r?.status ?? '?'));
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists || (u.size > 0 && info.size !== u.size)) throw new Error('incompleto');
      fileRef.current = dest; setProgress(1); setPhase('ready');
      await install();
    } catch {
      if (cancelled.current) { setPhase('idle'); return; }
      setPhase('error'); setError('Não foi possível baixar. Confira a internet e tente de novo.');
    }
  }, [install]);

  const cancel = useCallback(async () => {
    cancelled.current = true;
    try { await dlRef.current?.pauseAsync(); } catch { /* já terminou */ }
    setPhase('idle'); setProgress(0);
  }, []);

  /** Abre a tela do Android onde se libera “Instalar apps desconhecidos” só para o Modo Treino. */
  const allowInstall = useCallback(() => {
    IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {data: `package:${PACKAGE}`}).catch(() => { void Linking.openSettings(); });
  }, []);
  const openBrowser = useCallback(() => { const u = updateRef.current; const url = u?.apkUrl || u?.releaseUrl; if (url) void Linking.openURL(url); }, []);

  return {status, check, update, visible, phase, progress, received, error, dismiss, download, install, cancel, allowInstall, openBrowser};
}
