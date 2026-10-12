/** Aba BUSCAR: uma caixa só para achar exercícios, fitas (músicas do celular), bags, rádios e treinos já feitos. */
import React, {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {formatClock, searchBags, searchExercises, searchSessions, searchTracks} from '../../logic';
import {EXERCISES, Exercise, flag, imageInfo} from '../data';
import {useApp} from '../store';
import {Card, Icon, IconName, Kicker, Pop, Press} from '../ui';
import {C, R, T} from '../theme';
import {MiniTape} from '../music/Cassette';
import {Track, useMusic} from '../music/MusicProvider';
import {loadStations, search as searchStations, searchOnline, Station, toTrack} from '../radio/api';

const RECENT = 'modo-treino-recent-searches';
const GROUPS = Array.from(new Set(EXERCISES.map((e) => e.grupo)));
const SHORTCUTS = [...GROUPS, 'Treino A', 'Treino B'];
const fmtKg = (n: number) => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});
const dm = (date: string) => { const [, m, d] = date.split('-'); return `${d}/${m}`; };

type Props = {
  onStartExercise: (e: Exercise) => void;
  onEditExercise: (e: Exercise) => void;
  onGoBags: () => void;
  onGoHistory: () => void;
};

function Head({icon, title, count, color = C.pink}: {icon: IconName; title: string; count: number; color?: string}) {
  return (
    <View style={S.head}>
      <Icon name={icon} size={17} color={color} />
      <Text style={S.headText}>{title}</Text>
      <View style={S.count}><Text style={S.countText}>{count}</Text></View>
    </View>
  );
}

function Row({children, onPress, label, tint}: {children: React.ReactNode; onPress: () => void; label: string; tint?: string}) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} scaleTo={0.985} style={[S.row, tint ? {backgroundColor: tint} : null]}>
      {children}
    </Press>
  );
}

export default function SearchScreen({onStartExercise, onEditExercise, onGoBags, onGoHistory}: Props) {
  const {state, conf, total} = useApp();
  const m = useMusic();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [moreTracks, setMoreTracks] = useState(false);
  const [online, setOnline] = useState<Station[]>([]);
  const [cache, setCache] = useState<Station[]>([]);
  const [searching, setSearching] = useState(false);
  const query = q.trim();

  useEffect(() => { AsyncStorage.getItem(RECENT).then((v) => { if (v) { try { setRecent(JSON.parse(v)); } catch { /* lista ilegível */ } } }).catch(() => {}); }, []);
  useEffect(() => { loadStations().then((r) => setCache(r.stations)).catch(() => {}); }, []);
  const remember = () => {
    if (query.length < 2) return;
    const next = [query, ...recent.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 6);
    setRecent(next);
    AsyncStorage.setItem(RECENT, JSON.stringify(next)).catch(() => {});
  };
  const forget = () => { setRecent([]); AsyncStorage.removeItem(RECENT).catch(() => {}); };

  // rádios: primeiro as do cache local (instantâneo e offline), depois as do diretório online
  useEffect(() => {
    setOnline([]);
    if (query.length < 3) { setSearching(false); return; }
    setSearching(true);
    let alive = true;
    const t = setTimeout(() => { searchOnline(query).then((r) => { if (alive) { setOnline(r); setSearching(false); } }); }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const exercises = useMemo(() => (query ? searchExercises(EXERCISES, query) : []), [query]);
  const tracks = useMemo(() => (query ? searchTracks(m.library, query) : []), [query, m.library]);
  const bags = useMemo(() => (query ? searchBags(m.lib.tapes, query) : []), [query, m.lib.tapes]);
  const sessions = useMemo(() => (query ? searchSessions(state.sessions, query) : []), [query, state.sessions]);
  const radios = useMemo(() => {
    if (!query) return [];
    const seen = new Set<string>();
    return [...searchStations(cache, query, null, 12), ...online].filter((s) => (seen.has(s.i) ? false : (seen.add(s.i), true))).slice(0, 15);
  }, [query, cache, online]);

  const none = !!query && !exercises.length && !tracks.length && !bags.length && !sessions.length && !radios.length;
  const shownTracks = moreTracks ? tracks.slice(0, 60) : tracks.slice(0, 6);

  return (
    <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)}>
        <Kicker>Achar tudo em um lugar</Kicker>
        <Text style={[T.h1, {marginTop: 4, marginBottom: 14, fontSize: 40, lineHeight: 38}]} accessibilityRole="header">Buscar.</Text>
      </Animated.View>

      <View style={S.box}>
        <Icon name="search" size={20} color={C.muted} />
        <TextInput value={q} onChangeText={(v) => { setQ(v); setMoreTracks(false); }} placeholder="Exercício, fita, bag, rádio, treino…" placeholderTextColor={C.muted}
          accessibilityLabel="Campo de busca" style={S.input} autoCorrect={false} returnKeyType="search" onSubmitEditing={remember} />
        {q.length > 0 && <Press accessibilityRole="button" accessibilityLabel="Limpar a busca" onPress={() => setQ('')} quiet style={S.clear}><Icon name="close" size={18} /></Press>}
      </View>

      {!query && (
        <Animated.View entering={FadeIn.duration(260)}>
          <Text style={S.sub}>ATALHOS</Text>
          <View style={S.chips}>
            {SHORTCUTS.map((g) => (
              <Pop key={g} accessibilityRole="button" accessibilityLabel={`Buscar ${g}`} onPress={() => setQ(g)} offset={3} quiet innerStyle={S.chip}><Text style={S.chipText}>{g}</Text></Pop>
            ))}
          </View>
          {recent.length > 0 && (
            <>
              <View style={S.recentHead}><Text style={S.sub}>BUSCAS RECENTES</Text><Press accessibilityRole="button" accessibilityLabel="Limpar buscas recentes" onPress={forget} quiet><Text style={S.link}>LIMPAR</Text></Press></View>
              <View style={S.chips}>
                {recent.map((r) => (
                  <Pop key={r} accessibilityRole="button" accessibilityLabel={`Buscar de novo ${r}`} onPress={() => setQ(r)} offset={3} quiet color={C.soft} innerStyle={S.chip}><Icon name="time-outline" size={15} color={C.muted} /><Text style={S.chipText}>{r}</Text></Pop>
                ))}
              </View>
            </>
          )}
          <Card color={C.sky} offset={4} style={{padding: 16, marginTop: 22}}>
            <Text style={T.h3}>O que dá para achar</Text>
            <Text style={[T.body, {marginTop: 4, color: C.ink}]}>
              {EXERCISES.length} exercícios dos treinos A e B · {m.library.length} fitas no celular · {m.lib.tapes.length} bags · rádios do mundo · {state.sessions.length} treinos feitos. Sem acento e sem se preocupar com maiúsculas.
            </Text>
          </Card>
        </Animated.View>
      )}

      {none && (
        <Animated.View entering={FadeIn}>
          <Card color={C.card} offset={3} style={{alignItems: 'center', padding: 22, marginTop: 8}}>
            <Icon name="sad-outline" size={32} color={C.pink} />
            <Text style={[T.h3, {marginTop: 8, textAlign: 'center'}]}>Nada com “{query}”</Text>
            <Text style={[T.body, {textAlign: 'center', marginTop: 4}]}>{searching ? 'Procurando rádios…' : 'Tente outro nome, um grupo muscular (bíceps, costas, ombro) ou o nome da música.'}</Text>
          </Card>
        </Animated.View>
      )}

      {exercises.length > 0 && (
        <View>
          <Head icon="barbell" title="EXERCÍCIOS" count={exercises.length} />
          {exercises.map((e) => {
            const c = conf(e);
            const info = imageInfo(e, state.persona);
            return (
              <Row key={e.id} label={`Fazer ${e.nome} agora`} onPress={() => { remember(); onStartExercise(e); }}>
                <View style={S.thumb}><Image source={info.image} resizeMode="contain" style={S.thumbImg} accessibilityLabel={`Ilustração de ${e.nome}`} /></View>
                <View style={{flex: 1}}>
                  <Text numberOfLines={2} style={S.name}>{e.nome}</Text>
                  <Text numberOfLines={1} style={T.small}>{e.codigo} · {e.grupo} · {total(e)}×{c.reps}{c.peso ? ` · ${c.peso} kg` : ''}</Text>
                </View>
                <Press accessibilityRole="button" accessibilityLabel={`Ver e ajustar ${e.nome}`} onPress={() => onEditExercise(e)} hitSlop={6} style={S.iconBtn}><Icon name="create-outline" size={19} /></Press>
                <View style={[S.iconBtn, {backgroundColor: C.yellow}]}><Icon name="play" size={18} /></View>
              </Row>
            );
          })}
        </View>
      )}

      {tracks.length > 0 && (
        <View>
          <Head icon="albums" title="FITAS" count={tracks.length} />
          {shownTracks.map((t: Track) => (
            <Row key={t.id} label={`Tocar ${t.title}`} onPress={() => { remember(); void m.playFita(t, tracks); }} tint={m.now?.id === t.id ? '#FFF1BF' : undefined}>
              <MiniTape id={t.id} size={64} />
              <View style={{flex: 1}}>
                <Text numberOfLines={2} style={S.name}>{t.title}</Text>
                <Text numberOfLines={1} style={T.small}>{t.artist || (t.duration ? formatClock(t.duration) : 'No celular')}</Text>
              </View>
              <View style={[S.iconBtn, {backgroundColor: C.yellow}]}><Icon name={m.now?.id === t.id && m.playing ? 'pause' : 'play'} size={18} /></View>
            </Row>
          ))}
          {!moreTracks && tracks.length > 6 && (
            <Press accessibilityRole="button" accessibilityLabel={`Mostrar mais ${tracks.length - 6} fitas`} onPress={() => setMoreTracks(true)} quiet style={S.more}><Text style={S.link}>MOSTRAR MAIS {Math.min(54, tracks.length - 6)}</Text></Press>
          )}
        </View>
      )}

      {bags.length > 0 && (
        <View>
          <Head icon="bag-handle" title="BAGS" count={bags.length} />
          {bags.map((b) => (
            <Row key={b.id} label={`Abrir a bag ${b.name}`} onPress={() => { remember(); m.selectTape(b.id); onGoBags(); }}>
              <View style={[S.thumb, {backgroundColor: C.rose}]}><Icon name="bag-handle" size={26} /></View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={S.name}>{b.name}</Text>
                <Text numberOfLines={1} style={T.small}>{b.ids.length} {b.ids.length === 1 ? 'item' : 'itens'}</Text>
              </View>
              <Press accessibilityRole="button" accessibilityLabel={`Tocar a bag ${b.name}`} onPress={() => { remember(); m.playTape(false, b.id); }} hitSlop={6} style={[S.iconBtn, {backgroundColor: C.yellow}]}><Icon name="play" size={18} /></Press>
            </Row>
          ))}
        </View>
      )}

      {(radios.length > 0 || (searching && !!query && query.length >= 3)) && (
        <View>
          <Head icon="earth" title="RÁDIOS" count={radios.length} color={C.blue} />
          {radios.map((s) => {
            const tr = toTrack(s);
            const on = m.now?.id === tr.id;
            return (
              <Row key={s.i} label={`Ouvir a rádio ${s.n}`} onPress={() => { remember(); void m.playRadio(tr); }} tint={on ? '#FFF1BF' : undefined}>
                <View style={[S.thumb, {backgroundColor: '#17104A'}]}><Text style={{fontSize: 24}}>{flag(s.cc)}</Text></View>
                <View style={{flex: 1}}>
                  <Text numberOfLines={1} style={S.name}>{s.n}</Text>
                  <Text numberOfLines={1} style={T.small}>{s.co || 'Rádio'}{s.tg ? ` · ${s.tg.split(',')[0]}` : ''} · ao vivo</Text>
                </View>
                <View style={[S.iconBtn, {backgroundColor: C.yellow}]}><Icon name={on && m.playing ? 'pause' : 'play'} size={18} /></View>
              </Row>
            );
          })}
          {searching && <Text style={[T.small, {textAlign: 'center', marginTop: 4}]}>Procurando no diretório de rádios…</Text>}
        </View>
      )}

      {sessions.length > 0 && (
        <View>
          <Head icon="calendar" title="TREINOS FEITOS" count={sessions.length} color={C.green} />
          {sessions.slice(0, 8).map((x) => (
            <Row key={`${x.date}-${x.treino}`} label={`Ver o treino ${x.treino} de ${dm(x.date)} no progresso`} onPress={() => { remember(); onGoHistory(); }}>
              <View style={[S.thumb, {backgroundColor: C.mint}]}><Text style={S.date}>{dm(x.date)}</Text></View>
              <View style={{flex: 1}}>
                <Text numberOfLines={1} style={S.name}>Treino {x.treino} · {x.sets} séries{x.volume ? ` · ${fmtKg(x.volume)} kg` : ''}</Text>
                <Text numberOfLines={1} style={T.small}>{(x.items || []).map((i) => i.nome).join(', ') || 'Sem detalhes'}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={C.muted} />
            </Row>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  box: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: R.pill, paddingLeft: 16, paddingRight: 6, height: 54, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4},
  input: {flex: 1, fontSize: 16, color: C.ink},
  clear: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  sub: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: C.muted, marginTop: 20, marginBottom: 10},
  recentHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  link: {fontSize: 12, fontWeight: '900', letterSpacing: 0.8, color: C.blue},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center'},
  chipText: {fontSize: 15, fontWeight: '900', color: C.ink},
  head: {flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 24, marginBottom: 10},
  headText: {fontSize: 12, fontWeight: '900', letterSpacing: 1.6, color: C.ink},
  count: {minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: C.yellow, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center'},
  countText: {fontSize: 12, fontWeight: '900', color: C.ink},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 8, backgroundColor: C.card, borderRadius: R.md, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4},
  thumb: {width: 58, height: 58, borderRadius: 14, backgroundColor: '#B4CDF6', borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2},
  thumbImg: {width: '100%', height: '100%'},
  name: {fontSize: 15, fontWeight: '800', color: C.ink},
  iconBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center'},
  more: {alignSelf: 'center', padding: 10},
  date: {fontSize: 16, fontWeight: '900', color: C.ink},
});
