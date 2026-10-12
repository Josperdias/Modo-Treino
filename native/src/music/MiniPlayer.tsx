import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {Icon, Press} from '../ui';
import {C} from '../theme';
import {useMusic} from './MusicProvider';

/** Faixa tocando agora, sempre à mão: abre a aba Músicas, pausa e passa de faixa. */
export default function MiniPlayer({onOpen}: {onOpen: () => void; dark?: boolean}) {
  const dark = true;
  const m = useMusic();
  if (!m.now && !m.tapeTracks.length) return null;
  return (
    <View style={[MP.bar, dark && MP.dark]} accessibilityRole="toolbar" accessibilityLabel="Player de música">
      <Press accessibilityRole="button" accessibilityLabel={`Abrir músicas. ${m.now ? 'Tocando ' + m.now.title : 'Nada tocando'}`} onPress={onOpen} style={MP.info} quiet>
        <View style={[MP.disc, m.playing && {backgroundColor: C.pink}]}><Icon name="musical-notes" size={16} color={C.ink} /></View>
        <View style={{flex: 1}}>
          <Text numberOfLines={1} style={[MP.title, dark && {color: C.white}]}>{m.now?.title || `Bolsa ${m.activeTape.name}`}</Text>
          <Text numberOfLines={1} style={[MP.sub, dark && {color: '#B7C1E3'}]}>{m.live ? 'Rádio ao vivo' : m.activeTape.name} · {m.playing ? 'tocando' : 'pausado'}</Text>
        </View>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={MP.play} quiet><Icon name={m.playing ? 'pause' : 'play'} size={20} color={C.ink} /></Press>
      <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={MP.next} quiet><Icon name="play-skip-forward" size={20} color={dark ? C.white : C.ink} /></Press>
    </View>
  );
}
const MP = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.navy2, borderTopWidth: 1, borderTopColor: '#2B3763'},
  dark: {},
  info: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
  disc: {width: 36, height: 36, borderRadius: 18, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 13, fontWeight: '800', color: C.ink},
  sub: {fontSize: 11, color: C.muted, marginTop: 1},
  play: {width: 42, height: 42, borderRadius: 21, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  next: {width: 38, height: 38, alignItems: 'center', justifyContent: 'center'},
});
