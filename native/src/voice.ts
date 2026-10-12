/** Voz do treino (opcional, desligada por padrão): o Android lê em voz alta o exercício, a série e o descanso.
 * Usa o mecanismo de voz do próprio celular (offline na maioria). Falhar nunca atrapalha o treino. */
import * as Speech from 'expo-speech';

export function falar(texto: string) {
  try { Speech.stop(); Speech.speak(texto, {language: 'pt-BR', rate: 1.0, pitch: 1.0}); } catch { /* sem mecanismo de voz */ }
}
export function calar() {
  try { Speech.stop(); } catch { /* nada falando */ }
}
