import React, {useEffect, useState} from 'react';
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import Svg, {Circle, Defs, G, LinearGradient, Path, Pattern, Polygon, Rect, Stop} from 'react-native-svg';
import {Text} from '../text';
import {Icon, Press} from '../ui';
import {C} from '../theme';
import Animated, {Easing, SlideInDown, SlideOutDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming} from 'react-native-reanimated';
import {MiniTape} from './Cassette';
import {useHeroGone} from './dock';
import {useMusic, useMusicProgress} from './MusicProvider';

/** Visor LCD verde-limão (anos 2000): fundo claro, letras escuras. A fonte é a monoespaçada do sistema (nenhum arquivo de fonte novo). */
const LCD = {ink: '#0B3D1A', dim: '#2E9E49', edge: '#0B2A14'};
const GOLD = {top: '#FFE27A', mid: '#FFC93C', low: '#F0A81C'};
const MONO = Platform.select({android: 'monospace', ios: 'Menlo', default: 'Courier New, monospace'});
const SEGMENTS = 20;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const INK = C.ink;

/** Camada de desenho do tamanho exato do pai (padrões em pixels reais, sem esticar). */
function useBox() {
  const [box, setBox] = useState({w: 0, h: 0});
  const onLayout = (e: {nativeEvent: {layout: {width: number; height: number}}}) => {
    const {width, height} = e.nativeEvent.layout;
    setBox((o) => (Math.abs(o.w - width) < 0.5 && Math.abs(o.h - height) < 0.5 ? o : {w: width, h: height}));
  };
  return {...box, onLayout};
}

/** Corpo dourado do rádio: degradê, meio-tom (bolinhas), faixa xadrez de corrida embaixo e listas rosa na lateral. */
function GoldBody() {
  const {w, h, onLayout} = useBox();
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GOLD.top} /><Stop offset="0.5" stopColor={GOLD.mid} /><Stop offset="1" stopColor={GOLD.low} />
            </LinearGradient>
            <Pattern id="halftone" x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
              <Circle cx={3} cy={3} r={1.7} fill="#C77A00" opacity={0.3} />
              <Circle cx={9} cy={9} r={1.7} fill="#C77A00" opacity={0.3} />
            </Pattern>
            <Pattern id="checker" x={0} y={0} width={10} height={10} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={5} height={5} fill={INK} /><Rect x={5} y={5} width={5} height={5} fill={INK} />
              <Rect x={5} y={0} width={5} height={5} fill="#FFFFFF" /><Rect x={0} y={5} width={5} height={5} fill="#FFFFFF" />
            </Pattern>
            <Pattern id="stripes" x={0} y={0} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect x={0} y={0} width={3} height={8} fill="#FF4FA3" opacity={0.55} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#gold)" />
          <Rect x={0} y={0} width={w} height={h} fill="url(#halftone)" />
          <Rect x={0} y={0} width={w} height={h * 0.16} fill="#FFFFFF" opacity={0.2} />
          <Rect x={0} y={h - 6} width={w} height={6} fill="url(#checker)" />
          <Rect x={0} y={h - 7} width={w} height={1.5} fill={INK} />
          <Rect x={w - 30} y={0} width={30} height={h - 7} fill="url(#stripes)" />
        </Svg>
      )}
    </View>
  );
}

/** Fundo atrás do rádio: bolinhas pequenas, como o cabeçalho do app. */
function DotsBack() {
  const {w, h, onLayout} = useBox();
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <Pattern id="navydots" x={0} y={0} width={14} height={14} patternUnits="userSpaceOnUse"><Circle cx={7} cy={7} r={1.2} fill="#FFFFFF" opacity={0.14} /></Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#navydots)" />
        </Svg>
      )}
    </View>
  );
}

/** Linhas de varredura e reflexo do vidro do visor. */
function LcdGlass() {
  const {w, h, onLayout} = useBox();
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <Pattern id="scan" x={0} y={0} width={4} height={3} patternUnits="userSpaceOnUse"><Rect x={0} y={2} width={4} height={1} fill={LCD.edge} opacity={0.12} /></Pattern>
            <Pattern id="pixels" x={0} y={0} width={3} height={3} patternUnits="userSpaceOnUse"><Rect x={2} y={0} width={1} height={3} fill={LCD.edge} opacity={0.05} /></Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#pixels)" />
          <Rect x={0} y={0} width={w} height={h} fill="url(#scan)" />
          <G opacity={0.28}><Polygon points={`${w * 0.1},0 ${w * 0.32},0 ${w * 0.12},${h} 0,${h}`} fill="#FFFFFF" /></G>
        </Svg>
      )}
    </View>
  );
}

/** Alto-falante: grade de pontinhos escuros. */
function Grill({cols = 2, rows = 5}: {cols?: number; rows?: number}) {
  const w = cols * 7, h = rows * 7;
  return (
    <View style={{width: w, height: h, flexShrink: 0}}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => <Circle key={`${r}-${c}`} cx={3.5 + c * 7} cy={3.5 + r * 7} r={2.2} fill={INK} opacity={0.85} />))}
      </Svg>
    </View>
  );
}

/** Adesivos do rádio (vetor, sem imagem): estrela, raio, carinha, nota e selo MUSIC. Só enfeite: não captam toque. */
const Sticker = ({style, children}: {style: object; children: React.ReactNode}) => <View pointerEvents="none" style={[MP.sticker, style]}>{children}</View>;
function Stickers({narrow}: {narrow: boolean}) {
  return (
    <>
      <Sticker style={{left: -2, top: 1, transform: [{rotate: '-14deg'}]}}>
        <Svg width={24} height={24} viewBox="0 0 24 24"><Polygon points="12,1.5 15,9 23,9.5 17,14.8 19,22.5 12,18.3 5,22.5 7,14.8 1,9.5 9,9" fill="#F46FA0" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></Svg>
      </Sticker>
      <Sticker style={{right: narrow ? 6 : 54, top: 0, transform: [{rotate: '12deg'}]}}>
        <Svg width={20} height={22} viewBox="0 0 24 26"><Polygon points="15,1 4,15 11,15 8,25 21,10 13,10" fill="#FF4FA3" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></Svg>
      </Sticker>
      <Sticker style={{right: 4, bottom: 0, transform: [{rotate: '10deg'}]}}>
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M9 18V5l11-2v13" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Path d="M9 18V5l11-2v13" stroke="#F46FA0" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Circle cx={6.5} cy={18} r={3.3} fill="#F46FA0" stroke={INK} strokeWidth={1.6} /><Circle cx={17.5} cy={16} r={3.3} fill="#F46FA0" stroke={INK} strokeWidth={1.6} /></Svg>
      </Sticker>
      {!narrow && (
        <Sticker style={{left: 6, bottom: 0, transform: [{rotate: '-6deg'}]}}>
          <View style={MP.badge}><Text style={MP.badgeText}>MUSIC</Text></View>
        </Sticker>
      )}
      <Sticker style={{right: 70, bottom: 0}}>
        <Svg width={18} height={18} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={10.5} fill="#FFD23A" stroke={INK} strokeWidth={1.8} /><Circle cx={8.5} cy={10} r={1.5} fill={INK} /><Circle cx={15.5} cy={10} r={1.5} fill={INK} /><Path d="M7 14.2c1.4 2.6 8.6 2.6 10 0" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" /></Svg>
      </Sticker>
    </>
  );
}

/** Relógio + barra de segmentos do visor. Fica num componente próprio: só ele re-renderiza a cada atualização de posição. */
function LcdClock({live, playing}: {live: boolean; playing: boolean}) {
  const {position, duration} = useMusicProgress();
  const pct = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const lit = Math.round(pct * SEGMENTS);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Progresso da música" accessibilityValue={{min: 0, max: 100, now: Math.round(pct * 100)}}>
      <View style={MP.lcdTop}>
        <Text numberOfLines={1} style={MP.lcdTiny}>{live ? 'Rádio ao vivo' : playing ? 'Tocando agora' : 'Pausado'}</Text>
        {!live && duration > 0 ? <Text style={MP.lcdTiny}>{mmss(position)}</Text> : null}
      </View>
      {!live ? (
        <View style={MP.segs}>
          {Array.from({length: SEGMENTS}, (_, i) => <View key={i} style={[MP.seg, i < lit && MP.segOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

/** Nome da música no visor: se for maior que a janela, rola de um lado a outro (só enquanto toca; parado fica fixo). */
function LcdMarquee({text, run}: {text: string; run: boolean}) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState(0);
  const [wide, setWide] = useState(0);
  const x = useSharedValue(0);
  const over = Math.max(0, wide - box);
  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (run && !reduce && over > 0) x.value = withDelay(900, withRepeat(withTiming(-over, {duration: Math.max(2200, over * 34), easing: Easing.inOut(Easing.quad)}), -1, true));
    return () => cancelAnimation(x);
  }, [run, reduce, over, text, x]);
  const move = useAnimatedStyle(() => ({transform: [{translateX: x.value}]}));
  return (
    <View style={MP.marquee} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
      <Animated.View style={[MP.marqueeRow, move]}>
        <Text numberOfLines={1} onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={MP.lcdTitle}>{text}</Text>
      </Animated.View>
    </View>
  );
}

/** Equalizador de 5 barras: só mexe enquanto toca (e se o sistema não pedir menos movimento). */
function Eq({on}: {on: boolean}) {
  return <View style={MP.eq}>{[0, 1, 2, 3, 4].map((i) => <EqBar key={i} i={i} on={on} />)}</View>;
}
function EqBar({i, on}: {i: number; on: boolean}) {
  const reduce = useReducedMotion();
  const h = useSharedValue(0.25);
  useEffect(() => {
    cancelAnimation(h);
    if (on && !reduce) h.value = withDelay(i * 90, withRepeat(withTiming(1, {duration: 380 + i * 110, easing: Easing.inOut(Easing.quad)}), -1, true));
    else h.value = withTiming(on ? 0.6 : 0.2, {duration: 200});
    return () => cancelAnimation(h);
  }, [on, reduce, i, h]);
  const st = useAnimatedStyle(() => ({height: 4 + h.value * 20}));
  return <Animated.View style={[MP.eqBar, st]} />;
}

/** Faixa tocando agora, sempre à mão: um rádio dourado com a janela da fita, visor LCD verde, equalizador, adesivos e teclas. */
export default function MiniPlayer({onOpen}: {onOpen: () => void; dark?: boolean}) {
  const m = useMusic();
  const {width} = useWindowDimensions();
  if (!m.now && !m.tapeTracks.length && !m.library.length) return null;
  const narrow = width < 360;
  const wide = width >= 400;   // só aí cabem o equalizador e o alto-falante da direita
  const title = m.now?.title || `Bag ${m.activeTape.name}`;
  const lcdText = m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : m.now?.title || 'Rádio ao vivo') : title;
  return (
    <View style={MP.wrap}>
      <DotsBack />
      <View style={MP.bar} accessibilityRole="toolbar" accessibilityLabel="Player de música">
        <GoldBody />
        {!narrow && <Grill />}
        <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. ${m.now ? 'Tocando ' + m.now.title : 'Nada tocando'}`} onPress={onOpen} style={MP.info} quiet>
          <View style={MP.deck}>
            {m.now && !m.live
              ? <MiniTape id={m.now.id} size={44} />
              : <View style={[MP.disc, m.playing && {backgroundColor: C.pink}]}><Icon name={m.live ? 'radio' : 'musical-notes'} size={18} color={C.ink} /></View>}
          </View>
          <View style={MP.lcd}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
              <Defs><LinearGradient id="lcdg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#B6FF8A" /><Stop offset="1" stopColor="#3FD64F" /></LinearGradient></Defs>
              <Rect x={0} y={0} width={100} height={100} fill="url(#lcdg)" />
            </Svg>
            <LcdGlass />
            <View style={MP.lcdRow}>
              <Icon name="musical-notes" size={16} color={LCD.ink} />
              <View style={{flex: 1, minWidth: 0}}>
                <LcdMarquee text={lcdText} run={m.playing} />
                {m.now ? <LcdClock live={m.live} playing={m.playing} /> : <Text style={MP.lcdTiny}>Sem fita</Text>}
              </View>
              {wide && <Eq on={m.playing} />}
            </View>
          </View>
        </Press>
        {!narrow && <Press accessibilityRole="button" accessibilityLabel="Voltar uma faixa" onPress={() => m.skip(-1)} style={MP.key} quiet><Icon name="play-skip-back" size={17} color={C.white} /></Press>}
        <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={MP.play} quiet><Icon name={m.playing ? 'pause' : 'play'} size={20} color={C.ink} /></Press>
        <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={MP.key} quiet><Icon name="play-skip-forward" size={17} color={C.white} /></Press>
        {wide && <Grill />}
      </View>
      <Stickers narrow={narrow} />
    </View>
  );
}
const MP = StyleSheet.create({
  wrap: {paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, backgroundColor: C.navy2},
  bar: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 20, borderWidth: 3, borderColor: INK, overflow: 'hidden'},
  sticker: {position: 'absolute'},
  badge: {backgroundColor: C.white, borderWidth: 2, borderColor: INK, borderRadius: 6, paddingHorizontal: 4, transform: [{rotate: '-4deg'}]},
  badgeText: {fontSize: 9, lineHeight: 11, fontWeight: '900', color: INK, letterSpacing: 0.5},
  info: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5},
  deck: {width: 52, height: 50, borderRadius: 10, backgroundColor: '#0B1033', borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center'},
  disc: {width: 34, height: 34, borderRadius: 17, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  lcd: {flex: 1, minWidth: 0, minHeight: 50, borderRadius: 10, borderWidth: 3, borderColor: LCD.edge, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', justifyContent: 'center'},
  lcdRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  marquee: {height: 19, overflow: 'hidden'},
  marqueeRow: {position: 'absolute', left: 0, top: 0, width: 4000, flexDirection: 'row'},
  lcdTitle: {alignSelf: 'flex-start', fontFamily: MONO, fontSize: 14, lineHeight: 19, fontWeight: '700', color: LCD.ink},
  lcdTop: {flexDirection: 'row', justifyContent: 'space-between', gap: 4},
  lcdTiny: {flexShrink: 1, fontFamily: MONO, fontSize: 10, lineHeight: 12, fontWeight: '700', color: LCD.ink, opacity: 0.85},
  segs: {flexDirection: 'row', gap: 1.5, marginTop: 2},
  seg: {flex: 1, height: 3, borderRadius: 1, backgroundColor: LCD.dim, opacity: 0.45},
  segOn: {backgroundColor: LCD.ink, opacity: 1},
  eq: {flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 26},
  eqBar: {width: 3, borderRadius: 1, backgroundColor: LCD.ink},
  play: {width: 46, height: 46, borderRadius: 23, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#2FD14B'},
  key: {width: 36, height: 38, borderRadius: 11, backgroundColor: '#1B2547', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK, borderBottomWidth: 4},
});

/** Miniplayer da aba Músicas: desliza de baixo quando o player grande sai da tela (Fitas) ou sempre que há música (Bags); some na Rádio. */
export function DockedMini({visible, mode, onOpen}: {visible: boolean; mode: 'tapes' | 'bags' | 'radio'; onOpen: () => void}) {
  const m = useMusic();
  const heroGone = useHeroGone();
  const show = visible && mode !== 'radio' && !!m.now && (mode === 'bags' || heroGone);
  if (!show) return null;
  return (
    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.quad))}>
      <MiniPlayer onOpen={onOpen} />
    </Animated.View>
  );
}
