/** Rádio do mundo: um globo 3D com milhares de estações. Gire, dê zoom, toque num ponto (ou num país) e ouça. */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown, FadeOutDown, ZoomIn, ZoomOut} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {flag} from '../data';
import {Btn, Icon, Pop, Press, Pulse, Sheet, useToast} from '../ui';
import {C, R, T} from '../theme';
import GlobeView, {GlobeEvent, GlobeHandle} from '../radio/GlobeView';
import {countClick, GENRES, GENRE_GROUPS, idsDoEstilo, loadStations, search, Station, toTrack} from '../radio/api';
import {useMusic} from '../music/MusicProvider';

export default function RadioScreen({active = true}: {active?: boolean}) {
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
  const [near, setNear] = useState<string[]>([]);
  const [nearOpen, setNearOpen] = useState(false);
  const [cardHidden, setCardHidden] = useState(false);  // cartão recolhido: o globo inteiro aparece
  const [infoOpen, setInfoOpen] = useState(false);     // "i": mais informações da rádio
  const [countries, setCountries] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);   // painel "Estilos" (recolhido por padrão)
  const [names, setNames] = useState<Record<string, string>>({});
  const nomePais = useCallback((cc: string, fallback: string) => names[cc] || fallback || cc, [names]);

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

  useEffect(() => { if (ready) globe.current?.post({cmd: active ? 'resume' : 'pause'}); }, [ready, active]);
  // nome da faixa: a página do globo abre uma leitura curta do stream a cada 20 s enquanto a rádio toca
  useEffect(() => { if (ready) globe.current?.post({cmd: 'track', id: playing?.i ?? null, url: playing?.u ?? null}); }, [ready, playing?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  // estilo escolhido: o globo mostra só as rádios desse estilo
  useEffect(() => { if (ready) globe.current?.post({cmd: 'filter', ids: tag ? idsDoEstilo(stations, tag) : null}); }, [ready, tag, stations]);

  const focus = (s: Station, altitude = 0.9) => globe.current?.post({cmd: 'focus', id: s.i, lat: s.lat, lng: s.lng, altitude, ms: 1100});
  const pick = (s: Station, move = true) => { setSelected(s); setNear([]); setCardHidden(false); if (move) focus(s); };
  const play = (s: Station) => { pick(s, false); countClick(s.i); void m.playRadio(toTrack(s)); };

  const onEvent = useCallback((e: GlobeEvent) => {
    if (e.type === 'ready') setReady(true);
    else if (e.type === 'station') { const s = byId.get(e.id); if (s) setSelected(s); }
    else if (e.type === 'near') setNear(e.ids);
    else if (e.type === 'names') setNames(e.map);
    else if (e.type === 'track') m.setRadioTrack(e.id, e.title, !!e.icy && !e.error);
    else if (e.type === 'country') { setSelected(null); setCountry({iso2: e.iso2, name: e.name}); globe.current?.post({cmd: 'country', iso2: e.iso2}); }
  }, [byId, m]);

  const results = useMemo(() => (query.trim() || tag ? search(stations, query, tag, 30) : []), [stations, query, tag]);
  const countryList = useMemo(() => (country ? stations.filter((s) => s.cc === country.iso2).slice(0, 80) : []), [stations, country]);

  const countryRank = useMemo(() => {
    const m2 = new Map<string, {cc: string; co: string; n: number}>();
    for (const s of stations) { if (!s.cc) continue; const c = m2.get(s.cc) || {cc: s.cc, co: s.co, n: 0}; c.n++; m2.set(s.cc, c); }
    return [...m2.values()].sort((a, b) => b.n - a.n);
  }, [stations]);
  const openCountry = (cc: string, co: string) => {
    const list = stations.filter((s) => s.cc === cc);
    if (list.length) {
      const lat = list.reduce((a, s) => a + s.lat, 0) / list.length, lng = list.reduce((a, s) => a + s.lng, 0) / list.length;
      globe.current?.post({cmd: 'focus', lat, lng, altitude: 1.3, ms: 1000});
    }
    globe.current?.post({cmd: 'country', iso2: cc});
    setSelected(null); setCountries(false); setCountry({iso2: cc, name: co});
  };
  const nearList = useMemo(() => near.map((id) => byId.get(id)).filter(Boolean) as Station[], [near, byId]);

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
      <LinearGradient colors={['#080C24', '#17104A', '#0E2250']} style={StyleSheet.absoluteFill} />
      <View style={S.globe}><GlobeView ref={globe} onEvent={onEvent} /></View>
      <View style={S.scrim} pointerEvents="none"><LinearGradient colors={['rgba(8,12,36,.82)', 'rgba(8,12,36,0)']} style={StyleSheet.absoluteFill} /></View>

      <View style={S.top} pointerEvents="box-none">
        <View style={S.titleRow} pointerEvents="none">
          <Text style={S.title}>RÁDIO DO MUNDO</Text>
          <View style={S.count}><Text style={S.countText}>{state === 'ready' ? `${stations.length.toLocaleString('pt-BR')} estações` : state === 'loading' ? 'carregando…' : 'sem rede'}</Text></View>
        </View>
        <View style={S.search}>
          <Icon name="search" size={18} color="#B7C1E3" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar rádio, país ou estilo" placeholderTextColor="#8E99BF" accessibilityLabel="Buscar rádio" style={S.input} autoCorrect={false} />
          {(query || tag) ? <Press accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => { setQuery(''); setTag(null); }} quiet><Icon name="close-circle" size={20} color="#B7C1E3" /></Press> : null}
        </View>
        <View style={S.actions}>
          <Pop accessibilityRole="button" accessibilityLabel="Surpreenda-me com uma rádio aleatória" onPress={surprise} color={C.pink} offset={3} radius={21} style={{width: 52}} innerStyle={S.dice}>
            <Icon name="dice" size={24} />
          </Pop>
          <Pop accessibilityRole="button" accessibilityLabel="Ver rádios por país" onPress={() => setCountries(true)} color={C.sky} offset={3} radius={20} style={{flex: 1}} innerStyle={S.act}>
            <Icon name="flag" size={16} /><Text style={S.actText} numberOfLines={1}>PAÍSES</Text>
          </Pop>
          <Pop accessibilityRole="button" accessibilityLabel={tag ? `Escolher estilo, agora ${GENRES.find((g) => g.tag === tag)?.label}` : 'Escolher estilo'} accessibilityState={{expanded: stylesOpen}} onPress={() => setStylesOpen(!stylesOpen)} color={tag ? C.yellow : C.card} offset={3} radius={20} style={{flex: 1.25}} innerStyle={S.act}>
            <Icon name="options" size={17} /><Text style={S.actText} numberOfLines={1}>{tag ? (GENRES.find((g) => g.tag === tag)?.label || 'ESTILO').toUpperCase() : 'ESTILOS'}</Text><Icon name={stylesOpen ? 'chevron-up' : 'chevron-down'} size={15} />
          </Pop>
        </View>
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
              <View style={{flex: 1}}><Text style={S.resName} numberOfLines={1}>{item.n}</Text><Text style={S.resSub} numberOfLines={1}>{[item.st, nomePais(item.cc, item.co)].filter(Boolean).join(', ')}{item.tg ? ` · ${item.tg.split(',')[0]}` : ''}</Text></View>
              <Icon name="play-circle" size={26} color={C.yellow} />
            </Press>
          )} />
        </Animated.View>
      )}

      {stylesOpen && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(140)} style={S.stylesPanel}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{maxHeight: 300}}>
            {GENRE_GROUPS.map((grp) => (
              <View key={grp.label} style={{marginBottom: 12}}>
                <Text style={S.groupLabel}>{grp.label.toUpperCase()}</Text>
                <View style={S.chipsWrap}>
                  {grp.tags.map((tg) => {
                    const g = GENRES.find((x) => x.tag === tg); if (!g) return null;
                    return (
                      <Press key={g.tag} accessibilityRole="button" accessibilityLabel={`Estilo ${g.label}`} accessibilityState={{selected: tag === g.tag}} onPress={() => { setTag(tag === g.tag ? null : g.tag); setStylesOpen(false); }} style={[S.chip, tag === g.tag && S.chipOn]} quiet>
                        <Text style={[S.chipText, tag === g.tag && {color: C.ink}]}>{g.label.toUpperCase()}</Text>
                      </Press>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <Press accessibilityRole="button" accessibilityLabel="Recolher os estilos" onPress={() => setStylesOpen(false)} style={S.stylesClose} quiet><Icon name="chevron-up" size={18} color="#DDE4FF" /></Press>
        </Animated.View>
      )}
      <View style={S.bottom} pointerEvents="box-none">
        {showCard && card && cardHidden && (
          <Animated.View entering={ZoomIn.duration(220)} exiting={ZoomOut.duration(140)} style={{alignSelf: 'flex-end'}}>
            <Pop accessibilityRole="button" accessibilityLabel={`Abrir o cartão da rádio ${card.n}`} onPress={() => setCardHidden(false)} color={C.card} offset={3} radius={26} style={{width: 52}} innerStyle={S.reopen}>
              <Text style={{fontSize: 24}}>{flag(card.cc)}</Text>
            </Pop>
          </Animated.View>
        )}
        <View style={S.legend} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[S.dot, {backgroundColor: '#1D1F66'}]} /><Text style={S.legendText}>rádio</Text>
          <View style={[S.dot, {backgroundColor: '#E63950'}]} /><Text style={S.legendText}>escolhida</Text>
          <View style={[S.dot, {backgroundColor: '#22B35E'}]} /><Text style={S.legendText}>tocando</Text>
        </View>
        {showCard && card && !cardHidden && (
          <Animated.View key={card.i} entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(160)}>
            <Press accessibilityRole="button" accessibilityLabel={`Rádio ${card.n}`} onPress={() => focus(card)} style={S.card} quiet>
              <View style={S.cardTop}>
                <View style={S.flagBox}><Text style={{fontSize: 24}}>{flag(card.cc)}</Text></View>
                <View style={{flex: 1}}>
                  <Text style={S.cardName} numberOfLines={1}>{card.n}</Text>
                  {playingId === card.i
                    ? <Text style={S.cardTrack} numberOfLines={1}>{m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : m.radioTrack?.state === 'sem' ? 'Esta rádio não informa a faixa' : 'Buscando o nome da faixa…'}</Text>
                    : <Text style={S.cardSub} numberOfLines={1}>{flag(card.cc)} {nomePais(card.cc, card.co)}{card.st ? ` · ${card.st}` : ''}{card.tg ? ` · ${card.tg.split(',')[0]}` : ''}{card.br ? ` · ${card.br} kbps` : ''}</Text>}
                </View>
                <Pop accessibilityRole="button" accessibilityLabel="Recolher o cartão da rádio" onPress={() => setCardHidden(true)} color={C.soft} offset={2} radius={16} style={{width: 32, alignSelf: 'flex-start'}} innerStyle={S.infoBtn}><Icon name="chevron-down" size={20} /></Pop>
                <Pop accessibilityRole="button" accessibilityLabel="Mais informações da rádio" onPress={() => setInfoOpen(true)} color={C.soft} offset={2} radius={16} style={{width: 32, alignSelf: 'flex-start'}} innerStyle={S.infoBtn}><Icon name="information" size={20} /></Pop>
              </View>
              <View style={S.cardBtns}>
                <Pop accessibilityRole="button" accessibilityLabel={isPlayingCard ? 'Pausar rádio' : 'Ouvir rádio'} onPress={() => (playingId === card.i ? m.playPause() : play(card))} color={C.yellow} offset={3} radius={20} style={{flex: 1}} innerStyle={S.cardBtn}>
                  <Icon name={isPlayingCard ? 'pause' : 'play'} size={18} /><Text style={S.cardBtnText}>{isPlayingCard ? 'PAUSAR' : 'OUVIR'}</Text>
                </Pop>
                <Pop accessibilityRole="button" accessibilityLabel="Guardar rádio numa bag" onPress={() => setSaving(true)} color={C.sky} offset={3} radius={20} style={{flex: 1}} innerStyle={S.cardBtn}>
                  <Icon name="bag-add" size={18} /><Text style={S.cardBtnText}>NA BAG</Text>
                </Pop>
                <Pop accessibilityRole="button" accessibilityLabel={`Mais rádios de ${nomePais(card.cc, card.co)}`} onPress={() => setCountry({iso2: card.cc, name: nomePais(card.cc, card.co)})} color={C.soft} offset={3} radius={20} innerStyle={[S.cardBtn, {paddingHorizontal: 12}]}>
                  <Icon name="list" size={18} />
                </Pop>
                {nearList.length > 1 && selected && near[0] === selected.i && (
                  <Pop accessibilityRole="button" accessibilityLabel={`Mais ${nearList.length - 1} rádios neste ponto`} onPress={() => setNearOpen(true)} color={C.pink} offset={3} radius={20} innerStyle={[S.cardBtn, {paddingHorizontal: 10}]}>
                    <Text style={S.cardBtnText}>+{nearList.length - 1}</Text>
                  </Pop>
                )}
              </View>
            </Press>
          </Animated.View>
        )}
      </View>

      <Sheet visible={!!country} onClose={() => { setCountry(null); globe.current?.post({cmd: 'country', iso2: null}); }} title={country ? `${flag(country.iso2)} ${nomePais(country.iso2, country.name)}` : ''} tall>
        {countryList.length === 0 ? <Text style={[T.body, {padding: 16}]}>Ainda não há rádios com localização neste país.</Text> : (
          <FlatList data={countryList} keyExtractor={(s) => s.i} contentContainerStyle={{paddingBottom: 30}} renderItem={({item}) => (
            <Press accessibilityRole="button" accessibilityLabel={`Ouvir ${item.n}`} onPress={() => { setCountry(null); play(item); focus(item); }} quiet style={S.listRow}>
              <View style={{flex: 1}}><Text style={S.listName} numberOfLines={1}>{item.n}</Text><Text style={T.small} numberOfLines={1}>{[item.st, item.tg.split(',')[0]].filter(Boolean).join(' · ') || 'Rádio'}</Text></View>
              <Icon name="play-circle" size={28} color={C.ink} />
            </Press>
          )} />
        )}
      </Sheet>

      <Sheet visible={nearOpen} onClose={() => setNearOpen(false)} title="Rádios neste ponto" tall>
        <FlatList data={nearList} keyExtractor={(x) => x.i} contentContainerStyle={{paddingBottom: 30}} renderItem={({item}) => (
          <Press accessibilityRole="button" accessibilityLabel={`Ouvir ${item.n}`} onPress={() => { setNearOpen(false); play(item); }} quiet style={S.listRow}>
            <Text style={S.flag}>{flag(item.cc)}</Text>
            <View style={{flex: 1}}><Text style={S.listName} numberOfLines={1}>{item.n}</Text><Text style={T.small} numberOfLines={1}>{[nomePais(item.cc, item.co), item.tg.split(',')[0]].filter(Boolean).join(' · ')}</Text></View>
            <Icon name="play-circle" size={28} color={C.ink} />
          </Press>
        )} />
      </Sheet>

      <Sheet visible={countries} onClose={() => setCountries(false)} title="Rádios por país" tall>
        <FlatList data={countryRank} keyExtractor={(x) => x.cc} initialNumToRender={16} contentContainerStyle={{paddingBottom: 30}} renderItem={({item}) => (
          <Press accessibilityRole="button" accessibilityLabel={`${nomePais(item.cc, item.co)}, ${item.n} rádios`} onPress={() => openCountry(item.cc, nomePais(item.cc, item.co))} quiet style={S.listRow}>
            <Text style={S.flag}>{flag(item.cc)}</Text>
            <View style={{flex: 1}}><Text style={S.listName} numberOfLines={1}>{nomePais(item.cc, item.co)}</Text></View>
            <View style={S.countPill}><Text style={S.countPillText}>{item.n}</Text></View>
          </Press>
        )} />
      </Sheet>

      <Sheet visible={infoOpen && !!card} onClose={() => setInfoOpen(false)} title="Sobre a rádio" scroll>
        {card ? (
          <View style={{paddingBottom: 6}}>
            <View style={S.infoHead}>
              <View style={S.flagBoxLight}><Text style={{fontSize: 30}}>{flag(card.cc)}</Text></View>
              <View style={{flex: 1}}>
                <Text style={S.infoName}>{card.n}</Text>
                <Text style={T.small}>{nomePais(card.cc, card.co)}{card.st ? ` · ${card.st}` : ''}</Text>
              </View>
            </View>
            {playingId === card.i ? <View style={S.infoNow}><Text style={S.infoNowText}>{m.radioTrack?.title ? `♪ Tocando agora: ${m.radioTrack.title}` : m.radioTrack?.state === 'sem' ? 'Esta rádio não informa o nome da faixa.' : 'Buscando o nome da faixa…'}</Text></View> : null}
            <View style={S.infoRow}><Text style={S.infoKey}>ESTILOS</Text>
              {card.tg ? <View style={S.infoTags}>{card.tg.split(',').filter(Boolean).slice(0, 12).map((g) => <View key={g} style={S.infoTag}><Text style={S.infoTagText}>{g.trim()}</Text></View>)}</View> : <Text style={S.infoVal}>Não informado</Text>}
            </View>
            <View style={S.infoRow}><Text style={S.infoKey}>QUALIDADE</Text><Text style={S.infoVal}>{card.br ? `${card.br} kbps` : 'Não informada'}</Text></View>
            <View style={S.infoRow}><Text style={S.infoKey}>POPULARIDADE</Text><Text style={S.infoVal}>{card.c ? `${card.c.toLocaleString('pt-BR')} ${card.c === 1 ? 'toque' : 'toques'} no diretório` : 'Sem toques registrados'}</Text></View>
            <View style={S.infoRow}><Text style={S.infoKey}>ONDE FICA</Text><Text style={S.infoVal}>{[card.st, nomePais(card.cc, card.co)].filter(Boolean).join(', ') || 'Não informado'}{card.lat || card.lng ? `  (${card.lat.toFixed(1)}°, ${card.lng.toFixed(1)}°)` : ''}</Text></View>
            <View style={S.infoRow}><Text style={S.infoKey}>SINAL</Text><Text style={S.infoVal}>Transmissão ao vivo pela internet. O diretório de rádios é o Radio Browser; as informações são enviadas pelas próprias rádios e podem estar incompletas.</Text></View>
            <View style={{marginTop: 8}}><Btn kind="primary" icon="earth" text="VER NO GLOBO" label="Ver a rádio no globo" onPress={() => { setInfoOpen(false); focus(card); }} /></View>
          </View>
        ) : null}
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
  globe: {...StyleSheet.absoluteFillObject, bottom: -96},   // o mundo ocupa a tela toda: busca, botões e cartão flutuam por cima dele
  scrim: {position: 'absolute', left: 0, right: 0, top: 0, height: 190},
  top: {position: 'absolute', left: 0, right: 0, top: 0, zIndex: 3, paddingHorizontal: 16, paddingTop: 8},
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 28, fontWeight: '900', color: C.white, letterSpacing: 0.5},
  actions: {flexDirection: 'row', gap: 8, marginTop: 10},
  dice: {width: 52, height: 42, alignItems: 'center', justifyContent: 'center'},
  act: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 42, paddingHorizontal: 6},
  actText: {fontSize: 13, fontWeight: '900', letterSpacing: 0.6, color: C.ink, flexShrink: 1},
  count: {backgroundColor: 'rgba(8,12,36,.62)', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4},
  countText: {fontSize: 12, fontWeight: '700', color: '#DDE4FF'},
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, backgroundColor: 'rgba(14,20,50,.7)', borderRadius: R.pill, paddingHorizontal: 16, height: 44, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.25)'},
  input: {flex: 1, color: C.white, fontSize: 15},
  stylesPanel: {position: 'absolute', left: 14, right: 14, top: 154, padding: 12, borderRadius: R.lg, backgroundColor: 'rgba(10,14,40,.82)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.22)', zIndex: 5},
  groupLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: '#9FB0E6', marginBottom: 8},
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  stylesClose: {alignItems: 'center', justifyContent: 'center', paddingTop: 4, height: 28},
  chip: {paddingHorizontal: 14, height: 36, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.2)'},
  chipOn: {backgroundColor: C.yellow, borderColor: C.yellow},
  chipText: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: '#DDE4FF'},
  center: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', top: 120},
  hint: {color: '#DDE4FF', marginTop: 12, textAlign: 'center', fontSize: 14},
  results: {position: 'absolute', left: 16, right: 16, top: 154, maxHeight: 330, backgroundColor: 'rgba(10,14,40,.92)', borderRadius: R.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.22)', overflow: 'hidden', zIndex: 5},
  resRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,.14)'},
  flag: {fontSize: 24},
  resName: {color: C.white, fontSize: 15, fontWeight: '700'},
  resSub: {color: '#AEB9E0', fontSize: 12},
  bottom: {position: 'absolute', left: 14, right: 14, bottom: 10, gap: 8},
  legend: {alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(8,12,36,.62)', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4},
  dot: {width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#F5E7C4'},
  legendText: {fontSize: 10, fontWeight: '700', color: '#DDE4FF', marginRight: 6},
  card: {padding: 10, borderRadius: R.lg, backgroundColor: 'rgba(255,254,250,.97)', borderWidth: 2, borderBottomWidth: 4, borderColor: C.ink},
  cardTop: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  cardBtns: {flexDirection: 'row', gap: 8, marginTop: 10},
  cardBtn: {height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8},
  flagBox: {width: 44, height: 44, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  cardName: {fontSize: 18, fontWeight: '900', color: C.ink, letterSpacing: 0.2},
  cardSub: {fontSize: 12, fontWeight: '700', color: C.muted},
  cardBtnText: {fontSize: 14, fontWeight: '900', letterSpacing: 0.8, color: C.ink},
  reopen: {width: 52, height: 52, alignItems: 'center', justifyContent: 'center'},
  infoBtn: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  infoHead: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  flagBoxLight: {width: 56, height: 56, borderRadius: 16, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  infoName: {fontSize: 24, fontWeight: '900', color: C.ink},
  infoNow: {backgroundColor: '#DDF6E6', borderRadius: R.md, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: '#1F8A4C'},
  infoNowText: {fontSize: 14, fontWeight: '800', color: '#14653A'},
  infoRow: {paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  infoKey: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: C.muted, marginBottom: 4},
  infoVal: {fontSize: 15, lineHeight: 21, color: C.ink},
  infoTags: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  infoTag: {backgroundColor: C.sky, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1.5, borderColor: C.ink},
  infoTagText: {fontSize: 12, fontWeight: '800', color: C.ink},
  listRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line},
  listName: {fontSize: 16, fontWeight: '700', color: C.ink},
  cardTrack: {fontSize: 12, fontWeight: '800', color: '#1F8A4C'},
  countPill: {backgroundColor: C.soft, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1.5, borderColor: C.ink},
  countPillText: {fontSize: 13, fontWeight: '900', color: C.ink},
  bagName: {fontSize: 16, fontWeight: '900', color: C.ink, marginTop: 4},
});
