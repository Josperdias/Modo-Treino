/** Adapta a biblioteca atual a uma fila nativa, preservando IDs originais das bags.
 * Não altera dados persistidos, não copia nem exclui faixas.
 * Usado apenas na prova de conceito, nunca em paralelo com expo-audio. */
/** Mesma conta de `tapeIndex.ts` (cor da fita 0–7): o serviço nativo usa o número para escolher a capa da notificação. Um teste confere que as duas não divergem. */
export function capaIndex(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}
export function buildNativeQueue(items, currentId) {
  if (!Array.isArray(items)) throw new Error('Fila inválida');
  const allowed = new Set(['device','file','radio']);
  const queue = items.filter(t => t && allowed.has(t.source) && typeof t.uri === 'string' && /^(content|file|https?):\/\//.test(t.uri))
    .map(t => ({id: String(t.id), uri: t.uri, title: String(t.title || 'Fita sem título'), artist: t.artist || '', source: t.source, art: t.source === 'radio' ? 'radio' : capaIndex(String(t.id))}));
  const index = queue.findIndex(t => t.id === currentId);
  if (index < 0) throw new Error('A faixa atual não está acessível na fila');
  return {items: queue, index};
}
