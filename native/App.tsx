import 'react-native-gesture-handler';
import React, {useEffect, useState} from 'react';
import {BackHandler, ImageSourcePropType, LayoutChangeEvent, StatusBar, StyleSheet, View} from 'react-native';
import {Text} from './src/text';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {FadeIn, FadeOut, SlideInRight, SlideOutRight, useAnimatedStyle, useSharedValue, withSpring} from 'react-native-reanimated';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import {useFonts} from 'expo-font';
import {BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black} from '@expo-google-fonts/barlow-condensed';
import {DMSans_400Regular, DMSans_500Medium, DMSans_700Bold} from '@expo-google-fonts/dm-sans';
import {Glyph} from './src/glyphs';
import {AppProvider, useApp} from './src/store';
import {EXERCISES, Exercise, imageInfo, personaShort, Treino} from './src/data';
import {MusicProvider} from './src/music/MusicProvider';
import MiniPlayer from './src/music/MiniPlayer';
import NowPlaying from './src/music/NowPlaying';
import MusicHub, {MusicMode} from './src/screens/MusicHub';
import HomeScreen from './src/screens/HomeScreen';
import TrainScreen from './src/screens/TrainScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SearchScreen from './src/screens/SearchScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import {EditSheet, GallerySheet, SettingsSheet} from './src/screens/Sheets';
import ZoomView from './src/ZoomView';
import {Bounce, Icon, IconName, Pattern, Press, ToastProvider, useToast} from './src/ui';
import {useUpdates} from './src/updates';
import UpdateBanner from './src/UpdateBanner';
import {useBackup} from './src/backup';
import {limparTreino, pedirNotificacoes} from './src/notify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {C, R, useNarrow} from './src/theme';

const APP_VERSION='1.4.1';

type Tab = 'home' | 'music' | 'search' | 'progress';
const TABS: {key: Tab; label: string; icon: IconName; on: IconName}[] = [
  {key: 'home', label: 'Início', icon: 'home-outline', on: 'home'},
  {key: 'music', label: 'Músicas', icon: 'musical-notes-outline', on: 'musical-notes'},
  {key: 'search', label: 'Buscar', icon: 'search-outline', on: 'search'},
  {key: 'progress', label: 'Progresso', icon: 'stats-chart-outline', on: 'stats-chart'},
];

function TabBar({tab, onTab}: {tab: Tab; onTab: (t: Tab) => void}) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const idx = TABS.findIndex((t) => t.key === tab);
  const seg = Math.max(0, (w - 24) / TABS.length);
  const placed = React.useRef(false);
  useEffect(() => {
    if (!placed.current && seg > 0) { placed.current = true; x.value = idx * seg; return; } // primeira posição sem animar
    x.value = withSpring(idx * seg, {damping: 17, stiffness: 220});
  }, [idx, seg, x]);
  const pill = useAnimatedStyle(() => ({transform: [{translateX: x.value}]}));
  return (
    <View style={TB.bar} accessibilityRole="tablist" onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Animated.View style={[TB.pill, {width: seg}, pill]} pointerEvents="none"><View style={TB.pillInner} /></Animated.View>}
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Press key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{selected: on}} onPress={() => onTab(t.key)} style={TB.item} scaleTo={0.92}>
            <Bounce trigger={on}><Icon name={on ? t.on : t.icon} size={23} color={on ? C.ink : '#B7C1E3'} /></Bounce>
            <Text style={[TB.label, on && {color: C.ink}]}>{t.label.toUpperCase()}</Text>
          </Press>
        );
      })}
    </View>
  );
}
const TB = StyleSheet.create({
  bar: {flexDirection: 'row', backgroundColor: C.navy, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10},
  pill: {position: 'absolute', top: 8, bottom: 10, left: 12},
  pillInner: {flex: 1, marginHorizontal: 4, borderRadius: 18, backgroundColor: C.yellow},
  item: {flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 3},
  label: {fontSize: 10, fontWeight: '900', color: '#B7C1E3', letterSpacing: 0.9},
});

function Shell() {
  const app = useApp();
  const {state} = app;
  const toast = useToast();
  const narrow = useNarrow();
  const [tab, setTab] = useState<Tab>('home');
  const [musicMode, setMusicMode] = useState<MusicMode>('tapes');
  const [open, setOpen] = useState<Treino | null>(null);
  const [workout, setWorkout] = useState<{t: Treino; index?: number} | null>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [zoom, setZoom] = useState<{source: ImageSourcePropType; label: string} | null>(null);
  const [settings, setSettings] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);
  const updates = useUpdates(APP_VERSION, state.notifyUpdates, app.loaded);
  const backup = useBackup(state, APP_VERSION, app.loaded, (b) => app.update((s) => ({...s, ...b})));

  useEffect(() => { void limparTreino(); }, []); // notificação fixa que sobrou de um treino interrompido
  // Android 13+: sem a permissão nenhuma notificação aparece (nem a do player). Pede uma vez, na primeira abertura; depois, em Ajustes.
  useEffect(() => {
    if (!app.loaded) return;
    AsyncStorage.getItem('modo-treino-notif-asked').then((v) => { if (!v) { AsyncStorage.setItem('modo-treino-notif-asked', '1').catch(() => {}); void pedirNotificacoes(); } }).catch(() => {});
  }, [app.loaded]);

  useEffect(() => {
    const on = state.keepAwake && !!workout;
    if (on) activateKeepAwakeAsync('modo-treino-workout').catch(() => {});
    return () => { if (on) deactivateKeepAwake('modo-treino-workout').catch(() => {}); };
  }, [state.keepAwake, !!workout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (workout) return false; // o modo execução cuida do próprio botão voltar
      if (open) { setOpen(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [open, tab, workout]);

  const openZoom = (e: Exercise) => {
    const i = imageInfo(e, state.persona);
    setZoom({source: i.image, label: i.status === 'missing' ? `Ilustração decorativa de Josperd, não é uma demonstração de ${e.nome}` : `Ilustração de ${e.nome}`});
  };

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <StatusBar backgroundColor={C.navy} barStyle="light-content" />
      {/* com o modo execução aberto, o fundo some para leitores de tela (e para o toque) */}
      <View style={{flex: 1}} aria-hidden={!!workout} importantForAccessibility={workout ? 'no-hide-descendants' : 'auto'}>
      <View style={S.header}>
        <Pattern kind="dots" color="#FFFFFF" opacity={0.07} size={16} />
        <View>
          <Text style={[S.sub, narrow && {fontSize: 9, letterSpacing: 1.4}]}>BY JOSPERD  /  EDIÇÃO 001</Text>
          <Text style={[S.brand, narrow && {fontSize: 23}]} accessibilityRole="header">MODO <Text style={{color: C.yellow}}>TREINO.</Text></Text>
        </View>
        <Press accessibilityRole="button" accessibilityLabel="Abrir ajustes" onPress={() => setSettings(true)} style={S.chip}>
          <Glyph persona={state.persona} size={narrow ? 22 : 26} spin />
          {!narrow && <Text style={S.chipText}>{personaShort(state.persona).toUpperCase()}</Text>}
          <Icon name="settings-sharp" size={15} color="#B7C1E3" />
        </Press>
      </View>

      <UpdateBanner u={updates} current={APP_VERSION} />
      <View style={{flex: 1, backgroundColor: C.paper}}>
        <Animated.View key={tab} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} style={{flex: 1}}>
          {tab === 'home' && <HomeScreen onOpenTreino={(t) => setOpen(t)} onStart={(t) => setWorkout({t})} />}
          {tab === 'music' && <MusicHub mode={musicMode} onMode={setMusicMode} />}
          {tab === 'search' && <SearchScreen onStartExercise={(e) => setWorkout({t: e.treino, index: EXERCISES.filter((x) => x.treino === e.treino).findIndex((x) => x.id === e.id)})} onEditExercise={setEditing}
            onGoBags={() => { setMusicMode('bags'); setTab('music'); }} onGoHistory={() => setTab('progress')} />}
          {tab === 'progress' && <ProgressScreen onTrain={() => setTab('home')} />}
        </Animated.View>
        {tab === 'home' && open && (
          <Animated.View entering={SlideInRight.duration(280)} exiting={SlideOutRight.duration(220)} style={S.layer}>
            <TrainScreen treino={open} onBack={() => setOpen(null)} onTreino={setOpen} onStart={(t, index) => setWorkout({t, index})} onEdit={setEditing}
              onFinished={() => { toast.show('Treino salvo no histórico ✓'); setOpen(null); setTab('progress'); }} />
          </Animated.View>
        )}
      </View>

      {tab !== 'music' && <MiniPlayer onOpen={() => setNowOpen(true)} />}
      <TabBar tab={tab} onTab={setTab} />
      </View>

      {workout && (
        <WorkoutScreen key={`${workout.t}-${workout.index ?? 'x'}`} treino={workout.t} startIndex={workout.index} onClose={() => setWorkout(null)}
          onSaved={() => { setWorkout(null); setOpen(null); toast.show('Treino salvo no histórico ✓'); setTab('progress'); }}
          onOpenMusic={() => { setWorkout(null); setTab('music'); }} onZoom={openZoom} onEdit={setEditing} />
      )}
      <EditSheet exercise={editing} onClose={() => setEditing(null)} onZoom={openZoom} />
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} version={APP_VERSION} status={updates.status} onCheck={() => { void updates.check(true); }} onGallery={() => setGallery(true)} backup={backup} />
      <NowPlaying visible={nowOpen} onClose={() => setNowOpen(false)} onTapes={() => setTab('music')} />
      <GallerySheet visible={gallery} onClose={() => setGallery(false)} onZoom={openZoom} />
      {zoom && <ZoomView source={zoom.source} label={zoom.label} onClose={() => setZoom(null)} />}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsReady, fontError] = useFonts({BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold});
  if (!fontsReady && !fontError) return <View style={{flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center'}}><Glyph persona="vinho" size={64} spin /></View>;
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AppProvider>
          <MusicProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </MusicProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const S = StyleSheet.create({
  safe: {flex: 1, backgroundColor: C.navy},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, backgroundColor: C.navy},
  sub: {fontSize: 10, fontWeight: '900', letterSpacing: 2.2, color: '#B7C1E3'},
  brand: {fontSize: 30, fontWeight: '900', letterSpacing: 0.4, color: C.white, marginTop: 2},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: R.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 11, borderWidth: 2, borderColor: '#4A5580'},
  avatar: {width: 32, height: 32, borderRadius: 16, backgroundColor: C.paper, overflow: 'hidden', padding: 2},
  chipText: {fontSize: 13, fontWeight: '900', color: C.white, letterSpacing: 1},
  layer: {...StyleSheet.absoluteFillObject, backgroundColor: C.paper, zIndex: 5},
});
