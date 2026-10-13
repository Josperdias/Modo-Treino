/** Pequenas regras puras de transporte, sem React/Expo: testáveis no Node. */

/**
 * Calcula a janela segura de crossfade. Se a duração é desconhecida não supõe
 * que a faixa cabe; reduz o fade para 0 (troca direta), evitando sobreposição
 * prolongada de estações ou arquivos inválidos.
 * @param {number} requestedSeconds
 * @param {number} durationSeconds
 * @returns {number}
 */
export function clampFadeSeconds(requestedSeconds, durationSeconds) {
  if (!Number.isFinite(requestedSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(8, Math.max(0, requestedSeconds), Math.max(0, durationSeconds / 2));
}

/** Uma faixa só deve emitir um avanço por término.
 * @param {{didJustFinish:boolean,playing:boolean,changing:boolean,handledId:string|null,currentId:string}} s
 */
export function shouldHandleFinish(s) {
  return Boolean(s.didJustFinish && s.playing && !s.changing && s.currentId && s.handledId !== s.currentId);
}
