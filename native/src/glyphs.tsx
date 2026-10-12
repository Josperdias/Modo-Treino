/** Símbolos dos personagens: ★ estrela = Josperd, ✿ flor = Camila Camomila (a ruivinha). */
import React, {useEffect} from 'react';
import Animated, {Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Path} from 'react-native-svg';
import type {Persona} from './data';
import {C} from './theme';

const starPath = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 21;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
})();

export function Star({size = 28, fill = C.yellow, stroke = C.ink}: {size?: number; fill?: string; stroke?: string}) {
  return <Svg width={size} height={size} viewBox="0 0 100 100"><Path d={starPath} fill={fill} stroke={stroke} strokeWidth={6} strokeLinejoin="round" /></Svg>;
}

export function Flower({size = 28, petal = C.pink, center = C.yellow, stroke = C.ink}: {size?: number; petal?: string; center?: string; stroke?: string}) {
  const petals = [0, 60, 120, 180, 240, 300].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return <Circle key={deg} cx={50 + Math.cos(a) * 26} cy={50 + Math.sin(a) * 26} r={19} fill={petal} stroke={stroke} strokeWidth={5} />;
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {petals}
      <Circle cx={50} cy={50} r={17} fill={center} stroke={stroke} strokeWidth={5} />
    </Svg>
  );
}

/** Josperd = estrela, Camila = flor. `spin` gira devagar (respeita "remover animações"). */
export function Glyph({persona, size = 28, spin = false}: {persona: Persona; size?: number; spin?: boolean}) {
  const r = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!spin || reduce) return;
    r.value = withRepeat(withTiming(360, {duration: 14000, easing: Easing.linear}), -1, false);
  }, [spin, reduce, r]);
  const st = useAnimatedStyle(() => ({transform: [{rotate: `${r.value}deg`}]}));
  const node = persona === 'loira' ? <Flower size={size} /> : <Star size={size} />;
  return spin ? <Animated.View style={st}>{node}</Animated.View> : node;
}
