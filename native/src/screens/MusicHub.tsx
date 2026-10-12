/** Aba "Músicas": as bolsas de música e a rádio do mundo (globo 3D) lado a lado, com um seletor no topo. */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {Icon, Pop} from '../ui';
import {C, R} from '../theme';
import MusicScreen from './MusicScreen';
import RadioScreen from './RadioScreen';

export type MusicMode = 'bags' | 'radio';

export default function MusicHub({mode, onMode}: {mode: MusicMode; onMode: (m: MusicMode) => void}) {
  const [radioSeen, setRadioSeen] = useState(mode === 'radio');
  useEffect(() => { if (mode === 'radio') setRadioSeen(true); }, [mode]);
  const radio = mode === 'radio';
  const items: {key: MusicMode; label: string; aria: string; icon: React.ComponentProps<typeof Icon>['name']}[] = [
    {key: 'bags', label: 'BOLSAS', aria: 'Bolsas de música', icon: 'bag-handle'},
    {key: 'radio', label: 'RÁDIO', aria: 'Rádio do mundo', icon: 'earth'},
  ];
  return (
    <View style={[S.root, {backgroundColor: radio ? '#080C24' : C.paper}]}>
      <View style={S.bar} accessibilityRole="tablist">
        {items.map((it) => {
          const on = mode === it.key;
          return (
            <Pop key={it.key} accessibilityRole="tab" accessibilityLabel={it.aria} accessibilityState={{selected: on}} onPress={() => onMode(it.key)} color={on ? C.yellow : radio ? '#1B2547' : C.card}
              shadowColor={radio ? '#000' : C.ink} radius={R.pill} offset={on ? 2 : 3} style={{flex: 1}} innerStyle={S.item} quiet>
              <Icon name={it.icon} size={19} color={on ? C.ink : radio ? '#DDE4FF' : C.ink} />
              <Text style={[S.label, {color: on ? C.ink : radio ? '#DDE4FF' : C.ink}]}>{it.label}</Text>
            </Pop>
          );
        })}
      </View>
      <View style={{flex: 1}}>
        {mode === 'bags' && <MusicScreen onRadio={() => onMode('radio')} />}
        {radioSeen && <View style={radio ? StyleSheet.absoluteFill : S.hidden} pointerEvents={radio ? 'auto' : 'none'}><RadioScreen /></View>}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {flex: 1},
  bar: {flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6},
  item: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42},
  label: {fontSize: 17, fontWeight: '900', letterSpacing: 1},
  hidden: {...StyleSheet.absoluteFillObject, opacity: 0, zIndex: -1},
});
