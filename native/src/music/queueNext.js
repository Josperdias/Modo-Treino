/** Organiza a fila temporária da biblioteca sem alterar bags persistentes.
 * "Tocar a seguir" não duplica a faixa e não remove arquivos locais.
 * @template {{id:string}} T
 * @param {T[]} queue
 * @param {string | undefined | null} currentId
 * @param {T} requested
 * @returns {T[]}
 */
export function insertNextInQueue(queue, currentId, requested) {
  const list = queue.filter((x) => x.id !== requested.id);
  const at = list.findIndex((x) => x.id === currentId);
  list.splice(at + 1, 0, requested);
  return list;
}
