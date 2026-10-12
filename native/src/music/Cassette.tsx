import React, {useEffect, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {useReducedMotion, cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import Svg, {Circle, G, Line, Rect} from 'react-native-svg';
import {C} from '../theme';

const W = 320, H = 200;
const LEFT = {x: 98, y: 124}, RIGHT = {x: 222, y: 124};

function Hub({size}: {size: number}) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c - 1} fill="#E9E4DA" />
      <Circle cx={c} cy={c} r={c * 0.58} fill="#101733" />
      <G stroke="#E9E4DA" strokeWidth={size * 0.07} strokeLinecap="round">
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const rad = (a * Math.PI) / 180;
          return <Line key={a} x1={c + Math.cos(rad) * c * 0.22} y1={c + Math.sin(rad) * c * 0.22} x2={c + Math.cos(rad) * c * 0.5} y2={c + Math.sin(rad) * c * 0.5} />;
        })}
      </G>
    </Svg>
  );
}

/** Fita cassete: os carretéis giram enquanto toca e a fita passa de um lado para o outro conforme a faixa avança. */
export default function Cassette({playing, label, side = 'LADO A', progress = 0}: {playing: boolean; label: string; side?: string; progress?: number}) {
  const [w, setW] = useState(300);
  const spin = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (playing && !reduce) spin.value = withRepeat(withTiming(spin.value + 360, {duration: 2400, easing: Easing.linear}), -1, false);
    else cancelAnimation(spin);
    return () => cancelAnimation(spin);
  }, [playing, spin, reduce]);
  const style = useAnimatedStyle(() => ({transform: [{rotate: `${spin.value % 360}deg`}]}));
  const k = w / W;
  const p = Math.max(0, Math.min(1, progress));
  const left = 31 - p * 11, right = 20 + p * 11; // raio da fita enrolada em cada lado
  const hub = 40 * k;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout} style={CS.wrap} accessible accessibilityRole="image" accessibilityLabel={`Fita cassete ${label}${playing ? ', tocando' : ''}`}>
      <Svg width="100%" height={w * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={4} y={4} width={W - 8} height={H - 8} rx={20} fill="#25316C" stroke="#0B1033" strokeWidth={5} />
        <Rect x={22} y={18} width={W - 44} height={74} rx={10} fill="#FBD4D4" stroke="#EA9CC9" strokeWidth={2} />
        <Rect x={22} y={70} width={W - 44} height={22} rx={0} fill="#F6A4C1" opacity={0.55} />
        <Rect x={44} y={92} width={W - 88} height={66} rx={33} fill="#090D23" stroke="#53629D" strokeWidth={3} />
        <Circle cx={LEFT.x} cy={LEFT.y} r={left} fill="#3A2A22" />
        <Circle cx={RIGHT.x} cy={RIGHT.y} r={right} fill="#3A2A22" />
        <Rect x={102} y={156} width={116} height={26} rx={6} fill="#101733" opacity={0.7} />
        <Circle cx={118} cy={170} r={4} fill="#53629D" /><Circle cx={202} cy={170} r={4} fill="#53629D" />
      </Svg>
      <Animated.View style={[CS.reel, {left: (LEFT.x - 20) * k, top: (LEFT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <Animated.View style={[CS.reel, {left: (RIGHT.x - 20) * k, top: (RIGHT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <View style={[CS.sticker, {left: 34 * k, right: 34 * k, top: 24 * k}]} pointerEvents="none">
        <Text style={CS.side}>MODO MÚSICA · {side}</Text>
        <Text numberOfLines={1} style={CS.title}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const CS = StyleSheet.create({
  wrap: {width: '100%'},
  reel: {position: 'absolute'},
  sticker: {position: 'absolute'},
  side: {fontSize: 9, letterSpacing: 1.4, fontWeight: '900', color: '#443765'},
  title: {fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 4, letterSpacing: -0.4},
});

const TAPE_COLORS = ['#F6A4C1', '#A9C6F8', '#FFD365', '#A8E0C2', '#C7B6F2'];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** Mini cassete de UMA música (uma fita). A cor do rótulo varia por música; estática de propósito, para listas longas. */
export function MiniTape({id, size = 76, on = false}: {id: string; size?: number; on?: boolean}) {
  const label = TAPE_COLORS[hash(id) % TAPE_COLORS.length];
  return (
    <Svg width={size} height={size * 0.64} viewBox="0 0 100 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={2} y={2} width={96} height={60} rx={9} fill={on ? C.yellow : '#25316C'} stroke="#0B1033" strokeWidth={3} />
      <Rect x={9} y={7} width={82} height={24} rx={4} fill={label} stroke="#0B1033" strokeWidth={1.5} />
      <Rect x={16} y={14} width={44} height={3} rx={1.5} fill="#0B1033" opacity={0.55} />
      <Rect x={16} y={20} width={28} height={3} rx={1.5} fill="#0B1033" opacity={0.3} />
      <Rect x={16} y={34} width={68} height={20} rx={10} fill="#090D23" />
      <Circle cx={32} cy={44} r={6} fill="#E9E4DA" /><Circle cx={32} cy={44} r={2.2} fill="#101733" />
      <Circle cx={68} cy={44} r={6} fill="#E9E4DA" /><Circle cx={68} cy={44} r={2.2} fill="#101733" />
    </Svg>
  );
}
