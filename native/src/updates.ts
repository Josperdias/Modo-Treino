import {useCallback, useEffect, useState} from 'react';
import {Alert, AppState, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apkAsset, evaluateUpdate, safeGithubUrl} from '../logic';

export const GITHUB_REPO = 'Josperdias/Modo-Treino';

/** Avisa quando existe uma RELEASE nova (commit não conta). Nada é instalado sozinho. Checa ao abrir/retomar o app. */
export function useUpdates(version: string, enabled: boolean, ready: boolean) {
  const [status, setStatus] = useState('Aguardando consulta ao GitHub.');
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
      const url = safeGithubUrl(up.release?.html_url, GITHUB_REPO);
      const apk = apkAsset(up.release, GITHUB_REPO);
      setStatus(`Versão ${up.tag} publicada. Baixe e instale manualmente.`);
      const seen = await AsyncStorage.getItem('modo-treino-last-release');
      if (url && (force || seen !== up.tag)) {
        await AsyncStorage.setItem('modo-treino-last-release', up.tag);
        Alert.alert('Modo Treino atualizado!', `Uma nova versão (${up.tag}) está disponível. Nada é instalado automaticamente.`, [
          {text: 'Depois', style: 'cancel'},
          {text: 'Ver release', onPress: () => { Linking.openURL(url); }},
          ...(apk ? [{text: 'Baixar APK', onPress: () => { Linking.openURL(apk.url); }}] : []),
        ]);
      }
    } catch { setStatus('GitHub indisponível, sem internet ou sem release pública.'); } finally { clearTimeout(timer); }
  }, [version, enabled]);
  useEffect(() => {
    if (!ready || !enabled) return;
    void check(false);
    const sub = AppState.addEventListener('change', (x) => { if (x === 'active') void check(false); });
    return () => sub.remove();
  }, [ready, enabled, check]);
  return {status, check};
}
