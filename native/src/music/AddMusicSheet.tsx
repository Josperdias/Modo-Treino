import React, {useEffect, useMemo, useState} from 'react';
import {FlatList, Linking, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import {formatClock, searchTracks} from '../../logic';
import {Btn, Icon, Pop, Press, Sheet} from '../ui';
import {C, R, T} from '../theme';
import {Track, useMusic} from './MusicProvider';

/** Escolhe músicas que já estão no celular e coloca na bolsa (nada é copiado nem apagado).
 * Três caminhos: lista do Android, uma pasta escolhida uma vez, ou arquivos soltos. */
export default function AddMusicSheet({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const m = useMusic();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inTape = useMemo(() => new Set(m.activeTape.ids), [m.activeTape]);
  const list = useMemo(() => searchTracks(m.device, q), [m.device, q]);
  useEffect(() => { if (visible && m.permission === 'granted' && !m.device.length && !m.scanning) void m.scan(); }, [visible, m.permission]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setPicked(new Set()); setQ(''); onClose(); };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const confirm = () => {
    const chosen: Track[] = m.device.filter((x) => picked.has(x.id));
    m.addToTape(chosen);
    close();
  };
  const hasList = m.device.length > 0 || m.permission === 'granted';
  const sources = (
    <View style={S.sources}>
      <Btn kind="ghost" small icon="folder-open-outline" text="PASTA" label="Escolher uma pasta de músicas" onPress={() => { void m.addFolder(); }} style={{flex: 1}} />
      <Btn kind="ghost" small icon="document-attach-outline" text="ARQUIVOS" label="Escolher arquivos de áudio" onPress={() => { void m.importFiles(); }} style={{flex: 1}} />
      {m.permission !== 'granted' && m.permission !== 'unavailable' && <Btn kind="ghost" small icon="phone-portrait-outline" text="LISTA" label="Listar músicas do celular" onPress={() => { void m.scan(); }} style={{flex: 1}} />}
    </View>
  );
  const header = (
    <View>
      <Text style={[T.body, {marginBottom: 12}]}>Músicas que já estão no seu celular. Elas continuam onde estão: a bolsa só guarda a lista.</Text>
      {sources}
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
    : (
      <View style={S.perm}>
        <Icon name={m.permission === 'unavailable' ? 'information-circle-outline' : 'lock-closed-outline'} size={34} color={C.ink} />
        <Text style={[T.h3, {textAlign: 'center', marginTop: 10}]}>
          {m.permission === 'unavailable' ? 'Leitura automática indisponível aqui' : 'Permita o acesso às músicas'}
        </Text>
        <Text style={[T.body, {textAlign: 'center', marginTop: 6, marginBottom: 16}]}>
          {m.permission === 'blocked' ? 'O Android bloqueou o pedido. Abra as configurações do app e libere “Música e áudio”, ou escolha uma PASTA acima (não precisa de permissão).'
            : m.permission === 'unavailable' ? 'Use PASTA ou ARQUIVOS para trazer músicas do armazenamento.'
            : 'O Modo Treino só lê a lista de músicas para você montar as bolsas. Nada sai do aparelho. Se preferir, escolha uma PASTA acima.'}
        </Text>
        {m.permission === 'blocked'
          ? <Btn text="ABRIR CONFIGURAÇÕES" icon="settings-sharp" onPress={() => { Linking.openSettings().catch(() => {}); }} />
          : m.permission !== 'unavailable' && <Btn text={m.scanning ? 'PROCURANDO…' : 'PERMITIR E LISTAR'} icon="musical-notes" disabled={m.scanning} onPress={() => { void m.scan(); }} />}
      </View>
    );
  return (
    <Sheet visible={visible} onClose={close} title={`Adicionar à bolsa ${m.activeTape.name}`} tall>
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
            <Press accessibilityRole="checkbox" accessibilityLabel={`${item.title}${already ? ', já está na bolsa' : ''}`} accessibilityState={{checked: on || already, disabled: already}}
              disabled={already} onPress={() => toggle(item.id)} scaleTo={0.985} quiet style={[S.row, already && {opacity: 0.45}]}>
              <View style={[S.box, (on || already) && S.boxOn]}>{(on || already) && <Icon name="checkmark" size={16} color={C.white} />}</View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={S.title}>{item.title}</Text>
                <Text style={T.small}>{already ? 'Já está na bolsa' : item.duration ? formatClock(item.duration) : 'Arquivo do celular'}</Text>
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
  sources: {flexDirection: 'row', gap: 8, marginBottom: 10},
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 16, height: 48, marginBottom: 10, borderWidth: 2, borderColor: C.ink},
  input: {flex: 1, fontSize: 15, color: C.ink},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  box: {width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white},
  boxOn: {backgroundColor: C.green, borderColor: C.ink},
  title: {fontSize: 15, fontWeight: '700', color: C.ink},
  perm: {alignItems: 'center', padding: 22, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.ink},
  footer: {position: 'absolute', left: 20, right: 20, bottom: 18},
});
