import React, {useEffect, useState} from 'react';
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Path, Pattern, Polygon, Rect, Stop} from 'react-native-svg';
import {Text} from '../text';
import {Icon, Press} from '../ui';
import {C} from '../theme';
import Animated, {Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming} from 'react-native-reanimated';
import {MiniTape} from './Cassette';
import {setMiniCollapsed, useHeroGone, useMiniCollapsed} from './dock';
import {useMusic, useMusicProgress} from './MusicProvider';

/** Visor LCD verde-limão (anos 2000): fundo claro, letras escuras. A fonte é a monoespaçada do sistema (nenhum arquivo de fonte novo). */
const LCD = {ink: '#0B3D1A', dim: '#2E9E49', edge: '#0B2A14'};
const GOLD = {top: '#FFE27A', mid: '#FFC93C', low: '#F0A81C'};
const MONO = Platform.select({android: 'monospace', ios: 'Menlo', default: 'Courier New, monospace'});
const SEGMENTS = 20;
const INK = C.ink;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Alturas fixas: nada é medido na tela, então o rádio entra e recolhe sem recalcular layout (animação lisa). */
const BAR_H = 76;
const TOP_PAD = 10;
const BOTTOM_PAD = 6;
const FULL_H = TOP_PAD + BAR_H + BOTTOM_PAD;
const COMPACT_H = 44;

/* ---------------------------------------------------------------- desenho (tudo em porcentagem, sem onLayout) */

/** Corpo dourado: degradê, meio-tom, brilho no topo, listras rosa na ponta e faixa xadrez de corrida embaixo. */
const GoldBody = React.memo(function GoldBody({checker = true, stripes = true}: {checker?: boolean; stripes?: boolean}) {
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GOLD.top} /><Stop offset="0.5" stopColor={GOLD.mid} /><Stop offset="1" stopColor={GOLD.low} />
          </LinearGradient>
          <Pattern id="halftone" x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
            <Circle cx={3} cy={3} r={1.7} fill="#C77A00" opacity={0.15} />
            <Circle cx={9} cy={9} r={1.7} fill="#C77A00" opacity={0.15} />
          </Pattern>
          <Pattern id="rosestripes" x={0} y={0} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect x={0} y={0} width={3} height={8} fill="#FF4FA3" opacity={0.5} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#gold)" />
        <Rect width="100%" height="100%" fill="url(#halftone)" />
        <Rect width="100%" height="16%" fill="#FFFFFF" opacity={0.2} />
        {stripes && <Rect x="88%" width="12%" height="100%" fill="url(#rosestripes)" />}
      </Svg>
      {checker && (
        <Svg style={MP.checker} width="100%" height={5} pointerEvents="none">
          <Defs>
            <Pattern id="checker" x={0} y={0} width={10} height={10} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={5} height={5} fill={INK} /><Rect x={5} y={0} width={5} height={5} fill="#FFFFFF" />
            </Pattern>
          </Defs>
          <Rect width="100%" height={5} fill="url(#checker)" />
        </Svg>
      )}
    </>
  );
});

/** Fundo atrás do rádio: bolinhas pequenas, como o cabeçalho do app. */
const DotsBack = React.memo(function DotsBack() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs><Pattern id="navydots" x={0} y={0} width={14} height={14} patternUnits="userSpaceOnUse"><Circle cx={7} cy={7} r={1.2} fill="#FFFFFF" opacity={0.07} /></Pattern></Defs>
      <Rect width="100%" height="100%" fill="url(#navydots)" />
    </Svg>
  );
});

/** Vidro do visor. O fundo verde é feito de Views lisas (preenchem a caixa exatamente, em qualquer largura); só as linhas de varredura são desenho. */
const LcdGlass = React.memo(function LcdGlass() {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, {backgroundColor: '#6FE56A'}]} pointerEvents="none" />
      <View style={MP.glassTop} pointerEvents="none" />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs><Pattern id="scan" x={0} y={0} width={4} height={3} patternUnits="userSpaceOnUse"><Rect x={0} y={2} width={4} height={1} fill={LCD.edge} opacity={0.12} /></Pattern></Defs>
        <Rect width="100%" height="100%" fill="url(#scan)" />
      </Svg>
    </>
  );
});

/** Alto-falante: grade de pontinhos escuros. */
const Grill = React.memo(function Grill({cols = 2, rows = 5}: {cols?: number; rows?: number}) {
  const w = cols * 7, h = rows * 7;
  return (
    <View style={{width: w, height: h, flexShrink: 0}}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => <Circle key={`${r}-${c}`} cx={3.5 + c * 7} cy={3.5 + r * 7} r={2.2} fill={INK} opacity={0.85} />))}
      </Svg>
    </View>
  );
});

/** Adesivos (vetor): estrela, raio, carinha, nota e selo MUSIC. Ficam todos DENTRO da área do rádio, sobre a borda do corpo. Só enfeite: não captam toque. */
const Sticker = ({style, children}: {style: object; children: React.ReactNode}) => <View pointerEvents="none" style={[MP.sticker, style]}>{children}</View>;
const Stickers = React.memo(function Stickers({narrow}: {narrow: boolean}) {
  return (
    <>
      <Sticker style={{left: 8, top: 0, transform: [{rotate: '-14deg'}]}}>
        <Svg width={24} height={24} viewBox="0 0 24 24"><Polygon points="12,1.5 15,9 23,9.5 17,14.8 19,22.5 12,18.3 5,22.5 7,14.8 1,9.5 9,9" fill="#F46FA0" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></Svg>
      </Sticker>
      <Sticker style={{right: 16, top: 0, transform: [{rotate: '12deg'}]}}>
        <Svg width={20} height={22} viewBox="0 0 24 26"><Polygon points="15,1 4,15 11,15 8,25 21,10 13,10" fill="#FF4FA3" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></Svg>
      </Sticker>
      <Sticker style={{right: 8, bottom: 0, transform: [{rotate: '10deg'}]}}>
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M9 18V5l11-2v13" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Path d="M9 18V5l11-2v13" stroke="#F46FA0" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Circle cx={6.5} cy={18} r={3.3} fill="#F46FA0" stroke={INK} strokeWidth={1.6} /><Circle cx={17.5} cy={16} r={3.3} fill="#F46FA0" stroke={INK} strokeWidth={1.6} /></Svg>
      </Sticker>
      {!narrow && (
        <Sticker style={{left: 10, bottom: 0, transform: [{rotate: '-6deg'}]}}>
          <View style={MP.badge}><Text style={MP.badgeText}>MUSIC</Text></View>
        </Sticker>
      )}
      <Sticker style={{right: 56, bottom: 0}}>
        <Svg width={18} height={18} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={10.5} fill="#FFD23A" stroke={INK} strokeWidth={1.8} /><Circle cx={8.5} cy={10} r={1.5} fill={INK} /><Circle cx={15.5} cy={10} r={1.5} fill={INK} /><Path d="M7 14.2c1.4 2.6 8.6 2.6 10 0" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" /></Svg>
      </Sticker>
    </>
  );
});

/* ---------------------------------------------------------------- partes vivas */

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

/* ---------------------------------------------------------------- rádio dourado */

/** Corpo cheio do rádio: janela da fita, visor LCD, equalizador, teclas e alto-falantes. */
function Full({onOpen, onCollapse}: {onOpen: () => void; onCollapse: () => void}) {
  const m = useMusic();
  const {width} = useWindowDimensions();
  const narrow = width < 360;
  const wide = width >= 400;   // só aí cabem o equalizador e o alto-falante da direita
  const title = m.now?.title || '';
  const lcdText = m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : title || 'Rádio ao vivo') : title;
  return (
    <View style={MP.full}>
      <DotsBack />
      <View style={MP.bar} accessibilityRole="toolbar" accessibilityLabel="Player de música">
        <GoldBody />
        <View style={MP.row}>
          {!narrow && <Grill />}
          <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. ${m.now ? 'Tocando ' + m.now.title : 'Nada tocando'}`} onPress={onOpen} style={MP.info} quiet>
            <View style={MP.deck}>
              {m.now && !m.live
                ? <MiniTape id={m.now.id} size={44} />
                : <View style={[MP.disc, m.playing && {backgroundColor: C.pink}]}><Icon name={m.live ? 'radio' : 'musical-notes'} size={18} color={C.ink} /></View>}
            </View>
            <View style={MP.lcd}>
              <LcdGlass />
              <View style={MP.lcdRow}>
                <Icon name="musical-notes" size={16} color={LCD.ink} />
                <View style={{flex: 1, minWidth: 0}}>
                  <LcdMarquee text={lcdText} run={m.playing} />
                  <LcdClock live={m.live} playing={m.playing} />
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
      </View>
      <Stickers narrow={narrow} />
      <Press accessibilityRole="button" accessibilityLabel="Recolher o player" onPress={onCollapse} style={MP.tab} hitSlop={10} quiet>
        <Icon name="chevron-down" size={16} color={GOLD.top} />
      </Press>
    </View>
  );
}

/** Rádio recolhido: tirinha dourada com o nome da música, play/pausa e a setinha para abrir de novo. */
function Compact({onOpen, onExpand}: {onOpen: () => void; onExpand: () => void}) {
  const m = useMusic();
  const text = m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : m.now?.title || 'Rádio ao vivo') : m.now?.title || '';
  return (
    <View style={MP.compactWrap}>
      <View style={MP.compact} accessibilityRole="toolbar" accessibilityLabel="Player de música (recolhido)">
        <GoldBody checker={false} stripes={false} />
        <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. Tocando ${m.now?.title ?? ''}`} onPress={onOpen} style={MP.compactLcd} quiet>
          <LcdGlass />
          <Icon name="musical-notes" size={14} color={LCD.ink} />
          <Text numberOfLines={1} style={MP.compactText}>{text}</Text>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={MP.compactPlay} quiet><Icon name={m.playing ? 'pause' : 'play'} size={15} color={C.ink} /></Press>
        <Press accessibilityRole="button" accessibilityLabel="Abrir o player" onPress={onExpand} style={MP.compactUp} hitSlop={8} quiet><Icon name="chevron-up" size={18} color={C.white} /></Press>
      </View>
    </View>
  );
}

/** O rádio: só existe se há música tocando (ou pausada na fila). A altura anima entre cheio e recolhido; as duas versões trocam com um fade curto. */
function Radio({onOpen}: {onOpen: () => void}) {
  const collapsed = useMiniCollapsed();
  const reduce = useReducedMotion();
  const h = useSharedValue(collapsed ? COMPACT_H : FULL_H);
  useEffect(() => {
    h.value = withTiming(collapsed ? COMPACT_H : FULL_H, {duration: reduce ? 0 : 260, easing: Easing.out(Easing.cubic)});
  }, [collapsed, reduce, h]);
  const shell = useAnimatedStyle(() => ({height: h.value}));
  return (
    <Animated.View style={[MP.shell, shell]}>
      {collapsed
        ? <Animated.View key="c" style={MP.layer} entering={FadeIn.duration(160).delay(60)} exiting={FadeOut.duration(90)}><Compact onOpen={onOpen} onExpand={() => setMiniCollapsed(false)} /></Animated.View>
        : <Animated.View key="f" style={MP.layer} entering={FadeIn.duration(180).delay(80)} exiting={FadeOut.duration(90)}><Full onOpen={onOpen} onCollapse={() => setMiniCollapsed(true)} /></Animated.View>}
    </Animated.View>
  );
}

/** Aparece só com música no player (nada de rádio vazio na tela inicial) e entra deslizando de baixo. */
export default function MiniPlayer({onOpen}: {onOpen: () => void; dark?: boolean}) {
  const m = useMusic();
  if (!m.now) return null;
  return (
    <Animated.View entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.quad))}>
      <Radio onOpen={onOpen} />
    </Animated.View>
  );
}

const MP = StyleSheet.create({
  shell: {backgroundColor: C.navy2, overflow: 'hidden'},
  layer: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0},
  full: {height: FULL_H, paddingHorizontal: 8, paddingTop: TOP_PAD, paddingBottom: BOTTOM_PAD},
  bar: {height: BAR_H, borderRadius: 20, borderWidth: 3, borderColor: INK, overflow: 'hidden'},
  row: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 13},
  checker: {position: 'absolute', left: 8, right: 8, bottom: 5, height: 5, borderRadius: 2, overflow: 'hidden'},
  sticker: {position: 'absolute'},
  badge: {backgroundColor: C.white, borderWidth: 2, borderColor: INK, borderRadius: 6, paddingHorizontal: 4, transform: [{rotate: '-4deg'}]},
  badgeText: {fontSize: 9, lineHeight: 11, fontWeight: '900', color: INK, letterSpacing: 0.5},
  tab: {position: 'absolute', top: 0, left: '50%', marginLeft: -23, width: 46, height: 20, borderRadius: 10, backgroundColor: C.navy2, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center'},
  info: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5},
  deck: {width: 52, height: 50, borderRadius: 10, backgroundColor: '#0B1033', borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center'},
  disc: {width: 34, height: 34, borderRadius: 17, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  lcd: {flex: 1, minWidth: 0, height: 50, borderRadius: 10, borderWidth: 3, borderColor: LCD.edge, paddingHorizontal: 6, overflow: 'hidden', justifyContent: 'center'},
  glassTop: {position: 'absolute', left: 0, right: 0, top: 0, height: '48%', backgroundColor: '#9BF58A'},
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
  compactWrap: {flex: 1, paddingHorizontal: 8, justifyContent: 'center'},
  compact: {height: 34, borderRadius: 14, borderWidth: 3, borderColor: INK, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4},
  compactLcd: {flex: 1, minWidth: 0, height: 22, borderRadius: 7, borderWidth: 2, borderColor: LCD.edge, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6},
  compactText: {flex: 1, fontFamily: MONO, fontSize: 12, lineHeight: 15, fontWeight: '700', color: LCD.ink},
  compactPlay: {width: 24, height: 24, borderRadius: 12, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2FD14B'},
  compactUp: {width: 24, height: 24, borderRadius: 8, backgroundColor: '#1B2547', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK},
});

/** Miniplayer da aba Músicas: aparece quando o player grande sai da tela (Fitas) ou sempre que há música (Bags); some na Rádio. */
export function DockedMini({visible, mode, onOpen}: {visible: boolean; mode: 'tapes' | 'bags' | 'radio'; onOpen: () => void}) {
  const m = useMusic();
  const heroGone = useHeroGone();
  const show = visible && mode !== 'radio' && !!m.now && (mode === 'bags' || heroGone);
  if (!show) return null;
  return <MiniPlayer onOpen={onOpen} />;
}
