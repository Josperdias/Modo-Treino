/** O globo 3D (three.js) roda dentro de uma WebView só nesta tela; o resto do app é nativo.
 * Protocolo: native/assets/globe/globe.html (comandos `postToGlobe`, eventos `ready`/`station`/`country`). */
import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {ActivityIndicator, Platform, StyleSheet, View} from 'react-native';
import {Asset} from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import {WebView} from 'react-native-webview';
import {C} from '../theme';

export type GlobeMsg = {cmd: string; [k: string]: unknown};
export type GlobeEvent = {type: 'ready'} | {type: 'station'; id: string} | {type: 'country'; iso2: string; name: string};
export type GlobeHandle = {post: (m: GlobeMsg) => void};

async function loadHtml(): Promise<string> {
  const asset = Asset.fromModule(require('../../assets/globe/globe.html'));
  if (Platform.OS === 'web') { const r = await fetch(asset.uri); return r.text(); }
  await asset.downloadAsync();
  return FileSystem.readAsStringAsync(asset.localUri || asset.uri);
}

const GlobeView = forwardRef<GlobeHandle, {onEvent: (e: GlobeEvent) => void}>(function GlobeView({onEvent}, ref) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const web = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => { loadHtml().then(setHtml).catch(() => setFailed(true)); }, []);

  useImperativeHandle(ref, () => ({
    post: (m) => {
      if (Platform.OS === 'web') frame.current?.contentWindow?.postMessage(m, '*');
      else web.current?.injectJavaScript(`window.postToGlobe(${JSON.stringify(m)});true;`);
    },
  }));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data && typeof e.data === 'object' && e.data.type) cb.current(e.data); };
    window.addEventListener('message', fn);
    return () => window.removeEventListener('message', fn);
  }, []);

  if (failed) return <View style={S.fill} />;
  if (!html) return <View style={[S.fill, S.center]}><ActivityIndicator color={C.yellow} /></View>;
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {ref: (el: HTMLIFrameElement | null) => { frame.current = el; }, srcDoc: html, title: 'Globo de rádios', style: {border: 0, width: '100%', height: '100%', background: 'transparent', colorScheme: 'normal'}});
  }
  return (
    <WebView
      ref={web}
      source={{html, baseUrl: 'https://modotreino.local/'}}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled={false}
      overScrollMode="never"
      scrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      androidLayerType="hardware"
      style={{flex: 1, backgroundColor: 'transparent'}}
      containerStyle={{backgroundColor: 'transparent'}}
      onMessage={(e) => { try { cb.current(JSON.parse(e.nativeEvent.data)); } catch { /* mensagem inválida */ } }}
    />
  );
});
export default GlobeView;
const S = StyleSheet.create({fill: {flex: 1}, center: {alignItems: 'center', justifyContent: 'center'}});
