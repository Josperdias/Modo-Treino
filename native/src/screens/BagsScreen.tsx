/** BAGS: playlists. Uma bag junta fitas (músicas do celular) e rádios do mundo e toca tudo em sequência. */
import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {flag} from '../data';
import {Btn, Card, Icon, Kicker, Pattern, Press, Sheet} from '../ui';
import {C, R, T} from '../theme';
import BagArt, {bagColor} from '../music/BagArt';
import AddMusicSheet from '../music/AddMusicSheet';
import {Track, useMusic} from '../music/MusicProvider';

export default function BagsScreen({onRadio}: {onRadio: () => void}) {
  const m = useMusic();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const [undo, setUndo] = useState<{track: Track; index: number} | null>(null);
  const bag = editing && m.activeTape.id === editing ? m.activeTape : null;

  const resolve = (ids: string[]) => ids.map((id) => m.lib.tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
  const create = () => {
    if (!name.trim()) return;
    setEditing(m.newTape(name));
    setName(''); setNaming(false);
  };
  const confirmDelete = () => bag && Alert.alert(`Excluir a bag “${bag.name}”?`, 'Só a bag é apagada. As fitas continuam no seu celular.', [
    {text: 'Cancelar', style: 'cancel'}, {text: 'Excluir bag', style: 'destructive', onPress: () => { m.deleteTape(); setEditing(null); }},
  ]);
  const remove = (t: Track) => {
    const index = m.activeTape.ids.indexOf(t.id);
    m.removeFromTape(t.id);
    setUndo({track: t, index}); // o aviso comum fica atrás da folha aberta, então o "desfazer" mora dentro dela
  };
  const kind = (t: Track) => (t.source === 'radio' ? `${flag(t.cc)} ${t.country || 'Rádio'} · ao vivo` : 'Fita');

  return (
    <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(380)}>
        <Kicker>Playlists · fitas e rádios</Kicker>
        <Text style={[T.h1, {marginTop: 4, marginBottom: 12, fontSize: 40, lineHeight: 38}]}>Suas bags.</Text>
        <Card color={C.sky} offset={4} pattern={<Pattern kind="dots" opacity={0.1} size={16} />}>
          <Text style={S.lead}>Uma <Text style={{fontWeight: '800'}}>bag</Text> é uma playlist: junte <Text style={{fontWeight: '800'}}>fitas</Text> (as músicas do seu celular) e <Text style={{fontWeight: '800'}}>rádios</Text> do mundo e toque tudo de uma vez. Tirar da bag nunca apaga a música.</Text>
        </Card>
      </Animated.View>

      {m.lib.tapes.map((b, i) => {
        const items = resolve(b.ids);
        const radios = items.filter((t) => t.source === 'radio').length;
        const fitas = items.length - radios;
        const active = m.playing && !m.queueName && m.lib.selected === b.id && !!m.now;
        return (
          <Animated.View key={b.id} entering={FadeInDown.delay(80 + i * 70).duration(320)} style={{marginTop: 20}}>
            <Card color={bagColor(i)} offset={5} pattern={<Pattern kind={i % 2 ? 'dots' : 'stripes'} opacity={0.09} size={16} />}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                <BagArt color={bagColor(i)} count={items.length} open={items.length > 0} playing={active} size={104} />
                <View style={{flex: 1}}>
                  <Text style={S.name} numberOfLines={2}>{b.name}</Text>
                  <Text style={S.meta}>{fitas} {fitas === 1 ? 'fita' : 'fitas'}{radios ? ` · ${radios} ${radios === 1 ? 'rádio' : 'rádios'}` : ''}</Text>
                  {active && <Text style={S.now}>● tocando agora</Text>}
                </View>
              </View>
              {items.length > 0 && (
                <View style={S.chips}>
                  {items.slice(0, 3).map((t) => <View key={t.id} style={S.chip}><Icon name={t.source === 'radio' ? 'radio' : 'musical-note'} size={13} /><Text style={S.chipText} numberOfLines={1}>{t.title}</Text></View>)}
                  {items.length > 3 && <View style={S.chip}><Text style={S.chipText}>+{items.length - 3}</Text></View>}
                </View>
              )}
              <View style={{flexDirection: 'row', gap: 8, marginTop: 14}}>
                <Btn small icon="play" text="TOCAR" label={`Tocar a bag ${b.name}`} onPress={() => m.playTape(false, b.id)} style={{flex: 1}} />
                <Btn small kind="ghost" icon="shuffle" text="ALEATÓRIO" label={`Tocar a bag ${b.name} em ordem aleatória`} onPress={() => m.playTape(true, b.id)} style={{flex: 1}} />
                <Btn small kind="dark" icon="settings-sharp" text="" label={`Editar a bag ${b.name}`} onPress={() => { m.selectTape(b.id); setEditing(b.id); }} style={{width: 54}} />
              </View>
            </Card>
          </Animated.View>
        );
      })}

      <Btn icon="add-circle" text="NOVA BAG" label="Criar nova bag" onPress={() => { setName(''); setNaming(true); }} style={{marginTop: 22}} />
      <Btn kind="pink" small icon="earth" text="ACHAR UMA RÁDIO NO GLOBO" onPress={onRadio} style={{marginTop: 10}} />

      <Sheet visible={naming} onClose={() => setNaming(false)} title="Nova bag">
        <TextInput value={name} onChangeText={setName} autoFocus placeholder="Nome (ex.: Pesado, Cardio, Rádios)" placeholderTextColor={C.muted} maxLength={40} accessibilityLabel="Nome da bag" style={S.input} onSubmitEditing={create} />
        <Btn text="CRIAR" icon="checkmark" disabled={!name.trim()} onPress={create} />
      </Sheet>

      <Sheet visible={!!bag && !adding} onClose={() => { setEditing(null); setUndo(null); }} title={bag ? `Bag ${bag.name}` : ''} tall>
        {bag && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 24}} keyboardShouldPersistTaps="handled">
            <Text style={[T.kicker, {marginBottom: 8}]}>Nome</Text>
            <TextInput defaultValue={bag.name} onEndEditing={(e) => m.renameTape(e.nativeEvent.text)} accessibilityLabel="Renomear bag" maxLength={40} style={S.input} />
            <View style={{flexDirection: 'row', gap: 8, marginBottom: 14}}>
              <Btn small icon="add-circle" text="FITAS" label="Colocar fitas na bag" onPress={() => setAdding(true)} style={{flex: 1}} />
              <Btn small kind="pink" icon="earth" text="RÁDIO" label="Achar uma rádio no globo para a bag" onPress={() => { setEditing(null); onRadio(); }} style={{flex: 1}} />
            </View>
            {undo && (
              <View style={S.undo}>
                <Text style={S.undoText} numberOfLines={2}>“{undo.track.title}” saiu da bag</Text>
                <Btn small kind="ghost" icon="arrow-undo" text="DESFAZER" label="Desfazer" onPress={() => { m.restoreToTape(undo.track, undo.index); setUndo(null); }} />
              </View>
            )}
            <Text style={[T.kicker, {marginBottom: 8}]}>Dentro desta bag</Text>
            {m.tapeTracks.length === 0 && <Text style={[T.body, {paddingVertical: 12}]}>Vazia. Coloque fitas do celular ou rádios do globo.</Text>}
            {m.tapeTracks.map((t, i) => (
              <View key={t.id} style={S.item}>
                <View style={S.num}><Icon name={t.source === 'radio' ? 'radio' : 'musical-note'} size={16} /></View>
                <View style={{flex: 1}}>
                  <Text numberOfLines={1} style={S.itemTitle}>{t.title}</Text>
                  <Text style={T.small} numberOfLines={1}>{kind(t)}</Text>
                </View>
                <Press accessibilityRole="button" accessibilityLabel={`Subir ${t.title}`} disabled={i === 0} onPress={() => m.moveInTape(t.id, -1)} style={[S.iconBtn, i === 0 && {opacity: 0.3}]} quiet><Icon name="arrow-up" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Descer ${t.title}`} disabled={i === m.tapeTracks.length - 1} onPress={() => m.moveInTape(t.id, 1)} style={[S.iconBtn, i === m.tapeTracks.length - 1 && {opacity: 0.3}]} quiet><Icon name="arrow-down" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Tirar ${t.title} da bag`} onPress={() => remove(t)} style={[S.iconBtn, {backgroundColor: '#FBE3E8'}]}><Icon name="remove" size={20} color="#9B2C4A" /></Press>
              </View>
            ))}
            {m.missing > 0 && <Text style={[T.small, {marginTop: 8}]}>{m.missing} item(ns) desta bag não estão mais no celular e foram ignorados.</Text>}
            {m.lib.tapes.length > 1 && <Btn small kind="danger" icon="trash-outline" text="EXCLUIR BAG" label="Excluir esta bag" onPress={confirmDelete} style={{marginTop: 22}} />}
          </ScrollView>
        )}
      </Sheet>
      <AddMusicSheet visible={adding} onClose={() => setAdding(false)} />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  lead: {fontSize: 14, lineHeight: 21, color: C.ink, fontWeight: '500'},
  name: {fontSize: 28, fontWeight: '900', color: C.ink, lineHeight: 26},
  meta: {fontSize: 13, fontWeight: '700', color: 'rgba(20,27,52,.75)', marginTop: 4},
  now: {fontSize: 12, fontWeight: '800', color: '#C2203F', marginTop: 4},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.ink, maxWidth: '100%'},
  chipText: {fontSize: 12, fontWeight: '800', color: C.ink, flexShrink: 1},
  input: {backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: 16, height: 52, fontSize: 16, color: C.ink, marginBottom: 14, borderWidth: 2, borderColor: C.ink},
  item: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  num: {width: 34, height: 34, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  itemTitle: {fontSize: 15, fontWeight: '700', color: C.ink},
  undo: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.md, borderWidth: 2, borderColor: C.ink, padding: 10, marginBottom: 12},
  undoText: {flex: 1, fontSize: 14, fontWeight: '700', color: C.ink},
  iconBtn: {width: 38, height: 38, borderRadius: 19, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
});
