import React, {useEffect, useState} from 'react';
import {Alert, Image, Keyboard, Linking, ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import {DEFAULT_SOUNDS, playSound, SOUND_STYLES} from '../../SoundFX';
import {EXERCISES, Exercise, file, imageInfo, Persona, personaName, Treino} from '../data';
import {useApp} from '../store';
import {BackupApi, shareBackup, shareCsv} from '../backup';
import {GITHUB_REPO} from '../updates';
import {ModoPlayback, NotificationStyle} from '../../modules/modo-playback';
import {abrirAjustesDeNotificacao, diagnostico, estadoNotificacoes, mostrarTreino, NotifState, pedirNotificacoes} from '../notify';
import {ModoNotif} from '../../modules/modo-notif';
import {Btn, Card, Chips, Icon, Kicker, Pop, Press, Sheet, Switch} from '../ui';
import ExerciseVideo from '../ExerciseVideo';
import {deleteExerciseVideo, pickExerciseVideo} from '../video';
import {falar} from '../voice';
import {Glyph} from '../glyphs';
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
          <Pop key={p} accessibilityRole="button" accessibilityState={{selected: on}} accessibilityLabel={p === 'loira' ? 'Escolher Camila Camomila, a ruivinha' : 'Escolher Josperd'}
            onPress={() => update((s) => ({...s, persona: p}))} color={on ? C.yellow : C.card} radius={R.lg} offset={on ? 3 : 5} style={{flex: 1}} innerStyle={PS.card}>
            <View style={PS.img}>
              <Image source={file(p === 'loira' ? 'lateral_loira.png' : 'lateral_vinho.png')} resizeMode="contain" style={{width: '100%', height: '100%'}} />
              <View style={PS.glyph}><Glyph persona={p} size={34} spin={on} /></View>
            </View>
            <Text style={PS.name} numberOfLines={1}>{p === 'loira' ? 'CAMILA' : 'JOSPERD'}</Text>
            <Text style={PS.sub}>{(p === 'loira' ? 'a ruivinha' : 'por Josperd') + (on ? '  ● ativa' : p === 'loira' ? '  ✿' : '  ★')}</Text>
          </Pop>
        );
      })}
    </View>
  );
}
const PS = StyleSheet.create({
  card: {padding: 10, alignItems: 'center'},
  img: {width: '100%', height: 118, backgroundColor: '#F4F0E6', borderRadius: R.md, padding: 4, borderWidth: 2, borderColor: C.ink},
  glyph: {position: 'absolute', top: -10, left: -10},
  name: {fontSize: 17, fontWeight: '900', color: C.ink, marginTop: 8, letterSpacing: 0.6},
  sub: {fontSize: 12, fontWeight: '500', color: 'rgba(20,27,52,.7)'},
});

const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
  <View style={{marginBottom: 24}}><Text style={[T.kicker, {marginBottom: 10}]}>{title}</Text>{children}</View>
);

function NotifPermission({visible}: {visible: boolean}) {
  const {state} = useApp();
  const [st, setSt] = useState<NotifState>('unavailable');
  const [info, setInfo] = useState<string[]>([]);
  const refresh = () => { void estadoNotificacoes().then(setSt); setInfo(diagnostico()); };
  useEffect(() => { if (visible) refresh(); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  // Estilo da notificação de música (só existe no motor nativo Media3): cartão ilustrado ou player do sistema.
  const [estilo, setEstilo] = useState<NotificationStyle>('card');
  useEffect(() => { if (visible && ModoPlayback.available) void ModoPlayback.getNotificationStyle().then(setEstilo).catch(() => {}); }, [visible]);
  const escolher = (v: NotificationStyle) => { setEstilo(v); void ModoPlayback.setNotificationStyle(v).catch(() => {}); };
  if (st === 'unavailable') return null;
  const ok = st === 'granted';
  // Mostra os dois cartões com dados de exemplo, para ver (e conferir no Android) como ficam.
  const testar = () => {
    ModoNotif.music({title: 'Fita 03 – Ritmo de treino', subtitle: 'Bag Treino A · Mix genérico', kicker: 'Fita', art: 2, playing: true, live: false, position: 84, duration: 198, fav: false, skip: true});
    mostrarTreino({kicker: 'A1 · Bíceps', title: 'Rosca direta na barra W', image: '', persona: state.persona, pill: 'Séries feitas: 2/5', restEndsAt: 0, restPaused: false, restLeft: 0,
      primaryAction: 'serie', primaryLabel: 'Concluir série 3', secondaryAction: 'next', secondaryLabel: 'Próximo exercício'});
    setTimeout(() => { ModoNotif.musicStop(); ModoNotif.workoutStop(); }, 20000);
    setInfo(diagnostico());
  };
  return (
    <View style={{marginTop: 4, paddingVertical: 10}}>
      <Text style={T.h3}>{ok ? 'Notificações permitidas ✓' : 'Notificações desligadas'}</Text>
      <Text style={[T.small, {marginTop: 2, marginBottom: 10}]}>
        {ok ? 'Duas notificações no visual do app: a da música (fita ou rádio) e a do exercício. Elas aparecem também com a tela bloqueada.'
          : st === 'ask' ? 'Sem esta permissão o Android esconde TODAS as notificações do app: a do player de música e a do exercício.'
          : 'O Android está bloqueando as notificações do Modo Treino. Abra os ajustes do app e ligue "Mostrar notificações" (e, em alguns celulares, "Tela de bloqueio" e "Notificações flutuantes").'}
      </Text>
      {info.length > 0 && <View style={{marginBottom: 10}}>{info.map((l) => <Text key={l} style={T.small} selectable>{l}</Text>)}</View>}
      {ModoPlayback.available && (
        <View style={{marginBottom: 12}}>
          <Text style={T.h3}>Notificação da música</Text>
          <Text style={[T.small, {marginTop: 2, marginBottom: 8}]}>
            {estilo === 'card' ? 'Cartão ilustrado do app: a fita colorida, o nome e os botões. O Android o desenha dentro de uma moldura e não deixa arrastar o tempo.'
              : 'Player do Android: tela cheia, com a barra de tempo que você arrasta, o ♥ e a capa do app.'}
          </Text>
          <View style={{flexDirection: 'row', gap: 8}}>
            <View style={{flex: 1}}><Btn small kind={estilo === 'card' ? 'primary' : 'ghost'} icon="albums" text="CARTÃO" label="Notificação em cartão ilustrado" onPress={() => escolher('card')} /></View>
            <View style={{flex: 1}}><Btn small kind={estilo === 'system' ? 'primary' : 'ghost'} icon="play-circle" text="PLAYER" label="Notificação no player do sistema" onPress={() => escolher('system')} /></View>
          </View>
        </View>
      )}
      <View style={{gap: 8}}>
        {st === 'ask' && <Btn small icon="notifications" text="PERMITIR NOTIFICAÇÕES" onPress={() => { void pedirNotificacoes().then((n) => { setSt(n); setInfo(diagnostico()); }); }} />}
        {st !== 'ask' && <Btn small kind={ok ? 'ghost' : 'primary'} icon="settings-sharp" text="AJUSTES DE NOTIFICAÇÃO" onPress={() => { abrirAjustesDeNotificacao(); }} />}
        {ok && <Btn small icon="notifications" text="TESTAR AS DUAS" onPress={testar} />}
      </View>
    </View>
  );
}

export function SettingsSheet({visible, onClose, version, status, onCheck, onGallery, backup}: {visible: boolean; onClose: () => void; version: string; status: string; onCheck: () => void; onGallery: () => void; backup: BackupApi}) {
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
          <Switch value={state.notifyWorkout} onChange={(v) => update((s) => ({...s, notifyWorkout: v}))} title="Notificação do exercício" desc="Cartão verde-menta com a ilustração, as séries feitas e botões para concluir a série e pular o descanso, também com a tela bloqueada." />
          <Switch value={state.voice} onChange={(v) => { update((s) => ({...s, voice: v})); if (v) falar('Voz do treino ligada.'); }} title="Voz do treino" desc="Desligada por padrão. O Android fala o exercício, a série concluída e o descanso. Usa a voz que já está no celular." />
          <NotifPermission visible={visible} />
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

        <Section title="Backup dos seus dados">
          <Card color={C.mint} offset={4}>
            {backup.supported ? (backup.folder ? (
              <>
                <Text style={T.h3}>Backup automático ligado ✓</Text>
                <Text style={[T.small, {marginTop: 4}]}>{backup.last ? `Último backup: ${backup.last}.` : 'Ainda sem backup nesta pasta.'} O app guarda sozinho depois de cada treino ou ajuste.</Text>
                <View style={{gap: 8, marginTop: 12}}>
                  <Btn small icon="cloud-upload-outline" text="SALVAR AGORA" disabled={backup.busy} onPress={() => { void backup.saveNow(); }} />
                  <Btn small kind="dark" icon="cloud-download-outline" text="RESTAURAR DO BACKUP" disabled={backup.busy} onPress={() => { void backup.restore(); }} />
                  <Btn small kind="ghost" icon="folder-open-outline" text="TROCAR PASTA" onPress={() => { void backup.choose(); }} />
                </View>
              </>
            ) : (
              <>
                <Text style={T.h3}>Backup sem complicação</Text>
                <Text style={[T.small, {marginTop: 4}]}>Escolha uma pasta uma única vez (por exemplo, Documentos). Depois o app guarda tudo lá sozinho, e restaurar é um toque. Sem arquivos para procurar.</Text>
                <Btn icon="folder-open-outline" text="ESCOLHER PASTA DO BACKUP" disabled={backup.busy} onPress={() => { void backup.choose(); }} style={{marginTop: 12}} />
              </>
            )) : <Text style={T.small}>O backup por pasta funciona no app Android. No navegador, use “Enviar backup”.</Text>}
          </Card>
          <Text style={[T.small, {marginTop: 10}]}>Tudo fica só neste aparelho e na pasta que você escolher. Nada vai para servidores.</Text>
          <View style={{gap: 8, marginTop: 10}}>
            <Btn kind="ghost" small icon="share-outline" text="ENVIAR BACKUP PARA OUTRO APP" onPress={() => { void shareBackup(state, version); }} />
            <Btn kind="ghost" small icon="document-text-outline" text="ENVIAR PLANILHA (CSV)" onPress={() => { void shareCsv(state); }} />
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
  const [watch, setWatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const video = exercise ? app.state.videos[exercise.id] : undefined;
  useEffect(() => { setWatch(false); }, [exercise]);
  const chooseVideo = async () => {
    if (!exercise || busy) return;
    setBusy(true);
    try {
      const v = await pickExerciseVideo(exercise.id);
      if (v) { if (video) void deleteExerciseVideo(video.uri); app.update((s) => ({...s, videos: {...s.videos, [exercise.id]: v}})); setWatch(true); }
    } catch (e) {
      Alert.alert(e instanceof Error && e.message === 'not-video' ? 'Isso não é um vídeo' : 'Não foi possível guardar o vídeo', e instanceof Error && e.message === 'not-video' ? 'Escolha um arquivo de vídeo (MP4, MOV, WebM ou 3GP).' : 'Confira se há espaço no celular e tente de novo.');
    } finally { setBusy(false); }
  };
  const removeVideo = () => {
    if (!exercise || !video) return;
    Alert.alert('Remover o vídeo?', 'Só a cópia guardada pelo Modo Treino é apagada. O vídeo original continua na sua galeria.', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Remover', style: 'destructive', onPress: () => { void deleteExerciseVideo(video.uri); setWatch(false); app.update((s) => { const {[exercise.id]: _gone, ...rest} = s.videos; return {...s, videos: rest}; }); }},
    ]);
  };
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
          <Text style={[T.kicker, {marginTop: 22, marginBottom: 8}]}>Meu vídeo de execução</Text>
          {video ? (
            <View style={{gap: 10}}>
              {watch && <ExerciseVideo video={video} height={300} />}
              <Text style={T.small} numberOfLines={1}>{video.name}</Text>
              <Btn small icon={watch ? 'close' : 'play'} kind={watch ? 'ghost' : 'primary'} text={watch ? 'FECHAR O VÍDEO' : 'VER MEU VÍDEO'} onPress={() => setWatch(!watch)} />
              <View style={{flexDirection: 'row', gap: 10}}>
                <Btn small kind="ghost" icon="swap-horizontal" text="TROCAR" onPress={() => { void chooseVideo(); }} style={{flex: 1}} />
                <Btn small kind="danger" icon="trash-outline" text="REMOVER" onPress={removeVideo} style={{flex: 1}} />
              </View>
            </View>
          ) : (
            <>
              <Text style={[T.small, {marginBottom: 10}]}>Grave você fazendo o movimento e guarde aqui para rever durante o treino. O vídeo fica só neste celular.</Text>
              <Btn small kind="ghost" icon="videocam-outline" text={busy ? 'GUARDANDO…' : 'ESCOLHER UM VÍDEO'} disabled={busy} onPress={() => { void chooseVideo(); }} />
            </>
          )}
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
