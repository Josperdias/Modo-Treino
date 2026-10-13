import {buildNativeQueue} from './nativePilotQueue.js';

/** Plano para recolocar no Media3 a última fila local depois que o app (e o serviço) foram encerrados.
 * Só fitas locais: rádio ao vivo nunca é restaurada. Sem tocar sozinha: quem chama usa autoplay=false.
 * Devolve null se não há nada seguro para restaurar (sessão velha, faixa apagada, formato estranho). */
export function buildRestorePlan(saved, knownTracks, now = Date.now()) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.ids) || typeof saved.currentId !== 'string') return null;
  if (!Number.isFinite(saved.savedAt) || now - saved.savedAt > 30 * 24 * 3600 * 1000) return null;
  const byId = new Map((knownTracks || []).filter(Boolean).map((t) => [t.id, t]));
  const tracks = saved.ids.slice(0, 10000).map((id) => byId.get(id)).filter((t) => t && t.source !== 'radio');
  if (!tracks.some((t) => t.id === saved.currentId)) return null;
  try {
    const {items, index} = buildNativeQueue(tracks, saved.currentId);
    const positionMs = Number.isFinite(saved.positionMs) ? Math.max(0, Math.floor(saved.positionMs)) : 0;
    return {tracks, items, index, positionMs};
  } catch {
    return null;
  }
}
