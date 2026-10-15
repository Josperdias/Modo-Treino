/** "Tocando agora": o cartão grande do player (arte, nome, repetir/anterior/play/próxima/favoritar, barra com tempo).
 * Abre ao tocar no mini player. A fita gira enquanto toca; para rádio, o globo e o país. */
import React from 'react';
import {Image, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Text} from '../text';
import Animated, {FadeIn} from 'react-native-reanimated';
import {flag} from '../data';
import {Btn, Card, Icon, Pattern, Pop, Press, Pulse, Sheet} from '../ui';
import {C, R, T} from '../theme';
import LiveCassette from './LiveCassette';
import {SeekBar, VolumeBar} from './PlayerBits';
import {useMusic} from './MusicProvider';

export default function NowPlaying({visible, onClose, onTapes}: {visible: boolean; onClose: () => void; onTapes: () => void}) {
  const m = useMusic();
  const {height} = useWindowDimensions();
  const artH = Math.max(120, Math.min(200, Math.round(height * 0.22)));   // a arte nunca passa de ~1/5 da tela: o painel não cobre tudo
  const t = m.now;
  const live = m.live;
  const fav = t ? m.isFav(t.id) : false;
  const deco = t && !live ? m.deco(t.id) : undefined;
  const bag = m.queueName ?? m.activeTape.name;
  const sub = !t ? '' : live ? `${flag(t.cc)} ${t.country || 'Rádio'} · ao vivo` : `Fita · ${bag}`;
  return (
    <Sheet visible={visible} onClose={onClose} title="Tocando agora" scroll>
      {!t ? (
        <View style={{paddingVertical: 24, alignItems: 'center', gap: 12}}>
          <Icon name="musical-notes" size={36} color={C.pink} />
          <Text style={[T.body, {textAlign: 'center'}]}>Nada tocando. Escolha uma fita ou uma rádio.</Text>
          <Btn small icon="albums" text="VER FITAS" onPress={() => { onClose(); onTapes(); }} />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(220)}>
          <Card color={live ? '#17104A' : C.yellow} offset={5} style={{paddingTop: 14, paddingBottom: 12, alignItems: 'center'}} pattern={<Pattern kind="dots" color={live ? '#FFFFFF' : undefined} opacity={live ? 0.1 : 0.13} size={16} />}>
            {live
              ? <Image source={require('../../assets/notif/radio.png')} resizeMode="contain" style={{width: '100%', height: artH}} accessibilityLabel="Rádio do mundo" />
              : <View style={{width: '100%'}}><LiveCassette playing={m.playing} label={t.title} /></View>}
          </Card>

          <View style={S.head}>
            <View style={{flex: 1}}>
              <Text style={S.title} numberOfLines={2}>{live && m.radioTrack?.title ? m.radioTrack.title : t.title}{deco?.stickers?.length ? `  ${deco.stickers.join(' ')}` : ''}</Text>
              <Text style={S.sub} numberOfLines={1}>{live && m.radioTrack?.title ? `${t.title} · ${flag(t.cc)} ${t.country || ''}` : sub}</Text>
            </View>
            {live && <View style={S.live}><View style={S.liveDot} /><Text style={S.liveText}>AO VIVO</Text></View>}
          </View>

          {deco?.note ? (
            <Animated.View entering={FadeIn.duration(260)} style={S.noteCard} accessible accessibilityLabel={`Anotação da fita: ${deco.note}`}>
              <Text style={S.noteKicker}>📝 ANOTAÇÃO DA FITA</Text>
              <Text style={S.noteText}>{deco.note}</Text>
            </Animated.View>
          ) : null}

          {!live && <SeekBar />}

          <View style={S.controls}>
            {live ? <View style={S.side} /> : (
              <Press accessibilityRole="button" accessibilityLabel={m.lib.repeat ? 'Desligar repetir' : 'Ligar repetir'} accessibilityState={{selected: m.lib.repeat}} onPress={() => m.setRepeat(!m.lib.repeat)} style={S.side} quiet>
                <Icon name="repeat" size={24} color={m.lib.repeat ? C.blue : C.muted} />
              </Press>
            )}
            {live ? <View style={S.side} /> : <Press accessibilityRole="button" accessibilityLabel="Faixa anterior" onPress={() => m.skip(-1)} style={S.side} quiet><Icon name="play-skip-back" size={30} /></Press>}
            <Pulse scale={m.playing ? 1 : 1.04} duration={1100}>
              <Pop accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} offset={4} radius={40} quiet innerStyle={S.play}><Icon name={m.playing ? 'pause' : 'play'} size={36} /></Pop>
            </Pulse>
            {live ? <View style={S.side} /> : <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={S.side} quiet><Icon name="play-skip-forward" size={30} /></Press>}
            <Press accessibilityRole="button" accessibilityLabel={fav ? 'Tirar das favoritas' : 'Favoritar'} accessibilityState={{selected: fav}} onPress={() => m.toggleFav(t)} style={S.side} quiet>
              <Icon name={fav ? 'heart' : 'heart-outline'} size={26} color={fav ? '#E63950' : C.ink} />
            </Press>
          </View>

          <VolumeBar />
          <Btn small kind="ghost" icon={live ? 'earth' : 'albums'} text={live ? 'ABRIR O GLOBO' : 'VER MINHAS FITAS'} onPress={() => { onClose(); onTapes(); }} style={{marginTop: 12}} />
        </Animated.View>
      )}
    </Sheet>
  );
}

const S = StyleSheet.create({
  head: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 6},
  title: {fontSize: 26, fontWeight: '900', color: C.ink, lineHeight: 26},
  sub: {fontSize: 14, fontWeight: '700', color: C.muted, marginTop: 4},
  live: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD3DE', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.ink},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0204A'},
  liveText: {fontSize: 11, fontWeight: '900', letterSpacing: 1, color: C.ink},
  noteCard: {backgroundColor: '#FFF1A8', borderRadius: R.md, padding: 12, marginTop: 6, marginBottom: 4, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4, transform: [{rotate: '-0.6deg'}]},
  noteKicker: {fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: '#7A5200'},
  noteText: {fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 4},
  controls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4},
  side: {width: 48, height: 52, alignItems: 'center', justifyContent: 'center'},
  play: {width: 76, height: 76, alignItems: 'center', justifyContent: 'center'},
});
