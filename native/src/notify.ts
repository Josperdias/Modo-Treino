/** Notificação do exercício em andamento (separada da notificação de música, que é a do player do sistema).
 * Fica fixa enquanto o modo execução está aberto, mostra o exercício atual e, ao tocar nela, volta para o app.
 * Falhas (sem permissão, aparelho sem suporte) nunca atrapalham o treino. */
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';

const CANAL = 'treino';
const ID = 'treino-ativo';
let pronto: Promise<boolean> | null = null;

export type NotifState = 'granted' | 'ask' | 'blocked' | 'unavailable';
const toState = (p: {granted: boolean; canAskAgain: boolean}): NotifState => (p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked');

/** O canal precisa existir ANTES de pedir a permissão (no Android 13+ o diálogo só aparece assim). */
async function criarCanal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Treino em andamento', description: 'Mostra o exercício atual enquanto você treina.',
    importance: Notifications.AndroidImportance.LOW, enableVibrate: false, showBadge: false, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Estado da permissão de notificações (vale também para a notificação do player de música). */
export async function estadoNotificacoes(): Promise<NotifState> {
  if (Platform.OS === 'web') return 'unavailable';
  try { return toState(await Notifications.getPermissionsAsync()); } catch { return 'unavailable'; }
}

/** Mostra o pedido de permissão do Android (se ainda puder). Sem ela, NENHUMA notificação aparece, nem a do player. */
export async function pedirNotificacoes(): Promise<NotifState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    Notifications.setNotificationHandler({handleNotification: async () => ({shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false})});
    await criarCanal();
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted || !atual.canAskAgain) return toState(atual);
    return toState(await Notifications.requestPermissionsAsync());
  } catch { return 'unavailable'; }
}

async function preparar(): Promise<boolean> {
  return (await pedirNotificacoes()) === 'granted';
}

export async function mostrarTreino(title: string, body: string): Promise<void> {
  pronto ??= preparar();
  if (!(await pronto)) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {title, body, sticky: true, autoDismiss: false, color: '#162039', priority: Notifications.AndroidNotificationPriority.LOW, data: {tipo: 'treino'}},
      trigger: Platform.OS === 'android' ? {channelId: CANAL} : null,
    });
  } catch { /* notificação é um extra */ }
}

export async function limparTreino(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.dismissNotificationAsync(ID);
    await Notifications.cancelScheduledNotificationAsync(ID);
  } catch { /* nada a limpar */ }
}
