import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, Image, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Canvas, Picture, createPicture, type SkImage, type SkPicture} from '@shopify/react-native-skia';
import Animated, {Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {LinearGradient} from 'expo-linear-gradient';
import {Text} from '../../text';
import {Icon} from '../../ui';
import type {Control, Hero} from '../save';
import {loadSprites} from '../render/assets';
import {loadMenuImages, type MenuImages} from './assets';
import {MOTION_MS, choiceOf, clamp, releaseTarget, stageRect, tapTarget, targetOf, tweenAt, type Choice, type Tween} from './pose';
import {drawMenu} from './scene';
import {pickLoadingStyle, type LoadingStyle} from './loadingStyle';

export type SelectMenuProps = {
  /** Último personagem usado (já vem escolhido se o jogador já jogou antes). */
  hero: Hero;
  /** Primeira vez: começa na tela neutra, sem ninguém escolhido. */
  first: boolean;
  control: Control;
  best: Record<Hero, number>;
  haptics: boolean;
  onPlay: (hero: Hero) => void;
  /** Toca no PRESS START (antes do carregando): o jogo usa para o som da fita carregando. */
  onPress?: () => void;
  onClose: () => void;
  onControl: (c: Control) => void;
  /** Som do jogo ligado (efeitos ou trilha) e o botão que liga/desliga os dois. Desligado por padrão. */
  sound: boolean;
  onSound: (on: boolean) => void;
};

const PRESS_MS = 760; // pisca + pixels se espalhando antes do carregando
const LUNGE_MS = 360; // o personagem avança para a tela antes do carregando
const LOAD_BG: Record<Choice, number> = {josperd: require('../../../assets/arcade/menu/bg_josperd.webp'), camila: require('../../../assets/arcade/menu/bg_camila.webp')};
const LOAD_HERO: Record<Choice, number> = {josperd: require('../../../assets/arcade/menu/hero_josperd.webp'), camila: require('../../../assets/arcade/menu/hero_camila.webp')};
const ACCENT_HEX: Record<Choice, string> = {josperd: '#ff4dc4', camila: '#4fe6ff'};
const NAMES: Record<Choice, string> = {josperd: 'JOSPERD', camila: 'CAMILA'};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const NO_IMAGES = {} as MenuImages;
const MIN_LOADING_MS = 2000; // dá tempo de ver a tela de carregamento (e é o piso do carregamento de verdade)

export default function SelectMenu(p: SelectMenuProps) {
  const win = useWindowDimensions();
  const [size, setSize] = useState<{w: number; h: number} | null>(null);
  const [images, setImages] = useState<MenuImages>(NO_IMAGES);
  const [choice, setChoice] = useState<Choice | null>(null) // sempre abre no centro: quem joga escolhe (nada vem pré-selecionado);
  const [phase, setPhase] = useState<'select' | 'flash' | 'loading'>('select');
  const reduce = useReducedMotion();
  const props = useRef(p);
  props.current = p;

  // Estado da animação (fora do React: o laço de quadros lê direto).
  const st = useRef({
    t: 0,
    tween: null as Tween | null,
    drag: null as {t0: number; x0: number; y0: number; at: number} | null,
    opened: now(),
    glintAt: -1,
    lungeAt: -1,
    pressAt: -1,
    loadAt: -1,
    sprites: null as (SkImage | null)[] | null,
  });

  const blank = useMemo(() => createPicture(() => {}, {width: 1, height: 1}), []);
  const picture = useSharedValue<SkPicture>(blank);
  const retired = useRef<SkPicture[]>([]);
  const publish = useCallback((next: SkPicture) => {
    const prev = picture.value;
    picture.value = next;
    retired.current.push(prev);
    while (retired.current.length > 2) { try { retired.current.shift()?.dispose(); } catch { /* já liberado */ } }
  }, [picture]);
  useEffect(() => () => { for (const old of retired.current.splice(0)) { try { old.dispose(); } catch { /* já liberado */ } } }, []);

  useEffect(() => {
    let alive = true;
    loadMenuImages().then((i) => { if (alive) setImages(i); }).catch(() => {});
    loadSprites().catch(() => {}); // pré-carrega os sprites do jogo enquanto o jogador escolhe
    return () => { alive = false; };
  }, []);

  /* ---------- escolher ---------- */
  const goTo = useCallback((target: number, fromT?: number) => {
    const s = st.current;
    const from = fromT ?? s.t;
    const dur = reduce ? 0 : MOTION_MS;
    if (Math.abs(from - target) < 1e-6) { s.t = target; s.tween = null; s.drag = null; return; }
    const before = choiceOf(s.tween ? s.tween.to : s.t);
    s.tween = {from, to: target, start: now(), dur};
    s.drag = null;
    const c = choiceOf(target);
    if (c && c !== before) {
      s.glintAt = now();
      if (props.current.haptics && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setChoice(c);
  }, [reduce]);
  const choose = useCallback((c: Choice) => { if (choiceOfNow() !== c) goTo(targetOf(c)); }, [goTo]);
  const choiceOfNow = () => {
    const s = st.current;
    return choiceOf(s.tween ? s.tween.to : s.t);
  };
  const swap = () => choose(choiceOfNow() === 'josperd' ? 'camila' : 'josperd');

  /* ---------- deslizar com o dedo (acompanha o toque) ---------- */
  // O PanResponder guarda a primeira versão dos closures: o que ele precisa vem de refs.
  const goToRef = useRef(goTo); goToRef.current = goTo;
  const winRef = useRef(win); winRef.current = win;
  const pan = useRef(
    PanResponder.create({
      // Os botões (fechar, controle, setas, JOGAR) são irmãos por cima e ficam com os toques deles;
      // o resto da tela é deste responder: arrastar acompanha o dedo, toque curto escolhe o lado.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const s = st.current;
        s.drag = {t0: s.tween ? tweenAt(s.tween, now()) : s.t, x0: e.nativeEvent.locationX ?? e.nativeEvent.pageX, y0: e.nativeEvent.locationY ?? e.nativeEvent.pageY, at: now()};
        s.tween = null;
      },
      onPanResponderMove: (_e, g) => {
        const s = st.current;
        if (!s.drag || Math.abs(g.dx) < 8) return; // dedo parado ou toque: ainda não é arrasto
        const stage = stageRect(winRef.current.width, winRef.current.height);
        s.t = clamp(s.drag.t0 - g.dx / (stage.w * 0.55), -1, 1);
      },
      onPanResponderRelease: (_e, g) => {
        const s = st.current;
        const d = s.drag;
        if (!d) return;
        const stage = stageRect(winRef.current.width, winRef.current.height);
        const tap = Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10 && now() - d.at < 600;
        if (tap) {
          const fy = d.y0 / stage.h;
          s.t = d.t0;
          if (fy > 0.14 && fy < 0.8) goToRef.current(tapTarget(d.x0, stage), d.t0); // as zonas do protótipo: miolo da tela
          else goToRef.current(d.t0, d.t0);
        } else goToRef.current(releaseTarget(d.t0, s.t, g.dx), s.t);
      },
      onPanResponderTerminate: () => { const s = st.current; if (s.drag) goToRef.current(s.drag.t0, s.t); },
    }),
  ).current;

  /* ---------- laço de quadros ---------- */
  useEffect(() => {
    if (!size) return;
    let raf = 0;
    let active = true;
    const stage = stageRect(size.w, size.h);
    const rect = {width: size.w, height: size.h};
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = st.current;
      const t0 = now();
      if (s.tween) { s.t = tweenAt(s.tween, t0); if (t0 - s.tween.start >= s.tween.dur) { s.t = s.tween.to; s.tween = null; } }
      const sec = (t0 - s.opened) / 1000;
      const intro = reduce ? 1 : clamp(sec / 0.9, 0, 1);
      const glint = s.glintAt < 0 || reduce ? -1 : (t0 - s.glintAt) / 670;
      const load = s.loadAt < 0 ? undefined : (() => {
        const el = (t0 - s.loadAt) / 1000, u = clamp((el * 1000) / MIN_LOADING_MS, 0, 1);
        return {hero: (s.t < 0 ? 'josperd' : 'camila') as Choice, time: el, progress: u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, sprites: s.sprites};
      })();
      publish(createPicture((canvas) => {
        drawMenu(canvas, {t: s.t, time: reduce ? 0 : sec, intro: 1 - Math.pow(1 - intro, 3), glint, lunge: s.lungeAt < 0 ? 0 : (t0 - s.lungeAt) / LUNGE_MS, press: s.pressAt < 0 ? undefined : (t0 - s.pressAt) / 1000, W: size.w, H: size.h, stage, images, still: !!reduce, load});
      }, rect));
    };
    raf = requestAnimationFrame(tick);
    const sub = AppState.addEventListener('change', (a) => {
      if (a !== 'active') { active = false; cancelAnimationFrame(raf); } else if (!active) { active = true; raf = requestAnimationFrame(tick); }
    });
    return () => { cancelAnimationFrame(raf); sub.remove(); };
  }, [size, images, reduce, publish]);

  /* ---------- jogar: clarão → carregando → começa ---------- */
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({opacity: flash.value}));
  // Carregando "clássico" (ilustrado): barra, personagem que entra e logo que pulsa.
  const [loadStyle, setLoadStyle] = useState<LoadingStyle>('pixel');
  const meter = useSharedValue(0);
  const pulse = useSharedValue(0);
  const meterStyle = useAnimatedStyle(() => ({width: `${meter.value * 100}%`}));
  const heroStyle = useAnimatedStyle(() => {
    const e = Math.min(1, meter.value * 5);
    return {transform: [{translateY: (1 - e) * 60}, {scale: 0.86 + 0.14 * e + 0.07 * meter.value}], opacity: Math.min(1, e * 1.6)};
  });
  const logoStyle = useAnimatedStyle(() => ({transform: [{scale: 0.97 + 0.07 * pulse.value}]}));
  const startedRef = useRef(false);
  const play = useCallback(() => {
    const c = choiceOfNow();
    if (!c || startedRef.current) return;
    startedRef.current = true;
    props.current.onPress?.();
    if (props.current.haptics && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase('flash');
    const lunge = reduce ? 0 : PRESS_MS;
    st.current.lungeAt = reduce ? -1 : now();
    st.current.pressAt = reduce ? -1 : now();
    flash.value = withDelay(Math.max(0, lunge - 110), withSequence(withTiming(1, {duration: 110}), withTiming(0, {duration: 220})));
    const t0 = now();
    setTimeout(() => {
      // 15 % das vezes aparece o carregando clássico; o resto é o de pixels. (Os testes podem forçar um dos dois.)
      const forced = (globalThis as {__MODO_LOADING_STYLE__?: LoadingStyle}).__MODO_LOADING_STYLE__;
      const style = forced ?? pickLoadingStyle(Math.random());
      setLoadStyle(style);
      if (style === 'pixel') st.current.loadAt = now();
      else {
        meter.value = withTiming(1, {duration: MIN_LOADING_MS, easing: Easing.inOut(Easing.quad)});
        pulse.value = withRepeat(withTiming(1, {duration: 700, easing: Easing.inOut(Easing.sin)}), -1, true);
      }
      setPhase('loading');
      loadSprites().then((sp) => { st.current.sprites = sp[c]; }).catch(() => {});
      // O "carregando" é de verdade: espera os sprites do jogo, e nunca menos que o tempo da animação.
      Promise.race([loadSprites(), new Promise((r) => setTimeout(r, 6000))]).catch(() => {}).then(() => {
        setTimeout(() => props.current.onPlay(c), Math.max(0, MIN_LOADING_MS - (now() - t0 - lunge - 60)));
      });
    }, lunge + 60);
  }, [flash, meter, pulse, reduce]);

  // Teclado (web/desktop).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { e.preventDefault(); choose('josperd'); }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); choose('camila'); }
      else if ((k === 'enter' || k === ' ') && !e.repeat) { e.preventDefault(); play(); }
      else if (k === 'escape') props.current.onClose();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [choose, play]);

  /* ---------- botão JOGAR entra/sai ---------- */
  const stage = size ? stageRect(size.w, size.h) : stageRect(win.width, win.height);
  const zoneTop = stage.h * 0.17, zoneH = stage.h * 0.61;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => { const {width, height} = e.nativeEvent.layout; if (width > 0 && height > 0) setSize({w: width, h: height}); }}
      {...pan.panHandlers}
      accessibilityRole="radiogroup"
      accessibilityLabel="Escolha seu personagem"
      testID="arcade-menu"
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none"><Picture picture={picture} /></Canvas>

      {/* Para leitores de tela: dois "rádios" invisíveis (o toque de verdade é tratado pelo responder da tela). */}
      {(['josperd', 'camila'] as Choice[]).map((c) => (
        <View
          key={c}
          accessible
          accessibilityRole="radio"
          accessibilityState={{checked: choice === c}}
          aria-checked={choice === c}
          accessibilityLabel={`${NAMES[c]}. Recorde ${p.best[c]} pontos`}
          accessibilityActions={[{name: 'activate'}]}
          onAccessibilityAction={() => choose(c)}
          onAccessibilityTap={() => choose(c)}
          testID={`arcade-hero-${c}`}
          pointerEvents="none"
          style={{position: 'absolute', top: stage.y + stage.h * 0.17, height: stage.h * 0.61, width: stage.w / 2, left: stage.x + (c === 'josperd' ? 0 : stage.w / 2)}}
        />
      ))}

      {/* Botão de setas no centro (a arte fica no canvas; aqui só o toque). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alternar personagem"
        onPress={swap}
        testID="arcade-swap"
        style={{position: 'absolute', width: stage.w * 0.16, height: stage.w * 0.16, left: stage.x + stage.w * (0.5 - (choice === 'josperd' ? 1 : choice === 'camila' ? -1 : 0) * 0.07) - stage.w * 0.08, top: stage.y + stage.h * 0.62 - stage.w * 0.08}}
      />

      {/* Topo: sair e controle */}
      {phase !== 'loading' && <View pointerEvents="box-none" style={[S.top, {left: stage.x + 12, right: size ? size.w - stage.x - stage.w + 12 : 12}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar o fliperama" onPress={p.onClose} style={S.round} testID="arcade-close"><Icon name="close" size={22} color="#fff" /></Pressable>
        <View style={{flexDirection: 'row', gap: 8}}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.control === 'touch' ? 'Controle por toque. Tocar para usar a inclinação' : 'Controle por inclinação. Tocar para usar o toque'}
            onPress={() => p.onControl(p.control === 'touch' ? 'tilt' : 'touch')}
            style={S.ctrl}
            testID="arcade-control"
          >
            <Icon name={p.control === 'touch' ? 'hand-left-outline' : 'phone-portrait-outline'} size={16} color="#fff" />
            <Text style={S.ctrlT}>{p.control === 'touch' ? 'TOQUE' : 'INCLINAR'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.sound ? 'Som ligado. Tocar para desligar' : 'Som desligado. Tocar para ligar'}
            accessibilityState={{selected: p.sound}}
            onPress={() => p.onSound(!p.sound)}
            style={S.round}
            testID="arcade-sound"
          >
            <Icon name={p.sound ? 'volume-high' : 'volume-mute'} size={20} color="#fff" />
          </Pressable>
        </View>
      </View>}

      {/* Rodapé: o PRESS START é desenhado em pixels no canvas; aqui só a área de toque e o aviso para leitor de tela. */}
      {/* Sem texto na tela: só o aviso para leitores de tela (a dica de deslizar fica na arte). */}
      <View accessibilityLiveRegion="polite" accessibilityLabel={choice ? `${NAMES[choice]} selecionado` : ''} testID="arcade-indicator" style={{height: 0, width: 0}} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={choice ? `Jogar com ${NAMES[choice]}. Recorde ${p.best[choice]} pontos` : 'Escolha seu personagem'}
        disabled={!choice || phase !== 'select'}
        onPress={play}
        testID="arcade-play"
        style={{position: 'absolute', left: stage.x + stage.w * 0.08, width: stage.w * 0.84, top: stage.y + stage.h * 0.875, height: stage.h * 0.1}}
      />

      {/* Clarão + carregando (a tela de carregamento em pixels é desenhada no canvas) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: '#fff'}, flashStyle]} />
      {phase === 'loading' && loadStyle === 'pixel' && <View style={StyleSheet.absoluteFill} testID="arcade-loading" accessibilityLabel="Carregando o jogo" accessibilityLiveRegion="polite" />}
      {phase === 'loading' && loadStyle === 'classic' && (
        <View style={[StyleSheet.absoluteFill, S.loading]} testID="arcade-loading" accessibilityLabel="Carregando o jogo" accessibilityLiveRegion="polite">
          <Image source={LOAD_BG[choice ?? 'josperd']} resizeMode="stretch" style={[StyleSheet.absoluteFill, {opacity: 0.55}]} />
          <LinearGradient colors={['rgba(9,3,36,.92)', 'rgba(9,3,36,.35)', 'rgba(4,2,20,.95)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <Animated.View style={[{position: 'absolute', bottom: 0, left: stage.x, width: stage.w, aspectRatio: 1024 / 1536}, heroStyle]} pointerEvents="none">
            <Image source={LOAD_HERO[choice ?? 'josperd']} resizeMode="contain" style={{width: '100%', height: '100%', resizeMode: 'contain'}} />
          </Animated.View>
          <LinearGradient colors={['rgba(4,2,20,0)', 'rgba(4,2,20,.9)']} style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%'}} pointerEvents="none" />
          <Animated.View style={[{position: 'absolute', top: stage.y + stage.h * 0.06, width: '86%', aspectRatio: 1518 / 1043}, logoStyle]}>
            <Image source={require('../../../assets/arcade/menu/logo.webp')} resizeMode="contain" style={{width: '100%', height: '100%', resizeMode: 'contain'}} accessibilityLabel="NEON STEP DX" />
          </Animated.View>
          <View style={{position: 'absolute', bottom: stage.y + stage.h * 0.07, width: '100%', alignItems: 'center'}}>
            <Text style={[S.loadT, {textShadowColor: ACCENT_HEX[choice ?? 'josperd']}]}>CARREGANDO…</Text>
            <View style={S.meter}>
              <Animated.View style={[S.meterFill, meterStyle]} />
              <View style={S.meterCuts} pointerEvents="none">{Array.from({length: 15}, (_, i) => <View key={i} style={S.meterCut} />)}</View>
            </View>
            <Text style={S.loadS}>{NAMES[choice ?? 'josperd']} ★ PREPARE O SALTO</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  loading: {alignItems: 'center', justifyContent: 'center', zIndex: 10, backgroundColor: '#05021a'},
  loadT: {fontSize: 16, fontWeight: '900', letterSpacing: 5, color: '#fff', textShadowRadius: 14, textShadowOffset: {width: 0, height: 0}},
  loadS: {fontSize: 10, fontWeight: '800', letterSpacing: 2.4, color: 'rgba(226,228,251,.85)', marginTop: 10},
  meter: {height: 14, width: '70%', marginTop: 14, backgroundColor: 'rgba(5,6,36,.8)', borderWidth: 2, borderColor: '#40dffd', overflow: 'hidden', borderRadius: 3},
  meterFill: {height: '100%', backgroundColor: '#ff4fd8'},
  meterCuts: {...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-evenly'},
  meterCut: {width: 3, height: '100%', backgroundColor: '#050624'},
  top: {position: 'absolute', top: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  round: {width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(3,6,28,.72)', borderWidth: 1, borderColor: 'rgba(147,230,255,.45)', alignItems: 'center', justifyContent: 'center'},
  ctrl: {flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: 'rgba(3,6,28,.72)', borderWidth: 1, borderColor: 'rgba(147,230,255,.45)'},
  ctrlT: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: '#fff'},
});
