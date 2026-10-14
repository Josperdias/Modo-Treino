import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {formatClock, searchTracks} from '../../logic';
import {flag} from '../data';
import {Btn, Card, Chips, Equalizer, Icon, Kicker, Pattern, Pop, Press, Pulse, Sheet, useToast} from '../ui';
import {C, R, T, useNarrow} from '../theme';
import {MiniTape} from '../music/Cassette';
import LiveCassette from '../music/LiveCassette';
import {PermissionCard, SourceButtons} from '../music/LibrarySources';
import {Track, useMusic} from '../music/MusicProvider';
import {SeekBar, VolumeBar} from '../music/PlayerBits';
import {setHeroGone} from '../music/dock';

const FADES = [0, 2, 3, 5, 8];

const TIMERS = [0, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const HERO_GONE_Y = 520;   // depois desta rolagem o player grande já saiu da tela: o miniplayer assume
const ROW_H = 84;   // altura fixa da linha: a lista calcula a posição sem medir cada item (rolagem lisa)

type RowProps = {t: Track; current: boolean; playing: boolean; sub: string; onPlay: (t: Track) => void; onMenu: (t: Track) => void};
/** Uma fita na lista. Sem animações por linha e memoizada: só re-renderiza quando a própria fita muda de estado. */
const FitaRow = React.memo(function FitaRow({t, current, playing, sub, onPlay, onMenu}: RowProps) {
  return (
    <View style={P.rowWrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Tocar ${t.title}`} onPress={() => onPlay(t)} android_ripple={{color: 'rgba(20,27,52,.12)'}}
        style={({pressed}) => [P.row, current && P.rowOn, pressed && {opacity: 0.85}]}>
        <MiniTape id={t.id} />
        <View style={{flex: 1}}>
          <Text numberOfLines={2} style={P.rowTitle}>{t.title}</Text>
          <Text style={T.small} numberOfLines={1}>{current ? (playing ? 'Tocando agora' : 'Pausada') : sub}</Text>
        </View>
        {current && playing && <Equalizer active />}
        <Pressable accessibilityRole="button" accessibilityLabel={`Mais opções de ${t.title}`} onPress={() => onMenu(t)} hitSlop={6} style={P.iconBtn}><Icon name="ellipsis-horizontal" size={20} /></Pressable>
      </Pressable>
    </View>
  );
});

const subOf = (t: Track) => {
  const base = t.duration ? formatClock(t.duration) : t.source === 'file' ? 'Arquivo copiado para o app' : 'No celular';
  return t.artist ? `${t.artist} · ${base}` : base;
};

/** FITAS: cada música do celular é uma fita (um cassete colorido). Toque numa fita para ouvir; coloque fitas em bags (playlists) na aba BAGS. */
export default function MusicScreen() {
  const m = useMusic();
  const toast = useToast();
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState<Track | null>(null);
  const [pickBag, setPickBag] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => searchTracks(m.library, q), [m.library, q]);
  const listView = useRef<FlatList<Track>>(null);
  useEffect(() => () => setHeroGone(false), []);
  const onScroll = useCallback((e: {nativeEvent: {contentOffset: {y: number}}}) => { setHeroGone(e.nativeEvent.contentOffset.y > HERO_GONE_Y); }, []);
  const context = m.queueName ?? `Bag ${m.activeTape.name}`;
  const where = (t: Track) => m.lib.tapes.filter((b) => b.ids.includes(t.id)).map((b) => b.name);

  // O contexto do player muda a cada ~300 ms (posição); os callbacks da lista ficam estáveis via ref para as linhas não re-renderizarem.
  const mRef = useRef(m); mRef.current = m;
  const listRef = useRef(list); listRef.current = list;
  const onPlay = useCallback((t: Track) => { void mRef.current.playFita(t, listRef.current); }, []);
  const onMenu = useCallback((t: Track) => { setPickBag(false); setMenu(t); }, []);
  const nowId = m.now?.id;
  const nowIndex = nowId ? list.findIndex((x) => x.id === nowId) : -1;
  const goToNow = useCallback(() => {
    if (nowIndex >= 0) listView.current?.scrollToIndex({index: nowIndex, viewPosition: 0.35, animated: true});
  }, [nowIndex]);
  const renderItem = useCallback(({item}: {item: Track}) => (
    <FitaRow t={item} current={nowId === item.id} playing={m.playing} sub={subOf(item)} onPlay={onPlay} onMenu={onMenu} />
  ), [nowId, m.playing, onPlay, onMenu]);

  const header = (
    <View>
      <Animated.View entering={FadeInDown.duration(380)}>
        <Kicker>Sua sonoplastia particular / 001</Kicker>
        <Text style={[T.h1, {marginTop: 4, marginBottom: 16, fontSize: 40, lineHeight: 38}]}>Suas fitas,{'\n'}seu ritmo.</Text>
        <Card color={C.yellow} offset={6} style={{alignItems: 'center', paddingTop: 22, paddingBottom: 18}} pattern={<Pattern kind="dots" opacity={0.13} size={16} />}>
          <View style={{width: '100%'}}><LiveCassette playing={m.playing} label={m.now?.title || 'Escolha uma fita'} /></View>
          <Text style={P.heroSub}>{m.library.length ? `${m.library.length} ${m.library.length === 1 ? 'fita' : 'fitas'} no seu celular` : 'Nenhuma fita ainda: traga as músicas do celular'}</Text>
        </Card>
      </Animated.View>

      <View style={{marginTop: 20}}>
        <Card offset={4} style={{padding: 18}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text numberOfLines={1} style={[P.song, {flex: 1}]}>{m.now?.title || 'Toque ▶ ou escolha uma fita'}</Text>
            {m.live && <View style={P.live}><View style={P.liveDot} /><Text style={P.liveText}>AO VIVO</Text></View>}
          </View>
          <Text style={[T.small, {marginTop: 2}]} numberOfLines={1}>{m.now ? (m.live ? (m.radioTrack?.title ? `♪ ${m.radioTrack.title}` : `${flag(m.now.cc)} ${m.now.country || 'Rádio'}`) : context) : `${m.library.length} fita(s) · ${m.activeTape.ids.length} item(ns) na bag ${m.activeTape.name}`}</Text>
          {!m.live && <View style={{marginTop: 12}}><SeekBar /></View>}
          <View style={P.controls}>
            <Press accessibilityRole="button" accessibilityLabel={m.lib.shuffle ? 'Desligar aleatório' : 'Ligar aleatório'} accessibilityState={{selected: m.lib.shuffle}} onPress={() => m.setShuffle(!m.lib.shuffle)} style={P.small} quiet><Icon name="shuffle" size={22} color={m.lib.shuffle ? C.blue : C.muted} /></Press>
            <Press accessibilityRole="button" accessibilityLabel="Faixa anterior" onPress={() => m.skip(-1)} style={P.small} quiet><Icon name="play-skip-back" size={26} /></Press>
            <Pulse scale={m.playing ? 1 : 1.04} duration={1100}>
              <Pop accessibilityRole="button" accessibilityLabel="Tocar ou pausar" onPress={m.playPause} offset={4} radius={36} quiet innerStyle={P.play}><Icon name={m.playing ? 'pause' : 'play'} size={32} /></Pop>
            </Pulse>
            <Press accessibilityRole="button" accessibilityLabel="Próxima faixa" onPress={() => m.skip(1)} style={P.small} quiet><Icon name="play-skip-forward" size={26} /></Press>
            <Press accessibilityRole="button" accessibilityLabel={m.lib.repeat ? 'Desligar repetir' : 'Ligar repetir'} accessibilityState={{selected: m.lib.repeat}} onPress={() => m.setRepeat(!m.lib.repeat)} style={P.small} quiet><Icon name="repeat" size={22} color={m.lib.repeat ? C.blue : C.muted} /></Press>
          </View>
          <VolumeBar />
          <Press accessibilityRole="button" accessibilityLabel="Transição entre músicas" onPress={() => setSettings(true)} style={P.fadeRow} quiet>
            <Icon name="options-outline" size={16} color={C.muted} /><Text style={T.small}>Controles · transição {m.lib.fade ? `${m.lib.fade} s` : 'desligada'} · {m.lib.rate}x{m.sleepLeft ? ` · dorme em ${mmss(m.sleepLeft)}` : ''}</Text>
          </Press>
        </Card>
      </View>

      <View style={P.sectionHead}><Text style={[T.h2, {fontSize: 28, flex: 1}]}>Minhas fitas</Text></View>
      <SourceButtons />

      {m.library.length === 0 ? (
        m.permission === 'granted' || m.scanning
          ? <Animated.View entering={FadeIn}><Card color={C.card} offset={3} style={{alignItems: 'center', padding: 24}}>
              <Icon name="musical-notes" size={34} color={C.pink} />
              <Text style={[T.h3, {marginTop: 8}]}>{m.scanning ? 'Procurando suas fitas…' : 'Nenhuma fita encontrada'}</Text>
              <Text style={[T.body, {textAlign: 'center', marginTop: 4}]}>Escolha uma pasta ou arquivos acima. As músicas ficam onde estão: sem importar, sem copiar.</Text>
            </Card></Animated.View>
          : <PermissionCard />
      ) : (
        <>
          <View style={P.search}>
            <Icon name="search" size={18} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar fita ou artista" placeholderTextColor={C.muted} accessibilityLabel="Buscar fita" style={P.searchInput} autoCorrect={false} returnKeyType="search" />
            {q.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Limpar a busca da fita" onPress={() => setQ('')} hitSlop={8}><Icon name="close-circle" size={20} color={C.muted} /></Pressable>}
          </View>
          <View style={P.countRow}>
            <Text style={T.small} accessibilityLiveRegion="polite">{q.trim() ? `${list.length} de ${m.library.length} ${m.library.length === 1 ? 'fita' : 'fitas'}` : `${m.library.length} ${m.library.length === 1 ? 'fita' : 'fitas'}`}</Text>
            {nowIndex >= 0 && <Pressable accessibilityRole="button" accessibilityLabel="Ir para a fita que está tocando" onPress={goToNow} hitSlop={8} style={P.goNow}><Icon name="locate" size={15} /><Text style={P.goNowText}>{m.playing ? 'TOCANDO' : 'ATUAL'} · {nowIndex + 1}</Text></Pressable>}
          </View>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
            <Btn small icon="play" text="TOCAR TUDO" label="Tocar todas as fitas" onPress={() => m.playAll(false, list)} style={{flex: 1}} />
            <Btn small kind="ghost" icon="shuffle" text="ALEATÓRIO" label="Tocar todas as fitas em ordem aleatória" onPress={() => m.playAll(true, list)} style={{flex: 1}} />
          </View>
          {list.length === 0 && <Text style={[T.body, {textAlign: 'center', padding: 20}]}>Nenhuma fita com esse nome.</Text>}
        </>
      )}
    </View>
  );

  return (
    <View style={{flex: 1}}>
      <FlatList
        ref={listView}
        data={m.library.length ? list : []}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        extraData={`${nowId}|${m.playing}`}
        getItemLayout={(_, i) => ({length: ROW_H, offset: ROW_H * i, index: i})}
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={40}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={P.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={48}
        onScrollToIndexFailed={(info) => { setTimeout(() => listView.current?.scrollToOffset({offset: info.averageItemLength * info.index, animated: true}), 60); }}
        ListHeaderComponent={header}
        ListFooterComponent={<Text style={P.disclaimer}>As fitas são as músicas do seu celular e tocam offline; nada é copiado nem apagado. Para montar playlists, use as BAGS. Rádios precisam de internet. Links do YouTube não são reproduzidos. Em segundo plano, o som depende do Android e das suas permissões.</Text>}
      />

      <Sheet visible={settings} onClose={() => setSettings(false)} title="Controles do player">
        <Text style={[T.h3, {marginBottom: 4}]}>Transição entre músicas</Text>
        <Text style={[T.small, {marginBottom: 10}]}>Quanto tempo uma música leva para sumir enquanto a próxima entra.</Text>
        <Chips options={FADES} value={m.lib.fade} onChange={m.setFade} format={(n) => (n ? `${n} s` : 'Sem')} label={(n) => `Transição de ${n} segundos`} />
        <Text style={[T.h3, {marginTop: 20, marginBottom: 4}]}>Velocidade</Text>
        <Text style={[T.small, {marginBottom: 10}]}>Não vale para rádio ao vivo.</Text>
        <Chips options={RATES} value={m.lib.rate} onChange={m.setRate} format={(n) => `${n}x`} label={(n) => `Velocidade ${n} vezes`} />
        <Text style={[T.h3, {marginTop: 20, marginBottom: 4}]}>Timer para dormir</Text>
        <Text style={[T.small, {marginBottom: 10}]}>{m.sleepLeft ? `Pausa em ${mmss(m.sleepLeft)}.` : 'A música pausa sozinha depois do tempo escolhido.'}</Text>
        <Chips options={TIMERS} value={m.sleepLeft ? -1 : 0} onChange={(n) => m.setSleep(n)} format={(n) => (n ? `${n} min` : 'Desligado')} label={(n) => (n ? `Pausar em ${n} minutos` : 'Desligar o timer')} />
      </Sheet>

      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title || ''}>
        {menu && (
          <View style={{gap: 10, paddingBottom: 10}}>
            <Text style={T.small}>{where(menu).length ? `Está nas bags: ${where(menu).join(', ')}` : 'Ainda não está em nenhuma bag.'}</Text>
            <Btn small icon="play" text="TOCAR AGORA" onPress={() => { void m.playFita(menu, list); setMenu(null); }} />
            <Btn small kind="ghost" icon="bag-add" text={pickBag ? 'ESCOLHA A BAG' : 'COLOCAR NA BAG'} onPress={() => setPickBag(!pickBag)} />
            {pickBag && (
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
                {m.lib.tapes.map((b) => {
                  const has = b.ids.includes(menu.id);
                  return (
                    <Pop key={b.id} accessibilityRole="button" accessibilityLabel={has ? `Já está na bag ${b.name}` : `Colocar na bag ${b.name}`} disabled={has} onPress={() => { m.copyToTape(menu, b.id); toast.show(`“${menu.title}” na bag ${b.name}`); setMenu(null); }} offset={3} quiet innerStyle={{paddingHorizontal: 16, minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: has ? 0.45 : 1}}>
                      <Text style={{fontSize: 16, fontWeight: '900', color: C.ink}}>{has ? '✓ ' : ''}{b.name}</Text>
                    </Pop>
                  );
                })}
              </View>
            )}
            {menu.source === 'file' && <Btn small kind="danger" icon="trash-outline" text="APAGAR CÓPIA DO APP" label={`Apagar a cópia de ${menu.title} do app`}
              onPress={() => Alert.alert('Apagar a cópia do app?', 'Só a cópia guardada pelo Modo Treino é removida. O arquivo original continua onde estava.', [{text: 'Cancelar', style: 'cancel'}, {text: 'Apagar cópia', style: 'destructive', onPress: () => { m.forgetImported(menu.id); setMenu(null); }}])} />}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const P = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  heroSub: {fontSize: 13, fontWeight: '700', color: 'rgba(20,27,52,.75)', marginTop: 10},
  song: {fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: 0.2},
  live: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD3DE', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.ink},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0204A'},
  liveText: {fontSize: 11, fontWeight: '900', letterSpacing: 1, color: C.ink},
  seek: {height: 28, justifyContent: 'center'},
  seekTrack: {height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink},
  seekFill: {height: 8, backgroundColor: C.pink},
  seekKnob: {position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: C.yellow, marginLeft: -9, top: 5, borderWidth: 2, borderColor: C.ink},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
  controls: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingRight: 4},
  small: {width: 46, height: 46, alignItems: 'center', justifyContent: 'center'},
  play: {width: 68, height: 68, alignItems: 'center', justifyContent: 'center'},
  volRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  volPct: {width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700', color: C.muted},
  fadeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'center', padding: 8},
  sectionHead: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10},
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 16, height: 48, marginBottom: 12, borderWidth: 2, borderColor: C.ink},
  searchInput: {flex: 1, fontSize: 15, color: C.ink},
  countRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4, marginBottom: 10, paddingHorizontal: 4, minHeight: 28},
  goNow: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.yellow, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.ink},
  goNowText: {fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: C.ink},
  iconBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center'},
  rowWrap: {height: ROW_H, paddingBottom: 8},
  row: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, backgroundColor: C.card, borderRadius: R.md, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4},
  rowOn: {backgroundColor: '#FFF1BF'},
  rowTitle: {fontSize: 15, fontWeight: '700', color: C.ink},
  disclaimer: {fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 24},
});
