import React, {useEffect, useState} from 'react';
import {Alert, Image, Keyboard, Linking, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {DEFAULT_SOUNDS, playSound, SOUND_STYLES} from '../../SoundFX';
import {EXERCISES, Exercise, file, imageInfo, Persona, personaName, Treino} from '../data';
import {useApp} from '../store';
import {exportBackup, exportCsv, importBackup} from '../backup';
import {GITHUB_REPO} from '../updates';
import {Btn, Card, Chips, Icon, Kicker, Press, Sheet, Switch} from '../ui';
import {C, INK, R, shadow, T} from '../theme';

const REST_EX = [0, 30, 45, 60, 90, 120, 180];
const REST_SET = [0, 15, 30, 45, 60, 90];
const secLabel = (n: number) => (n ? `${n}s` : 'Sem');

export function PersonaPicker() {
  const {state, update} = useApp();
  return (
    <View style={{flexDirection: 'row', gap: 12}}>
      {(['vinho', 'loira'] as Persona[]).map((p) => {
        const on = state.persona === p;
        return (
          <Press key={p} accessibilityRole="button" accessibilityState={{selected: on}} accessibilityLabel={p === 'loira' ? 'Escolher Camila Camomila, a ruivinha' : 'Escolher Josperd'}
            onPress={() => update((s) => ({...s, persona: p}))} style={[PS.card, on && PS.on]}>
            <View style={PS.img}><Image source={file(p === 'loira' ? 'lateral_loira.png' : 'lateral_vinho.png')} resizeMode="contain" style={{width: '100%', height: '100%'}} /></View>
            <Text style={PS.name}>{p === 'loira' ? 'CAMILA · RUIVINHA' : 'JOSPERD'}</Text>
            <Text style={PS.sub}>{state.persona === p ? '● Selecionado' : p === 'loira' ? 'a ruivinha' : 'por Josperd'}</Text>
            {on && <View style={PS.check}><Icon name="checkmark" size={14} color={C.white} /></View>}
          </Press>
        );
      })}
    </View>
  );
}
const PS = StyleSheet.create({
  card: {flex: 1, backgroundColor: C.card, borderRadius: R.lg, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: C.line},
  on: {...INK, backgroundColor: '#FFF1CE'},
  img: {width: '100%', height: 110, backgroundColor: '#F4F0E6', borderRadius: R.md, padding: 4},
  name: {fontSize: 13, fontWeight: '900', color: C.ink, marginTop: 8, letterSpacing: 0.6},
  sub: {fontSize: 11, color: C.muted},
  check: {position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center'},
});

const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
  <View style={{marginBottom: 24}}><Text style={[T.kicker, {marginBottom: 10}]}>{title}</Text>{children}</View>
);

export function SettingsSheet({visible, onClose, version, status, onCheck, onGallery}: {visible: boolean; onClose: () => void; version: string; status: string; onCheck: () => void; onGallery: () => void}) {
  const {state, update} = useApp();
  const snd = state.sounds || DEFAULT_SOUNDS;
  const setSnd = (patch: Partial<typeof snd>) => update((v) => ({...v, sounds: {...v.sounds, ...patch}}));
  return (
    <Sheet visible={visible} onClose={onClose} title="Ajustes" tall>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 30}}>
        <Section title="Personagem"><PersonaPicker /><Text style={[T.small, {marginTop: 8}]}>{personaName(state.persona)}. Sem a arte da Camila, o app usa o Josperd e avisa.</Text></Section>

        <Section title="Descanso">
          <Text style={T.h3}>Entre exercícios</Text>
          <Text style={[T.small, {marginBottom: 10, marginTop: 2}]}>Começa quando você termina todas as séries de um exercício.</Text>
          <Chips options={REST_EX} value={state.restExercise} onChange={(n) => update((s) => ({...s, restExercise: n}))} format={secLabel} label={(n) => `Descanso entre exercícios: ${n ? n + ' segundos' : 'desligado'}`} />
          <Text style={[T.h3, {marginTop: 20}]}>Entre séries</Text>
          <Text style={[T.small, {marginBottom: 10, marginTop: 2}]}>Desligado por padrão: as séries do mesmo exercício seguem sem contagem.</Text>
          <Chips options={REST_SET} value={state.restSet} onChange={(n) => update((s) => ({...s, restSet: n}))} format={secLabel} label={(n) => `Descanso entre séries: ${n ? n + ' segundos' : 'desligado'}`} />
        </Section>

        <Section title="Tela">
          <Switch value={state.keepAwake} onChange={(v) => update((s) => ({...s, keepAwake: v}))} title="Manter a tela ligada no treino" desc="Evita apagar durante o modo execução. Gasta mais bateria." />
        </Section>

        <Section title="Sons do app">
          <Switch value={snd.enabled} onChange={(v) => setSnd({enabled: v})} title="Efeitos sonoros" desc="Desligados por padrão. Não interferem na música das fitas." />
          {snd.enabled && (
            <View style={{marginTop: 6}}>
              <Text style={[T.small, {marginVertical: 8}]}>Estilo</Text>
              <View style={{flexDirection: 'row', gap: 10, flexWrap: 'wrap'}}>
                {SOUND_STYLES.map(([id, name, description]) => (
                  <Press key={id} accessibilityRole="button" accessibilityState={{selected: snd.pack === id}} accessibilityLabel={`Estilo de som ${name}`} onPress={() => { setSnd({pack: id}); playSound('series', true, id); }} style={[SS.pack, snd.pack === id && SS.packOn]}>
                    <Text style={[SS.packName, snd.pack === id && {color: C.white}]}>{name}</Text>
                    <Text style={[T.small, snd.pack === id && {color: '#C9D1EE'}]}>{description}</Text>
                  </Press>
                ))}
              </View>
              <Text style={[T.small, {marginTop: 14, marginBottom: 8}]}>Volume · {snd.volume}%</Text>
              <Chips options={[0, 20, 35, 50, 75, 100]} value={snd.volume} onChange={(v) => setSnd({volume: v})} format={(n) => `${n}%`} label={(n) => `Volume ${n} por cento`} />
              {([['buttons', 'Sons nos botões'], ['series', 'Série marcada'], ['finish', 'Treino finalizado'], ['rest', 'Descanso concluído'], ['countdown', 'Contagem 3, 2, 1'], ['voice', 'Voz em português (ou bipes)']] as const).map(([k, label]) => (
                <Switch key={k} value={!!snd[k]} onChange={(v) => setSnd({[k]: v} as Partial<typeof snd>)} title={label} />
              ))}
            </View>
          )}
        </Section>

        <Section title="Ilustrações"><Btn kind="ghost" icon="albums-outline" text="VER COLEÇÃO COMPLETA" onPress={() => { onClose(); setTimeout(onGallery, 250); }} /></Section>

        <Section title="Atualizações">
          <Card>
            <Switch value={state.notifyUpdates} onChange={(v) => update((s) => ({...s, notifyUpdates: v}))} title="Avisar quando sair versão nova" desc="Só quando existe uma release com APK. Nada é instalado sozinho." />
            <Text style={[T.small, {marginVertical: 8}]}>{status}</Text>
            <View style={{gap: 8}}>
              <Btn kind="ghost" small icon="refresh" text="VERIFICAR AGORA" onPress={onCheck} />
              <Btn kind="ghost" small icon="logo-github" text="VER TODAS AS VERSÕES" onPress={() => { Linking.openURL(`https://github.com/${GITHUB_REPO}/releases`).catch(() => {}); }} />
            </View>
          </Card>
        </Section>

        <Section title="Seus dados">
          <Text style={[T.body, {marginBottom: 12}]}>Tudo fica só neste aparelho. Exporte um backup antes de trocar de versão ou de celular.</Text>
          <View style={{gap: 8}}>
            <Btn kind="ghost" small icon="download-outline" text="EXPORTAR BACKUP (JSON)" onPress={() => { void exportBackup(state, version); }} />
            <Btn kind="ghost" small icon="document-text-outline" text="EXPORTAR PLANILHA (CSV)" onPress={() => { void exportCsv(state); }} />
            <Btn kind="ghost" small icon="push-outline" text="IMPORTAR BACKUP" onPress={() => { void importBackup((b) => update((s) => ({...s, ...b, ...{restExercise: b.restExercise, restSet: b.restSet}}))); }} />
          </View>
        </Section>
        <Text style={[T.small, {textAlign: 'center'}]}>Modo Treino · versão {version} · by Josperd</Text>
      </ScrollView>
    </Sheet>
  );
}
const SS = StyleSheet.create({
  pack: {minWidth: 104, paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.white},
  packOn: {backgroundColor: C.ink},
  packName: {fontSize: 13, fontWeight: '900', color: C.ink, letterSpacing: 0.6},
});

export function EditSheet({exercise, onClose, onZoom}: {exercise: Exercise | null; onClose: () => void; onZoom: (e: Exercise) => void}) {
  const app = useApp();
  const [weight, setWeight] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  useEffect(() => {
    if (!exercise) return;
    const c = app.conf(exercise);
    setWeight(c.peso); setSeries(String(c.series)); setReps(String(c.reps));
  }, [exercise]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    if (!exercise) return;
    const n = Number(series), r = Number(reps), w = weight.trim().replace(',', '.');
    if (n < 1 || n > 12 || !Number.isInteger(n) || r < 1 || r > 100 || !Number.isInteger(r) || (w !== '' && (!Number.isFinite(Number(w)) || Number(w) < 0 || Number(w) > 999))) {
      Alert.alert('Confira os valores', 'As séries devem ser de 1 a 12, repetições de 1 a 100 e peso de 0 a 999.');
      return;
    }
    app.saveOverride(exercise, {peso: w, series: n, reps: r});
    Keyboard.dismiss();
    onClose();
  };
  const info = exercise ? imageInfo(exercise, app.state.persona) : null;
  return (
    <Sheet visible={!!exercise} onClose={onClose} title={exercise?.nome || ''} tall>
      {exercise && info && (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 24}}>
          <Text style={T.kicker}>{exercise.codigo} · {exercise.grupo}</Text>
          <Press accessibilityRole="imagebutton" accessibilityLabel={`Ampliar a ilustração de ${exercise.nome}`} onPress={() => onZoom(exercise)} scaleTo={0.985} quiet style={ES.art}>
            <Image source={info.image} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${exercise.nome}`} />
          </Press>
          {info.status !== 'ok' && <Text style={[T.small, {marginTop: 6, color: '#A94865'}]}>{info.note}</Text>}
          <Text style={[T.body, {marginTop: 12}]}>{exercise.orientacao}</Text>
          <Text style={[T.small, {marginTop: 6}]}>{exercise.nota}</Text>
          <View style={ES.fields}>
            <Field label="PESO (KG)" value={weight} onChange={setWeight} keyboardType="decimal-pad" placeholder="a definir" flex={1.3} />
            <Field label="SÉRIES" value={series} onChange={setSeries} keyboardType="number-pad" />
            <Field label="REPS" value={reps} onChange={setReps} keyboardType="number-pad" />
          </View>
          <Btn text="SALVAR AJUSTES" icon="checkmark" onPress={save} style={{marginTop: 18}} />
        </ScrollView>
      )}
    </Sheet>
  );
}
function Field({label, value, onChange, keyboardType, placeholder, flex = 1}: {label: string; value: string; onChange: (v: string) => void; keyboardType: 'decimal-pad' | 'number-pad'; placeholder?: string; flex?: number}) {
  return (
    <View style={{flex}}>
      <Text style={ES.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={C.muted} accessibilityLabel={label} style={ES.input} />
    </View>
  );
}
const ES = StyleSheet.create({
  art: {height: 230, borderRadius: R.xl, backgroundColor: C.white, padding: 8, marginTop: 10},
  fields: {flexDirection: 'row', gap: 10, marginTop: 18},
  label: {fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: C.muted, marginBottom: 6},
  input: {height: 52, borderRadius: R.md, backgroundColor: C.white, paddingHorizontal: 14, fontSize: 18, fontWeight: '800', color: C.ink},
});

export function GallerySheet({visible, onClose, onZoom}: {visible: boolean; onClose: () => void; onZoom: (e: Exercise) => void}) {
  const {state} = useApp();
  const [filter, setFilter] = useState<'ALL' | Treino>('ALL');
  const list = EXERCISES.filter((e) => filter === 'ALL' || e.treino === filter);
  return (
    <Sheet visible={visible} onClose={onClose} title="Coleção ilustrada" tall>
      <Kicker>Arte por Josperd</Kicker>
      <View style={{marginVertical: 12}}><PersonaPicker /></View>
      <View style={{marginBottom: 12}}>
        <Chips options={['ALL', 'A', 'B'] as ('ALL' | Treino)[]} value={filter} onChange={setFilter} format={(x) => (x === 'ALL' ? 'Todos' : `Treino ${x}`)} label={(x) => (x === 'ALL' ? 'Todos os treinos' : `Treino ${x}`)} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={GS.grid}>
        {list.map((e) => {
          const info = imageInfo(e, state.persona);
          return (
            <Press key={e.id} accessibilityRole="imagebutton" accessibilityLabel={`Ampliar a ilustração de ${e.nome}`} onPress={() => onZoom(e)} scaleTo={0.97} quiet style={GS.card}>
              <View style={GS.art}><Image source={info.image} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${e.nome}`} /></View>
              <Text style={GS.code}>{e.codigo} · {e.grupo}</Text>
              <Text style={GS.name} numberOfLines={2}>{e.nome}</Text>
              {info.status !== 'ok' && <Text style={GS.warn}>{info.status === 'missing' ? 'Capa decorativa' : 'Arte do Josperd'}</Text>}
            </Press>
          );
        })}
        <Text style={[T.small, {width: '100%', marginTop: 6}]}>Na polia baixa frontal ainda não existe imagem específica: o Josperd é apenas uma capa decorativa.</Text>
      </ScrollView>
    </Sheet>
  );
}
const GS = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 30},
  card: {width: '47.5%', backgroundColor: C.white, borderRadius: R.lg, padding: 10, ...shadow.soft},
  art: {height: 140, backgroundColor: '#F4F0E6', borderRadius: R.md, padding: 4},
  code: {fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: C.muted, marginTop: 8, textTransform: 'uppercase'},
  name: {fontSize: 13, fontWeight: '800', color: C.ink, marginTop: 2},
  warn: {fontSize: 10, fontWeight: '800', color: '#A94865', marginTop: 3},
});
