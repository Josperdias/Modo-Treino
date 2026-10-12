/** Vídeo de execução de um exercício: o seu próprio vídeo (gravado por você ou da galeria), copiado para a pasta do app.
 * Nada é baixado da internet; fica só no celular. Remover apaga só a cópia do app (o original continua onde estava). */
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type ExVideo = {uri: string; name: string};
const DIR = () => `${FileSystem.documentDirectory || ''}modo-treino-video/`;
const VIDEO = /\.(mp4|m4v|mov|webm|3gp|3gpp|mkv)$/i;

/** Abre o seletor do Android e copia o vídeo escolhido. Devolve null se cancelar; lança 'not-video' se não for vídeo. */
export async function pickExerciseVideo(exerciseId: string): Promise<ExVideo | null> {
  // "*/*": alguns seletores escondem arquivos quando o filtro é só "video/*"; confirmamos pela extensão/tipo depois.
  const out = await DocumentPicker.getDocumentAsync({type: '*/*', multiple: false, copyToCacheDirectory: true});
  const f = out.canceled ? null : out.assets[0];
  if (!f) return null;
  if (!/^video\//.test(f.mimeType || '') && !VIDEO.test(f.name)) throw new Error('not-video');
  await FileSystem.makeDirectoryAsync(DIR(), {intermediates: true});
  const ext = f.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4';
  const uri = `${DIR()}${exerciseId}-${Date.now().toString(36)}.${ext}`;
  await FileSystem.copyAsync({from: f.uri, to: uri});
  return {uri, name: f.name};
}

export const deleteExerciseVideo = (uri: string) => FileSystem.deleteAsync(uri, {idempotent: true}).catch(() => {});
