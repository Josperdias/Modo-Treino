import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {Icon, Press} from '../ui';
import {C} from '../theme';
import Animated, {Easing, SlideInDown, SlideOutDown} from 'react-native-reanimated';
import {MiniTape} from './Cassette';
import {useHeroGone} from './dock';
import {useMusic, useMusicProgress} from './MusicProvider';

/** Linha fina de progresso no topo do miniplayer. Fica num componente próprio: só ela re-renderiza a cada atualização de posição. */
function MiniProgress() {
  const {position, duration} = useMusicProgress();
  const pct = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  return (
    <View style={MP.track} accessible accessibilityRole="progressbar" accessibilityLabel="Progresso da música" accessibilityValue={{min: 0, max: 100, now: Math.round(pct * 100)}}>
      <View style={[MP.fill, {width: `${pct * 100}%`}]} />
    </View>
  );
}

/** Faixa tocando agora, sempre à mão: abre a aba Músicas, pausa e passa de faixa. */
export default function MiniPlayer({onOpen}: {onOpen: () => void; dark?: boolean}) {
  const dark = true;
  const m = useMusic();
  if (!m.now && !m.tapeTracks.length && !m.library.length) return null;
  return (
    <View style={[MP.bar, dark && MP.dark]} accessibilityRole="toolbar" accessibilityLabel="Player de música">
      {m.now && !m.live ? <MiniProgress /> : null}
      <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. ${m.now ? 'Tocando ' + m.now.title : 'Nada tocando'}`} onPress={onOpen} style={MP.info} quiet>
        {m.now && !m.live
          ? <MiniTape id={m.now.id} size={46} />
          : <View style={[MP.disc, m.playing && {backgroundColor: C.pink}]}><Icon name={m.live ? 'radio' : 'musical-notes'} size={16} color={C.ink} /></View>}
        <View style={{flex: 1}}>
          <Text numberOfLines={1} style={[MP.title, dark && {color: C.white}]}>{m.now?.title || `Bag ${m.activeTape.name}`}</Text>
          <Text numberOfLines={1} style={[MP.sub, dark && {color: '#B7C1E3'}]}>{m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : 'Rádio ao vivo') : `${m.queueName ?? m.activeTape.name} · ${m.playing ? 'tocando' : 'pausado'}`}</Text>
        </View>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={MP.play} quiet><Icon name={m.playing ? 'pause' : 'play'} size={20} color={C.ink} /></Press>
      <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={MP.next} quiet><Icon name="play-skip-forward" size={20} color={dark ? C.white : C.ink} /></Press>
    </View>
  );
}
const MP = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.navy2, borderTopWidth: 1, borderTopColor: '#2B3763'},
  track: {position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: '#2B3763'},
  fill: {height: 3, backgroundColor: C.pink},
  dark: {},
  info: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
  disc: {width: 36, height: 36, borderRadius: 18, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 13, fontWeight: '800', color: C.ink},
  sub: {fontSize: 11, color: C.muted, marginTop: 1},
  play: {width: 42, height: 42, borderRadius: 21, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  next: {width: 38, height: 38, alignItems: 'center', justifyContent: 'center'},
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
