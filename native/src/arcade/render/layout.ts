/** Geometria da tela de jogo compartilhada entre o desenho e o toque (puro, sem Skia). */

/** Botão de tiro: círculo no centro de baixo (px de tela). Toques aqui atiram em vez de mover. */
export function fireZone(width: number, height: number): {cx: number; cy: number; r: number} {
  const r = Math.max(30, Math.min(40, width * 0.095));
  return {cx: width / 2, cy: height - r - 26, r};
}

/** O ponto (x, y) está dentro do botão de tiro (com 14 px de folga para o dedo)? */
export function inFireZone(x: number, y: number, width: number, height: number): boolean {
  const z = fireZone(width, height);
  return Math.hypot(x - z.cx, y - z.cy) <= z.r + 14;
}

/** Altura (px de tela) onde começa a fileira de vidas/poderes, logo abaixo do cartão de pontos. */
export const HUD_ROW_Y = 92;
