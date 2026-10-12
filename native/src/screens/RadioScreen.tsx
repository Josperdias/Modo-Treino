/** Rádio do mundo: um globo 3D com milhares de estações. Gire, dê zoom, toque num ponto (ou num país) e ouça. */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown, FadeOutDown} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {flag} from '../data';
import {Btn, Icon, Pop, Press, Pulse, Sheet, useToast} from '../ui';
import {C, R, T} from '../theme';
import GlobeView, {GlobeEvent, GlobeHandle} from '../radio/GlobeView';
import {countClick, GENRES, loadStations, search, Station, toTrack} from '../radio/api';
import {useMusic} from '../music/MusicProvider';

export default function RadioScreen() {
  const m = useMusic();
  const toast = useToast();
  const globe = useRef<GlobeHandle>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Station | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [country, setCountry] = useState<{iso2: string; name: string} | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(stations.map((s) => [s.i, s])), [stations]);
  const playingId = m.now?.source === 'radio' ? m.now.id.slice(6) : null;
  const playing = playingId ? byId.get(playingId) || null : null;

  const load = useCallback((force = false) => {
    setState('loading');
    loadStations(force).then((r) => { setStations(r.stations); setState('ready'); }).catch(() => setState('error'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = useCallback(() => {
    if (!ready || !stations.length) return;
    globe.current?.post({cmd: 'setStations', data: stations.map((s) => ({i: s.i, n: s.n, lat: s.lat, lng: s.lng, cc: s.cc, c: s.c}))});
  }, [ready, stations]);
  useEffect(send, [send]);
  useEffect(() => { if (ready) globe.current?.post({cmd: 'playing', id: playingId}); }, [ready, playingId]);
  useEffect(() => { if (ready) globe.current?.post({cmd: 'selected', id: selected?.i ?? null}); }, [ready, selected]);

  const focus = (s: Station, altitude = 0.9) => globe.current?.post({cmd: 'focus', lat: s.lat, lng: s.lng, altitude, ms: 1100});
  const pick = (s: Station, move = true) => { setSelected(s); if (move) focus(s); };
  const play = (s: Station) => { pick(s, false); countClick(s.i); void m.playRadio(toTrack(s)); };

  const onEvent = useCallback((e: GlobeEvent) => {
    if (e.type === 'ready') setReady(true);
    else if (e.type === 'station') { const s = byId.get(e.id); if (s) setSelected(s); }
    else if (e.type === 'country') { setSelected(null); setCountry({iso2: e.iso2, name: e.name}); globe.current?.post({cmd: 'country', iso2: e.iso2}); }
  }, [byId]);

  const results = useMemo(() => (query.trim() || tag ? search(stations, query, tag, 30) : []), [stations, query, tag]);
  const countryList = useMemo(() => (country ? stations.filter((s) => s.cc === country.iso2).slice(0, 80) : []), [stations, country]);

  const surprise = () => {
    if (!stations.length) return;
    const pool = tag ? search(stations, query, tag, 400) : stations.slice(0, 1500);
    const s = pool[Math.floor(Math.random() * pool.length)];
    if (s) { pick(s); }
  };

  const showCard = selected || playing;
  const card = selected || playing;
  const isPlayingCard = !!card && playingId === card.i && m.playing;

  return (
    <View style={S.root}>
      <LinearGradient colors={['#080C24', '#141C42', '#1B2547']} style={StyleSheet.absoluteFill} />
      <View style={S.globe}><GlobeView ref={globe} onEvent={onEvent} /></View>

      <View style={S.top} pointerEvents="box-none">
        <View style={S.titleRow}>
          <Text style={S.title}>RÁDIO DO MUNDO</Text>
          <View style={S.count}><Text style={S.countText}>{state === 'ready' ? `${stations.length.toLocaleString('pt-BR')} estações` : state === 'loading' ? 'carregando…' : 'sem rede'}</Text></View>
        </View>
        <View style={S.search}>
          <Icon name="search" size={18} color="#B7C1E3" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar rádio, país ou estilo" placeholderTextColor="#8E99BF" accessibilityLabel="Buscar rádio" style={S.input} autoCorrect={false} />
          {(query || tag) ? <Press accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => { setQuery(''); setTag(null); }} quiet><Icon name="close-circle" size={20} color="#B7C1E3" /></Press> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingRight: 20}} style={{marginTop: 10}}>
          {GENRES.map((g) => (
            <Press key={g} accessibilityRole="button" accessibilityLabel={`Estilo ${g}`} accessibilityState={{selected: tag === g}} onPress={() => setTag(tag === g ? null : g)} style={[S.chip, tag === g && S.chipOn]} quiet>
              <Text style={[S.chipText, tag === g && {color: C.ink}]}>{g.toUpperCase()}</Text>
            </Press>
          ))}
        </ScrollView>
      </View>

      {state === 'loading' && <View style={S.center} pointerEvents="none"><ActivityIndicator color={C.yellow} size="large" /><Text style={S.hint}>Buscando rádios do mundo…</Text></View>}
      {state === 'error' && (
        <View style={S.center}>
          <Icon name="cloud-offline-outline" size={40} color={C.yellow} />
          <Text style={[S.hint, {marginBottom: 14}]}>Não deu para falar com o diretório de rádios.{'\n'}Confira a internet.</Text>
          <View style={{width: 200}}><Btn small icon="refresh" text="TENTAR DE NOVO" onPress={() => load(true)} /></View>
        </View>
      )}

      {results.length > 0 && (
        <Animated.View entering={FadeIn.duration(160)} style={S.results}>
          <FlatList data={results} keyExtractor={(s) => s.i} keyboardShouldPersistTaps="handled" renderItem={({item}) => (
            <Press accessibilityRole="button" accessibilityLabel={`Rádio ${item.n}, ${item.co}`} onPress={() => { pick(item); setQuery(''); setTag(null); }} quiet style={S.resRow}>
              <Text style={S.flag}>{flag(item.cc)}</Text>
              <View style={{flex: 1}}><Text style={S.resName} numberOfLines={1}>{item.n}</Text><Text style={S.resSub} numberOfLines={1}>{[item.st, item.co].filter(Boolean).join(', ')}{item.tg ? ` · ${item.tg.split(',')[0]}` : ''}</Text></View>
              <Icon name="play-circle" size={26} color={C.yellow} />
            </Press>
          )} />
        </Animated.View>
      )}

      <View style={S.bottom} pointerEvents="box-none">
        <View style={S.fabRow} pointerEvents="box-none">
          <Pulse scale={1.05} duration={1400}>
            <Pop accessibilityRole="button" accessibilityLabel="Surpreenda-me com uma rádio aleatória" onPress={surprise} color={C.pink} offset={4} innerStyle={S.fab}>
              <Icon name="dice" size={20} /><Text style={S.fabText}>SURPREENDA-ME</Text>
            </Pop>
          </Pulse>
        </View>
        {showCard && card && (
          <Animated.View key={card.i} entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(160)}>
            <Pop accessibilityRole="button" accessibilityLabel={`Rádio ${card.n}`} onPress={() => focus(card)} color={C.card} radius={R.lg} offset={5} quiet innerStyle={S.card}>
              <View style={S.cardTop}>
                <View style={S.flagBox}><Text style={{fontSize: 28}}>{flag(card.cc)}</Text></View>
                <View style={{flex: 1}}>
                  <Text style={S.cardName} numberOfLines={1}>{card.n}</Text>
                  <Text style={T.small} numberOfLines={1}>{[card.st, card.co].filter(Boolean).join(', ') || 'Rádio'}{card.br ? ` · ${card.br} kbps` : ''}</Text>
                  {card.tg ? <View style={S.tags}>{card.tg.split(',').slice(0, 3).map((g) => <View key={g} style={S.tag}><Text style={S.tagText}>{g}</Text></View>)}</View> : null}
                </View>
              </View>
              <View style={S.cardBtns}>
                <Pop accessibilityRole="button" accessibilityLabel={isPlayingCard ? 'Pausar rádio' : 'Ouvir rádio'} onPress={() => (playingId === card.i ? m.playPause() : play(card))} color={C.yellow} offset={3} style={{flex: 1}} innerStyle={S.cardBtn}>
                  <Icon name={isPlayingCard ? 'pause' : 'play'} size={20} /><Text style={S.cardBtnText}>{isPlayingCard ? 'PAUSAR' : 'OUVIR'}</Text>
                </Pop>
                <Pop accessibilityRole="button" accessibilityLabel="Guardar rádio numa bag" onPress={() => setSaving(true)} color={C.sky} offset={3} style={{flex: 1}} innerStyle={S.cardBtn}>
                  <Icon name="bag-add" size={20} /><Text style={S.cardBtnText}>NA BAG</Text>
                </Pop>
                <Pop accessibilityRole="button" accessibilityLabel={`Mais rádios de ${card.co}`} onPress={() => setCountry({iso2: card.cc, name: card.co})} color={C.card} offset={3} innerStyle={[S.cardBtn, {paddingHorizontal: 12}]}>
                  <Icon name="list" size={20} />
                </Pop>
              </View>
            </Pop>
          </Animated.View>
        )}
      </View>

      <Sheet visible={!!country} onClose={() => { setCountry(null); globe.current?.post({cmd: 'country', iso2: null}); }} title={country ? `${flag(country.iso2)} ${country.name || country.iso2}` : ''} tall>
        {countryList.length === 0 ? <Text style={[T.body, {padding: 16}]}>Ainda não há rádios com localização neste país.</Text> : (
          <FlatList data={countryList} keyExtractor={(s) => s.i} contentContainerStyle={{paddingBottom: 30}} renderItem={({item}) => (
            <Press accessibilityRole="button" accessibilityLabel={`Ouvir ${item.n}`} onPress={() => { setCountry(null); play(item); focus(item); }} quiet style={S.listRow}>
              <View style={{flex: 1}}><Text style={S.listName} numberOfLines={1}>{item.n}</Text><Text style={T.small} numberOfLines={1}>{[item.st, item.tg.split(',')[0]].filter(Boolean).join(' · ') || 'Rádio'}</Text></View>
              <Icon name="play-circle" size={28} color={C.ink} />
            </Press>
          )} />
        )}
      </Sheet>

      <Sheet visible={saving} onClose={() => setSaving(false)} title="Guardar em qual bag?">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingVertical: 8, paddingRight: 12}}>
          {m.lib.tapes.map((t, i) => (
            <Pop key={t.id} accessibilityRole="button" accessibilityLabel={`Guardar na bag ${t.name}`} onPress={() => { if (card) { m.selectTape(t.id); m.addToTape([toTrack(card)]); toast.show(`“${card.n}” na bag ${t.name}`); } setSaving(false); }} color={C.yellow} radius={R.md} offset={4} innerStyle={{paddingHorizontal: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={S.bagName} numberOfLines={1}>{t.name}</Text>
              <Text style={T.small}>{t.ids.length} itens</Text>
            </Pop>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const S = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#101733', overflow: 'hidden'},
  globe: {...StyleSheet.absoluteFillObject},
  top: {paddingHorizontal: 16, paddingTop: 10},
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 32, fontWeight: '900', color: C.white, letterSpacing: 0.5},
  count: {backgroundColor: 'rgba(255,255,255,.12)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 5},
  countText: {fontSize: 12, fontWeight: '700', color: '#DDE4FF'},
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: R.pill, paddingHorizontal: 16, height: 48, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.22)'},
  input: {flex: 1, color: C.white, fontSize: 15},
  chip: {paddingHorizontal: 14, height: 34, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.2)'},
  chipOn: {backgroundColor: C.yellow, borderColor: C.yellow},
  chipText: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: '#DDE4FF'},
  center: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', top: 120},
  hint: {color: '#DDE4FF', marginTop: 12, textAlign: 'center', fontSize: 14},
  results: {position: 'absolute', left: 16, right: 16, top: 170, maxHeight: 360, backgroundColor: 'rgba(14,20,50,.96)', borderRadius: R.lg, borderWidth: 2, borderColor: C.ink, overflow: 'hidden'},
  resRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,.14)'},
  flag: {fontSize: 24},
  resName: {color: C.white, fontSize: 15, fontWeight: '700'},
  resSub: {color: '#AEB9E0', fontSize: 12},
  bottom: {position: 'absolute', left: 14, right: 14, bottom: 12, gap: 10},
  fabRow: {flexDirection: 'row', justifyContent: 'flex-start'},
  fab: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 46},
  fabText: {fontSize: 15, fontWeight: '900', letterSpacing: 0.8, color: C.ink},
  card: {padding: 14},
  cardTop: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  flagBox: {width: 54, height: 54, borderRadius: 16, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  cardName: {fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: 0.2},
  tags: {flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap'},
  tag: {backgroundColor: C.sky, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 2, borderWidth: 1.5, borderColor: C.ink},
  tagText: {fontSize: 11, fontWeight: '700', color: C.ink},
  cardBtns: {flexDirection: 'row', gap: 10, marginTop: 12},
  cardBtn: {height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8},
  cardBtnText: {fontSize: 15, fontWeight: '900', letterSpacing: 0.8, color: C.ink},
  listRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  listName: {fontSize: 16, fontWeight: '700', color: C.ink},
  bagName: {fontSize: 16, fontWeight: '900', color: C.ink, marginTop: 4},
});
