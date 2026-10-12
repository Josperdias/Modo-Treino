/** Backup sem escolher arquivo: você escolhe uma pasta UMA vez e o app guarda os dados lá sozinho.
 * Restaurar é um toque (o app lê o backup da pasta). Também dá para enviar o arquivo a outro app. */
import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {sessionsToCsv, validateBackup} from '../logic';
import type {Store} from './store';
import {todayKey} from './store';

const DIR_KEY = 'modotreino-backup-dir';
const LAST_KEY = 'modotreino-backup-last';
const NAME = 'modo-treino-backup';
const SAF = FileSystem.StorageAccessFramework;

const decodeName = (uri: string) => { try { return decodeURIComponent(decodeURIComponent(uri)); } catch { return uri; } };

const payload = (s: Store, version: string) => JSON.stringify({
  app: 'modo-treino', version, exportedAt: new Date().toISOString(), persona: s.persona, restExercise: s.restExercise, restSet: s.restSet,
  sets: s.sets, override: s.override, sessions: s.sessions, sounds: s.sounds, notifyUpdates: s.notifyUpdates,
}, null, 2);

async function findBackup(dir: string): Promise<string | null> {
  const files = await SAF.readDirectoryAsync(dir);
  return files.find((u) => decodeName(u).split(/[/:]/).pop()?.startsWith(NAME)) || null;
}

async function writeToFolder(dir: string, text: string) {
  const existing = await findBackup(dir);
  const target = existing || await SAF.createFileAsync(dir, NAME, 'application/json');
  await FileSystem.writeAsStringAsync(target, text);
}

async function shareText(name: string, text: string, mime: string) {
  try {
    const uri = (FileSystem.cacheDirectory || '') + name;
    await FileSystem.writeAsStringAsync(uri, text);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, {mimeType: mime, dialogTitle: name});
    else Alert.alert('Compartilhamento indisponível', 'Este aparelho não oferece o compartilhamento de arquivos.');
  } catch { Alert.alert('Não foi possível exportar', 'Tente novamente em instantes.'); }
}

export const shareBackup = (s: Store, version: string) => shareText(`modo-treino-backup-${todayKey()}.json`, payload(s, version), 'application/json');
export const shareCsv = (s: Store) => shareText(`modo-treino-historico-${todayKey()}.csv`, '﻿' + sessionsToCsv(s.sessions), 'text/csv');

export type BackupApi = {
  supported: boolean;
  folder: string | null;
  last: string | null;
  busy: boolean;
  choose: () => Promise<void>;
  saveNow: () => Promise<void>;
  restore: () => Promise<void>;
};

/** Mantém o backup automático: grava na pasta escolhida alguns segundos depois de qualquer mudança nos dados. */
export function useBackup(state: Store, version: string, loaded: boolean, apply: (b: ReturnType<typeof validateBackup>) => void): BackupApi {
  const supported = Platform.OS === 'android';
  const [folder, setFolder] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef({state, folder});
  ref.current = {state, folder};

  useEffect(() => {
    AsyncStorage.multiGet([DIR_KEY, LAST_KEY]).then(([[, d], [, l]]) => { setFolder(d); setLast(l); }).catch(() => {});
  }, []);

  const write = useCallback(async (dir: string, quiet: boolean) => {
    try {
      await writeToFolder(dir, payload(ref.current.state, version));
      const now = new Date().toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
      setLast(now); AsyncStorage.setItem(LAST_KEY, now).catch(() => {});
      return true;
    } catch {
      if (!quiet) Alert.alert('Não foi possível salvar o backup', 'A pasta pode ter sido apagada ou o acesso foi retirado. Escolha a pasta de novo.');
      return false;
    }
  }, [version]);

  // automático: depois de qualquer alteração (com folga, para não gravar a cada toque)
  const sig = state.sessions.length + ':' + Object.keys(state.override).length + ':' + state.persona + ':' + state.restExercise + ':' + state.restSet + ':' + JSON.stringify(state.sets).length;
  useEffect(() => {
    if (!loaded || !folder || !supported) return;
    const t = setTimeout(() => { void write(folder, true); }, 15000);
    return () => clearTimeout(t);
  }, [sig, folder, loaded, supported, write]);

  const choose = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const p = await SAF.requestDirectoryPermissionsAsync();
      if (!p.granted) return;
      setFolder(p.directoryUri); AsyncStorage.setItem(DIR_KEY, p.directoryUri).catch(() => {});
      if (await write(p.directoryUri, false)) Alert.alert('Backup automático ligado', 'Seus treinos e ajustes serão guardados nessa pasta sozinhos. Para restaurar, é só tocar em “Restaurar”.');
    } catch { Alert.alert('Pasta indisponível', 'Não foi possível abrir o seletor de pastas.'); }
    finally { setBusy(false); }
  }, [supported, write]);

  const saveNow = useCallback(async () => {
    if (!folder) return;
    setBusy(true);
    try { if (await write(folder, false)) Alert.alert('Backup salvo', 'Seus dados foram guardados na pasta escolhida.'); } finally { setBusy(false); }
  }, [folder, write]);

  const restore = useCallback(async () => {
    if (!folder) return;
    setBusy(true);
    try {
      const file = await findBackup(folder);
      if (!file) { Alert.alert('Nenhum backup na pasta', 'Ainda não há backup salvo nessa pasta. Toque em “Salvar agora” no aparelho de origem.'); return; }
      const raw = await FileSystem.readAsStringAsync(file);
      const b = validateBackup(JSON.parse(raw));
      Alert.alert('Restaurar este backup?', `Tem ${b.sessions.length} treino(s). Os registros atuais deste aparelho serão substituídos.`, [
        {text: 'Cancelar', style: 'cancel'}, {text: 'Restaurar', style: 'destructive', onPress: () => apply(b)},
      ]);
    } catch { Alert.alert('Não foi possível restaurar', 'O arquivo da pasta não é um backup do Modo Treino ou a pasta ficou inacessível.'); }
    finally { setBusy(false); }
  }, [folder, apply]);

  return {supported, folder, last, busy, choose, saveNow, restore};
}
