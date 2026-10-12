/** Notificações do Modo Treino (Android), todas nativas e no visual do app:
 * - MÚSICA: cartão azul-céu com a fita (ou o globo da rádio), anterior / tocar / próxima. Vive no player (MusicProvider).
 * - TREINO: cartão verde-menta com a ilustração do exercício, "Séries feitas" (ou o descanso) e botões. Vive no modo execução.
 * Falhas (sem permissão, aparelho sem suporte, navegador) nunca atrapalham o treino nem a música. */
import {Image, ImageSourcePropType, Platform} from 'react-native';
import {ModoNotif, WorkoutCard} from '../modules/modo-notif';

export type NotifState = 'granted' | 'ask' | 'blocked' | 'unavailable';

/** Estado das notificações do app: permissão do Android + o interruptor geral de notificações do app. */
export async function estadoNotificacoes(): Promise<NotifState> {
  if (Platform.OS !== 'android' || !ModoNotif.available) return 'unavailable';
  const p = await ModoNotif.permission();
  if (!p) return 'unavailable';
  const d = ModoNotif.diagnose();
  if (p.granted && d?.enabled !== false) return 'granted';
  return p.canAskAgain ? 'ask' : 'blocked';
}

/** Mostra o pedido de permissão do Android (se ainda puder). Sem ela NENHUMA notificação aparece. */
export async function pedirNotificacoes(): Promise<NotifState> {
  if (Platform.OS !== 'android' || !ModoNotif.available) return 'unavailable';
  await ModoNotif.requestPermission();
  return estadoNotificacoes();
}

/** Abre direto a tela "Notificações" deste app nas configurações do Android. */
export const abrirAjustesDeNotificacao = () => ModoNotif.openSettings();

/** Importância dos canais, em palavras (para o teste em Ajustes). */
const nivel = (n: number) => (n < 0 ? 'ainda não criado' : n === 0 ? 'BLOQUEADO' : n === 1 ? 'mínima' : n === 2 ? 'baixa (silenciosa)' : 'normal');
export function diagnostico(): string[] {
  const d = ModoNotif.diagnose();
  if (!d) return [];
  return [
    `Aparelho: ${d.device} · Android API ${d.sdk}`,
    `Notificações do app: ${d.enabled ? 'ligadas' : 'DESLIGADAS no Android'}`,
    `Canal Música: ${nivel(d.music)}`,
    `Canal Treino: ${nivel(d.workout)}`,
  ];
}

export const mostrarTreino = (card: WorkoutCard) => { ModoNotif.workout(card); };
export const limparTreino = () => { ModoNotif.workoutStop(); };

/** Nome do recurso (APK de release) ou caminho do arquivo da ilustração, para o cartão nativo carregar a imagem. No navegador não existe: devolve vazio. */
export function nomeDaImagem(source: ImageSourcePropType): string {
  try {
    if (Platform.OS !== 'android' || typeof Image.resolveAssetSource !== 'function') return '';
    return Image.resolveAssetSource(source)?.uri ?? '';
  } catch { return ''; }
}
