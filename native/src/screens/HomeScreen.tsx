import React from 'react';
import {Image, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {FadeInDown, FadeInUp, ZoomIn} from 'react-native-reanimated';
import {file, personaShort, Treino, treinoTitle} from '../data';
import {todayKey, useApp} from '../store';
import {streak as streakDays} from '../../logic';
import {AText, Btn, Card, CountUp, Float, Icon, Kicker, Pattern, Pop, Pulse, Twinkle} from '../ui';
import {C, R, T, useNarrow} from '../theme';
import {PersonaPicker} from './Sheets';

const TONE: Record<Treino, string> = {A: C.pink, B: C.sky};

type Props = {onOpenTreino: (t: Treino) => void; onStart: (t: Treino) => void};

function SectionTitle({over, title, delay = 0}: {over: string; title: string; delay?: number}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360)} style={{marginTop: 30, marginBottom: 14}}>
      <Kicker>{over}</Kicker>
      <Text style={[T.h1, {fontSize: 34, lineHeight: 34, marginTop: 4}]} accessibilityRole="header">{title}</Text>
    </Animated.View>
  );
}

export default function HomeScreen({onOpenTreino, onStart}: Props) {
  const app = useApp();
  const narrow = useNarrow();
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
      <Animated.View entering={FadeInDown.duration(420)}>
        <Card color={C.sky} offset={6} style={{padding: 22}} pattern={<Pattern kind="dots" opacity={0.16} size={18} />}>
          <Twinkle size={18} color={C.ink} delay={200} style={{top: 156, right: 44}} />
          <Twinkle size={13} color={C.white} delay={700} style={{top: 238, right: 22}} />
          <Twinkle size={15} color={C.ink} delay={1200} style={{top: 330, left: 120}} />
          <Twinkle size={12} color={C.white} delay={500} style={{top: 300, left: 40}} />
          <View style={H.heroPill}><Icon name="sparkles" size={13} /><Text style={H.heroPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>SEU MOVIMENTO COMEÇA AQUI</Text></View>
          <Animated.View entering={ZoomIn.delay(450).springify().damping(7)} style={H.stickerPos}>
            <Float amplitude={3} rotate={8} duration={1800} style={H.sticker}><Text style={H.stickerText}>BORA!</Text></Float>
          </Animated.View>
          <AText entering={FadeInUp.delay(120).duration(420)} style={[H.heroTitle, narrow && {fontSize: 38, lineHeight: 38}]} accessibilityRole="header">VAI LÁ.{'\n'}FAZ VALER.</AText>
          <AText entering={FadeInUp.delay(220).duration(420)} style={H.heroSub}>Uma série de cada vez. O seu treino, ilustrado por Josperd.</AText>
          <View style={H.heroBottom}>
            <Animated.View entering={FadeInUp.delay(320).duration(420)} style={{width: narrow ? '58%' : '54%', paddingBottom: 4}}>
              <Pulse scale={1.035} duration={1300}><Btn icon="play" text={started ? 'CONTINUAR' : 'COMEÇAR'} label={started ? `Continuar treino ${next}` : `Começar treino ${next}`} onPress={() => onStart(next)} /></Pulse>
              <Text style={H.heroNote}>TREINO {next}{started ? ` · ${pn.percent}% hoje` : ''}</Text>
            </Animated.View>
            <Float amplitude={5} rotate={5} style={[H.poster, narrow && {width: 132, height: 184, right: -26}]}>
              <Image source={hero} resizeMode="contain" style={{width: '100%', height: '100%'}} accessibilityLabel={`Ilustração de ${personaShort(state.persona)}`} />
            </Float>
          </View>
        </Card>
      </Animated.View>

      <SectionTitle over="Sua companhia" title="Escolha o personagem" delay={80} />
      <Animated.View entering={FadeInDown.delay(140).duration(360)}><PersonaPicker /></Animated.View>

      <View style={H.stats}>
        {stats.map(([n, label], i) => (
          <Animated.View key={label} entering={FadeInDown.delay(200 + i * 70).duration(360)} style={{flex: 1}}>
            <Card offset={3} style={{paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center'}}>
              <CountUp value={n} style={H.statBig} />
              <Text style={H.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
            </Card>
          </Animated.View>
        ))}
      </View>

      <SectionTitle over="Dupla da semana" title="Escolha seu treino" delay={260} />
      {(['A', 'B'] as const).map((t, i) => {
        const p = t === 'A' ? pA : pB;
        return (
          <Animated.View key={t} entering={FadeInDown.delay(300 + i * 110).duration(420)} style={{marginBottom: 12}}>
            <Pop accessibilityRole="button" accessibilityLabel={`Abrir treino ${t}`} onPress={() => onOpenTreino(t)} color={TONE[t]} radius={R.xl} offset={6} innerStyle={H.tile}>
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
            </Pop>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const H = StyleSheet.create({
  scroll: {padding: 20, paddingBottom: 170},
  heroPill: {alignSelf: 'flex-start', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: C.ink},
  heroPillText: {fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.ink},
  stickerPos: {position: 'absolute', top: 70, right: 14, zIndex: 3},
  sticker: {backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 2, borderColor: C.ink},
  stickerText: {fontSize: 17, fontWeight: '900', color: C.ink, letterSpacing: 1},
  heroTitle: {fontSize: 48, fontWeight: '900', letterSpacing: -1, color: C.ink, lineHeight: 46, marginTop: 18},
  heroSub: {fontSize: 14, lineHeight: 21, color: 'rgba(20,27,52,.82)', fontWeight: '500', marginTop: 12, maxWidth: '78%'},
  heroBottom: {marginTop: 14, minHeight: 200, justifyContent: 'flex-end'},
  heroNote: {fontSize: 11, fontWeight: '800', color: 'rgba(20,27,52,.7)', marginTop: 8, textAlign: 'center'},
  poster: {position: 'absolute', right: -34, bottom: -32, width: 168, height: 232, backgroundColor: C.card, borderRadius: 16, padding: 5, borderWidth: 2, borderColor: C.ink},
  stats: {flexDirection: 'row', gap: 6, marginTop: 14},
  statBig: {fontSize: 34, fontWeight: '900', color: C.ink, letterSpacing: 0},
  statLabel: {fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 0},
  tile: {padding: 20, minHeight: 232, justifyContent: 'center'},
  tileOver: {fontSize: 12, fontWeight: '800', letterSpacing: 1.3, color: C.ink},
  tileBig: {fontSize: 38, fontWeight: '900', letterSpacing: 0, color: C.ink, marginTop: 8, lineHeight: 44},
  tileSub: {fontSize: 15, color: 'rgba(20,27,52,.82)', fontWeight: '500', marginTop: 6},
  tileFoot: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap'},
  tileLink: {fontSize: 13, fontWeight: '800', letterSpacing: 1, color: C.ink},
  tileChip: {backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6, borderWidth: 2, borderColor: C.ink},
  tileChipText: {fontSize: 11, fontWeight: '800', color: C.ink, letterSpacing: 0.6},
  tileArt: {position: 'absolute', right: -28, bottom: -30, width: 156, height: 236, backgroundColor: C.card, borderRadius: 16, padding: 5, borderWidth: 2, borderColor: C.ink},
});
