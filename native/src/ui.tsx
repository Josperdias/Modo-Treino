import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {Modal, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Animated, {cancelAnimation, Easing, FadeInDown, FadeOutDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Defs, G, Line, Pattern as SvgPattern, Rect} from 'react-native-svg';
import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {playSound} from '../SoundFX';
import {C, INK, R, shadow, T} from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({name, size = 22, color = C.ink}: {name: IconName; size?: number; color?: string}) => <Ionicons name={name} size={size} color={color} />;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressProps = Omit<PressableProps, 'style'> & {style?: StyleProp<ViewStyle>; scaleTo?: number; quiet?: boolean; haptic?: boolean};
/** Botão base: encolhe com mola ao tocar, toca o som de botão (se o usuário ligou) e dá um toque de vibração leve. */
export function Press({style, scaleTo = 0.96, quiet = false, haptic = true, onPress, onPressIn, onPressOut, ...rest}: PressProps) {
  const s = useSharedValue(1);
  // react-native-web só entende aria-*: espelha accessibilityState/Value (no Android nativo os dois funcionam).
  const st = rest.accessibilityState;
  const val = rest.accessibilityValue;
  const aria: Record<string, unknown> = {};
  if (st) {
    if (st.checked !== undefined) aria['aria-checked'] = st.checked;
    if (st.selected !== undefined) aria['aria-selected'] = st.selected;
    if (st.expanded !== undefined) aria['aria-expanded'] = st.expanded;
    if (st.disabled !== undefined) aria['aria-disabled'] = st.disabled;
  }
  if (val?.text) aria['aria-valuetext'] = val.text;
  const anim = useAnimatedStyle(() => ({transform: [{scale: s.value}]}));
  return (
    <AnimatedPressable
      {...rest}
      {...aria}
      style={[style, anim]}
      onPressIn={(e) => { s.value = withSpring(scaleTo, {damping: 18, stiffness: 420}); onPressIn?.(e); }}
      onPressOut={(e) => { s.value = withSpring(1, {damping: 14, stiffness: 300}); onPressOut?.(e); }}
      onPress={(e) => {
        if (!quiet) playSound('button');
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
    />
  );
}

type BtnProps = {text: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'dark' | 'ghost' | 'danger'; disabled?: boolean; small?: boolean; label?: string; style?: StyleProp<ViewStyle>};
export function Btn({text, onPress, icon, kind = 'primary', disabled, small, label, style}: BtnProps) {
  const bg = kind === 'primary' ? C.yellow : kind === 'dark' ? C.ink : kind === 'danger' ? '#FBE3E8' : 'transparent';
  const fg = kind === 'dark' ? C.white : kind === 'danger' ? '#9B2C4A' : C.ink;
  return (
    <Press accessibilityRole="button" accessibilityLabel={label || text} accessibilityState={{disabled: !!disabled}} disabled={disabled} onPress={onPress}
      style={[B.btn, small && B.small, {backgroundColor: bg}, kind === 'primary' && INK, kind === 'danger' && {borderWidth: 2, borderColor: '#9B2C4A'}, kind === 'ghost' && B.ghost, disabled && {opacity: 0.4}, style]}>
      {icon && <Icon name={icon} size={small ? 17 : 20} color={fg} />}
      <Text style={[B.text, small && {fontSize: 12}, {color: fg}]}>{text}</Text>
    </Press>
  );
}
const B = StyleSheet.create({
  btn: {minHeight: 54, borderRadius: R.pill, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9},
  small: {minHeight: 42, paddingHorizontal: 16},
  ghost: {borderWidth: 2, borderColor: C.ink},
  text: {fontSize: 14, fontWeight: '900', letterSpacing: 0.6},
});

export const Card = ({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}) => <View style={[K.card, style]}>{children}</View>;
const K = StyleSheet.create({card: {backgroundColor: C.card, borderRadius: R.lg, padding: 18, borderWidth: 1.5, borderColor: C.line}});

export function Kicker({children, color}: {children: string; color?: string}) { return <Text style={[T.kicker, color ? {color} : null]}>{children}</Text>; }

export function Chips<V extends string | number>({options, value, onChange, format, label}: {options: V[]; value: V; onChange: (v: V) => void; format?: (v: V) => string; label: (v: V) => string}) {
  return (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Press key={String(o)} accessibilityRole="button" accessibilityLabel={label(o)} accessibilityState={{selected: on}} onPress={() => onChange(o)} style={[CH.chip, on && CH.on]}>
            <Text style={[CH.text, on && {color: C.white}]}>{format ? format(o) : String(o)}</Text>
          </Press>
        );
      })}
    </View>
  );
}
const CH = StyleSheet.create({
  chip: {paddingHorizontal: 16, minHeight: 40, borderRadius: R.pill, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  on: {backgroundColor: C.ink},
  text: {fontSize: 13, fontWeight: '800', color: C.ink},
});

export function Switch({value, onChange, title, desc}: {value: boolean; onChange: (v: boolean) => void; title: string; desc?: string}) {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => { x.value = withTiming(value ? 1 : 0, {duration: 180, easing: Easing.out(Easing.quad)}); }, [value, x]);
  const knob = useAnimatedStyle(() => ({transform: [{translateX: x.value * 20}]}));
  const track = useAnimatedStyle(() => ({backgroundColor: x.value > 0.5 ? C.green : '#CFCABD'}));
  return (
    <Press accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{checked: value}} onPress={() => onChange(!value)} scaleTo={0.985} style={SW.row}>
      <View style={{flex: 1}}>
        <Text style={T.h3}>{title}</Text>
        {desc ? <Text style={[T.small, {marginTop: 3}]}>{desc}</Text> : null}
      </View>
      <Animated.View style={[SW.track, track]}><Animated.View style={[SW.knob, knob]} /></Animated.View>
    </Press>
  );
}
const SW = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12},
  track: {width: 48, height: 28, borderRadius: 14, padding: 3},
  knob: {width: 22, height: 22, borderRadius: 11, backgroundColor: C.white},
});

/** Folha que sobe de baixo (substitui as páginas extras): ajustes, edição, escolher músicas. */
export function Sheet({visible, onClose, title, children, tall}: {visible: boolean; onClose: () => void; title: string; children: React.ReactNode; tall?: boolean}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={SH.back}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" accessibilityRole="button" />
        <View style={[SH.sheet, tall && {height: '88%'}]} accessibilityViewIsModal>
          <View style={SH.grab} />
          <View style={SH.head}>
            <Text style={[T.h2, {flex: 1}]} accessibilityRole="header">{title}</Text>
            <Press accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={SH.close} quiet><Icon name="close" size={20} /></Press>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
const SH = StyleSheet.create({
  back: {flex: 1, backgroundColor: 'rgba(16,23,51,.55)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '92%'},
  grab: {alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#CFCABD', marginTop: 10},
  head: {flexDirection: 'row', alignItems: 'center', paddingVertical: 14},
  close: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
});

/** Anel de progresso animado (SVG). */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function Ring({size, stroke, progress, color = C.ink, track = 'rgba(20,27,52,.12)', children}: {size: number; stroke: number; progress: number; color?: string; track?: string; children?: React.ReactNode}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(progress);
  useEffect(() => { p.value = withTiming(Math.max(0, Math.min(1, progress)), {duration: 450, easing: Easing.out(Easing.cubic)}); }, [progress, p]);
  const props = useAnimatedProps(() => ({strokeDashoffset: circ * (1 - p.value)}));
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} animatedProps={props} originX={size / 2} originY={size / 2} rotation={-90} />
      </Svg>
      {children}
    </View>
  );
}

/* ---- aviso rápido (com "Desfazer") ---- */
type ToastApi = {show: (message: string, action?: {label: string; run: () => void}) => void};
const ToastCtx = createContext<ToastApi>({show: () => {}});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({children}: {children: React.ReactNode}) {
  const [t, setT] = useState<{message: string; action?: {label: string; run: () => void}; id: number} | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<ToastApi['show']>((message, action) => {
    if (timer.current) clearTimeout(timer.current);
    setT({message, action, id: Date.now()});
    timer.current = setTimeout(() => setT(null), action ? 5000 : 2600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <ToastCtx.Provider value={{show}}>
      {children}
      {t && (
        <Animated.View key={t.id} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)} style={TS.wrap} pointerEvents="box-none">
          <View style={TS.bar} accessibilityLiveRegion="polite">
            <Text style={TS.text}>{t.message}</Text>
            {t.action && <Press accessibilityRole="button" onPress={() => { t.action?.run(); setT(null); }} quiet><Text style={TS.action}>{t.action.label}</Text></Press>}
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
const TS = StyleSheet.create({
  wrap: {position: 'absolute', left: 16, right: 16, bottom: 150, zIndex: 120, alignItems: 'center'},
  bar: {flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 20, paddingVertical: 13, ...shadow.lift},
  text: {color: C.white, fontWeight: '700', fontSize: 13, flexShrink: 1},
  action: {color: C.yellow, fontWeight: '900', fontSize: 13},
});

/** Textura de fundo para os cartões: pontos (retícula) ou listras diagonais. Nunca captura toque. */
export function Pattern({kind = 'dots', color = '#141B34', opacity = 0.1, size = 16}: {kind?: 'dots' | 'stripes' | 'grid'; color?: string; opacity?: number; size?: number}) {
  const id = `p-${kind}-${size}`;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
      <Defs>
        <SvgPattern id={id} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform={kind === 'stripes' ? 'rotate(45)' : undefined}>
          {kind === 'dots' && <Circle cx={size / 2} cy={size / 2} r={size * 0.12} fill={color} />}
          {kind === 'stripes' && <Line x1={0} y1={0} x2={0} y2={size} stroke={color} strokeWidth={size * 0.28} />}
          {kind === 'grid' && <G stroke={color} strokeWidth={1}><Line x1={0} y1={0} x2={size} y2={0} /><Line x1={0} y1={0} x2={0} y2={size} /></G>}
        </SvgPattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </Svg>
  );
}

/** Número que sobe até o valor (estatísticas). */
export function CountUp({value, style}: {value: number; style?: StyleProp<import('react-native').TextStyle>}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const from = 0, started = Date.now(), dur = 700;
    let raf: ReturnType<typeof setInterval>;
    raf = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / dur);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(raf);
    }, 32);
    return () => clearInterval(raf);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

/** Sobe e desce devagar (pôsteres e selos): dá vida sem distrair. */
export function Float({children, amplitude = 5, duration = 2600, rotate = 0, style}: {children: React.ReactNode; amplitude?: number; duration?: number; rotate?: number; style?: StyleProp<ViewStyle>}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, {duration, easing: Easing.inOut(Easing.sin)}), -1, true);
    return () => cancelAnimation(t);
  }, [t, duration]);
  const a = useAnimatedStyle(() => ({transform: [{translateY: (t.value - 0.5) * 2 * amplitude}, {rotate: `${rotate + (t.value - 0.5) * 1.6}deg`}]}));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
