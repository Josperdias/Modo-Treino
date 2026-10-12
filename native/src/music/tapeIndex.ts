/** Índice (0–7) da cor de uma fita, estável por música: a mesma cor no cassete da lista e na arte da notificação. */
export const TAPE_COUNT = 8;
export function tapeIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % TAPE_COUNT;
}
