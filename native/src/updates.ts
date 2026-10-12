import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apkAsset, evaluateUpdate, releaseNotes, safeGithubUrl} from '../logic';
import {ModoApk} from '../modules/modo-apk';

export const GITHUB_REPO = 'Josperdias/Modo-Treino';
const DISMISSED = 'modo-treino-dismissed-release';
/** Baixar DENTRO do app = pelo gerenciador de downloads do Android (módulo modo-apk): progresso aqui, arquivo em Downloads, notificação do
 * sistema e SHA-256 conferido. Quem abre o instalador é o Android (você toca no arquivo e confirma).
 * NÃO instalamos direto do app porque isso exige a permissão REQUEST_INSTALL_PACKAGES, que no 1.3.2 coincidiu com um erro de instalação
 * ("problem parsing the package") num Xiaomi/HyperOS. No navegador (testes) e sem o módulo, o botão abre o download pelo sistema. */
export const baixaNoApp = () => Platform.OS === 'android' && ModoApk.available;

export type UpdateInfo = {tag: string; notes: string[]; apkUrl: string | null; size: number; sha256: string | null; releaseUrl: string | null};
export type UpdatePhase = 'idle' | 'downloading' | 'ready' | 'error';
export type UpdatesApi = ReturnType<typeof useUpdates>;

/** Avisa quando existe uma RELEASE nova (commit não conta), no topo do app. No Android baixa o APK aqui mesmo (com progresso e conferência
 * do SHA-256) e te leva ao arquivo para instalar: quem confirma a instalação é você, e o Android só aceita atualização assinada com a MESMA chave. */
export function useUpdates(version: string, enabled: boolean, ready: boolean) {
  const [status, setStatus] = useState('Aguardando consulta ao GitHub.');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [received, setReceived] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<UpdateInfo | null>(null);
  const idRef = useRef<number>(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stopPolling, []);

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
      const info: UpdateInfo = {tag: up.tag, notes: releaseNotes(up.release?.body), apkUrl: apk?.url ?? null, size: apk?.size ?? 0, sha256: apk?.sha256 ?? null, releaseUrl: safeGithubUrl(up.release?.html_url, GITHUB_REPO)};
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

  const openBrowser = useCallback(() => { const u = updateRef.current; const url = u?.apkUrl || u?.releaseUrl; if (url) void Linking.openURL(url); }, []);

  /** Abre a tela de Downloads do Android: toque no arquivo modo-treino-….apk e em Instalar. */
  const install = useCallback(async () => { if (!ModoApk.openDownloads()) openBrowser(); }, [openBrowser]);

  const fail = useCallback((msg: string) => { stopPolling(); setPhase('error'); setError(msg); }, []);

  const download = useCallback(async () => {
    const u = updateRef.current;
    if (!u) return;
    if (!baixaNoApp() || !u.apkUrl) { openBrowser(); return; }
    stopPolling();
    if (idRef.current >= 0) ModoApk.remove(idRef.current);
    setPhase('downloading'); setProgress(0); setReceived(0); setError(null);
    const id = ModoApk.enqueue(u.apkUrl, `modo-treino-${u.tag}.apk`, `Modo Treino ${u.tag}`);
    if (id < 0) { fail('O Android não aceitou o download. Use "No navegador".'); return; }
    idRef.current = id;
    let busy = false;
    timer.current = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const st = ModoApk.status(id);
        const total = st.total > 0 ? st.total : u.size;
        setReceived(st.received); setProgress(total > 0 ? Math.min(1, st.received / total) : 0);
        if (st.state === 'failed' || st.state === 'missing') { fail(st.state === 'missing' ? 'O download foi cancelado.' : 'Não foi possível baixar. Confira a internet e tente de novo.'); return; }
        if (st.state === 'done') {
          stopPolling();
          if (u.size > 0 && st.received !== u.size) { ModoApk.remove(id); fail('O arquivo baixou incompleto. Tente de novo.'); return; }
          if (u.sha256) {
            const got = await ModoApk.sha256(id);
            if (got && got !== u.sha256) { ModoApk.remove(id); fail('O arquivo baixado não confere com o publicado (SHA-256). Ele foi apagado; tente de novo.'); return; }
          }
          setProgress(1); setPhase('ready');
        }
      } finally { busy = false; }
    }, 500);
  }, [fail, openBrowser]);

  const cancel = useCallback(async () => {
    stopPolling();
    if (idRef.current >= 0) ModoApk.remove(idRef.current);
    idRef.current = -1;
    setPhase('idle'); setProgress(0); setReceived(0);
  }, []);

  return {status, check, update, visible, phase, progress, received, error, dismiss, download, install, cancel, openBrowser};
}
