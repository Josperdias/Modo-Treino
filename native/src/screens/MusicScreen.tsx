import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown, LinearTransition} from 'react-native-reanimated';
import {formatClock} from '../../logic';
import {flag} from '../data';
import {AText, Btn, Card, Chips, Equalizer, Icon, Kicker, Pattern, Pop, Press, Pulse, Sheet, useToast} from '../ui';
import {C, R, T, useNarrow} from '../theme';
import BagArt, {bagColor} from '../music/BagArt';
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

function VolumeBar() {
  const m = useMusic();
  const [w, setW] = useState(0);
  const v = m.lib.volume ?? 1;
  return (
    <View style={P.volRow}>
      <Press accessibilityRole="button" accessibilityLabel={v === 0 ? 'Ativar som' : 'Silenciar'} onPress={() => m.setVolume(v === 0 ? 1 : 0)} quiet haptic={false} style={{padding: 4}}>
        <Icon name={v === 0 ? 'volume-mute' : v < 0.5 ? 'volume-low' : 'volume-high'} size={20} color={C.ink} />
      </Press>
      <Press accessibilityRole="adjustable" accessibilityLabel="Volume" accessibilityValue={{text: `${Math.round(v * 100)} por cento`}} quiet haptic={false} scaleTo={1} style={[P.seek, {flex: 1}]}
        onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => { if (w > 0) m.setVolume(e.nativeEvent.locationX / w); }}>
        <View style={P.seekTrack}><View style={[P.seekFill, {width: `${v * 100}%`, backgroundColor: C.sky}]} /></View>
        <View style={[P.seekKnob, {left: `${v * 100}%`}]} />
      </Press>
      <Text style={P.volPct}>{Math.round(v * 100)}%</Text>
    </View>
  );
}

const TIMERS = [0, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function MusicScreen({onRadio}: {onRadio?: () => void}) {
  const m = useMusic();
  const toast = useToast();
  const narrow = useNarrow();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState<null | 'new' | 'rename'>(null);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState<(typeof m.tapeTracks)[number] | null>(null);
  const [others, setOthers] = useState(false);
  const tape = m.activeTape;
  const tapeIndex = m.lib.tapes.findIndex((t) => t.id === tape.id);
  const tone = bagColor(tapeIndex);

  const saveName = () => {
    if (!name.trim()) return;
    if (naming === 'new') m.newTape(name); else m.renameTape(name);
    setNaming(null); setName('');
  };
  const confirmDelete = () => Alert.alert(`Excluir a bolsa “${tape.name}”?`, 'Só a bolsa e a ordem são apagadas. As músicas continuam no seu celular.', [
    {text: 'Cancelar', style: 'cancel'}, {text: 'Excluir bolsa', style: 'destructive', onPress: () => m.deleteTape()},
  ]);
  const remove = (id: string, title: string) => {
    const index = tape.ids.indexOf(id);
    const track = m.lib.tracks.find((x) => x.id === id);
    m.removeFromTape(id);
    toast.show(`“${title}” saiu da bolsa`, track ? {label: 'DESFAZER', run: () => m.restoreToTape(track, index)} : undefined);
  };
  const sub = (t: (typeof m.tapeTracks)[number]) => t.source === 'radio' ? `${flag(t.cc)} ${t.country || 'Rádio'} · ao vivo` : t.duration ? formatClock(t.duration) : t.source === 'file' ? 'Arquivo copiado para o app' : 'No celular';

  return (
    <ScrollView contentContainerStyle={P.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(380)}>
        <Kicker>Sua sonoplastia particular / 001</Kicker>
        <Text style={[T.h1, {marginTop: 4, marginBottom: 16, fontSize: 40, lineHeight: 38}]}>Suas bolsas,{'\n'}seu ritmo.</Text>
        <Card color={tone} offset={6} style={{alignItems: 'center', paddingTop: 22, paddingBottom: 18}} pattern={<Pattern kind="dots" opacity={0.13} size={16} />}>
          <BagArt color={tone} count={m.tapeTracks.length} open={m.tapeTracks.length > 0} playing={m.playing} size={narrow ? 168 : 210} />
          <View style={P.nameTag}><Text style={P.nameTagText} numberOfLines={1}>{tape.name.toUpperCase()}</Text></View>
          <Text style={P.heroSub}>{m.tapeTracks.length ? `${m.tapeTracks.length} ${m.tapeTracks.length === 1 ? 'item' : 'itens'} na bolsa` : 'Bolsa vazia: encha com suas músicas'}</Text>
        </Card>
      </Animated.View>

      <View style={{marginTop: 20}}>
        <Card offset={4} style={{padding: 18}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text numberOfLines={1} style={[P.song, {flex: 1}]}>{m.now?.title || (tape.ids.length ? 'Toque ▶ para começar' : 'Bolsa vazia')}</Text>
            {m.live && <View style={P.live}><View style={P.liveDot} /><Text style={P.liveText}>AO VIVO</Text></View>}
          </View>
          <Text style={[T.small, {marginTop: 2}]} numberOfLines={1}>{m.now ? (m.live ? `${flag(m.now.cc)} ${m.now.country || 'Rádio'}` : tape.name) : `${tape.ids.length} item(ns) na bolsa`}</Text>
          {!m.live && <View style={{marginTop: 12}}><SeekBar /></View>}
          <View style={P.controls}>
            <Press accessibilityRole="button" accessibilityLabel={m.lib.shuffle ? 'Desligar aleatório' : 'Ligar aleatório'} accessibilityState={{selected: m.lib.shuffle}} onPress={() => m.setShuffle(!m.lib.shuffle)} style={P.small} quiet><Icon name="shuffle" size={22} color={m.lib.shuffle ? C.blue : C.muted} /></Press>
            <Press accessibilityRole="button" accessibilityLabel="Faixa anterior" onPress={() => m.skip(-1)} style={P.small} quiet><Icon name="play-skip-back" size={26} /></Press>
            <Pulse scale={m.playing ? 1 : 1.04} duration={1100}>
              <Pop accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} offset={4} radius={36} quiet innerStyle={P.play}><Icon name={m.playing ? 'pause' : 'play'} size={32} /></Pop>
            </Pulse>
            <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={P.small} quiet><Icon name="play-skip-forward" size={26} /></Press>
            <Press accessibilityRole="button" accessibilityLabel={m.lib.repeat ? 'Desligar repetir' : 'Ligar repetir'} accessibilityState={{selected: m.lib.repeat}} onPress={() => m.setRepeat(!m.lib.repeat)} style={P.small} quiet><Icon name="repeat" size={22} color={m.lib.repeat ? C.blue : C.muted} /></Press>
          </View>
          <VolumeBar />
          <Press accessibilityRole="button" accessibilityLabel="Transição entre músicas" onPress={() => setSettings(true)} style={P.fadeRow} quiet>
            <Icon name="options-outline" size={16} color={C.muted} /><Text style={T.small}>Controles · transição {m.lib.fade ? `${m.lib.fade} s` : 'desligada'} · {m.lib.rate}x{m.sleepLeft ? ` · dorme em ${mmss(m.sleepLeft)}` : ''}</Text>
          </Press>
        </Card>
      </View>

      <View style={P.sectionHead}><Text style={[T.h2, {fontSize: 28}]}>Minhas bolsas</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingVertical: 8, paddingRight: 20}} style={{marginHorizontal: -20, paddingLeft: 20}}>
        {m.lib.tapes.map((t, i) => {
          const on = t.id === tape.id;
          return (
            <Pop key={t.id} accessibilityRole="button" accessibilityLabel={`Bolsa ${t.name}, ${t.ids.length} itens`} accessibilityState={{selected: on}} onPress={() => m.selectTape(t.id)} color={on ? bagColor(i) : C.card} radius={R.lg} offset={on ? 3 : 5} innerStyle={P.bagCard}>
              <BagArt color={bagColor(i)} count={t.ids.length} open={on} playing={on && m.playing} size={92} />
              <Text numberOfLines={1} style={P.bagName}>{t.name}</Text>
              <Text style={P.bagCount}>{t.ids.length} {t.ids.length === 1 ? 'item' : 'itens'}</Text>
            </Pop>
          );
        })}
        <Pop accessibilityRole="button" accessibilityLabel="Criar nova bolsa" onPress={() => { setName(''); setNaming('new'); }} color={C.card} radius={R.lg} offset={5} innerStyle={[P.bagCard, {justifyContent: 'center', gap: 8}]}>
          <View style={P.plus}><Icon name="add" size={30} /></View>
          <Text style={P.bagName}>Nova bolsa</Text>
        </Pop>
      </ScrollView>

      <View style={P.sectionHead}>
        <Text style={[T.h2, {flex: 1, fontSize: 28}]} numberOfLines={1}>{tape.name}</Text>
        {tape.ids.length > 0 && <Pop accessibilityRole="button" accessibilityLabel={editing ? 'Concluir edição da bolsa' : 'Editar bolsa'} onPress={() => setEditing(!editing)} color={C.ink} offset={3} shadowColor={C.yellow} innerStyle={P.pillBtn}><Text style={P.pillText}>{editing ? 'OK' : 'EDITAR'}</Text></Pop>}
        <Press accessibilityRole="button" accessibilityLabel="Renomear bolsa" onPress={() => { setName(tape.name); setNaming('rename'); }} style={P.iconBtn}><Icon name="pencil" size={18} /></Press>
        {m.lib.tapes.length > 1 && <Press accessibilityRole="button" accessibilityLabel="Excluir bolsa" onPress={confirmDelete} style={P.iconBtn}><Icon name="trash-outline" size={18} color="#9B2C4A" /></Press>}
      </View>

      <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
        <Btn text="ADICIONAR MÚSICAS DO CELULAR" icon="add-circle" label="Adicionar músicas do celular" onPress={() => setAdding(true)} style={{flex: 1}} />
      </View>
      {m.tapeTracks.length > 0 && (
        <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
          <Btn small icon="play" text="TOCAR BOLSA" label="Tocar a bolsa toda" onPress={() => m.playBag(false)} style={{flex: 1}} />
          <Btn small kind="ghost" icon="shuffle" text="ALEATÓRIO" label="Tocar a bolsa em ordem aleatória" onPress={() => m.playBag(true)} style={{flex: 1}} />
        </View>
      )}
      {onRadio && <Btn kind="pink" small text="ACHAR UMA RÁDIO NO GLOBO" icon="earth" onPress={onRadio} style={{marginBottom: 14}} />}

      {m.tapeTracks.length === 0 ? (
        <Animated.View entering={FadeIn}>
          <Card color={C.card} offset={3} style={{alignItems: 'center', padding: 24}}>
            <Icon name="musical-notes" size={34} color={C.pink} />
            <Text style={[T.h3, {marginTop: 8}]}>Esta bolsa está vazia</Text>
            <Text style={[T.body, {textAlign: 'center', marginTop: 4}]}>Escolha músicas que já estão no seu celular ou ache uma rádio no globo. Sem importar, sem copiar.</Text>
          </Card>
        </Animated.View>
      ) : m.tapeTracks.map((t, i) => {
        const current = m.now?.id === t.id;
        return (
          <Animated.View key={t.id} layout={LinearTransition.duration(220)} entering={FadeIn.duration(220)} style={{marginBottom: 2}}>
            <Pop accessibilityRole="button" accessibilityLabel={`Tocar ${t.title}`} onPress={() => { void m.playTrack(t.id); }} color={current ? '#FFF1BF' : C.card} radius={R.md} offset={3} quiet innerStyle={P.row}>
              <View style={[P.num, current && {backgroundColor: C.yellow}]}>{current ? <Equalizer active={m.playing} /> : <Text style={P.numText}>{i + 1}</Text>}</View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={P.rowTitle}>{t.title}</Text>
                <Text style={T.small} numberOfLines={1}>{current ? (m.playing ? 'Tocando agora' : 'Pausada') : sub(t)}</Text>
              </View>
              {!editing && <Press accessibilityRole="button" accessibilityLabel={`Mais opções de ${t.title}`} onPress={() => { setOthers(false); setMenu(t); }} style={P.iconBtn} quiet><Icon name="ellipsis-horizontal" size={20} /></Press>}
              {editing && <>
                <Press accessibilityRole="button" accessibilityLabel={`Subir ${t.title}`} disabled={i === 0} onPress={() => m.moveInTape(t.id, -1)} style={[P.iconBtn, i === 0 && {opacity: 0.3}]} quiet><Icon name="arrow-up" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Descer ${t.title}`} disabled={i === m.tapeTracks.length - 1} onPress={() => m.moveInTape(t.id, 1)} style={[P.iconBtn, i === m.tapeTracks.length - 1 && {opacity: 0.3}]} quiet><Icon name="arrow-down" size={18} /></Press>
                <Press accessibilityRole="button" accessibilityLabel={`Tirar ${t.title} da bolsa`} onPress={() => remove(t.id, t.title)} style={[P.iconBtn, {backgroundColor: '#FBE3E8'}]}><Icon name="remove" size={20} color="#9B2C4A" /></Press>
              </>}
            </Pop>
          </Animated.View>
        );
      })}
      {m.missing > 0 && <Text style={[T.small, {marginTop: 8}]}>{m.missing} item(ns) desta bolsa não estão mais no celular e foram ignorados.</Text>}
      {editing && m.tapeTracks.some((t) => t.source === 'file') && (
        <Text style={[T.small, {marginTop: 10}]}>Arquivos copiados para o app (via “Arquivos”) ocupam espaço do app. Para apagar a cópia, use o botão abaixo; músicas do celular nunca são apagadas.</Text>
      )}
      {editing && m.tapeTracks.filter((t) => t.source === 'file').map((t) => (
        <Btn key={t.id} kind="danger" small icon="trash-outline" text={`APAGAR CÓPIA: ${t.title}`.slice(0, 40)} label={`Apagar a cópia de ${t.title} do app`} style={{marginTop: 8}}
          onPress={() => Alert.alert('Apagar a cópia do app?', 'Só a cópia guardada pelo Modo Treino é removida. O arquivo original continua onde estava.', [{text: 'Cancelar', style: 'cancel'}, {text: 'Apagar cópia', style: 'destructive', onPress: () => m.forgetImported(t.id)}])} />
      ))}
      <Text style={P.disclaimer}>As músicas ficam no celular e tocam offline. Rádios precisam de internet. Links do YouTube não são reproduzidos. Em segundo plano, o som depende do Android e das suas permissões.</Text>

      <AddMusicSheet visible={adding} onClose={() => setAdding(false)} />

      <Sheet visible={!!naming} onClose={() => setNaming(null)} title={naming === 'new' ? 'Nova bolsa' : 'Renomear bolsa'}>
        <TextInput value={name} onChangeText={setName} autoFocus placeholder="Nome da bolsa (ex.: Pesado, Cardio)" placeholderTextColor={C.muted} maxLength={40} accessibilityLabel="Nome da bolsa" style={P.nameInput} onSubmitEditing={saveName} />
        <Btn text="SALVAR" icon="checkmark" disabled={!name.trim()} onPress={saveName} />
      </Sheet>

      <Sheet visible={settings} onClose={() => setSettings(false)} title="Controles do player">
        <Text style={[T.h3, {marginBottom: 4}]}>Transição entre músicas</Text>
        <Text style={[T.small, {marginBottom: 10}]}>Quanto tempo uma música leva para sumir enquanto a próxima entra.</Text>
        <Chips options={FADES} value={m.lib.fade} onChange={m.setFade} format={(n) => (n ? `${n} s` : 'Sem')} label={(n) => `Transição de ${n} segundos`} />
        <Text style={[T.h3, {marginTop: 20, marginBottom: 4}]}>Velocidade</Text>
        <Text style={[T.small, {marginBottom: 10}]}>Não vale para rádio ao vivo.</Text>
        <Chips options={RATES} value={m.lib.rate} onChange={m.setRate} format={(n) => `${n}x`} label={(n) => `Velocidade ${n} vezes`} />
        <Text style={[T.h3, {marginTop: 20, marginBottom: 4}]}>Timer para dormir</Text>
        <Text style={[T.small, {marginBottom: 10}]}>{m.sleepLeft ? `Pausa em ${mmss(m.sleepLeft)}.` : 'A música pausa sozinha depois do tempo escolhido.'}</Text>
        <Chips options={TIMERS} value={m.sleepLeft ? -1 : 0} onChange={(n) => m.setSleep(n)} format={(n) => (n ? `${n} min` : 'Desligado')} label={(n) => (n ? `Pausar em ${n} minutos` : 'Desligar o timer')} />
      </Sheet>

      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title || ''}>
        {menu && (
          <View style={{gap: 10, paddingBottom: 10}}>
            <Btn small icon="play" text="TOCAR AGORA" onPress={() => { void m.playTrack(menu.id); setMenu(null); }} />
            <Btn small kind="ghost" icon="arrow-redo" text="TOCAR A SEGUIR" onPress={() => { m.playNext(menu.id); toast.show('Vai tocar a seguir'); setMenu(null); }} />
            <Btn small kind="ghost" icon="bag-add" text={others ? 'ESCOLHA A BOLSA' : 'COLOCAR EM OUTRA BOLSA'} onPress={() => setOthers(!others)} />
            {others && (
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
                {m.lib.tapes.filter((t) => t.id !== tape.id).map((t) => (
                  <Pop key={t.id} accessibilityRole="button" accessibilityLabel={`Colocar na bolsa ${t.name}`} onPress={() => { m.copyToTape(menu, t.id); toast.show(`Também na bolsa ${t.name}`); setMenu(null); }} offset={3} quiet innerStyle={{paddingHorizontal: 16, minHeight: 40, alignItems: 'center', justifyContent: 'center'}}>
                    <Text style={{fontSize: 16, fontWeight: '900', color: C.ink}}>{t.name}</Text>
                  </Pop>
                ))}
                {m.lib.tapes.length < 2 && <Text style={T.small}>Crie outra bolsa para mover faixas entre elas.</Text>}
              </View>
            )}
            <Btn small kind="danger" icon="remove-circle-outline" text="TIRAR DESTA BOLSA" onPress={() => { remove(menu.id, menu.title); setMenu(null); }} />
          </View>
        )}
      </Sheet>
    </ScrollView>
  );
}

const P = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  nameTag: {backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 20, paddingVertical: 8, marginTop: 10, borderWidth: 2, borderColor: C.ink, transform: [{rotate: '-2deg'}], maxWidth: '88%'},
  nameTagText: {fontSize: 22, fontWeight: '900', color: C.ink, letterSpacing: 1},
  heroSub: {fontSize: 13, fontWeight: '700', color: 'rgba(20,27,52,.75)', marginTop: 10},
  song: {fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: 0.2},
  live: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD3DE', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.ink},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0204A'},
  liveText: {fontSize: 11, fontWeight: '900', letterSpacing: 1, color: C.ink},
  seek: {height: 28, justifyContent: 'center'},
  seekTrack: {height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink},
  seekFill: {height: 8, backgroundColor: C.pink},
  seekKnob: {position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: C.yellow, marginLeft: -9, top: 5, borderWidth: 2, borderColor: C.ink},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
  controls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingRight: 4},
  small: {width: 46, height: 46, alignItems: 'center', justifyContent: 'center'},
  play: {width: 68, height: 68, alignItems: 'center', justifyContent: 'center'},
  volRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  volPct: {width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700', color: C.muted},
  fadeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'center', padding: 8},
  sectionHead: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10},
  bagCard: {width: 130, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', minHeight: 150},
  bagName: {fontSize: 18, fontWeight: '900', color: C.ink, marginTop: 4, letterSpacing: 0.3},
  bagCount: {fontSize: 11, fontWeight: '500', color: 'rgba(20,27,52,.7)'},
  plus: {width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center', justifyContent: 'center'},
  pillBtn: {paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center'},
  pillText: {color: C.yellow, fontWeight: '900', fontSize: 13, letterSpacing: 1},
  iconBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12},
  num: {width: 36, height: 36, borderRadius: 18, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  numText: {fontSize: 14, fontWeight: '900', color: C.ink},
  rowTitle: {fontSize: 15, fontWeight: '700', color: C.ink},
  disclaimer: {fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 24},
  nameInput: {backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: 16, height: 52, fontSize: 16, color: C.ink, marginBottom: 14, borderWidth: 2, borderColor: C.ink},
});
