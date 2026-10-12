import React, {useEffect, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import {formatClock, searchTracks} from '../../logic';
import {Btn, Icon, Press, Sheet} from '../ui';
import {C, R, T} from '../theme';
import {Track, useMusic} from './MusicProvider';
import {PermissionCard, SourceButtons} from './LibrarySources';

/** Escolhe fitas (músicas que já estão no celular) para colocar na bag selecionada. Nada é copiado nem apagado. */
export default function AddMusicSheet({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const m = useMusic();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inTape = useMemo(() => new Set(m.activeTape.ids), [m.activeTape]);
  const list = useMemo(() => searchTracks(m.library, q), [m.library, q]);
  useEffect(() => { if (visible && m.permission === 'granted' && !m.library.length && !m.scanning) void m.scan(); }, [visible, m.permission]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setPicked(new Set()); setQ(''); onClose(); };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const confirm = () => {
    const chosen: Track[] = m.library.filter((x) => picked.has(x.id));
    m.addToTape(chosen);
    close();
  };
  const hasList = m.library.length > 0 || m.permission === 'granted';
  const header = (
    <View>
      <Text style={[T.body, {marginBottom: 12}]}>Suas fitas (músicas do celular) para colocar na bag. Elas continuam onde estão: a bag só guarda a lista.</Text>
      <SourceButtons />
      {hasList && (
        <View style={S.search}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar música" placeholderTextColor={C.muted} accessibilityLabel="Buscar música" style={S.input} autoCorrect={false} />
        </View>
      )}
    </View>
  );
  const empty = hasList
    ? <Text style={[T.body, {textAlign: 'center', padding: 24}]}>{m.scanning ? 'Procurando músicas…' : q ? 'Nenhuma música com esse nome.' : 'Nenhuma música encontrada. Escolha uma pasta ou arquivos acima.'}</Text>
    : <PermissionCard />;
  return (
    <Sheet visible={visible} onClose={close} title={`Colocar fitas na bag ${m.activeTape.name}`} tall>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        initialNumToRender={14}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingBottom: 90}}
        style={{flexGrow: 0}}
        renderItem={({item}) => {
          const already = inTape.has(item.id);
          const on = picked.has(item.id);
          return (
            <Press accessibilityRole="checkbox" accessibilityLabel={`${item.title}${already ? ', já está na bag' : ''}`} accessibilityState={{checked: on || already, disabled: already}}
              disabled={already} onPress={() => toggle(item.id)} scaleTo={0.985} quiet style={[S.row, already && {opacity: 0.45}]}>
              <View style={[S.box, (on || already) && S.boxOn]}>{(on || already) && <Icon name="checkmark" size={16} color={C.white} />}</View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={S.title}>{item.title}</Text>
                <Text style={T.small}>{already ? 'Já está na bag' : item.duration ? formatClock(item.duration) : 'Arquivo do celular'}</Text>
              </View>
            </Press>
          );
        }}
      />
      <View style={S.footer}>
        <Btn text={picked.size ? `ADICIONAR ${picked.size}` : 'ADICIONAR'} icon="add" disabled={!picked.size} onPress={confirm} />
      </View>
    </Sheet>
  );
}
const S = StyleSheet.create({
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 16, height: 48, marginBottom: 10, borderWidth: 2, borderColor: C.ink},
  input: {flex: 1, fontSize: 15, color: C.ink},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  box: {width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white},
  boxOn: {backgroundColor: C.green, borderColor: C.ink},
  title: {fontSize: 15, fontWeight: '700', color: C.ink},
  footer: {position: 'absolute', left: 20, right: 20, bottom: 18},
});
