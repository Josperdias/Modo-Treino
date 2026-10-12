import React from 'react';
import {Alert, Image, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {FadeIn, FadeInDown, LinearTransition} from 'react-native-reanimated';
import {EXERCISES, Exercise, imageInfo, personaShort, Treino, treinoTitle} from '../data';
import {useApp} from '../store';
import {Btn, Card, Float, Icon, Pattern, Pop, Press, Ring, Twinkle} from '../ui';
import {C, R, T, useNarrow} from '../theme';

const TONE: Record<Treino, string> = {A: C.pink, B: C.sky};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = () => capital(new Date().toLocaleDateString('pt-BR', {weekday: 'short', day: 'numeric', month: 'short'}).replace('.', ''));

type Props = {treino: Treino; onBack: () => void; onTreino: (t: Treino) => void; onStart: (t: Treino, index?: number) => void; onEdit: (e: Exercise) => void; onFinished: () => void};

export default function TrainScreen({treino, onBack, onTreino, onStart, onEdit, onFinished}: Props) {
  const app = useApp();
  const narrow = useNarrow();
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
      <Animated.View entering={FadeInDown.duration(380)}>
        <Card color={TONE[treino]} offset={6} style={{flexDirection: 'row', padding: 20}} pattern={<Pattern kind={treino === 'A' ? 'stripes' : 'dots'} opacity={0.09} size={treino === 'A' ? 14 : 18} />}>
          <Twinkle size={16} color={C.white} delay={300} style={{top: 14, right: 150}} />
          <View style={{flex: 1, zIndex: 2}}>
            <Text style={S.date}>{longDate().toUpperCase()}</Text>
            <Text style={[S.heroTitle, narrow && {fontSize: 29, lineHeight: 29}]} accessibilityRole="header" numberOfLines={1}>TREINO {treino}</Text>
            <Text style={S.heroSub}>{treinoTitle(treino)}</Text>
            <View style={S.ringRow}>
              <Ring size={narrow ? 52 : 64} stroke={8} progress={p.percent / 100} color={C.ink} track="rgba(20,27,52,.16)">
                <Text style={S.ringText}>{p.percent}%</Text>
              </Ring>
              <Text style={[S.ringCaption, narrow && {fontSize: 11}]}>{started ? `${p.sets} de ${p.total} séries hoje` : `${p.total} séries · ${list.length} exercícios`}</Text>
            </View>
            <Btn icon={all ? 'eye' : 'play'} small text={all ? 'REVER' : started ? 'CONTINUAR' : 'COMEÇAR'} label={all ? 'Rever o treino' : started ? 'Continuar o treino' : `Começar treino ${treino}`} onPress={() => onStart(treino)} style={{alignSelf: 'flex-start', marginTop: 16, minWidth: 150}} />
          </View>
          <Float amplitude={4} rotate={5} style={[S.heroArtBox, narrow && {width: 88, height: 128, marginLeft: 4}]}><Image source={art.image} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${personaShort(state.persona)}`} /></Float>
        </Card>
      </Animated.View>

      <View style={S.seg} accessibilityRole="tablist">
        {(['A', 'B'] as const).map((t) => {
          const on = t === treino;
          return (
            <Pop key={t} accessibilityRole="tab" accessibilityLabel={`Treino ${t}`} accessibilityState={{selected: on}} onPress={() => onTreino(t)} color={on ? C.ink : C.card} radius={R.lg} offset={on ? 2 : 4} style={{flex: 1}} innerStyle={S.segItem}>
              <Text style={[S.segText, on && {color: C.yellow}]}>TREINO {t}</Text>
              <Text style={[S.segSub, on && {color: '#C9D1EE'}]}>{t === 'A' ? '6 exercícios' : '8 exercícios'}</Text>
            </Pop>
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
          <Animated.View key={e.id} entering={FadeInDown.delay(60 + i * 45).duration(320)} layout={LinearTransition} style={{marginBottom: 6}}>
            <Pop accessibilityRole="button" accessibilityLabel={`Abrir ${e.nome}`} onPress={() => onStart(treino, i)} color={complete ? '#E3F8EC' : C.card} radius={R.lg} offset={4} quiet innerStyle={S.row}>
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
            </Pop>
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
  scroll: {padding: 20, paddingBottom: 170},
  back: {flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 14, marginBottom: 6},
  backText: {fontSize: 15, fontWeight: '900', letterSpacing: 1.2, color: C.ink},
  date: {fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(20,27,52,.6)'},
  heroTitle: {fontSize: 40, fontWeight: '900', letterSpacing: 0.2, color: C.ink, marginTop: 4, lineHeight: 40},
  heroSub: {fontSize: 14, color: 'rgba(20,27,52,.78)', fontWeight: '500', marginTop: 4},
  ringRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14},
  ringText: {fontSize: 17, fontWeight: '900', color: C.ink},
  ringCaption: {flex: 1, fontSize: 12, fontWeight: '700', color: 'rgba(20,27,52,.78)'},
  heroArtBox: {width: 118, height: 170, borderRadius: 14, backgroundColor: C.card, padding: 4, alignSelf: 'center', marginLeft: 8, borderWidth: 2, borderColor: C.ink},
  seg: {flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 18},
  segItem: {alignItems: 'center', paddingVertical: 10},
  segText: {fontSize: 20, fontWeight: '900', letterSpacing: 0.6, color: C.ink},
  segSub: {fontSize: 11, color: C.muted, marginTop: 1, fontWeight: '500'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10},
  thumb: {width: 92, height: 92, borderRadius: R.md, backgroundColor: '#F4F0E6', padding: 3, borderWidth: 2, borderColor: C.ink},
  rowName: {fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 2},
  badge: {minWidth: 46, height: 36, paddingHorizontal: 8, borderRadius: 18, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  badgeDone: {backgroundColor: C.mint},
  badgeText: {fontSize: 14, fontWeight: '900', color: C.ink},
  edit: {width: 34, height: 34, alignItems: 'center', justifyContent: 'center'},
  note: {fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 18},
});
