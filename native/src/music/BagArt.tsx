/** Bolsa de música desenhada em SVG: alça, zíper, bolso e fitas/discos espiando pela abertura.
 * Selecionada, ela "abre" (os itens sobem); tocando, os itens balançam e notas musicais flutuam. */
import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming} from 'react-native-reanimated';
import Svg, {Circle, G, Line, Path, Rect} from 'react-native-svg';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../theme';

export const BAG_COLORS = [C.yellow, C.pink, C.sky, C.mint, '#C9B6F2', '#FFB98C'];
export const bagColor = (i: number) => BAG_COLORS[((i % BAG_COLORS.length) + BAG_COLORS.length) % BAG_COLORS.length];
const ITEM_COLORS = [C.pink, C.sky, C.mint, C.yellow];

const W = 200, H = 190;

function Item({i, open, playing, reduce}: {i: number; open: boolean; playing: boolean; reduce: boolean}) {
  const up = useSharedValue(0);
  const bob = useSharedValue(0);
  useEffect(() => { up.value = withDelay(i * 70, withSpring(open ? 1 : 0, {damping: 11, stiffness: 150})); }, [open, i, up]);
  useEffect(() => {
    if (playing && !reduce) bob.value = withRepeat(withSequence(withTiming(1, {duration: 380 + i * 90, easing: Easing.inOut(Easing.sin)}), withTiming(0, {duration: 380 + i * 90, easing: Easing.inOut(Easing.sin)})), -1, false);
    else bob.value = withTiming(0, {duration: 200});
  }, [playing, reduce, i, bob]);
  const x = [62, 100, 138][i], tilt = [-14, 4, 16][i], color = ITEM_COLORS[i % ITEM_COLORS.length];
  const st = useAnimatedStyle(() => ({
    transform: [{translateY: 34 - up.value * 34 - bob.value * 6}, {rotate: `${tilt + bob.value * (i % 2 ? 4 : -4)}deg`}],
    opacity: 0.15 + up.value * 0.85,
  }));
  return (
    <Animated.View style={[{position: 'absolute', left: `${((x - 20) / W) * 100}%`, top: '2%', width: '20%', height: '30%'}, st]}>
      <Svg width="100%" height="100%" viewBox="0 0 40 52">
        <Rect x={3} y={3} width={34} height={46} rx={7} fill={color} stroke={C.ink} strokeWidth={3} />
        <Rect x={9} y={9} width={22} height={13} rx={3} fill={C.white} stroke={C.ink} strokeWidth={2} />
        <Circle cx={15} cy={36} r={5} fill={C.white} stroke={C.ink} strokeWidth={2} />
        <Circle cx={26} cy={36} r={5} fill={C.white} stroke={C.ink} strokeWidth={2} />
      </Svg>
    </Animated.View>
  );
}

function Note({i, playing, reduce}: {i: number; playing: boolean; reduce: boolean}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (playing && !reduce) t.value = withDelay(i * 520, withRepeat(withTiming(1, {duration: 1900, easing: Easing.out(Easing.quad)}), -1, false));
    else t.value = 0;
  }, [playing, reduce, i, t]);
  const st = useAnimatedStyle(() => ({opacity: t.value === 0 ? 0 : 1 - t.value, transform: [{translateY: -t.value * 90}, {translateX: Math.sin(t.value * 5 + i) * 12}, {scale: 0.7 + t.value * 0.5}]}));
  return <Animated.View pointerEvents="none" style={[{position: 'absolute', top: '10%', left: `${30 + i * 22}%`}, st]}><Ionicons name={i % 2 ? 'musical-notes' : 'musical-note'} size={20} color={C.ink} /></Animated.View>;
}

export default function BagArt({color = C.yellow, count = 0, open = false, playing = false, size = 180, glyph = 'musical-notes'}: {color?: string; count?: number; open?: boolean; playing?: boolean; size?: number; glyph?: React.ComponentProps<typeof Ionicons>['name']}) {
  const reduce = useReducedMotion();
  const sway = useSharedValue(0);
  useEffect(() => {
    if (playing && !reduce) sway.value = withRepeat(withSequence(withTiming(1, {duration: 900, easing: Easing.inOut(Easing.sin)}), withTiming(-1, {duration: 900, easing: Easing.inOut(Easing.sin)})), -1, true);
    else sway.value = withTiming(0, {duration: 250});
  }, [playing, reduce, sway]);
  const bag = useAnimatedStyle(() => ({transform: [{rotate: `${sway.value * 2.2}deg`}]}));
  const items = Math.min(3, count);
  return (
    <Animated.View style={[{width: size, height: size * (H / W)}, bag]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* alça (atrás do corpo) */}
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`}>
        <Path d="M64 70 C64 20 136 20 136 70" fill="none" stroke={C.ink} strokeWidth={12} strokeLinecap="round" />
        <Path d="M64 70 C64 24 136 24 136 70" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      {/* fitas espiando */}
      {Array.from({length: items}, (_, i) => <Item key={i} i={i} open={open} playing={playing} reduce={reduce} />)}
      {/* corpo da bolsa */}
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={12} y={70} width={176} height={108} rx={30} fill={color} stroke={C.ink} strokeWidth={6} />
        <Path d="M18 100 Q100 116 182 100" fill="none" stroke={C.ink} strokeWidth={4} strokeDasharray="2 7" strokeLinecap="round" />
        <Path d="M20 84 Q100 98 180 84" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={8} strokeLinecap="round" />
        <G>
          <Rect x={52} y={118} width={96} height={46} rx={16} fill="rgba(255,255,255,.7)" stroke={C.ink} strokeWidth={4} />
          <Line x1={52} y1={134} x2={148} y2={134} stroke={C.ink} strokeWidth={3} opacity={0.35} />
        </G>
        <Circle cx={150} cy={104} r={8} fill={C.white} stroke={C.ink} strokeWidth={4} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'flex-end', paddingBottom: size * 0.095}]} pointerEvents="none">
        <Ionicons name={glyph} size={size * 0.14} color={C.ink} />
      </View>
      {[0, 1, 2].map((i) => <Note key={i} i={i} playing={playing} reduce={reduce} />)}
    </Animated.View>
  );
}
