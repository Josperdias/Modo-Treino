/** Zoom da ilustração com os dedos: pinça (centrada nos dedos), arrastar, toque duplo e botões +, − e AJUSTAR.
 * Os gestos rodam na thread de UI (gesture-handler + reanimated), então seguem o dedo sem engasgar.
 * Fica dentro de um <Modal>, acima de qualquer tela. */
import React, {useState} from 'react';
import {Image, ImageSourcePropType, LayoutChangeEvent, Modal, StyleSheet, View} from 'react-native';
import {Text} from './text';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming} from 'react-native-reanimated';
import {Icon, Press} from './ui';
import {C, R} from './theme';

const MAX = 6;
const SPRING = {damping: 20, stiffness: 220};

export default function ZoomView({source, label, onClose}: {source: ImageSourcePropType; label: string; onClose: () => void}) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startS = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const sw = useSharedValue(0);
  const sh = useSharedValue(0);
  const ratio = useSharedValue(0.75);
  const [pct, setPct] = useState(100);

  useAnimatedReaction(() => Math.round(scale.value * 100), (v, prev) => { if (v !== prev) runOnJS(setPct)(v); });

  // limites de arrasto: com a imagem inteira (contain) menor que a tela, só se move o que passa da borda
  const limit = (s: number) => {
    'worklet';
    const w = sw.value, h = sh.value, r = ratio.value || 0.75;
    const bw = r > w / h ? w : h * r;
    const bh = r > w / h ? w / r : h;
    return {mx: Math.max(0, (bw * s - w) / 2), my: Math.max(0, (bh * s - h) / 2)};
  };
  const clamp = (v: number, lo: number, hi: number) => { 'worklet'; return Math.max(lo, Math.min(hi, v)); };
  // aproxima por um ponto (fx, fy medidos a partir do centro) mantendo-o parado sob o dedo
  const zoomAbout = (next: number, fx: number, fy: number, fromS: number, fromX: number, fromY: number) => {
    'worklet';
    const s = clamp(next, 1, MAX);
    const k = s / fromS;
    const lim = limit(s);
    return {s, x: s <= 1 ? 0 : clamp(fx - k * (fx - fromX), -lim.mx, lim.mx), y: s <= 1 ? 0 : clamp(fy - k * (fy - fromY), -lim.my, lim.my)};
  };

  const pinch = Gesture.Pinch()
    .onStart(() => { startS.value = scale.value; startX.value = tx.value; startY.value = ty.value; })
    .onUpdate((e) => {
      const r = zoomAbout(startS.value * e.scale, e.focalX - sw.value / 2, e.focalY - sh.value / 2, startS.value, startX.value, startY.value);
      scale.value = r.s; tx.value = r.x; ty.value = r.y;
    });
  const pan = Gesture.Pan()
    .maxPointers(2)
    .onStart(() => { startX.value = tx.value; startY.value = ty.value; })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      const lim = limit(scale.value);
      tx.value = clamp(startX.value + e.translationX, -lim.mx, lim.mx);
      ty.value = clamp(startY.value + e.translationY, -lim.my, lim.my);
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(260)
    .onEnd((e) => {
      if (scale.value > 1.05) { scale.value = withSpring(1, SPRING); tx.value = withSpring(0, SPRING); ty.value = withSpring(0, SPRING); return; }
      const r = zoomAbout(2.5, e.x - sw.value / 2, e.y - sh.value / 2, 1, 0, 0);
      scale.value = withSpring(r.s, SPRING); tx.value = withSpring(r.x, SPRING); ty.value = withSpring(r.y, SPRING);
    });
  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch));

  const animated = useAnimatedStyle(() => ({transform: [{translateX: tx.value}, {translateY: ty.value}, {scale: scale.value}]}));
  const zoomBy = (k: number) => {
    const r = zoomAbout(scale.value * k, 0, 0, scale.value, tx.value, ty.value);
    scale.value = withTiming(r.s, {duration: 180}); tx.value = withTiming(r.x, {duration: 180}); ty.value = withTiming(r.y, {duration: 180});
  };
  const fit = () => { scale.value = withTiming(1, {duration: 220}); tx.value = withTiming(0, {duration: 220}); ty.value = withTiming(0, {duration: 220}); };
  const onLayout = (e: LayoutChangeEvent) => { sw.value = e.nativeEvent.layout.width; sh.value = e.nativeEvent.layout.height; };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={Z.root} accessibilityViewIsModal accessibilityLabel="Ilustração ampliada">
        <GestureDetector gesture={gesture}>
          <View style={Z.stage} onLayout={onLayout} collapsable={false}>
            <Animated.Image
              source={source}
              resizeMode="contain"
              accessibilityLabel={label}
              onLoad={(e: any) => { const s = e?.nativeEvent?.source; if (s?.width && s?.height) ratio.value = s.width / s.height; }}
              style={[Z.img, animated]}
            />
          </View>
        </GestureDetector>
        <View style={Z.bar}>
          <Press accessibilityRole="button" accessibilityLabel="Diminuir zoom" onPress={() => zoomBy(1 / 1.5)} style={Z.btn} quiet><Icon name="remove" size={22} color={C.white} /></Press>
          <Text accessibilityLiveRegion="polite" accessibilityLabel={`Zoom ${pct} por cento`} style={Z.pct}>{pct}%</Text>
          <Press accessibilityRole="button" accessibilityLabel="Aumentar zoom" onPress={() => zoomBy(1.5)} style={Z.btn} quiet><Icon name="add" size={22} color={C.white} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Ajustar à tela" onPress={fit} style={[Z.btn, {paddingHorizontal: 16}]} quiet><Text style={Z.fit}>AJUSTAR</Text></Press>
          <Press accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" onPress={onClose} style={[Z.btn, {backgroundColor: C.white}]} quiet><Icon name="close" size={22} color={C.ink} /></Press>
        </View>
        <Text style={Z.hint}>Pinça ou toque duplo para ampliar · arraste para mover</Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const Z = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'rgba(8,12,28,.97)', paddingTop: 40, paddingBottom: 16},
  stage: {flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
  img: {width: '100%', height: '100%'},
  bar: {flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingTop: 12, flexWrap: 'wrap'},
  btn: {minWidth: 48, height: 48, borderRadius: R.md, backgroundColor: C.navy2, alignItems: 'center', justifyContent: 'center'},
  fit: {color: C.white, fontWeight: '900', fontSize: 12, letterSpacing: 0.8},
  pct: {minWidth: 64, textAlign: 'center', color: C.yellow, fontWeight: '900', fontSize: 22},
  hint: {textAlign: 'center', color: '#B9C3DA', fontSize: 12, paddingTop: 10},
});
