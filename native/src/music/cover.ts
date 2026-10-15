/** Capa do álbum que vem dentro do arquivo da música (a "imagem da música" do app de música do celular). */
import {Platform} from 'react-native';
import {ModoPlayback} from '../../modules/modo-playback';

/** Onde há leitura de capa: no APK (módulo nativo). No navegador (testes) um objeto global opcional simula o resultado. */
export const coverSupported = () => (Platform.OS === 'web' ? !!(globalThis as any).__MODO_DEVICE__ : ModoPlayback.available);

/** Caminho de uma cópia da capa (arquivo no cache) ou null quando a música não tem capa dentro do arquivo. */
export async function trackCover(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return ((globalThis as any).__MODO_DEVICE__?.cover as string | undefined) || null;
  if (!ModoPlayback.available) return null;
  try { return await ModoPlayback.extractCover(uri); } catch { return null; }
}
