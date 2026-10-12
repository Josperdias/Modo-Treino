import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {FadeInDown, LinearTransition, ZoomIn} from 'react-native-reanimated';
import {annotateRecords, personalBests, streak as streakDays, totalVolume} from '../../logic';
import {todayKey, useApp} from '../store';
import {shareCsv} from '../backup';
import {Btn, Card, CountUp, Icon, Kicker, Pattern, Press} from '../ui';
import {C, INK, R, T} from '../theme';

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const fmtKg = (n: number) => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});

export default function ProgressScreen({onTrain}: {onTrain: () => void}) {
  const {state} = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const s = state.sessions;
  const records = annotateRecords(s);
  const bests = Object.entries(personalBests(s)).sort((a, b) => b[1].peso - a[1].peso);
  const volume = totalVolume(s);
  const stats: [number, string][] = [[s.length, 'Treinos'], [s.reduce((a, x) => a + x.sets, 0), 'Séries feitas'], [streakDays(s, todayKey()), 'Dias seguidos']];
  const trained = new Set(s.map((x) => x.date));
  const week = Array.from({length: 7}, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return {key: dayKey(d), letter: LETTERS[d.getDay()], today: k === 6}; });
  return (
    <ScrollView contentContainerStyle={P.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)}>
        <Kicker>Arquivo pessoal</Kicker>
        <Text style={[T.h1, {marginTop: 4}]}>Seu histórico.</Text>
        <View style={P.stats}>
          {stats.map(([n, label]) => (
            <View key={label} style={{flex: 1}}><Card offset={3} style={{paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center'}}><CountUp value={n} style={P.statBig} /><Text style={P.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text></Card></View>
          ))}
        </View>
        <Card color={C.sky} offset={4} outer={{marginTop: 18}} pattern={<Pattern kind="dots" opacity={0.1} size={14} />}>
          <Text style={P.weekTitle} accessibilityLabel="Últimos 7 dias">ÚLTIMOS 7 DIAS</Text>
          <View style={P.weekRow}>
            {week.map((d, i) => {
              const on = trained.has(d.key);
              return (
                <Animated.View key={d.key} entering={ZoomIn.delay(250 + i * 70).springify().damping(12)} style={{alignItems: 'center', gap: 6}}>
                  <View style={[P.dot, on && P.dotOn, d.today && P.dotToday]}>{on && <Icon name="checkmark" size={18} color={C.ink} />}</View>
                  <Text style={[P.dayLetter, d.today && {color: C.ink}]}>{d.letter}</Text>
                </Animated.View>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      {(bests.length > 0 || volume > 0) && (
        <Animated.View entering={FadeInDown.delay(80).duration(360)}>
          <Card color={C.ink} offset={5} shadowColor={C.yellow} outer={{marginTop: 20}} style={P.records}>
            <Pattern kind="grid" color="#FFFFFF" opacity={0.06} size={22} />
            <Kicker color="rgba(255,255,255,.6)">Seus números</Kicker>
            <Text style={P.recTitle}>Cargas e recordes</Text>
            {volume > 0 && <Text style={P.vol}>{fmtKg(volume)} kg <Text style={P.volSub}>de volume total</Text></Text>}
            {bests.map(([id, r]) => (
              <View key={id} style={P.recRow}><Text style={P.recName}>{r.nome}</Text><Text style={P.recKg}>{fmtKg(r.peso)} kg</Text></View>
            ))}
            <Text style={P.recNote}>Maior carga registrada por exercício. Volume = séries × repetições × carga, só das séries marcadas.</Text>
          </Card>
        </Animated.View>
      )}

      <Text style={[T.h2, {marginTop: 26, marginBottom: 12}]}>Histórico</Text>
      {s.length ? (
        <>
          {s.map((x, i) => ({x, i})).reverse().map(({x, i}) => {
            const isOpen = open === i;
            const items = x.items || [];
            return (
              <Animated.View key={`${x.date}-${x.treino}-${i}`} layout={LinearTransition.duration(220)} style={{marginBottom: 4}}>
                <Card offset={3} style={{padding: 0}}>
                <Press accessibilityRole="button" accessibilityState={{expanded: isOpen}} aria-expanded={isOpen}
                  accessibilityLabel={`Treino ${x.treino}, ${x.date.split('-').reverse().join('/')}, ${x.sets} séries. Toque para ${isOpen ? 'recolher' : 'ver o detalhe'}`}
                  onPress={() => setOpen(isOpen ? null : i)} style={P.itemHead} quiet scaleTo={0.99}>
                  <View style={[P.tag, {backgroundColor: x.treino === 'A' ? C.pink : C.sky}]}><Text style={P.tagText}>{x.treino}</Text></View>
                  <View style={{flex: 1}}>
                    <Text style={P.itemTitle}>Treino {x.treino}{records[i].length > 0 ? '  ★ RECORDE' : ''}</Text>
                    <Text style={T.small}>{x.date.split('-').reverse().join('/')} · {x.time} · {x.sets} séries{x.volume ? ` · ${fmtKg(x.volume)} kg` : ''}</Text>
                  </View>
                  <Text style={P.pct}>{x.percent}%</Text>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
                </Press>
                {isOpen && (
                  <View style={P.detail}>
                    {items.length ? items.map((it) => (
                      <View key={it.id} style={P.detailRow}>
                        <Text style={P.detailName}>{it.nome}{records[i].includes(it.id) ? '  ★' : ''}</Text>
                        <Text style={P.detailMeta}>{it.series} × {it.reps} · {it.peso ? `${fmtKg(it.peso)} kg` : 'sem carga'}</Text>
                      </View>
                    )) : <Text style={T.small}>Treino registrado sem detalhe por exercício.</Text>}
                  </View>
                )}
                </Card>
              </Animated.View>
            );
          })}
          <Btn kind="ghost" icon="download-outline" text="EXPORTAR PLANILHA (CSV)" onPress={() => { void shareCsv(state); }} style={{marginTop: 8}} />
        </>
      ) : (
        <View style={P.empty}>
          <Icon name="barbell" size={36} color={C.pink} />
          <Text style={[T.h3, {marginTop: 10}]}>O primeiro vem aí.</Text>
          <Text style={[T.body, {textAlign: 'center', marginTop: 4, marginBottom: 16}]}>Finalize um treino para começar o seu histórico.</Text>
          <Btn text="IR PARA O TREINO" icon="arrow-forward" onPress={onTrain} />
        </View>
      )}
    </ScrollView>
  );
}

const P = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  stats: {flexDirection: 'row', gap: 10, marginTop: 18},
  week: {backgroundColor: C.sky, borderRadius: R.lg, padding: 16, marginTop: 12, overflow: 'hidden', ...INK},
  weekTitle: {fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: C.ink},
  weekRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12},
  dot: {width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.75)', borderWidth: 2, borderColor: 'rgba(20,27,52,.35)', alignItems: 'center', justifyContent: 'center'},
  dotOn: {backgroundColor: C.yellow, borderColor: C.ink},
  dotToday: {borderColor: C.ink},
  dayLetter: {fontSize: 11, fontWeight: '900', color: 'rgba(20,27,52,.55)'},
  statX: {flex: 1, backgroundColor: C.card, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.line},
  statBig: {fontSize: 36, fontWeight: '900', color: C.ink, letterSpacing: -1},
  statLabel: {fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 2},
  records: {overflow: 'hidden'},
  recTitle: {fontSize: 22, fontWeight: '900', color: C.white, marginTop: 6},
  vol: {fontSize: 34, fontWeight: '900', color: C.yellow, marginTop: 10, letterSpacing: -1},
  volSub: {fontSize: 13, fontWeight: '600', color: '#B7C1E3', letterSpacing: 0},
  recRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,.18)'},
  recName: {flex: 1, color: C.white, fontWeight: '700', fontSize: 14},
  recKg: {color: C.yellow, fontWeight: '900', fontSize: 14},
  recNote: {fontSize: 11, lineHeight: 16, color: '#B7C1E3', marginTop: 12},
  item: {backgroundColor: C.card, borderRadius: R.lg, marginBottom: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.line},
  itemHead: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14},
  tag: {width: 42, height: 42, borderRadius: 14, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center'},
  tagText: {fontSize: 18, fontWeight: '900', color: C.ink},
  itemTitle: {fontSize: 15, fontWeight: '800', color: C.ink},
  pct: {fontSize: 16, fontWeight: '900', color: C.green},
  detail: {paddingHorizontal: 14, paddingBottom: 14},
  detailRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line},
  detailName: {flex: 1, fontSize: 13, fontWeight: '700', color: C.ink},
  detailMeta: {fontSize: 12, color: C.muted, fontWeight: '700'},
  empty: {alignItems: 'center', backgroundColor: C.card, borderRadius: R.lg, padding: 28, borderWidth: 1.5, borderColor: C.line},
});
