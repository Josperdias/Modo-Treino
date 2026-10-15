import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, LayoutChangeEvent, PanResponder, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {useReducedMotion, cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Defs, G, Line, Path, Pattern as SvgPattern, Rect} from 'react-native-svg';
import {C} from '../theme';
import type {FitaDeco, FitaPattern, FitaSticker} from '../../logic';
import {tapeIndex} from './tapeIndex';

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

/** Padrões que a pessoa pode pôr no corpo da fita (desenhados por cima da cor, bem de leve). */
export const PATTERNS: {key: FitaPattern; name: string}[] = [{key: 'dots', name: 'Bolinhas'}, {key: 'stripes', name: 'Listras'}, {key: 'check', name: 'Xadrez'}, {key: 'stars', name: 'Estrelas'}];
function PatternDefs() {
  const star = 'M10 2l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z';
  return (
    <Defs>
      <SvgPattern id="pt-dots" patternUnits="userSpaceOnUse" width={16} height={16}><Circle cx={8} cy={8} r={3} fill="#FFFFFF" opacity={0.22} /></SvgPattern>
      <SvgPattern id="pt-stripes" patternUnits="userSpaceOnUse" width={18} height={18} patternTransform="rotate(45)"><Rect x={0} y={0} width={9} height={18} fill="#FFFFFF" opacity={0.2} /></SvgPattern>
      <SvgPattern id="pt-check" patternUnits="userSpaceOnUse" width={24} height={24}><Rect x={0} y={0} width={12} height={12} fill="#FFFFFF" opacity={0.2} /><Rect x={12} y={12} width={12} height={12} fill="#FFFFFF" opacity={0.2} /></SvgPattern>
      <SvgPattern id="pt-stars" patternUnits="userSpaceOnUse" width={30} height={30}><Path d={star} fill="#FFFFFF" opacity={0.24} transform="translate(5 5)" /></SvgPattern>
    </Defs>
  );
}

/** Uma figurinha sobre a fita. Em modo de edição ela se arrasta com o dedo (a posição é uma fração da largura e da altura da fita). */
function StickerView({st, i, w, h, edit, selected, onSelect, onMove}: {st: FitaSticker; i: number; w: number; h: number; edit: boolean; selected: boolean; onSelect?: (i: number) => void; onMove?: (i: number, x: number, y: number) => void}) {
  const fs = Math.max(14, w * 0.12 * st.s);
  const live = useRef({st, w, h, i, onSelect, onMove});
  live.current = {st, w, h, i, onSelect, onMove};
  const start = useRef({x: 0, y: 0});
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,   // a rolagem do painel não rouba o arrasto
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = {x: live.current.st.x, y: live.current.st.y}; live.current.onSelect?.(live.current.i); },
    onPanResponderMove: (_, g) => {
      const c = live.current;
      c.onMove?.(c.i, Math.max(0, Math.min(1, start.current.x + g.dx / Math.max(1, c.w))), Math.max(0, Math.min(1, start.current.y + g.dy / Math.max(1, c.h))));
    },
  }), []);
  return (
    <View {...(edit ? pan.panHandlers : {})} pointerEvents={edit ? 'auto' : 'none'} accessible={edit} accessibilityRole={edit ? 'button' : undefined} accessibilityLabel={edit ? `Figurinha ${st.e}, arraste para mudar de lugar` : undefined}
      style={{position: 'absolute', left: st.x * w - fs * 0.7, top: st.y * h - fs * 0.7, width: fs * 1.4, height: fs * 1.4, alignItems: 'center', justifyContent: 'center', borderRadius: fs, borderWidth: edit && selected ? 2 : 0, borderColor: C.ink, borderStyle: 'dashed', backgroundColor: edit && selected ? 'rgba(255,255,255,.35)' : 'transparent'}}>
      <Text style={{fontSize: fs, lineHeight: fs * 1.22}}>{st.e}</Text>
    </View>
  );
}

export type CassetteEdit = {selected: number | null; onSelect: (i: number) => void; onMove: (i: number, x: number, y: number) => void};

/** Fita cassete: os carretéis giram enquanto toca e a fita passa de um lado para o outro conforme a faixa avança.
 * `deco`: a cor, o padrão, a imagem do rótulo e as figurinhas escolhidas pela pessoa. `edit`: modo de personalizar (figurinhas arrastáveis). */
export default function Cassette({playing, label, side = 'LADO A', progress = 0, deco, edit}: {playing: boolean; label: string; side?: string; progress?: number; deco?: FitaDeco; edit?: CassetteEdit}) {
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
  const h = w * (H / W);
  const p = Math.max(0, Math.min(1, progress));
  const left = 31 - p * 11, right = 20 + p * 11; // raio da fita enrolada em cada lado
  const hub = 40 * k;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const tone = deco?.color != null ? TAPES[deco.color] : null;
  const shell = tone ? tone.body : '#25316C';
  const labelBg = tone ? tone.label : '#FBD4D4';
  const band = tone ? tone.body : '#F6A4C1';
  const ink = tone ? tone.ink : '#443765';
  const hasImg = !!deco?.image;
  return (
    <View onLayout={onLayout} style={CS.wrap} accessible accessibilityRole="image" accessibilityLabel={`Fita cassete ${label}${playing ? ', tocando' : ''}`}>
      <Svg width="100%" height={h} viewBox={`0 0 ${W} ${H}`}>
        <PatternDefs />
        <Rect x={4} y={4} width={W - 8} height={H - 8} rx={20} fill={shell} stroke="#0B1033" strokeWidth={5} />
        {deco?.pattern ? <Rect x={6} y={6} width={W - 12} height={H - 12} rx={18} fill={`url(#pt-${deco.pattern})`} /> : null}
        <Rect x={22} y={18} width={W - 44} height={74} rx={10} fill={labelBg} stroke={tone ? '#0B1033' : '#EA9CC9'} strokeWidth={2} />
        {!hasImg && <Rect x={22} y={70} width={W - 44} height={22} rx={0} fill={band} opacity={tone ? 0.35 : 0.55} />}
        <Rect x={44} y={92} width={W - 88} height={66} rx={33} fill="#090D23" stroke="#53629D" strokeWidth={3} />
        <Circle cx={LEFT.x} cy={LEFT.y} r={left} fill="#3A2A22" />
        <Circle cx={RIGHT.x} cy={RIGHT.y} r={right} fill="#3A2A22" />
        <Rect x={102} y={156} width={116} height={26} rx={6} fill="#101733" opacity={0.7} />
        <Circle cx={118} cy={170} r={4} fill="#53629D" /><Circle cx={202} cy={170} r={4} fill="#53629D" />
      </Svg>
      {hasImg ? <Image source={{uri: deco!.image}} resizeMode="cover" style={{position: 'absolute', left: 23 * k, top: 19 * k, width: (W - 46) * k, height: 72 * k, borderRadius: 9 * k}} /> : null}
      <Animated.View style={[CS.reel, {left: (LEFT.x - 20) * k, top: (LEFT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <Animated.View style={[CS.reel, {left: (RIGHT.x - 20) * k, top: (RIGHT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <View style={[CS.sticker, {left: 34 * k, right: 34 * k, top: 24 * k}]} pointerEvents="none">
        <Text style={[CS.side, {color: hasImg ? '#FFFFFF' : ink, textShadowColor: hasImg ? 'rgba(11,16,51,.7)' : 'transparent', textShadowRadius: 4}]}>MODO MÚSICA · {side}</Text>
        <View style={hasImg ? CS.titleOnImg : undefined}><Text numberOfLines={1} style={[CS.title, hasImg && {marginTop: 0}]}>{label.toUpperCase()}</Text></View>
      </View>
      {deco?.stickers?.map((st, i) => (
        <StickerView key={i} st={st} i={i} w={w} h={h} edit={!!edit} selected={edit?.selected === i} onSelect={edit?.onSelect} onMove={edit?.onMove} />
      ))}
    </View>
  );
}

const CS = StyleSheet.create({
  wrap: {width: '100%'},
  reel: {position: 'absolute'},
  sticker: {position: 'absolute'},
  side: {fontSize: 9, letterSpacing: 1.4, fontWeight: '900', color: '#443765'},
  title: {fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 4, letterSpacing: -0.4},
  titleOnImg: {alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,.82)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4},
});

// Cada fita tem a sua cor, para reconhecer uma música de relance na lista (corpo, rótulo e carretéis combinam).
export const TAPES: {body: string; label: string; ink: string}[] = [
  {body: '#F0568A', label: '#FFD3E3', ink: '#7A1740'},   // rosa
  {body: '#3F7BEA', label: '#CFE0FF', ink: '#173E8F'},   // azul
  {body: '#F5B71F', label: '#FFEDB0', ink: '#7A5200'},   // amarelo
  {body: '#2DB67C', label: '#C9F3DF', ink: '#0F5E3E'},   // verde
  {body: '#8A5CE6', label: '#E2D4FF', ink: '#42218F'},   // roxo
  {body: '#F2793A', label: '#FFD9C2', ink: '#8A3410'},   // laranja
  {body: '#1FB5C9', label: '#C7F1F7', ink: '#0B5D69'},   // turquesa
  {body: '#E0453F', label: '#FFD0CD', ink: '#7C1814'},   // vermelho
];
const BORDER = '#0B1033';

/** Mini cassete de UMA música (uma fita), colorido por música. Estático e leve de propósito: listas com centenas de fitas.
 * Personalização opcional: `color` troca a cor, `stickers` coloca as figurinhas nos lugares escolhidos, `image` vira a capa no rótulo e `note` cola um bilhetinho amarelo. */
export const MiniTape = React.memo(function MiniTape({id, size = 76, color, stickers, image, note}: {id: string; size?: number; on?: boolean; color?: number; stickers?: FitaSticker[]; image?: string; note?: boolean}) {
  const t = TAPES[color ?? tapeIndex(id)] || TAPES[tapeIndex(id)];
  const h = size * 0.64, k = size / 100;
  return (
    <View style={{width: size, height: h}}>
      <Svg width={size} height={h} viewBox="0 0 100 64">
        <Rect x={2} y={2} width={96} height={60} rx={9} fill={t.body} stroke={BORDER} strokeWidth={3} />
        <Rect x={9} y={7} width={82} height={24} rx={4} fill={t.label} stroke={BORDER} strokeWidth={1.5} />
        {!image && <Rect x={16} y={14} width={44} height={3} rx={1.5} fill={t.ink} opacity={0.75} />}
        {!image && <Rect x={16} y={20} width={28} height={3} rx={1.5} fill={t.ink} opacity={0.45} />}
        <Rect x={16} y={34} width={68} height={20} rx={10} fill="#0B1033" />
        <Circle cx={32} cy={44} r={6.5} fill="#F7F3EA" /><Circle cx={32} cy={44} r={2.4} fill={t.body} />
        <Circle cx={68} cy={44} r={6.5} fill="#F7F3EA" /><Circle cx={68} cy={44} r={2.4} fill={t.body} />
      </Svg>
      {image ? <Image source={{uri: image}} resizeMode="cover" style={{position: 'absolute', left: 10 * k, top: 8 * k, width: 80 * k, height: 22 * k, borderRadius: 3 * k}} /> : null}
      {(stickers || []).slice(0, 6).map((st, i) => {
        const fs = Math.max(9, size * 0.17 * st.s);
        return <Text key={i} pointerEvents="none" style={{position: 'absolute', left: st.x * size - fs * 0.6, top: st.y * h - fs * 0.62, fontSize: fs, lineHeight: fs * 1.2}}>{st.e}</Text>;
      })}
      {note ? <View pointerEvents="none" style={{position: 'absolute', top: -2 * k, right: -3 * k, width: 15 * k, height: 15 * k, backgroundColor: '#FFE27A', borderWidth: 1.5, borderColor: BORDER, borderRadius: 2, transform: [{rotate: '8deg'}]}} /> : null}
    </View>
  );
});
