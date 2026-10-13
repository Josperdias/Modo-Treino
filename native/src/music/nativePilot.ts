/**
 * POC manual opt-in para futura integração com MusicProvider.
 * NÃO chamar enquanto expo-audio/ModoNotif.music reproduz ou mostra notificação.
 * O retorno é o snapshot da MediaSession; atualização visual deve usar onState().
 */
import {ModoPlayback, NativeTrack} from '../../modules/modo-playback';
import {buildNativeQueue} from './nativePilotQueue';

export const NATIVE_PLAYBACK_ENABLED = false; // MANTER false até QA Android e migração de notificação.

export async function tryNativeQueuePilot(items: NativeTrack[], currentId: string) {
  if (!NATIVE_PLAYBACK_ENABLED) throw new Error('Motor Media3 ainda em homologação; não ativar em produção.');
  const {items: playlist, index} = buildNativeQueue(items, currentId);
  return ModoPlayback.loadQueue(playlist, index, true);
}
