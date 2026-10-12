import {Alert} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {sessionsToCsv, validateBackup} from '../logic';
import type {Store} from './store';
import {todayKey} from './store';

async function shareFile(name: string, text: string, mime: string) {
  try {
    const uri = (FileSystem.cacheDirectory || '') + name;
    await FileSystem.writeAsStringAsync(uri, text);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, {mimeType: mime, dialogTitle: name});
    else Alert.alert('Compartilhamento indisponível', 'Este aparelho não oferece o compartilhamento de arquivos.');
  } catch { Alert.alert('Não foi possível exportar', 'Tente novamente em instantes.'); }
}

export const exportBackup = (s: Store, version: string) => shareFile(`modo-treino-backup-${todayKey()}.json`, JSON.stringify({
  app: 'modo-treino', version, exportedAt: new Date().toISOString(), persona: s.persona, restExercise: s.restExercise, restSet: s.restSet,
  sets: s.sets, override: s.override, sessions: s.sessions, sounds: s.sounds, notifyUpdates: s.notifyUpdates,
}, null, 2), 'application/json');

export const exportCsv = (s: Store) => shareFile(`modo-treino-historico-${todayKey()}.csv`, '﻿' + sessionsToCsv(s.sessions), 'text/csv');

export async function importBackup(apply: (b: ReturnType<typeof validateBackup>) => void) {
  try {
    const out = await DocumentPicker.getDocumentAsync({type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true});
    if (out.canceled) return;
    const raw = await FileSystem.readAsStringAsync(out.assets[0].uri);
    if (raw.length > 5000000) throw new Error('grande demais');
    const b = validateBackup(JSON.parse(raw));
    Alert.alert('Substituir seus registros?', `O backup tem ${b.sessions.length} treino(s). Os registros atuais deste aparelho serão substituídos.`, [
      {text: 'Cancelar', style: 'cancel'}, {text: 'Restaurar', style: 'destructive', onPress: () => apply(b)},
    ]);
  } catch { Alert.alert('Arquivo inválido', 'Escolha um backup .json exportado pelo Modo Treino.'); }
}
