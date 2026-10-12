/** Arte das notificações de música: uma fita colorida por música (mesma cor do cassete da lista) e o globo para rádios. */
import {Asset} from 'expo-asset';
import {tapeIndex} from './tapeIndex';

const FITAS = [
  require('../../assets/notif/fita-0.png'), require('../../assets/notif/fita-1.png'), require('../../assets/notif/fita-2.png'), require('../../assets/notif/fita-3.png'),
  require('../../assets/notif/fita-4.png'), require('../../assets/notif/fita-5.png'), require('../../assets/notif/fita-6.png'), require('../../assets/notif/fita-7.png'),
];
const RADIO = require('../../assets/notif/radio.png');
const cache = new Map<number, string>();

async function uriDe(mod: number): Promise<string | undefined> {
  if (cache.has(mod)) return cache.get(mod);
  try {
    const a = Asset.fromModule(mod);
    await a.downloadAsync();
    const uri = a.localUri || a.uri;
    if (uri) cache.set(mod, uri);
    return uri || undefined;
  } catch { return undefined; }
}

export const arteDaFita = (id: string) => uriDe(FITAS[tapeIndex(id)]);
export const arteDaRadio = () => uriDe(RADIO);
/** Já carregada (síncrono); usado para atualizar a notificação sem esperar. */
export const arteDaRadioPronta = () => cache.get(RADIO);
