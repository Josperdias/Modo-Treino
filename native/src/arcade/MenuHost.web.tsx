import React from 'react';
import {Text, View} from 'react-native';
import {WithSkiaWeb} from '@shopify/react-native-skia/lib/module/web';
import type {SelectMenuProps} from './menu/SelectMenu';

/** Web (testes de interface e prévia): o CanvasKit (wasm) é carregado antes do módulo do menu. */
export default function MenuHost(props: SelectMenuProps) {
  return (
    <WithSkiaWeb
      opts={{locateFile: (file: string) => `/${file}`}}
      getComponent={() => import('./menu/SelectMenu')}
      fallback={<View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: '#fff'}}>Carregando…</Text></View>}
      componentProps={props}
    />
  );
}
