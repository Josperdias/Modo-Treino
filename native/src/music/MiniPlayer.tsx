import React, {useEffect, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {Icon, Press} from '../ui';
import {C} from '../theme';
import Animated, {Easing, SlideInDown, SlideOutDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming} from 'react-native-reanimated';
import {MiniTape} from './Cassette';
import {useHeroGone} from './dock';
import {useMusic, useMusicProgress} from './MusicProvider';

/** Visor LCD anos 2000: fundo verde-escuro, letras verde-neon com brilho. A fonte é a monoespaçada do sistema (nenhum arquivo de fonte novo). */
const LCD = {bg: '#0A2113', edge: '#041109', on: '#7CFF9B', dim: '#1F5A33', glow: '#46FF7A'};
const MONO = Platform.select({android: 'monospace', ios: 'Menlo', default: 'Courier New, monospace'});
const SEGMENTS = 22;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Relógio + barra de segmentos do visor. Fica num componente próprio: só ele re-renderiza a cada atualização de posição. */
function LcdClock({live, playing}: {live: boolean; playing: boolean}) {
  const {position, duration} = useMusicProgress();
  const pct = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const lit = Math.round(pct * SEGMENTS);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Progresso da música" accessibilityValue={{min: 0, max: 100, now: Math.round(pct * 100)}}>
      <View style={MP.lcdTop}>
        <Text style={MP.lcdTiny}>{live ? '◉ FM AO VIVO' : `${playing ? '▶ PLAY' : '❚❚ PAUSA'}`}</Text>
        {!live && duration > 0 ? <Text style={MP.lcdTiny}>{mmss(position)}/{mmss(duration)}</Text> : null}
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

/** Faixa tocando agora, sempre à mão: um mini rádio com a janela da fita, visor LCD verde, equalizador e teclas. */
export default function MiniPlayer({onOpen}: {onOpen: () => void; dark?: boolean}) {
  const m = useMusic();
  if (!m.now && !m.tapeTracks.length && !m.library.length) return null;
  const title = m.now?.title || `Bag ${m.activeTape.name}`;
  const lcdText = (m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : m.now?.title || 'Rádio ao vivo') : title).toUpperCase();
  return (
    <View style={MP.bar} accessibilityRole="toolbar" accessibilityLabel="Player de música">
      <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. ${m.now ? 'Tocando ' + m.now.title : 'Nada tocando'}`} onPress={onOpen} style={MP.info} quiet>
        <View style={MP.deck}>
          {m.now && !m.live
            ? <MiniTape id={m.now.id} size={50} />
            : <View style={[MP.disc, m.playing && {backgroundColor: C.pink}]}><Icon name={m.live ? 'radio' : 'musical-notes'} size={18} color={C.ink} /></View>}
          <View style={[MP.led, m.playing && MP.ledOn]} />
        </View>
        <View style={MP.lcd}>
          <View style={MP.lcdShine} pointerEvents="none" />
          <View style={MP.lcdRow}>
            <View style={{flex: 1}}>
              <LcdMarquee text={lcdText} run={m.playing} />
              {m.now ? <LcdClock live={m.live} playing={m.playing} /> : <Text style={MP.lcdTiny}>SEM FITA</Text>}
            </View>
            <Eq on={m.playing} />
          </View>
        </View>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={MP.play} quiet><Icon name={m.playing ? 'pause' : 'play'} size={20} color={C.ink} /></Press>
      <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={MP.next} quiet><Icon name="play-skip-forward" size={18} color={C.white} /></Press>
    </View>
  );
}
const MP = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.navy2, borderTopWidth: 3, borderTopColor: '#34437A'},
  info: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8},
  deck: {width: 62, height: 54, borderRadius: 10, backgroundColor: '#0B1033', borderWidth: 2, borderColor: '#34437A', alignItems: 'center', justifyContent: 'center'},
  led: {position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4A2A33'},
  ledOn: {backgroundColor: '#FF5C7A'},
  disc: {width: 36, height: 36, borderRadius: 18, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  lcd: {flex: 1, minHeight: 54, borderRadius: 8, backgroundColor: LCD.bg, borderWidth: 2, borderColor: LCD.edge, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', justifyContent: 'center'},
  lcdShine: {position: 'absolute', left: 0, right: 0, top: 0, height: '38%', backgroundColor: 'rgba(255,255,255,0.05)'},
  lcdRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  marquee: {height: 20, overflow: 'hidden'},
  marqueeRow: {position: 'absolute', left: 0, top: 0, width: 4000, flexDirection: 'row'},
  lcdTitle: {alignSelf: 'flex-start', fontFamily: MONO, fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.8, color: LCD.on, textShadowColor: LCD.glow, textShadowRadius: 7, textShadowOffset: {width: 0, height: 0}},
  lcdTop: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 1},
  lcdTiny: {fontFamily: MONO, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.6, color: LCD.on, opacity: 0.8},
  segs: {flexDirection: 'row', gap: 1.5, marginTop: 2},
  seg: {flex: 1, height: 4, borderRadius: 1, backgroundColor: LCD.dim},
  segOn: {backgroundColor: LCD.on},
  eq: {flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28, paddingBottom: 1},
  eqBar: {width: 3, borderRadius: 1, backgroundColor: LCD.on, opacity: 0.9},
  play: {width: 44, height: 44, borderRadius: 22, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4},
  next: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#2B3763', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0B1033', borderBottomWidth: 3},
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
