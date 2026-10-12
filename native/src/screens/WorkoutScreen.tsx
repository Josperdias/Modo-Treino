/** Modo execução: um cartão por exercício, botões grandes para marcar as séries e descanso entre exercícios. */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, BackHandler, Image, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {Easing, FadeIn, FadeInRight, FadeOutLeft, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn} from 'react-native-reanimated';
import {doneCount, nextStep, restPlan, snapshotSession, tapSeries} from '../../logic';
import {playCount, playSound} from '../../SoundFX';
import {EXERCISES, Exercise, imageInfo, Treino} from '../data';
import {todayKey, useApp} from '../store';
import {AText, Btn, Confetti, FitText, Float, Icon, Pattern, Pop, Press, Pulse, Ring, useToast} from '../ui';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C, INK, R, T, useNarrow} from '../theme';
import MiniPlayer from '../music/MiniPlayer';
import {limparTreino, mostrarTreino} from '../notify';

type Props = {
  treino: Treino;
  startIndex?: number;
  onClose: () => void;
  onSaved: () => void;
  onOpenMusic: () => void;
  onZoom: (e: Exercise) => void;
  onEdit: (e: Exercise) => void;
};
type Rest = {end: number; total: number; advance: boolean};

const fmtKg = (n: number) => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function SegFill({pct}: {pct: number}) {
  const w = useSharedValue(pct);
  useEffect(() => { w.value = withTiming(pct, {duration: 420, easing: Easing.out(Easing.cubic)}); }, [pct, w]);
  const st = useAnimatedStyle(() => ({width: `${w.value}%`}));
  return <Animated.View style={[{height: '100%', backgroundColor: C.green}, st]} />;
}

function SetButton({n, size, done, next, label, onPress}: {n: number; size: number; done: boolean; next: boolean; label: string; onPress: () => void}) {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (done) pop.value = withSequence(withTiming(1.2, {duration: 110, easing: Easing.out(Easing.quad)}), withTiming(1, {duration: 190, easing: Easing.out(Easing.back(2))}));
  }, [done, pop]);
  const style = useAnimatedStyle(() => ({transform: [{scale: pop.value}]}));
  return (
    <Animated.View style={style}>
      <Pop accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected: done}} onPress={onPress} quiet radius={20} offset={4} color={done ? C.mint : next ? C.yellow : C.card} innerStyle={[W.set, {width: size - 4, height: size - 4}]}>
        {done ? <Icon name="checkmark" size={28} color={C.ink} /> : <Text style={W.setText}>{n}</Text>}
      </Pop>
    </Animated.View>
  );
}

export default function WorkoutScreen({treino, startIndex, onClose, onSaved, onOpenMusic, onZoom, onEdit}: Props) {
  const app = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const narrow = useNarrow();
  const {state} = app;
  const list = EXERCISES.filter((x) => x.treino === treino);
  const p = app.progress(treino);
  const [i, setI] = useState(() => Math.min(list.length - 1, Math.max(0, startIndex ?? p.firstIncomplete)));
  const [phase, setPhase] = useState<'card' | 'rest' | 'done'>(() => (startIndex == null && p.firstIncomplete < 0 && p.total > 0 ? 'done' : 'card'));
  const [rest, setRest] = useState<Rest | null>(null);
  const [secs, setSecs] = useState(0);
  const [help, setHelp] = useState(false);
  const prevSecs = useRef(0);
  const [setsW, setSetsW] = useState(0);

  const stopRest = useCallback(() => { setRest(null); setSecs(0); prevSecs.current = 0; }, []);
  const startRest = (seconds: number, advance: boolean) => {
    prevSecs.current = 0; setSecs(seconds); setRest({end: Date.now() + seconds * 1000, total: seconds, advance}); setPhase('rest');
  };
  const goNext = useCallback((from: number) => {
    const st = nextStep(app.progress(treino).list, from);
    setHelp(false);
    if (st.type === 'done') setPhase('done'); else { setI(st.index); setPhase('card'); }
  }, [app, treino]);
  const finishRest = useCallback(() => {
    const advance = rest?.advance ?? true;
    stopRest();
    if (advance) goNext(i); else setPhase('card');
  }, [rest, stopRest, goNext, i]);

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setSecs(Math.max(0, Math.ceil((rest.end - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [rest]);
  useEffect(() => {
    if (!rest) return;
    if (secs > 0 && secs <= 3 && secs !== prevSecs.current) playCount(secs);
    if (secs === 0 && prevSecs.current > 0) { playSound('rest'); prevSecs.current = 0; finishRest(); return; }
    prevSecs.current = secs;
  }, [secs, rest, finishRest]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const ex = list[i];
  const total = app.total(ex);
  const cur = doneCount(app.done(ex), total);

  // notificação do exercício (separada da de música): fixa durante o treino; ao tocar nela o app volta para esta tela
  useEffect(() => {
    if (!state.notifyWorkout || phase === 'done') { void limparTreino(); return; }
    const titulo = `Treino ${treino} · exercício ${i + 1}/${list.length}`;
    const proximo = list[i + 1];
    const corpo = phase === 'rest' ? `Descansando${proximo && cur >= total ? ` · próximo: ${proximo.nome}` : ''}` : `${ex.nome} · ${cur}/${total} séries`;
    void mostrarTreino(titulo, corpo);
  }, [state.notifyWorkout, phase, i, cur, total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { void limparTreino(); }, []);
  const c = app.conf(ex);
  const info = imageInfo(ex, state.persona);
  const cols = Math.min(total, 6);
  const setSize = setsW > 0 ? Math.max(44, Math.min(72, Math.floor((setsW - 12 * (cols - 1)) / cols))) : 60;

  const tap = (e: Exercise, k: number) => {
    const t = app.total(e);
    const before = doneCount(app.done(e), t);
    const next = tapSeries(app.done(e), k, t);
    const after = doneCount(next, t);
    app.setDone(e, next);
    if (after <= before) return;
    playSound('series');
    if (p.sets + (after - before) >= p.total) { stopRest(); setPhase('done'); return; }
    const seconds = restPlan({exerciseDone: after >= t, restExercise: state.restExercise, restSet: state.restSet});
    if (seconds > 0) startRest(seconds, after >= t);
  };
  const adjust = (e: Exercise, d: number) => { const k = app.conf(e); app.saveOverride(e, {...k, series: Math.max(1, Math.min(12, app.total(e) + d))}); };
  const restart = () => Alert.alert(`Recomeçar o Treino ${treino}?`, 'As séries marcadas hoje serão apagadas. O histórico é mantido.', [
    {text: 'Cancelar', style: 'cancel'}, {text: 'Recomeçar', style: 'destructive', onPress: () => { app.resetToday(treino); stopRest(); setPhase('card'); setI(0); }},
  ]);
  const save = () => {
    const r = app.finishWorkout(treino);
    if (r.ok) { playSound('finish'); onSaved(); }
    else toast.show(r.reason === 'already' ? 'Você já finalizou esse treino hoje.' : 'Marque pelo menos uma série.');
  };

  const top = (label: string) => (
    <>
      <View style={[W.top, {paddingTop: insets.top + 8}]}>
        <Press accessibilityRole="button" accessibilityLabel="Sair do modo execução" onPress={onClose} style={W.topBtn} quiet><Icon name="close" size={22} color={C.white} /></Press>
        <Text accessibilityLiveRegion="polite" style={W.topLabel}>{label}</Text>
        <Press accessibilityRole="button" accessibilityLabel="Recomeçar o treino" onPress={restart} style={W.topBtn} quiet><Icon name="refresh" size={20} color={C.white} /></Press>
      </View>
      <MiniPlayer onOpen={onOpenMusic} dark />
    </>
  );

  /* ---------- fim do treino ---------- */
  if (phase === 'done') {
    const snap = snapshotSession({exercises: EXERCISES, treino, date: todayKey(), getConf: app.conf, getDone: app.done});
    return (
      <View style={[W.shell, {backgroundColor: C.yellow}]}>
        <Pattern kind="stripes" opacity={0.07} size={22} />
        <Confetti />
        {top(`TREINO ${treino}`)}
        <View style={W.center}>
          <Animated.View entering={ZoomIn.springify().damping(9)}><Float amplitude={6} duration={2000}><View style={W.burst}><Icon name="checkmark" size={54} color={C.ink} /></View></Float></Animated.View>
          <AText entering={FadeIn.delay(150)} style={W.doneTitle}>TREINO {treino}{'\n'}COMPLETO!</AText>
          <AText entering={FadeIn.delay(260)} style={W.lead}>{snap.sets} séries registradas{snap.volume ? ` · ${fmtKg(snap.volume)} kg de volume` : ''}. Salvar no histórico?</AText>
          <Btn kind="dark" text="FINALIZAR E SALVAR" icon="checkmark" onPress={save} style={{alignSelf: 'stretch', marginTop: 24}} />
          <Btn kind="ghost" text="VOLTAR AOS EXERCÍCIOS" onPress={() => { setPhase('card'); setI(list.length - 1); }} style={{alignSelf: 'stretch', marginTop: 10}} />
        </View>
      </View>
    );
  }

  /* ---------- descanso ---------- */
  if (phase === 'rest' && rest) {
    const st = nextStep(p.list, i);
    const nx = st.type === 'exercise' ? list[st.index] : ex;
    const nc = app.conf(nx);
    const ni = imageInfo(nx, state.persona);
    const between = !rest.advance;
    return (
      <View style={[W.shell, {backgroundColor: C.navy}]}>
        <Pattern kind="dots" color="#FFFFFF" opacity={0.07} size={20} />
        {top("DESCANSO")}
        <View style={W.center}>
          <Animated.View entering={FadeIn} style={W.next}>
            <View style={W.nextImgBox}><Image source={ni.image} resizeMode="contain" style={W.nextImg} /></View>
            <View style={{flex: 1}}>
              <Text style={W.nextOver}>{between ? `PRÓXIMA: SÉRIE ${cur + 1} DE ${total}` : `PRÓXIMO EXERCÍCIO ${st.type === 'exercise' ? st.index + 1 : i + 1}/${list.length}`}</Text>
              <Text style={W.nextName}>{nx.nome.toUpperCase()}</Text>
              <Text style={W.nextMeta}>{app.total(nx)} × {nc.reps} rep. · {nc.peso ? `${nc.peso} kg` : 'carga a definir'}</Text>
            </View>
          </Animated.View>
          <Pulse scale={1.025} duration={1600}><Ring size={230} stroke={14} progress={rest.total ? secs / rest.total : 0} color={C.yellow} track="rgba(255,255,255,.14)">
            <Text accessibilityRole="timer" accessibilityLabel="Tempo de descanso" style={W.clock}>{clock(secs)}</Text>
            <Text style={W.clockLabel}>{between ? 'ENTRE SÉRIES' : 'ENTRE EXERCÍCIOS'}</Text>
          </Ring></Pulse>
          <View style={{flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 30}}>
            <Press accessibilityRole="button" accessibilityLabel="Mais 15 segundos" onPress={() => { setRest({...rest, end: rest.end + 15000, total: rest.total + 15}); setSecs((s) => s + 15); }} style={W.pill}><Text style={W.pillText}>+15s</Text></Press>
            <Press accessibilityRole="button" accessibilityLabel="Pular descanso" onPress={finishRest} style={[W.pill, {backgroundColor: C.white}]}><Text style={[W.pillText, {color: C.navy}]}>PULAR</Text></Press>
          </View>
        </View>
      </View>
    );
  }

  /* ---------- cartão do exercício ---------- */
  const lastStep = nextStep(p.list, i).type === 'done';
  const label = cur < total ? `CONCLUIR SÉRIE ${cur + 1}` : lastStep ? 'TERMINAR' : 'PRÓXIMO EXERCÍCIO';
  return (
    <View style={W.shell}>
      {top(`EXERCÍCIO ${i + 1}/${list.length}`)}
      <View accessibilityRole="progressbar" accessibilityLabel="Progresso do treino" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} style={W.segs}>
        {list.map((_, k) => { const x = p.list[k]; return <View key={k} style={[W.seg, k === i && W.segNow]}><SegFill pct={Math.round((100 * x.done) / x.total)} /></View>; })}
      </View>
      <ScrollView contentContainerStyle={W.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={ex.id} entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)}>
          <Pop accessibilityRole="imagebutton" accessibilityLabel={`Ampliar a ilustração de ${ex.nome}`} onPress={() => onZoom(ex)} quiet radius={R.xl} offset={6} color="#B4CDF6" innerStyle={W.figure}>
            <Image source={info.image} resizeMode="contain" style={[W.img, info.status === 'missing' && {opacity: 0.5}]} accessibilityLabel={`Ilustração de ${ex.nome}`} />
            <View style={W.zoomBadge}><Icon name="expand-outline" size={16} color={C.white} /></View>
          </Pop>
          <View style={[W.chip, info.status === 'fallback' && {backgroundColor: '#FFE6A1'}, info.status === 'missing' && {backgroundColor: '#FFC5D3'}]}><Text style={W.chipText}>{info.label}</Text></View>
          {info.status !== 'ok' && <Text style={[T.small, {textAlign: 'center', marginTop: 6}]}>{info.note}</Text>}

          <View style={W.titleRow}>
            <View style={{flex: 1}}>
              <Text style={T.kicker}>{ex.codigo} · {ex.grupo}</Text>
              <Text style={W.title}>{ex.nome.toUpperCase()}</Text>
            </View>
            <Pop accessibilityRole="button" accessibilityLabel="Como fazer o movimento" accessibilityState={{expanded: help}} onPress={() => setHelp(!help)} quiet radius={23} offset={3} color={help ? C.yellow : C.card} innerStyle={W.help}><Text style={W.helpMark}>?</Text></Pop>
          </View>
          {help && <AText entering={FadeIn} style={W.helpBox}>{ex.orientacao}</AText>}

          <View style={W.target}>
            <Text style={W.targetText}><Text style={W.targetBig}>{total}</Text> séries × <Text style={W.targetBig}>{c.reps}</Text> rep.</Text>
            <Text style={W.targetText}>{c.peso ? <><Text style={W.targetBig}>{c.peso}</Text> kg</> : 'carga a definir'}</Text>
            <Press accessibilityRole="button" accessibilityLabel={`Ajustar carga de ${ex.nome}`} onPress={() => onEdit(ex)} quiet style={W.edit}><Icon name="pencil" size={15} color={C.blue} /><Text style={W.editText}>AJUSTAR</Text></Press>
          </View>

          <Text style={W.setsLabel}>TOQUE NA SÉRIE QUE VOCÊ FEZ  <Text style={{color: C.ink}}>{cur}/{total}</Text></Text>
          <View style={W.sets} onLayout={(e) => setSetsW(e.nativeEvent.layout.width)}>
            {Array.from({length: total}, (_, k) => (
              <SetButton key={k} n={k + 1} size={setSize} done={k < cur} next={k === cur} onPress={() => tap(ex, k + 1)}
                label={`${k + 1} ${k === 0 ? 'série feita' : 'séries feitas'} de ${ex.nome}`} />
            ))}
          </View>
          <View style={W.stepper}>
            <Text style={[T.body, {flex: 1}]}>Séries neste exercício</Text>
            <Pop accessibilityRole="button" accessibilityLabel={`Diminuir séries de ${ex.nome}`} onPress={() => adjust(ex, -1)} quiet radius={14} offset={3} innerStyle={W.stepBtn}><Icon name="remove" size={20} /></Pop>
            <Text style={W.stepNum}>{total}</Text>
            <Pop accessibilityRole="button" accessibilityLabel={`Aumentar séries de ${ex.nome}`} onPress={() => adjust(ex, 1)} quiet radius={14} offset={3} innerStyle={W.stepBtn}><Icon name="add" size={20} /></Pop>
          </View>
        </Animated.View>
      </ScrollView>
      <View style={[W.controls, {paddingBottom: insets.bottom + 12}]}>
        <Pop accessibilityRole="button" accessibilityLabel="Exercício anterior" disabled={i === 0} onPress={() => { setI(i - 1); setHelp(false); }} quiet radius={22} offset={4} color={C.card} innerStyle={W.nav}><Icon name="play-skip-back" size={24} color={i === 0 ? C.muted : C.ink} /></Pop>
        <Pop accessibilityRole="button" accessibilityLabel={label} onPress={() => { if (cur < total) tap(ex, cur + 1); else goNext(i); }} radius={22} offset={5} style={{flex: 1}} innerStyle={W.main}>
          <FitText style={W.mainText}>{label}</FitText><Icon name={cur < total ? 'checkmark' : 'arrow-forward'} size={22} color={C.ink} />
        </Pop>
        <Pop accessibilityRole="button" accessibilityLabel="Próximo exercício" disabled={i === list.length - 1} onPress={() => { setI(i + 1); setHelp(false); }} quiet radius={22} offset={4} color={C.card} innerStyle={W.nav}><Icon name="play-skip-forward" size={24} /></Pop>
      </View>
    </View>
  );
}

const W = StyleSheet.create({
  shell: {...StyleSheet.absoluteFillObject, top: 0, backgroundColor: C.paper, zIndex: 90},
  top: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, backgroundColor: C.navy},
  topBtn: {width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#4A5580', alignItems: 'center', justifyContent: 'center'},
  topLabel: {fontSize: 22, fontWeight: '900', letterSpacing: -0.4, color: C.white},
  segs: {flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingTop: 8},
  seg: {flex: 1, height: 8, borderRadius: 4, backgroundColor: '#DDD7CA', overflow: 'hidden'},
  segNow: {borderWidth: 2, borderColor: C.pink, backgroundColor: '#E6E1D7'},
  body: {padding: 18, paddingBottom: 24},
  figure: {height: 270, padding: 6},
  img: {width: '100%', height: '100%'},
  zoomBadge: {position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(20,27,52,.78)', alignItems: 'center', justifyContent: 'center'},
  chip: {alignSelf: 'center', marginTop: 12, paddingHorizontal: 16, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.card, ...INK},
  chipText: {fontSize: 11, fontWeight: '900', letterSpacing: 1, color: C.ink},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16},
  title: {fontSize: 30, fontWeight: '900', letterSpacing: 0.2, color: C.ink, lineHeight: 30, marginTop: 4},
  help: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  helpMark: {fontSize: 20, fontWeight: '900', color: C.ink},
  helpBox: {backgroundColor: C.white, borderRadius: R.md, padding: 14, marginTop: 10, fontSize: 14, lineHeight: 21, color: C.muted},
  target: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 14},
  targetText: {fontSize: 14, color: C.muted, fontWeight: '700'},
  targetBig: {fontSize: 20, fontWeight: '900', color: C.ink},
  edit: {flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto'},
  editText: {fontSize: 12, fontWeight: '900', color: C.blue, letterSpacing: 0.6},
  setsLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 1.3, color: C.muted, marginTop: 22, marginBottom: 12},
  sets: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  set: {alignItems: 'center', justifyContent: 'center'},
  setText: {fontSize: 28, fontWeight: '900', color: C.ink},
  stepper: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22},
  stepBtn: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.yellow},
  stepNum: {minWidth: 24, textAlign: 'center', fontSize: 18, fontWeight: '900', color: C.ink},
  controls: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, backgroundColor: C.paper, borderTopWidth: 1.5, borderTopColor: C.line},
  nav: {width: 50, height: 58, alignItems: 'center', justifyContent: 'center'},
  main: {height: 58, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12},
  mainText: {color: C.ink, fontSize: 18, fontWeight: '900', letterSpacing: 0.6, flexShrink: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  burst: {width: 110, height: 110, borderRadius: 55, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', ...INK},
  doneTitle: {fontSize: 42, fontWeight: '900', letterSpacing: -1.5, color: C.ink, textAlign: 'center', lineHeight: 44, marginTop: 24},
  lead: {fontSize: 15, lineHeight: 22, color: C.ink, textAlign: 'center', marginTop: 14},
  next: {flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch', backgroundColor: C.navy2, borderRadius: R.lg, padding: 14, marginBottom: 34},
  nextImgBox: {width: 76, height: 76, borderRadius: R.md, backgroundColor: C.card, padding: 4},
  nextImg: {width: '100%', height: '100%'},
  nextOver: {fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: C.yellow},
  nextName: {fontSize: 15, fontWeight: '900', color: C.white, marginTop: 4},
  nextMeta: {fontSize: 12, color: '#B7C1E3', marginTop: 3},
  clock: {fontSize: 58, fontWeight: '900', color: C.white, letterSpacing: -2},
  clockLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: '#B7C1E3', marginTop: 2},
  pill: {flex: 1, height: 54, borderRadius: R.pill, borderWidth: 2, borderColor: '#4A5580', alignItems: 'center', justifyContent: 'center'},
  pillText: {color: C.white, fontWeight: '900', fontSize: 14, letterSpacing: 0.8},
});
