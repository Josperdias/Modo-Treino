import {Asset} from 'expo-asset';
import {Skia, type SkImage} from '@shopify/react-native-skia';
import type {Hero} from '../save';

/** Os 16 quadros oficiais, copiados byte a byte dos originais (nunca recortados nem redesenhados). */
const FILES: Record<Hero, number[]> = {
  josperd: [
    require('../../../assets/arcade/sprites/josperd_00.png'),
    require('../../../assets/arcade/sprites/josperd_01.png'),
    require('../../../assets/arcade/sprites/josperd_02.png'),
    require('../../../assets/arcade/sprites/josperd_03.png'),
    require('../../../assets/arcade/sprites/josperd_04.png'),
    require('../../../assets/arcade/sprites/josperd_05.png'),
    require('../../../assets/arcade/sprites/josperd_06.png'),
    require('../../../assets/arcade/sprites/josperd_07.png'),
  ],
  camila: [
    require('../../../assets/arcade/sprites/camila_00.png'),
    require('../../../assets/arcade/sprites/camila_01.png'),
    require('../../../assets/arcade/sprites/camila_02.png'),
    require('../../../assets/arcade/sprites/camila_03.png'),
    require('../../../assets/arcade/sprites/camila_04.png'),
    require('../../../assets/arcade/sprites/camila_05.png'),
    require('../../../assets/arcade/sprites/camila_06.png'),
    require('../../../assets/arcade/sprites/camila_07.png'),
  ],
};

export type SpriteSet = Record<Hero, (SkImage | null)[]>;

async function load(mod: number): Promise<SkImage | null> {
  try {
    const asset = Asset.fromModule(mod);
    if (!asset.localUri) await asset.downloadAsync();
    const data = await Skia.Data.fromURI(asset.localUri || asset.uri);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null; // sem a imagem o quadro simplesmente não é desenhado; o jogo continua
  }
}

let spritesCache: Promise<SpriteSet> | null = null;
/** Carrega uma vez: o menu pré-carrega enquanto o jogador escolhe e o jogo reaproveita. */
export function loadSprites(): Promise<SpriteSet> {
  if (!spritesCache) {
    spritesCache = (async () => {
      const out: SpriteSet = {josperd: [], camila: []};
      for (const hero of ['josperd', 'camila'] as const) out[hero] = await Promise.all(FILES[hero].map(load));
      return out;
    })();
  }
  return spritesCache;
}
