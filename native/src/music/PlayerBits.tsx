import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {formatClock} from '../../logic';
import {Icon, Press} from '../ui';
import {C, T} from '../theme';
import {useMusic} from './MusicProvider';

export function SeekBar() {
  const m = useMusic();
  const [w, setW] = useState(0);
  const pct = m.duration > 0 ? Math.min(1, m.position / m.duration) : 0;
  return (
    <View>
      <Press accessibilityRole="adjustable" accessibilityLabel="Posição da música" accessibilityValue={{text: `${formatClock(m.position)} de ${formatClock(m.duration)}`}} quiet haptic={false} scaleTo={1}
        onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => { if (w > 0 && m.duration > 0) m.seek((e.nativeEvent.locationX / w) * m.duration); }} style={B.seek}>
        <View style={B.seekTrack}><View style={[B.seekFill, {width: `${pct * 100}%`}]} /></View>
        <View style={[B.seekKnob, {left: `${pct * 100}%`}]} />
      </Press>
      <View style={B.times}><Text style={T.small}>{formatClock(m.position)}</Text><Text style={T.small}>{formatClock(m.duration)}</Text></View>
    </View>
  );
}

export function VolumeBar() {
  const m = useMusic();
  const [w, setW] = useState(0);
  const v = m.lib.volume ?? 1;
  return (
    <View style={B.volRow}>
      <Press accessibilityRole="button" accessibilityLabel={v === 0 ? 'Ativar som' : 'Silenciar'} onPress={() => m.setVolume(v === 0 ? 1 : 0)} quiet haptic={false} style={{padding: 4}}>
        <Icon name={v === 0 ? 'volume-mute' : v < 0.5 ? 'volume-low' : 'volume-high'} size={20} color={C.ink} />
      </Press>
      <Press accessibilityRole="adjustable" accessibilityLabel="Volume" accessibilityValue={{text: `${Math.round(v * 100)} por cento`}} quiet haptic={false} scaleTo={1} style={[B.seek, {flex: 1}]}
        onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => { if (w > 0) m.setVolume(e.nativeEvent.locationX / w); }}>
        <View style={B.seekTrack}><View style={[B.seekFill, {width: `${v * 100}%`, backgroundColor: C.sky}]} /></View>
        <View style={[B.seekKnob, {left: `${v * 100}%`}]} />
      </Press>
      <Text style={B.volPct}>{Math.round(v * 100)}%</Text>
    </View>
  );
}

const B = StyleSheet.create({
  seek: {height: 28, justifyContent: 'center'},
  seekTrack: {height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink},
  seekFill: {height: 8, backgroundColor: C.pink},
  seekKnob: {position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: C.yellow, marginLeft: -9, top: 5, borderWidth: 2, borderColor: C.ink},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
  volRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  volPct: {width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700', color: C.muted},
});
