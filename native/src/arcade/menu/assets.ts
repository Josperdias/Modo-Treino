import {Asset} from 'expo-asset';
import {Skia, type SkImage} from '@shopify/react-native-skia';

/** Artes do menu (WebP recomprimido das originais do dono; ver arcade/fonte/menu/LEIA-ME.md). */
const FILES = {
  bgL: require('../../../assets/arcade/menu/bg_josperd.webp'),
  bgR: require('../../../assets/arcade/menu/bg_camila.webp'),
  ghostL: require('../../../assets/arcade/menu/ghost_josperd.webp'),
  ghostR: require('../../../assets/arcade/menu/ghost_camila.webp'),
  heroL: require('../../../assets/arcade/menu/hero_josperd.webp'),
  heroR: require('../../../assets/arcade/menu/hero_camila.webp'),
  infoL: require('../../../assets/arcade/menu/info_josperd.webp'),
  infoR: require('../../../assets/arcade/menu/info_camila.webp'),
  ray: require('../../../assets/arcade/menu/ray.webp'),
  swap: require('../../../assets/arcade/menu/swap.webp'),
  logo: require('../../../assets/arcade/menu/logo.webp'),
  swipe: require('../../../assets/arcade/menu/swipe.webp'),
} as const;

export type MenuKey = keyof typeof FILES;
export type MenuImages = Record<MenuKey, SkImage | null>;

async function load(mod: number): Promise<SkImage | null> {
  try {
    const asset = Asset.fromModule(mod);
    if (!asset.localUri) await asset.downloadAsync();
    const data = await Skia.Data.fromURI(asset.localUri || asset.uri);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null; // sem uma arte o menu desenha o resto e continua utilizável
  }
}

let cache: Promise<MenuImages> | null = null;
/** Carrega uma vez só; o menu e o botão JOGAR esperam a mesma promessa. */
export function loadMenuImages(): Promise<MenuImages> {
  if (!cache) {
    cache = (async () => {
      const keys = Object.keys(FILES) as MenuKey[];
      const imgs = await Promise.all(keys.map((k) => load(FILES[k] as unknown as number)));
      const out = {} as MenuImages;
      keys.forEach((k, i) => { out[k] = imgs[i]; });
      return out;
    })();
  }
  return cache;
}
