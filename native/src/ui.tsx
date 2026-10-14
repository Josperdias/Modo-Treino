import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {Modal, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, TextStyle, useWindowDimensions, View, ViewStyle} from 'react-native';
import {Text} from './text';
import Animated, {useReducedMotion, cancelAnimation, Easing, FadeInDown, FadeOutDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Defs, G, Line, LinearGradient, Path, Pattern as SvgPattern, Rect, Stop} from 'react-native-svg';
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

/** Texto de uma linha que encolhe para caber na largura disponível (react-native-web não tem adjustsFontSizeToFit). */
export function FitText({children, style, minScale = 0.62}: {children: string; style: StyleProp<TextStyle>; minScale?: number}) {
  const [w, setW] = useState(0);
  const flat = StyleSheet.flatten(style) || {};
  const base = Number(flat.fontSize ?? 14);
  const display = String(flat.fontWeight) === '900';
  const em = base * (display ? 1.2 : 1);
  const est = children.length * (em * (display ? 0.52 : 0.58) + Number(flat.letterSpacing ?? 0));
  const scale = w > 0 && est > w ? Math.max(minScale, w / est) : 1;
  return (
    <View style={{flex: 1, minWidth: 0}} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Text numberOfLines={1} style={[style, {fontSize: base * scale, textAlign: 'center'}]}>{children}</Text>
    </View>
  );
}

/** Botão "adesivo": borda de tinta + sombra dura. Ao apertar, a frente afunda na sombra (como um botão físico). */
type PopProps = Omit<PressableProps, 'style'> & {color?: string; radius?: number; offset?: number; shadowColor?: string; style?: StyleProp<ViewStyle>; innerStyle?: StyleProp<ViewStyle>; quiet?: boolean; border?: boolean; children?: React.ReactNode};
export function Pop({color = C.yellow, radius = R.pill, offset = 4, shadowColor = C.ink, style, innerStyle, quiet = false, border = true, onPress, children, disabled, ...rest}: PopProps) {
  const p = useSharedValue(0);
  const front = useAnimatedStyle(() => ({transform: [{translateX: p.value * offset}, {translateY: p.value * offset}]}));
  const st = rest.accessibilityState;
  const aria: Record<string, unknown> = {};
  if (st) {
    if (st.checked !== undefined) aria['aria-checked'] = st.checked;
    if (st.selected !== undefined) aria['aria-selected'] = st.selected;
    if (st.expanded !== undefined) aria['aria-expanded'] = st.expanded;
    if (st.disabled !== undefined) aria['aria-disabled'] = st.disabled;
  }
  return (
    <Pressable
      {...rest}
      {...aria}
      disabled={disabled}
      style={[{marginRight: offset, marginBottom: offset, opacity: disabled ? 0.45 : 1}, style]}
      onPressIn={() => { p.value = withTiming(1, {duration: 60}); }}
      onPressOut={() => { p.value = withTiming(0, {duration: 160, easing: Easing.out(Easing.back(2.2))}); }}
      onPress={(e) => {
        if (!quiet) playSound('button');
        Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}>
      <View pointerEvents="none" style={{position: 'absolute', left: offset, top: offset, right: -offset, bottom: -offset, borderRadius: radius, backgroundColor: shadowColor}} />
      <Animated.View style={[{borderRadius: radius, backgroundColor: color, overflow: 'hidden'}, border && {borderWidth: 2, borderColor: C.ink}, front, innerStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

type BtnProps = {lines?: number; text: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'dark' | 'ghost' | 'danger' | 'pink'; disabled?: boolean; small?: boolean; label?: string; style?: StyleProp<ViewStyle>};
export function Btn({lines = 1, text, onPress, icon, kind = 'primary', disabled, small, label, style}: BtnProps) {
  const bg = kind === 'primary' ? C.yellow : kind === 'dark' ? C.ink : kind === 'danger' ? '#FBE3E8' : kind === 'pink' ? C.pink : C.card;
  const fg = kind === 'dark' ? C.yellow : kind === 'danger' ? '#9B2C4A' : C.ink;
  return (
    <Pop accessibilityRole="button" accessibilityLabel={label || text} accessibilityState={{disabled: !!disabled}} disabled={disabled} onPress={onPress} color={bg} offset={small ? 3 : 4}
      shadowColor={kind === 'dark' ? C.yellow : C.ink} style={[{alignSelf: 'stretch'}, style]} innerStyle={[B.btn, small && B.small]}>
      {icon && <Icon name={icon} size={small ? 17 : 20} color={fg} />}
      {lines > 1
        ? <Text numberOfLines={lines} style={[B.text, {textAlign: 'center'}, small && {fontSize: 12}, {color: fg}]}>{text}</Text>
        : <FitText style={[B.text, small && {fontSize: 12}, {color: fg}]}>{text}</FitText>}
    </Pop>
  );
}
const B = StyleSheet.create({
  btn: {minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9},
  small: {minHeight: 42, paddingHorizontal: 14},
  text: {fontSize: 15, fontWeight: '900', letterSpacing: 0.8, flexShrink: 1},
});

/** Cartão "adesivo" estático (borda de tinta + sombra dura). */
export function Card({children, style, outer, color = C.card, offset = 4, pattern, shadowColor = C.ink}: {children: React.ReactNode; style?: StyleProp<ViewStyle>; outer?: StyleProp<ViewStyle>; color?: string; offset?: number; pattern?: React.ReactNode; shadowColor?: string}) {
  return (
    <View style={[{marginRight: offset, marginBottom: offset}, outer]}>
      <View pointerEvents="none" style={{position: 'absolute', left: offset, top: offset, right: -offset, bottom: -offset, borderRadius: R.lg, backgroundColor: shadowColor}} />
      <View style={[{backgroundColor: color, borderRadius: R.lg, padding: 18, borderWidth: 2, borderColor: C.ink, overflow: 'hidden'}, style]}>{pattern}{children}</View>
    </View>
  );
}
export const AText = Animated.createAnimatedComponent(Text);

export function Kicker({children, color}: {children: string; color?: string}) { return <Text style={[T.kicker, color ? {color} : null]}>{children}</Text>; }

export function Chips<V extends string | number>({options, value, onChange, format, label}: {options: V[]; value: V; onChange: (v: V) => void; format?: (v: V) => string; label: (v: V) => string}) {
  return (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pop key={String(o)} accessibilityRole="button" accessibilityLabel={label(o)} accessibilityState={{selected: on}} onPress={() => onChange(o)} color={on ? C.ink : C.card} offset={on ? 2 : 3} quiet innerStyle={CH.chip}>
            <Text style={[CH.text, on && {color: C.yellow}]}>{format ? format(o) : String(o)}</Text>
          </Pop>
        );
      })}
    </View>
  );
}
const CH = StyleSheet.create({
  chip: {paddingHorizontal: 16, minHeight: 38, alignItems: 'center', justifyContent: 'center'},
  text: {fontSize: 16, fontWeight: '900', color: C.ink, letterSpacing: 0.4},
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

/** Borda de bolinhas rosa no alto da folha: o degradê some para cima e as bolinhas vão aparecendo (crescem até encostar na folha). */
const EDGE_H = 120;
/** A borda continua por trás dos cantos arredondados da folha (sem isso aparecia um vão cinza em cada canto). */
const EDGE_EXTRA = 36;
function SheetEdge({width}: {width: number}) {
  const total = EDGE_H + EDGE_EXTRA;
  const rows = React.useMemo(() => {
    const gap = 14; const n = Math.floor(total / gap); const cols = Math.ceil(width / gap) + 1;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const up = Math.max(0, i * gap - EDGE_EXTRA);   // quanto acima da folha a fileira está
      const r = 6.2 * Math.pow(Math.max(0, 1 - up / EDGE_H), 1.25);
      if (r < 0.6) continue;
      const y = total - 6 - i * gap; const off = i % 2 ? gap / 2 : 0;
      let d = '';
      for (let c = 0; c < cols; c++) { const x = c * gap + off - gap / 2; d += `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; }
      out.push(d);
    }
    return out;
  }, [width, total]);
  const solid = (EDGE_H / total).toFixed(3);
  return (
    <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: -EDGE_H, height: total}}>
      <Svg width={width} height={total}>
        <Defs>
          <LinearGradient id="sheetEdge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F472B6" stopOpacity="0" />
            <Stop offset={(EDGE_H * 0.55 / total).toFixed(3)} stopColor="#F472B6" stopOpacity="0.22" />
            <Stop offset={solid} stopColor="#F472B6" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#F472B6" stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={total} fill="url(#sheetEdge)" />
        {rows.map((d, i) => <Path key={i} d={d} fill="#FF9AD0" fillOpacity={0.8} />)}
      </Svg>
    </View>
  );
}

/** Folha que sobe de baixo (substitui as páginas extras): ajustes, edição, escolher músicas. */
/** `scroll`: o conteúdo rola dentro do painel quando é mais alto que a tela (em vez de ser cortado embaixo). */
export function Sheet({visible, onClose, title, children, tall, scroll}: {visible: boolean; onClose: () => void; title: string; children: React.ReactNode; tall?: boolean; scroll?: boolean}) {
  const {height, width} = useWindowDimensions();
  const reduce = useReducedMotion();
  // Altura máxima em pixels (a porcentagem não limitava o conteúdo: ele passava do fim da tela e os botões ficavam cortados).
  const maxH = Math.round(height * 0.9);
  // O fundo escuro aparece com fade e só a folha sobe (antes o fundo subia junto, com uma quina dura no meio da tela).
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = withTiming(1, {duration: reduce ? 0 : 340, easing: Easing.out(Easing.cubic)});
      return;
    }
    p.value = withTiming(0, {duration: reduce ? 0 : 240, easing: Easing.in(Easing.cubic)});
    const t = setTimeout(() => setMounted(false), reduce ? 0 : 260);
    return () => clearTimeout(t);
  }, [visible, reduce, p]);
  const backStyle = useAnimatedStyle(() => ({opacity: p.value}));
  const sheetStyle = useAnimatedStyle(() => ({transform: [{translateY: (1 - p.value) * (maxH + EDGE_H)}]}));
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={SH.back}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(16,23,51,.55)'}, backStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" accessibilityRole="button" />
        <Animated.View style={sheetStyle}>
          <SheetEdge width={width} />
          <View style={[SH.sheet, {maxHeight: maxH}, tall && {height: Math.round(height * 0.88)}]} accessibilityViewIsModal>
            <View style={SH.grab} />
            <View style={SH.head}>
              <Text style={[T.h2, {flex: 1}]} accessibilityRole="header">{title}</Text>
              <Press accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={SH.close} quiet><Icon name="close" size={20} /></Press>
            </View>
            {scroll ? <ScrollView style={{flexGrow: 0, flexShrink: 1}} contentContainerStyle={{paddingBottom: 8}} showsVerticalScrollIndicator={false} bounces={false}>{children}</ScrollView> : children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
/** Pergunta de confirmação no meio da tela (funciona também no navegador, onde o Alert do React Native não faz nada). */
export function Confirm({visible, title, text, confirmLabel, cancelLabel = 'VOLTAR', danger, onConfirm, onCancel}: {visible: boolean; title: string; text?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={CF.back}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Fechar a pergunta" accessibilityRole="button" />
        <View style={CF.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={CF.title}>{title}</Text>
          {text ? <Text style={CF.text}>{text}</Text> : null}
          <View style={CF.row}>
            <Press accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onCancel} style={[CF.btn, CF.cancel]} quiet><Text style={CF.cancelText}>{cancelLabel}</Text></Press>
            <Press accessibilityRole="button" accessibilityLabel={confirmLabel} onPress={onConfirm} style={[CF.btn, danger ? CF.danger : CF.ok]} quiet><Text style={CF.okText}>{confirmLabel}</Text></Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const CF = StyleSheet.create({
  back: {flex: 1, backgroundColor: 'rgba(16,23,51,.6)', alignItems: 'center', justifyContent: 'center', padding: 24},
  card: {alignSelf: 'stretch', backgroundColor: C.paper, borderRadius: R.xl, padding: 22, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 5},
  title: {fontSize: 26, fontWeight: '900', color: C.ink, lineHeight: 28},
  text: {fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 10},
  row: {flexDirection: 'row', gap: 10, marginTop: 20},
  btn: {flex: 1, minHeight: 52, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4},
  cancel: {backgroundColor: C.white},
  cancelText: {fontSize: 14, fontWeight: '900', letterSpacing: 0.6, color: C.ink},
  ok: {backgroundColor: C.yellow},
  danger: {backgroundColor: '#F4A3A3'},
  okText: {fontSize: 14, fontWeight: '900', letterSpacing: 0.6, color: C.ink, textAlign: 'center'},
});

const SH = StyleSheet.create({
  back: {flex: 1, justifyContent: 'flex-end'},
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
  const t = useSharedValue(0.5);
  const reduce = useReducedMotion(); // "remover animações" do sistema: fica parado
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, {duration, easing: Easing.inOut(Easing.sin)}), -1, true);
    return () => cancelAnimation(t);
  }, [t, duration, reduce]);
  const a = useAnimatedStyle(() => ({transform: [{translateY: (t.value - 0.5) * 2 * amplitude}, {rotate: `${rotate + (t.value - 0.5) * 1.6}deg`}]}));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Respira devagar (cronômetro de descanso, botão principal): chama a atenção sem piscar. */
export function Pulse({children, scale = 1.03, duration = 1500, style}: {children: React.ReactNode; scale?: number; duration?: number; style?: StyleProp<ViewStyle>}) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, {duration, easing: Easing.inOut(Easing.quad)}), -1, true);
    return () => cancelAnimation(t);
  }, [t, duration, reduce]);
  const a = useAnimatedStyle(() => ({transform: [{scale: 1 + (scale - 1) * t.value}]}));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Brilho que acende e apaga (decoração do hero). */
export function Twinkle({size = 16, color = C.ink, delay = 0, style}: {size?: number; color?: string; delay?: number; style?: StyleProp<ViewStyle>}) {
  const t = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => { t.value = withRepeat(withTiming(1, {duration: 1100, easing: Easing.inOut(Easing.sin)}), -1, true); }, delay);
    return () => { clearTimeout(id); cancelAnimation(t); };
  }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({opacity: 0.25 + 0.75 * t.value, transform: [{scale: 0.7 + 0.5 * t.value}, {rotate: `${t.value * 25}deg`}]}));
  return <Animated.View pointerEvents="none" style={[{position: 'absolute'}, style, a]}><Ionicons name="sparkles" size={size} color={color} /></Animated.View>;
}

/** Salta quando `trigger` fica verdadeiro (ícone da aba escolhida). */
export function Bounce({trigger, children}: {trigger: boolean; children: React.ReactNode}) {
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (trigger) s.value = withSequence(withTiming(1.3, {duration: 120, easing: Easing.out(Easing.quad)}), withTiming(1, {duration: 220, easing: Easing.out(Easing.back(2))}));
  }, [trigger, s]);
  const a = useAnimatedStyle(() => ({transform: [{scale: s.value}]}));
  return <Animated.View style={a}>{children}</Animated.View>;
}

/** Barrinhas de equalizador: dançam quando está tocando. */
export function Equalizer({active, color = C.ink, size = 18}: {active: boolean; color?: string; size?: number}) {
  const bars = [useSharedValue(0.35), useSharedValue(0.6), useSharedValue(0.45)];
  const reduce = useReducedMotion();
  useEffect(() => {
    bars.forEach((b, i) => {
      if (active && reduce) b.value = 0.7;
      else if (active) b.value = withRepeat(withSequence(withTiming(1, {duration: 320 + i * 110}), withTiming(0.25, {duration: 380 + i * 90})), -1, true);
      else { cancelAnimation(b); b.value = withTiming(0.3, {duration: 150}); }
    });
    return () => bars.forEach((b) => cancelAnimation(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);
  const styles = bars.map((b) => useAnimatedStyle(() => ({height: size * b.value}))); // eslint-disable-line react-hooks/rules-of-hooks
  return (
    <View style={{height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 2.5}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {styles.map((st, i) => <Animated.View key={i} style={[{width: 3.5, borderRadius: 2, backgroundColor: color}, st]} />)}
    </View>
  );
}

/** Confete que cai uma vez (treino completo). Não captura toques. */
const CONFETTI = [C.yellow, C.pink, C.sky, C.mint, C.white, C.ink];
export function Confetti({count = 28}: {count?: number}) {
  const [h, setH] = useState(0);
  const reduce = useReducedMotion();
  const pieces = useRef(Array.from({length: count}, (_, i) => ({
    x: Math.random(), delay: Math.random() * 700, dur: 1800 + Math.random() * 1400, rot: (Math.random() - 0.5) * 900, drift: (Math.random() - 0.5) * 80,
    w: 7 + Math.random() * 7, hgt: 10 + Math.random() * 10, color: CONFETTI[i % CONFETTI.length], round: i % 4 === 0,
  }))).current;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h > 0 && !reduce && pieces.map((p, i) => <ConfettiPiece key={i} p={p} h={h} />)}
    </View>
  );
}
function ConfettiPiece({p, h}: {p: {x: number; delay: number; dur: number; rot: number; drift: number; w: number; hgt: number; color: string; round: boolean}; h: number}) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withDelay(p.delay, withTiming(1, {duration: p.dur, easing: Easing.in(Easing.quad)})); return () => cancelAnimation(t); }, [t, p]);
  const a = useAnimatedStyle(() => ({opacity: t.value > 0.9 ? (1 - t.value) * 10 : 1, transform: [{translateY: -30 + t.value * (h + 60)}, {translateX: Math.sin(t.value * 6) * p.drift}, {rotate: `${t.value * p.rot}deg`}]}));
  return <Animated.View style={[{position: 'absolute', top: 0, left: `${p.x * 100}%`, width: p.w, height: p.round ? p.w : p.hgt, borderRadius: p.round ? p.w : 2, backgroundColor: p.color}, a]} />;
}
