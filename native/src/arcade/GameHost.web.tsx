import React from 'react';
import {Text, View} from 'react-native';
import {WithSkiaWeb} from '@shopify/react-native-skia/lib/module/web';
import type {GameCanvasProps} from './GameCanvas';

/** Web (testes de interface e prévia): o CanvasKit (wasm) é carregado antes do módulo do jogo. */
export default function GameHost(props: GameCanvasProps) {
  return (
    <WithSkiaWeb
      opts={{locateFile: (file: string) => `/${file}`}}
      getComponent={() => import('./GameCanvas')}
      fallback={<View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: '#fff'}}>Carregando…</Text></View>}
      componentProps={props}
    />
  );
}
