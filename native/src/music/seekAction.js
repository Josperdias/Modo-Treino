/** Recebe a posição de uma ação enviada pela MediaSession Android.
 * O formato é seek:<milissegundos>. Não aceita valores negativos, decimais
 * ou qualquer outro comando, e nunca permite seek além da faixa conhecida.
 * 100% lógica: sem dependência de React Native para permitir testes isolados.
 */
/** @param {string} action
 *  @param {number} durationSeconds
 *  @returns {number | null}
 */
export function parseSeekAction(action, durationSeconds) {
  const match = /^seek:([0-9]{1,13})$/.exec(action);
  if (!match || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const positionMs = Number(match[1]);
  if (!Number.isSafeInteger(positionMs)) return null;
  return Math.max(0, Math.min(durationSeconds, positionMs / 1000));
}
