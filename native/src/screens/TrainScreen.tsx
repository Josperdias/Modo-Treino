import React from 'react';
import {Alert, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeIn, FadeInDown, LinearTransition} from 'react-native-reanimated';
import {EXERCISES, Exercise, imageInfo, personaShort, Treino, treinoTitle} from '../data';
import {useApp} from '../store';
import {Btn, Float, Icon, Pattern, Press, Ring} from '../ui';
import {C, INK, R, T} from '../theme';

const TONE: Record<Treino, string> = {A: C.pink, B: C.sky};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = () => capital(new Date().toLocaleDateString('pt-BR', {weekday: 'short', day: 'numeric', month: 'short'}).replace('.', ''));

type Props = {treino: Treino; onBack: () => void; onTreino: (t: Treino) => void; onStart: (t: Treino, index?: number) => void; onEdit: (e: Exercise) => void; onFinished: () => void};

export default function TrainScreen({treino, onBack, onTreino, onStart, onEdit, onFinished}: Props) {
  const app = useApp();
  const {state} = app;
  const p = app.progress(treino);
  const list = EXERCISES.filter((x) => x.treino === treino);
  const started = p.sets > 0;
  const all = p.total > 0 && p.sets >= p.total;
  const art = imageInfo(list[Math.min(list.length - 1, Math.max(0, p.firstIncomplete))], state.persona);

  const finishNow = () => {
    const r = app.finishWorkout(treino);
    if (r.ok) onFinished();
    else Alert.alert(r.reason === 'already' ? 'Já concluído' : 'Marque uma série', r.reason === 'already' ? 'Você já finalizou esse treino hoje.' : 'Registre pelo menos uma série para concluir o treino.');
  };

  return (
    <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
      <Press accessibilityRole="button" accessibilityLabel="Voltar ao início" onPress={onBack} style={S.back} quiet><Icon name="arrow-back" size={18} /><Text style={S.backText}>INÍCIO</Text></Press>
      <Animated.View entering={FadeInDown.duration(380)} style={[S.hero, {backgroundColor: TONE[treino]}]}>
        <Pattern kind={treino === 'A' ? 'stripes' : 'dots'} opacity={0.09} size={treino === 'A' ? 14 : 18} />
        <View style={{flex: 1, zIndex: 2}}>
          <Text style={S.date}>{longDate().toUpperCase()}</Text>
          <Text style={S.heroTitle} accessibilityRole="header">TREINO {treino}</Text>
          <Text style={S.heroSub}>{treinoTitle(treino)}</Text>
          <View style={S.ringRow}>
            <Ring size={64} stroke={7} progress={p.percent / 100} color={C.ink} track="rgba(20,27,52,.16)">
              <Text style={S.ringText}>{p.percent}%</Text>
            </Ring>
            <Text style={S.ringCaption}>{started ? `${p.sets} de ${p.total} séries hoje` : `${p.total} séries · ${list.length} exercícios`}</Text>
          </View>
          <Btn icon={all ? 'eye' : 'play'} small text={all ? 'REVER' : started ? 'CONTINUAR' : 'COMEÇAR'} label={all ? 'Rever o treino' : started ? 'Continuar o treino' : `Começar treino ${treino}`} onPress={() => onStart(treino)} style={{alignSelf: 'flex-start', marginTop: 16}} />
        </View>
        <Float amplitude={4} rotate={5} style={S.heroArtBox}><Image source={art.image} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${personaShort(state.persona)}`} /></Float>
      </Animated.View>

      <View style={S.seg} accessibilityRole="tablist">
        {(['A', 'B'] as const).map((t) => {
          const on = t === treino;
          return (
            <Press key={t} accessibilityRole="tab" accessibilityLabel={`Treino ${t}`} accessibilityState={{selected: on}} onPress={() => onTreino(t)} style={[S.segItem, on && S.segOn]} scaleTo={0.97}>
              <Text style={[S.segText, on && {color: C.white}]}>TREINO {t}</Text>
              <Text style={[S.segSub, on && {color: '#C9D1EE'}]}>{t === 'A' ? '6 exercícios' : '8 exercícios'}</Text>
            </Press>
          );
        })}
      </View>

      {list.map((e, i) => {
        const c = app.conf(e);
        const tot = app.total(e);
        const done = app.done(e).slice(0, tot).filter(Boolean).length;
        const info = imageInfo(e, state.persona);
        const complete = done >= tot;
        return (
          <Animated.View key={e.id} entering={FadeInDown.delay(60 + i * 45).duration(320)} layout={LinearTransition}>
            <Press accessibilityRole="button" accessibilityLabel={`Abrir ${e.nome}`} onPress={() => onStart(treino, i)} scaleTo={0.985} quiet style={S.row}>
              <View style={S.thumb}><Image source={info.image} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${e.nome}`} /></View>
              <View style={{flex: 1}}>
                <Text style={S.rowName} numberOfLines={2}>{e.nome}</Text>
                <Text style={T.small}>{tot} × {c.reps} · {c.peso ? `${c.peso} kg` : 'carga a definir'}</Text>
                {info.status !== 'ok' && <Text style={[T.small, {color: '#A94865', marginTop: 2}]} numberOfLines={1}>{info.status === 'missing' ? 'Sem demonstração' : 'Arte do Josperd'}</Text>}
              </View>
              <View style={[S.badge, complete && S.badgeDone]} accessibilityLabel={`${done} de ${tot} séries`}>
                {complete ? <Icon name="checkmark" size={18} color={C.green} /> : <Text style={S.badgeText}>{done}/{tot}</Text>}
              </View>
              <Press accessibilityRole="button" accessibilityLabel={`Editar ${e.nome}`} onPress={() => onEdit(e)} style={S.edit} quiet><Icon name="pencil" size={16} color={C.muted} /></Press>
            </Press>
          </Animated.View>
        );
      })}

      {started && (
        <Animated.View entering={FadeIn} style={{marginTop: 14, gap: 10}}>
          <Btn kind="primary" icon="checkmark-done" text={`FINALIZAR TREINO ${treino}`} onPress={finishNow} />
        </Animated.View>
      )}
      <Text style={S.note}>As séries do Treino B são provisórias e editáveis. Ilustrações não substituem supervisão profissional.</Text>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 150},
  back: {flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 14, marginBottom: 6},
  backText: {fontSize: 12, fontWeight: '900', letterSpacing: 1.4, color: C.ink},
  hero: {borderRadius: R.xl, padding: 20, flexDirection: 'row', overflow: 'hidden', ...INK},
  date: {fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: 'rgba(20,27,52,.6)'},
  heroTitle: {fontSize: 36, fontWeight: '900', letterSpacing: -1.4, color: C.ink, marginTop: 6},
  heroSub: {fontSize: 14, color: 'rgba(20,27,52,.75)', fontWeight: '600', marginTop: 2},
  ringRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16},
  ringText: {fontSize: 15, fontWeight: '900', color: C.ink},
  ringCaption: {flex: 1, fontSize: 12, fontWeight: '700', color: 'rgba(20,27,52,.75)'},
  heroArtBox: {width: 124, height: 176, borderRadius: 14, backgroundColor: C.card, padding: 4, alignSelf: 'center', marginLeft: 8, ...INK},
  seg: {flexDirection: 'row', backgroundColor: C.soft, borderRadius: R.pill, padding: 5, marginTop: 20, marginBottom: 16, borderWidth: 1.5, borderColor: C.line},
  segItem: {flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.pill},
  segOn: {backgroundColor: C.ink},
  segText: {fontSize: 13, fontWeight: '900', letterSpacing: 0.8, color: C.ink},
  segSub: {fontSize: 11, color: C.muted, marginTop: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.lg, padding: 10, marginBottom: 10, borderWidth: 1.5, borderColor: C.line},
  thumb: {width: 72, height: 72, borderRadius: R.md, backgroundColor: '#F4F0E6', padding: 3},
  rowName: {fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 2},
  badge: {minWidth: 46, height: 36, paddingHorizontal: 8, borderRadius: 18, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  badgeDone: {backgroundColor: C.mint},
  badgeText: {fontSize: 12, fontWeight: '900', color: C.ink},
  edit: {width: 34, height: 34, alignItems: 'center', justifyContent: 'center'},
  note: {fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 18},
});
