import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInDown, LinearTransition} from 'react-native-reanimated';
import {annotateRecords, personalBests, streak as streakDays, totalVolume} from '../../logic';
import {todayKey, useApp} from '../store';
import {exportCsv} from '../backup';
import {Btn, Card, Icon, Kicker, Press} from '../ui';
import {C, INK, R, T} from '../theme';

const fmtKg = (n: number) => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});

export default function ProgressScreen({onTrain}: {onTrain: () => void}) {
  const {state} = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const s = state.sessions;
  const records = annotateRecords(s);
  const bests = Object.entries(personalBests(s)).sort((a, b) => b[1].peso - a[1].peso);
  const volume = totalVolume(s);
  const stats: [string, number | string, string][] = [[String(s.length), '', 'Treinos'], [String(s.reduce((a, x) => a + x.sets, 0)), '', 'Séries feitas'], [String(streakDays(s, todayKey())), '', 'Dias seguidos']];
  return (
    <ScrollView contentContainerStyle={P.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)}>
        <Kicker>Arquivo pessoal</Kicker>
        <Text style={[T.h1, {marginTop: 4}]}>Seu histórico.</Text>
        <View style={P.stats}>
          {stats.map(([big, , label]) => (
            <View key={label} style={P.stat}><Text style={P.statBig}>{big}</Text><Text style={P.statLabel}>{label}</Text></View>
          ))}
        </View>
      </Animated.View>

      {(bests.length > 0 || volume > 0) && (
        <Animated.View entering={FadeInDown.delay(80).duration(360)}>
          <Card style={P.records}>
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
              <Animated.View key={`${x.date}-${x.treino}-${i}`} layout={LinearTransition.duration(220)} style={P.item}>
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
              </Animated.View>
            );
          })}
          <Btn kind="ghost" icon="download-outline" text="EXPORTAR PLANILHA (CSV)" onPress={() => { void exportCsv(state); }} style={{marginTop: 8}} />
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
  stat: {flex: 1, backgroundColor: C.card, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.line},
  statBig: {fontSize: 30, fontWeight: '900', color: C.ink, letterSpacing: -1},
  statLabel: {fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 2},
  records: {backgroundColor: C.ink, marginTop: 14, borderColor: C.ink},
  recTitle: {fontSize: 22, fontWeight: '900', color: C.white, marginTop: 6},
  vol: {fontSize: 34, fontWeight: '900', color: C.yellow, marginTop: 10, letterSpacing: -1},
  volSub: {fontSize: 13, fontWeight: '600', color: '#B7C1E3', letterSpacing: 0},
  recRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,.18)'},
  recName: {flex: 1, color: C.white, fontWeight: '700', fontSize: 14},
  recKg: {color: C.yellow, fontWeight: '900', fontSize: 14},
  recNote: {fontSize: 11, lineHeight: 16, color: '#B7C1E3', marginTop: 12},
  item: {backgroundColor: C.card, borderRadius: R.lg, marginBottom: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.line},
  itemHead: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14},
  tag: {width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  tagText: {fontSize: 18, fontWeight: '900', color: C.ink},
  itemTitle: {fontSize: 15, fontWeight: '800', color: C.ink},
  pct: {fontSize: 16, fontWeight: '900', color: C.green},
  detail: {paddingHorizontal: 14, paddingBottom: 14},
  detailRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line},
  detailName: {flex: 1, fontSize: 13, fontWeight: '700', color: C.ink},
  detailMeta: {fontSize: 12, color: C.muted, fontWeight: '700'},
  empty: {alignItems: 'center', backgroundColor: C.card, borderRadius: R.lg, padding: 28, borderWidth: 1.5, borderColor: C.line},
});
