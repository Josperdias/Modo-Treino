/** Notificação do exercício em andamento (separada da notificação de música, que é a do player do sistema).
 * Fica fixa enquanto o modo execução está aberto, mostra o exercício atual e, ao tocar nela, volta para o app.
 * Falhas (sem permissão, aparelho sem suporte) nunca atrapalham o treino. */
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';

const CANAL = 'treino';
const ID = 'treino-ativo';
let pronto: Promise<boolean> | null = null;

async function preparar(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    Notifications.setNotificationHandler({handleNotification: async () => ({shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false})});
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: 'Treino em andamento', description: 'Mostra o exercício atual enquanto você treina.',
        importance: Notifications.AndroidImportance.LOW, enableVibrate: false, showBadge: false, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch { return false; }
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
