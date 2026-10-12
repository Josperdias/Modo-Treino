import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import Animated, {FadeIn, FadeInDown, LinearTransition} from 'react-native-reanimated';
import {formatClock} from '../../logic';
import {Btn, Card, Chips, Icon, Kicker, Press, Sheet, useToast} from '../ui';
import {C, INK, R, shadow, T} from '../theme';
import Cassette from '../music/Cassette';
import AddMusicSheet from '../music/AddMusicSheet';
import {useMusic} from '../music/MusicProvider';

const FADES = [0, 2, 3, 5, 8];

function SeekBar() {
  const m = useMusic();
  const [w, setW] = useState(0);
  const pct = m.duration > 0 ? Math.min(1, m.position / m.duration) : 0;
  return (
    <View>
      <Press accessibilityRole="adjustable" accessibilityLabel="Posição da música" accessibilityValue={{text: `${formatClock(m.position)} de ${formatClock(m.duration)}`}} quiet haptic={false} scaleTo={1}
        onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => { if (w > 0 && m.duration > 0) m.seek((e.nativeEvent.locationX / w) * m.duration); }} style={P.seek}>
        <View style={P.seekTrack}><View style={[P.seekFill, {width: `${pct * 100}%`}]} /></View>
        <View style={[P.seekKnob, {left: `${pct * 100}%`}]} />
      </Press>
      <View style={P.times}><Text style={T.small}>{formatClock(m.position)}</Text><Text style={T.small}>{formatClock(m.duration)}</Text></View>
    </View>
  );
}

export default function MusicScreen() {
  const m = useMusic();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState<null | 'new' | 'rename'>(null);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState(false);
  const tape = m.activeTape;
  const progress = m.duration > 0 ? m.position / m.duration : 0;

  const saveName = () => {
    if (!name.trim()) return;
    if (naming === 'new') m.newTape(name); else m.renameTape(name);
    setNaming(null); setName('');
  };
  const confirmDelete = () => Alert.alert(`Excluir a fita “${tape.name}”?`, 'Só a fita e sua ordem são apagadas. As músicas continuam no seu celular.', [
    {text: 'Cancelar', style: 'cancel'}, {text: 'Excluir fita', style: 'destructive', onPress: () => m.deleteTape()},
  ]);
  const remove = (id: string, title: string) => {
    const index = tape.ids.indexOf(id);
    const track = m.lib.tracks.find((x) => x.id === id);
    m.removeFromTape(id);
    toast.show(`“${title}” saiu da fita`, track ? {label: 'DESFAZER', run: () => m.restoreToTape(track, index)} : undefined);
  };

  return (
    <ScrollView contentContainerStyle={P.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(380)}>
        <Kicker>Sua sonoplastia particular / 001</Kicker>
        <Text style={[T.h1, {marginTop: 4, marginBottom: 16}]}>Suas fitas,{'\n'}seu ritmo.</Text>
        <Cassette playing={m.playing} label={tape.name} progress={progress} />
      </Animated.View>

      <Card style={P.player}>
        <Text numberOfLines={1} style={P.song}>{m.now?.title || (tape.ids.length ? 'Toque ▶ para começar' : 'Fita vazia')}</Text>
        <Text style={[T.small, {marginTop: 2}]}>{m.now ? `${tape.name}` : `${tape.ids.length} música(s) na fita`}</Text>
        <View style={{marginTop: 14}}><SeekBar /></View>
        <View style={P.controls}>
          <Press accessibilityRole="button" accessibilityLabel={m.lib.shuffle ? 'Desligar aleatório' : 'Ligar aleatório'} accessibilityState={{selected: m.lib.shuffle}} onPress={() => m.setShuffle(!m.lib.shuffle)} style={P.small} quiet><Icon name="shuffle" size={22} color={m.lib.shuffle ? C.blue : C.muted} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Faixa anterior" onPress={() => m.skip(-1)} style={P.small} quiet><Icon name="play-skip-back" size={26} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} style={P.play} scaleTo={0.92} quiet><Icon name={m.playing ? 'pause' : 'play'} size={30} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={P.small} quiet><Icon name="play-skip-forward" size={26} /></Press>
          <Press accessibilityRole="button" accessibilityLabel={m.lib.repeat ? 'Desligar repetir' : 'Ligar repetir'} accessibilityState={{selected: m.lib.repeat}} onPress={() => m.setRepeat(!m.lib.repeat)} style={P.small} quiet><Icon name="repeat" size={22} color={m.lib.repeat ? C.blue : C.muted} /></Press>
        </View>
        <Press accessibilityRole="button" accessibilityLabel="Transição entre músicas" onPress={() => setSettings(true)} style={P.fadeRow} quiet>
          <Icon name="timer-outline" size={16} color={C.muted} /><Text style={T.small}>Transição suave: {m.lib.fade ? `${m.lib.fade} s` : 'desligada'}</Text>
        </Press>
      </Card>

      <View style={P.sectionHead}><Text style={T.h2}>Minhas fitas</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10, paddingVertical: 10}} style={{marginVertical: -6}}>
        {m.lib.tapes.map((t) => {
          const on = t.id === tape.id;
          return (
            <Press key={t.id} accessibilityRole="button" accessibilityLabel={`Fita ${t.name}, ${t.ids.length} músicas`} accessibilityState={{selected: on}} onPress={() => m.selectTape(t.id)} style={[P.tape, on && P.tapeOn]}>
              <Text numberOfLines={1} style={[P.tapeName, on && {color: C.white}]}>{t.name}</Text>
              <Text style={[P.tapeCount, on && {color: '#C9D1EE'}]}>{t.ids.length} música{t.ids.length === 1 ? '' : 's'}</Text>
            </Press>
          );
        })}
        <Press accessibilityRole="button" accessibilityLabel="Criar nova fita" onPress={() => { setName(''); setNaming('new'); }} style={P.newTape}><Icon name="add" size={22} /><Text style={P.tapeName}>Nova fita</Text></Press>
      </ScrollView>

      <View style={P.sectionHead}>
        <Text style={[T.h2, {flex: 1}]} numberOfLines={1}>{tape.name}</Text>
        {tape.ids.length > 0 && <Press accessibilityRole="button" accessibilityLabel={editing ? 'Concluir edição da fita' : 'Editar fita'} onPress={() => setEditing(!editing)} style={P.pillBtn}><Text style={P.pillText}>{editing ? 'OK' : 'EDITAR'}</Text></Press>}
        <Press accessibilityRole="button" accessibilityLabel="Renomear fita" onPress={() => { setName(tape.name); setNaming('rename'); }} style={P.iconBtn}><Icon name="pencil" size={18} /></Press>
        {m.lib.tapes.length > 1 && <Press accessibilityRole="button" accessibilityLabel="Excluir fita" onPress={confirmDelete} style={P.iconBtn}><Icon name="trash-outline" size={18} color="#9B2C4A" /></Press>}
      </View>

      <Btn text="ADICIONAR MÚSICAS DO CELULAR" icon="add-circle" onPress={() => setAdding(true)} style={{marginBottom: 12}} />

      {m.tapeTracks.length === 0 ? (
        <Animated.View entering={FadeIn} style={P.empty}>
          <Icon name="musical-notes" size={34} color={C.pink} />
          <Text style={[T.h3, {marginTop: 8}]}>Esta fita está vazia</Text>
          <Text style={[T.body, {textAlign: 'center', marginTop: 4}]}>Escolha músicas que já estão no seu celular. Sem importar, sem copiar.</Text>
        </Animated.View>
      ) : m.tapeTracks.map((t, i) => {
        const current = m.now?.id === t.id;
        return (
          <Animated.View key={t.id} layout={LinearTransition.duration(220)} entering={FadeIn.duration(220)}>
            <Press accessibilityRole="button" accessibilityLabel={`Tocar ${t.title}`} onPress={() => { void m.playTrack(t.id); }} scaleTo={0.985} quiet style={[P.row, current && P.rowOn]}>
              <View style={[P.num, current && {backgroundColor: C.yellow}]}>{current && m.playing ? <Icon name="musical-notes" size={15} /> : <Text style={P.numText}>{i + 1}</Text>}</View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={P.rowTitle}>{t.title}</Text>
                <Text style={T.small}>{current ? (m.playing ? 'Tocando agora' : 'Pausada') : t.duration ? formatClock(t.duration) : t.source === 'file' ? 'Arquivo copiado para o app' : 'No celular'}</Text>
              </View>
              {editing && <>
                <Press accessibilityRole="button" accessibilityLabel={`Subir ${t.title}`} disabled={i === 0} onPress={() => m.moveInTape(t.id, -1)} style={[P.iconBtn, i === 0 && {opacity: 0.3}]} quiet><Icon name="arrow-up" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Descer ${t.title}`} disabled={i === m.tapeTracks.length - 1} onPress={() => m.moveInTape(t.id, 1)} style={[P.iconBtn, i === m.tapeTracks.length - 1 && {opacity: 0.3}]} quiet><Icon name="arrow-down" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Tirar ${t.title} da fita`} onPress={() => remove(t.id, t.title)} style={[P.iconBtn, {backgroundColor: '#FBE3E8'}]}><Icon name="remove" size={20} color="#9B2C4A" /></Press>
              </>}
            </Press>
          </Animated.View>
        );
      })}
      {m.missing > 0 && <Text style={[T.small, {marginTop: 8}]}>{m.missing} música(s) desta fita não estão mais no celular e foram ignoradas.</Text>}
      {editing && m.tapeTracks.some((t) => t.source === 'file') && (
        <Text style={[T.small, {marginTop: 10}]}>Arquivos copiados para o app (via “Escolher arquivos”) ocupam espaço do app. Para apagar a cópia, use a lixeira abaixo; músicas do celular nunca são apagadas.</Text>
      )}
      {editing && m.tapeTracks.filter((t) => t.source === 'file').map((t) => (
        <Btn key={t.id} kind="danger" small icon="trash-outline" text={`APAGAR CÓPIA: ${t.title}`.slice(0, 40)} label={`Apagar a cópia de ${t.title} do app`} style={{marginTop: 8}}
          onPress={() => Alert.alert('Apagar a cópia do app?', 'Só a cópia guardada pelo Modo Treino é removida. O arquivo original continua onde estava.', [{text: 'Cancelar', style: 'cancel'}, {text: 'Apagar cópia', style: 'destructive', onPress: () => m.forgetImported(t.id)}])} />
      ))}
      <Text style={P.disclaimer}>As músicas ficam no celular e tocam offline. Links do YouTube não são reproduzidos. Em segundo plano, o som depende do Android e das suas permissões.</Text>

      <AddMusicSheet visible={adding} onClose={() => setAdding(false)} />

      <Sheet visible={!!naming} onClose={() => setNaming(null)} title={naming === 'new' ? 'Nova fita' : 'Renomear fita'}>
        <TextInput value={name} onChangeText={setName} autoFocus placeholder="Nome da fita (ex.: Pesado, Cardio)" placeholderTextColor={C.muted} maxLength={40} accessibilityLabel="Nome da fita" style={P.nameInput} onSubmitEditing={saveName} />
        <Btn text="SALVAR" icon="checkmark" disabled={!name.trim()} onPress={saveName} />
      </Sheet>

      <Sheet visible={settings} onClose={() => setSettings(false)} title="Transição entre músicas">
        <Text style={[T.body, {marginBottom: 14}]}>Quanto tempo uma música leva para sumir enquanto a próxima entra.</Text>
        <Chips options={FADES} value={m.lib.fade} onChange={m.setFade} format={(n) => (n ? `${n} s` : 'Sem')} label={(n) => `Transição de ${n} segundos`} />
      </Sheet>
    </ScrollView>
  );
}

const P = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  player: {marginTop: 16, padding: 18, ...INK},
  song: {fontSize: 18, fontWeight: '900', color: C.ink, letterSpacing: -0.3},
  seek: {height: 28, justifyContent: 'center'},
  seekTrack: {height: 5, borderRadius: 3, backgroundColor: C.soft, overflow: 'hidden'},
  seekFill: {height: 5, backgroundColor: C.ink},
  seekKnob: {position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: C.ink, marginLeft: -7, top: 7},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
  controls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10},
  small: {width: 46, height: 46, alignItems: 'center', justifyContent: 'center'},
  play: {width: 68, height: 68, borderRadius: 34, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', ...INK},
  fadeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'center', padding: 8},
  sectionHead: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 12},
  tape: {minWidth: 118, paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line},
  tapeOn: {backgroundColor: C.ink, borderColor: C.ink},
  tapeName: {fontSize: 14, fontWeight: '900', color: C.ink},
  tapeCount: {fontSize: 11, color: C.muted, marginTop: 3},
  newTape: {minWidth: 118, paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#BDB7AA', alignItems: 'center', justifyContent: 'center', gap: 2},
  pillBtn: {paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center'},
  pillText: {color: C.white, fontWeight: '900', fontSize: 12, letterSpacing: 0.8},
  iconBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.md, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: C.line},
  rowOn: {backgroundColor: '#FFF6DA', borderColor: C.ink},
  num: {width: 34, height: 34, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  numText: {fontSize: 12, fontWeight: '900', color: C.muted},
  rowTitle: {fontSize: 15, fontWeight: '800', color: C.ink},
  empty: {alignItems: 'center', padding: 28, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line},
  disclaimer: {fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 24},
  nameInput: {backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: 16, height: 52, fontSize: 16, color: C.ink, marginBottom: 14},
});
