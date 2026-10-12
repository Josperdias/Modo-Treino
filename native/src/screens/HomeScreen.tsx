import React from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInDown, FadeInUp, ZoomIn} from 'react-native-reanimated';
import {file, personaShort, Treino, treinoTitle} from '../data';
import {todayKey, useApp} from '../store';
import {streak as streakDays} from '../../logic';
import {Btn, CountUp, Float, Icon, Kicker, Pattern, Press, Pulse, Twinkle} from '../ui';
import {C, INK, R, T} from '../theme';
import {PersonaPicker} from './Sheets';

const TONE: Record<Treino, string> = {A: C.pink, B: C.sky};

type Props = {onOpenTreino: (t: Treino) => void; onStart: (t: Treino) => void};

function SectionTitle({over, title, delay = 0}: {over: string; title: string; delay?: number}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360)} style={{marginTop: 30, marginBottom: 14}}>
      <Kicker>{over}</Kicker>
      <Text style={[T.h1, {fontSize: 30, lineHeight: 32, marginTop: 4}]} accessibilityRole="header">{title}</Text>
    </Animated.View>
  );
}

export default function HomeScreen({onOpenTreino, onStart}: Props) {
  const app = useApp();
  const {state} = app;
  const pA = app.progress('A'), pB = app.progress('B');
  const next: Treino = pA.sets > 0 && pA.sets < pA.total ? 'A' : pB.sets > 0 && pB.sets < pB.total ? 'B' : 'A';
  const pn = next === 'A' ? pA : pB;
  const started = pn.sets > 0 && pn.sets < pn.total;
  const hero = file(state.persona === 'loira' ? 'lateral_loira.png' : 'lateral_vinho.png');
  const stats: [number, string][] = [[state.sessions.length, 'Treinos'], [state.sessions.reduce((a, x) => a + x.sets, 0), 'Séries feitas'], [streakDays(state.sessions, todayKey()), 'Dias seguidos']];
  const tileArt = (t: Treino) => file(t === 'A' ? (state.persona === 'loira' ? 'martelo_loira.png' : 'martelo_vinho.png') : (state.persona === 'loira' ? 'crucifixo_loira.png' : 'supino_vinho.png'));

  return (
    <ScrollView contentContainerStyle={H.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(420)} style={H.hero}>
        <Pattern kind="dots" opacity={0.16} size={18} />
        <Twinkle size={20} color={C.ink} delay={200} style={{top: 150, right: 120}} />
        <Twinkle size={14} color={C.white} delay={700} style={{top: 120, right: 38}} />
        <Twinkle size={16} color={C.ink} delay={1200} style={{top: 250, left: 160}} />
        <View style={H.heroPill}><Icon name="sparkles" size={13} /><Text style={H.heroPillText}>SEU MOVIMENTO COMEÇA AQUI</Text></View>
        <Animated.View entering={ZoomIn.delay(450).springify().damping(7)} style={H.stickerPos}>
          <Float amplitude={3} rotate={8} duration={1800} style={H.sticker}><Text style={H.stickerText}>BORA!</Text></Float>
        </Animated.View>
        <Animated.Text entering={FadeInUp.delay(120).duration(420)} style={H.heroTitle} accessibilityRole="header">VAI LÁ.{'\n'}FAZ VALER.</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(220).duration(420)} style={H.heroSub}>Uma série de cada vez. O seu treino, ilustrado por Josperd.</Animated.Text>
        <View style={H.heroBottom}>
          <Animated.View entering={FadeInUp.delay(320).duration(420)} style={{width: '47%', paddingBottom: 4}}>
            <Pulse scale={1.035} duration={1300}><Btn icon="play" text={started ? `CONTINUAR TREINO ${next}` : `COMEÇAR TREINO ${next}`} label={started ? `Continuar treino ${next}` : `Começar treino ${next}`} onPress={() => onStart(next)} /></Pulse>
            {started && <Text style={H.heroNote}>{pn.percent}% do Treino {next} hoje</Text>}
          </Animated.View>
          <Float amplitude={5} rotate={5} style={H.poster}>
            <Image source={hero} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${personaShort(state.persona)}`} />
          </Float>
        </View>
      </Animated.View>

      <SectionTitle over="Sua companhia" title="Escolha o personagem" delay={80} />
      <Animated.View entering={FadeInDown.delay(140).duration(360)}><PersonaPicker /></Animated.View>

      <View style={H.stats}>
        {stats.map(([n, label], i) => (
          <Animated.View key={label} entering={FadeInDown.delay(200 + i * 70).duration(360)} style={H.stat}>
            <CountUp value={n} style={H.statBig} />
            <Text style={H.statLabel}>{label}</Text>
          </Animated.View>
        ))}
      </View>

      <SectionTitle over="Dupla da semana" title="Escolha seu treino" delay={260} />
      {(['A', 'B'] as const).map((t, i) => {
        const p = t === 'A' ? pA : pB;
        return (
          <Animated.View key={t} entering={FadeInDown.delay(300 + i * 110).duration(420)}>
            <Press accessibilityRole="button" accessibilityLabel={`Abrir treino ${t}`} onPress={() => onOpenTreino(t)} scaleTo={0.975} style={[H.tile, {backgroundColor: TONE[t]}]}>
              <Pattern kind={t === 'A' ? 'stripes' : 'dots'} opacity={0.09} size={t === 'A' ? 14 : 18} />
              <View style={{width: '62%', zIndex: 2}}>
                <Text style={H.tileOver}>FICHA {t} · {t === 'A' ? '06' : '08'} EXERCÍCIOS</Text>
                <Text style={H.tileBig} numberOfLines={1}>TREINO {t}</Text>
                <Text style={H.tileSub}>{treinoTitle(t)}</Text>
                <View style={H.tileFoot}>
                  <Text style={H.tileLink}>ABRIR TREINO</Text><Icon name="arrow-forward" size={15} />
                  {p.sets > 0 && <View style={H.tileChip}><Text style={H.tileChipText}>HOJE {p.percent}%</Text></View>}
                </View>
              </View>
              <Float amplitude={4} rotate={t === 'A' ? 5 : -4} duration={2800 + i * 400} style={H.tileArt}>
                <Image source={tileArt(t)} resizeMode="contain" style={{width: '100%', height: '100%'}} />
              </Float>
            </Press>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const H = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  hero: {backgroundColor: C.sky, borderRadius: R.xl, padding: 22, overflow: 'hidden', ...INK},
  heroPill: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 8, ...INK},
  heroPillText: {fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: C.ink},
  stickerPos: {position: 'absolute', top: 74, right: 18, zIndex: 3},
  sticker: {backgroundColor: C.pink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, ...INK},
  stickerText: {fontSize: 17, fontWeight: '900', color: C.ink, letterSpacing: 0.5},
  heroTitle: {fontSize: 44, fontWeight: '900', letterSpacing: -2, color: C.ink, lineHeight: 47, marginTop: 20},
  heroSub: {fontSize: 14, lineHeight: 21, color: 'rgba(20,27,52,.8)', fontWeight: '600', marginTop: 12, maxWidth: '78%'},
  heroBottom: {marginTop: 14, minHeight: 215, justifyContent: 'flex-end'},
  heroNote: {fontSize: 11, fontWeight: '800', color: 'rgba(20,27,52,.7)', marginTop: 8, textAlign: 'center'},
  poster: {position: 'absolute', right: -30, bottom: -34, width: 176, height: 240, backgroundColor: C.card, borderRadius: 16, padding: 5, ...INK},
  stats: {flexDirection: 'row', gap: 10, marginTop: 14},
  stat: {flex: 1, backgroundColor: C.card, borderRadius: R.lg, paddingVertical: 18, alignItems: 'center', borderWidth: 1.5, borderColor: C.line},
  statBig: {fontSize: 34, fontWeight: '900', color: C.ink, letterSpacing: -1.2},
  statLabel: {fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 2},
  tile: {borderRadius: R.xl, padding: 20, marginBottom: 14, overflow: 'hidden', minHeight: 232, justifyContent: 'center', ...INK},
  tileOver: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: C.ink},
  tileBig: {fontSize: 37, fontWeight: '900', letterSpacing: -1.8, color: C.ink, marginTop: 10, lineHeight: 46},
  tileSub: {fontSize: 14, color: 'rgba(20,27,52,.8)', fontWeight: '600', marginTop: 8},
  tileFoot: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap'},
  tileLink: {fontSize: 12, fontWeight: '900', letterSpacing: 1, color: C.ink},
  tileChip: {backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6, ...INK},
  tileChipText: {fontSize: 10, fontWeight: '900', color: C.ink, letterSpacing: 0.6},
  tileArt: {position: 'absolute', right: -28, bottom: -30, width: 156, height: 236, backgroundColor: C.card, borderRadius: 16, padding: 5, ...INK},
});
