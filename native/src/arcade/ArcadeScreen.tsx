import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, BackHandler, Platform, StyleSheet, View} from 'react-native';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import {Text} from '../text';
import {C, R} from '../theme';
import {Btn, Card, Chips, Icon, Pattern, Press, Switch} from '../ui';
import {Flower, Star} from '../glyphs';
import {useArcade, updateArcade} from './arcadeStore';
import {useMusic} from '../music/MusicProvider';
import GameHost from './GameHost';
import MenuHost from './MenuHost';
import {Session, type Hud} from './session.ts';
import {step as simStep} from './core/sim.ts';
import {recordRun, type Hero} from './save';
import type {SimEvent} from './core/types.ts';
import {ArcadeAudio} from './audio/engine';
import {cuesFor, lavaClose, musicFor, stingerFor} from './audio/plan.ts';

const NEON = {pink: '#ff4dac', cyan: '#49e6ff', bg: '#140a24', bg2: '#251438', glass: 'rgba(16,9,31,.72)'};
const HEROES: {id: Hero; name: string}[] = [{id: 'josperd', name: 'JOSPERD'}, {id: 'camila', name: 'CAMILA'}];

type Phase = 'select' | 'play' | 'pause' | 'over';

function newSeed(): number {
  const forced = (globalThis as any).__MODO_ARCADE_SEED__;
  if (typeof forced === 'number') return forced >>> 0;
  return ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
}

const pad = (n: number, w = 4) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

export default function ArcadeScreen({onClose}: {onClose: () => void}) {
  const {save, loaded} = useArcade();
  const [phase, setPhase] = useState<Phase>('select');
  const [hud, setHud] = useState<Hud | null>(null);
  const [cause, setCause] = useState<'fall' | 'damage' | 'crush'>('fall');
  const [hint, setHint] = useState(true);
  const [newRecord, setNewRecord] = useState(false);
  const [perf, setPerf] = useState('');
  const session = useRef<Session | null>(null);
  const hero = save.settings.hero;
  const userMusic = useMusic();
  const userMusicRef = useRef(userMusic);
  userMusicRef.current = userMusic;
  const pausedUserMusic = useRef(false);
  const audio = useRef<ArcadeAudio | null>(null);
  const getAudio = () => (audio.current ??= new ArcadeAudio());
  const set = (patch: Partial<typeof save.settings>) => updateArcade((s) => ({...s, settings: {...s.settings, ...patch}}));

  const start = useCallback((who?: Hero) => {
    const w = who ?? hero;
    const s = new Session(newSeed(), 690, save.best[w]);
    s.bestMeters = save.bestMeters[w];
    session.current = s;
    // Gancho só para testes de interface (ativo quando o teste fixa a semente).
    if (typeof (globalThis as any).__MODO_ARCADE_SEED__ === 'number') {
      (globalThis as any).__MODO_ARCADE_SESSION__ = s;
      (globalThis as any).__MODO_ARCADE_STEP__ = (axis: number) => simStep(s.sim, {axis});
    }
    audio.current?.ui('ui_start');
    setHud(s.hud());
    setHint(true);
    setNewRecord(false);
    setPhase('play');
  }, [hero, save.best, save.bestMeters]);

  const pause = useCallback(() => {
    if (session.current && !session.current.over) { session.current.pause(); audio.current?.ui('ui_pause'); setPhase('pause'); }
  }, []);
  const resume = useCallback(() => { session.current?.resume(); setPhase('play'); }, []);
  const toggleSound = useCallback((on: boolean) => { updateArcade((s) => ({...s, settings: {...s.settings, sfx: on, music: on}})); }, []);

  // Voltar do Android: jogando → pausa; pausa/fim → seleção; seleção → sai.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'play') pause();
      else if (phase === 'pause' || phase === 'over') setPhase('select');
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [phase, pause, onClose]);

  // Saiu do app ou bloqueou a tela: pausa sozinho.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') pause(); });
    return () => sub.remove();
  }, [pause]);

  useEffect(() => {
    if (phase !== 'play') return;
    activateKeepAwakeAsync('modo-arcade').catch(() => {});
    return () => { deactivateKeepAwake('modo-arcade').catch(() => {}); };
  }, [phase]);

  // Som (opt-in): liga/desliga conforme os ajustes; sai calado junto com a tela.
  useEffect(() => {
    if (!loaded) return;
    if (!save.settings.sfx && !save.settings.music && !audio.current) return;
    getAudio().configure(save.settings.sfx, save.settings.music);
  }, [loaded, save.settings.sfx, save.settings.music]);
  useEffect(() => { audio.current?.setVolume(save.settings.volume); }, [save.settings.volume, save.settings.sfx, save.settings.music]);
  // Com a trilha do jogo ligada, a música do próprio app (fita/rádio) é pausada uma vez, para não tocarem juntas. Não volta sozinha.
  useEffect(() => {
    if (!save.settings.music || pausedUserMusic.current) return;
    pausedUserMusic.current = true;
    try { if (userMusicRef.current.playing) userMusicRef.current.playPause(); } catch { /* sem problema */ }
  }, [save.settings.music]);
  useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);

  // Trilha da parte do jogo (menu, cada mundo, bônus) e aviso da lava.
  useEffect(() => {
    if (!audio.current) return;
    if (phase === 'pause') { audio.current.pause(); return; }
    audio.current.resume();
    if (phase !== 'play') { audio.current.setMusic(phase === 'select' ? 'menu' : null); return; }
    const tick = () => {
      const s = session.current;
      if (!s || !audio.current) return;
      const m = s.sim;
      audio.current.setMusic(musicFor({phase: 'play', world: m.world, y: m.player.y, bonusY0: m.bonusY0, bonusY1: m.bonusY1}));
      if (lavaClose(m.world, m.player.y, m.lava)) audio.current.play([{id: 'lava_warn', gain: 0.8}]);
    };
    tick();
    const id = setInterval(tick, 350);
    return () => clearInterval(id);
  }, [phase, save.settings.sfx, save.settings.music]);

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setTimeout(() => setHint(false), 3800);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!save.settings.perf || (phase !== 'play' && phase !== 'pause')) { setPerf(''); return; }
    const id = setInterval(() => {
      const p = session.current?.perfSummary();
      if (p && p.samples) setPerf(`${p.fps} fps · quadro p50 ${p.p50} p95 ${p.p95} p99 ${p.p99} ms · lentos ${p.slow}/${p.samples} · passo ${p.stepMs} ms · desenho ${p.drawMs} ms`);
    }, 500);
    return () => clearInterval(id);
  }, [save.settings.perf, phase]);

  const onEvents = useCallback((events: SimEvent[]) => {
    for (const e of events) {
      if (e.t === 'over') setCause(e.cause);
      audio.current?.play(cuesFor(e));
      if (!save.settings.haptics || Platform.OS === 'web') continue;
      if (e.t === 'collect' || e.t === 'pickup' || e.t === 'kill') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      else if (e.t === 'hit' && !e.blocked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      else if (e.t === 'portal' || e.t === 'revive') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else if (e.t === 'over') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [save.settings.haptics]);

  const onOver = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const r = recordRun(save, {hero, score: s.sim.score, meters: Math.floor((s.sim.maxY - 90) / 10)});
    updateArcade(() => r.save);
    setNewRecord(r.record);
    setPhase('over');
    const a = audio.current;
    if (a) setTimeout(() => a.play([{id: stingerFor(r.record), gain: 0.9}]), 650);
  }, [save, hero]);

  const info = HEROES.find((h) => h.id === hero)!;
  const playing = phase === 'play' || phase === 'pause' || phase === 'over'; // no fim, o último quadro fica atrás do cartão

  return (
    <View style={S.root} testID="arcade-root">
      <Pattern kind="grid" color="#FFFFFF" opacity={0.05} size={28} />
      {playing && session.current && (
        <GameHost
          session={session.current}
          hero={hero}
          running={phase === 'play'}
          control={save.settings.control}
          tiltInvert={save.settings.tiltInvert}
          onHud={setHud}
          onEvents={onEvents}
          onOver={onOver}
          onPauseKey={() => (phase === 'play' ? pause() : resume())}
        />
      )}

      {phase === 'play' && hud && (
        <View pointerEvents="box-none" style={S.hudWrap}>
          <View style={S.hudTop} pointerEvents="box-none">
            <View style={S.scoreWrap} pointerEvents="none">
              <View style={S.scoreShadow} />
              <View style={S.score}>
                <Pattern kind="dots" color={NEON.pink} opacity={0.35} size={12} />
                <View style={S.scoreRow}>
                  <View style={S.badge}>{hero === 'josperd' ? <Star size={22} fill={C.yellow} /> : <Flower size={24} petal={NEON.cyan} />}</View>
                  <View>
                    <Text style={S.kick}>PONTOS</Text>
                    <Text style={S.scoreN} testID="arcade-score">{pad(hud.score)}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={S.side} pointerEvents="none">
              <Pattern kind="stripes" color="#FFFFFF" opacity={0.08} size={14} />
              <Text style={S.kick}>RECORDE <Text style={S.sideN}>{pad(hud.best)}</Text></Text>
              <Text style={S.kick}>FITAS <Text style={S.sideN}>{pad(hud.tapes, 2)}</Text>  ·  <Text style={S.sideN}>{hud.meters} m</Text></Text>
            </View>
            <Press accessibilityRole="button" accessibilityLabel="Pausar" onPress={pause} haptic={false} quiet style={S.pauseBtn} testID="arcade-pause">
              <Icon name="pause" size={20} color={C.white} />
            </Press>
          </View>
          <View style={S.strip} pointerEvents="none">
            {hud.combo > 1 && <View style={[S.pill, {backgroundColor: C.yellow, borderColor: C.ink}]}><Text style={[S.stripT, {color: C.ink, textShadowRadius: 0}]}>COMBO x{hud.combo}</Text></View>}
          </View>
          {hint && (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(400)} style={S.hint} pointerEvents="none">
              <Icon name="chevron-back" size={22} color={C.white} />
              <Text style={S.hintT}>{save.settings.control === 'tilt' ? 'INCLINE · TOQUE NO BOTÃO ATIRA' : 'SEGURE OS LADOS · BOTÃO ATIRA'}</Text>
              <Icon name="chevron-forward" size={22} color={C.white} />
            </Animated.View>
          )}
        </View>
      )}
      {!!perf && <View style={S.perf} pointerEvents="none"><Text style={S.perfT}>{perf}</Text></View>}

      {phase === 'select' && loaded && (
        <MenuHost
          hero={hero}
          first={save.plays === 0}
          control={save.settings.control}
          best={save.best}
          haptics={save.settings.haptics}
          onPlay={(h) => { set({hero: h}); start(h); }}
          onPress={() => audio.current?.ui('tape_load')}
          onClose={onClose}
          onControl={(c) => set({control: c})}
          sound={save.settings.sfx || save.settings.music}
          onSound={toggleSound}
        />
      )}

      {phase === 'pause' && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={S.modal}>
          <Card color={NEON.bg2} shadowColor={NEON.pink} outer={{width: '100%', maxWidth: 420}} pattern={<Pattern kind="dots" color={NEON.pink} opacity={0.14} size={14} />}>
            <Text style={S.modalT}>PAUSA</Text>
            <Text style={S.modalS}>Seu recorde está esperando.</Text>
            <Btn text="CONTINUAR" icon="play" onPress={resume} style={{marginTop: 12}} />
            <View style={S.settings}>
              <Chips options={['touch', 'tilt'] as const} value={save.settings.control} onChange={(v) => set({control: v})} format={(v) => (v === 'touch' ? 'TOQUE' : 'INCLINAR')} label={(v) => (v === 'touch' ? 'Controle por toque' : 'Controle por inclinação')} />
              {save.settings.control === 'tilt' && <Switch value={save.settings.tiltInvert} onChange={(v) => set({tiltInvert: v})} title="Inverter a inclinação" desc="Use se o personagem andar para o lado contrário." />}
              <Switch value={save.settings.sfx} onChange={(v) => set({sfx: v})} title="Efeitos sonoros" desc="Desligados por padrão. Sons originais feitos por código." />
              <Switch value={save.settings.music} onChange={(v) => set({music: v})} title="Trilha do jogo" desc="Uma faixa para cada parte. Desligada por padrão." />
              {(save.settings.sfx || save.settings.music) && (
                <Chips options={[1, 2, 3] as const} value={save.settings.volume} onChange={(v) => set({volume: v})} format={(v) => (v === 1 ? 'BAIXO' : v === 2 ? 'MÉDIO' : 'ALTO')} label={(v) => `Volume do som: ${v === 1 ? 'baixo' : v === 2 ? 'médio' : 'alto'}`} />
              )}
              <Switch value={save.settings.haptics} onChange={(v) => set({haptics: v})} title="Vibração leve" desc="Desligada por padrão." />
              <Switch value={save.settings.perf} onChange={(v) => set({perf: v})} title="Medidor de desempenho" desc="Mostra FPS e tempo de quadro na tela." />
            </View>
            <View style={{gap: 8, marginTop: 10}}>
              <Btn kind="ghost" small icon="refresh" text="RECOMEÇAR" onPress={() => start()} />
              <Btn kind="ghost" small icon="people" text="TROCAR PERSONAGEM" onPress={() => setPhase('select')} />
              <Btn kind="danger" small icon="exit-outline" text="SAIR DO FLIPERAMA" onPress={onClose} />
            </View>
          </Card>
        </Animated.View>
      )}

      {phase === 'over' && hud && (
        <Animated.View entering={FadeIn.duration(220)} style={S.modal}>
          <Card color={NEON.bg2} shadowColor={NEON.pink} outer={{width: '100%', maxWidth: 420}} pattern={<Pattern kind="dots" color={NEON.pink} opacity={0.14} size={14} />}>
            <Text style={S.modalT}>FIM DE JOGO</Text>
            {newRecord && <Text style={[S.modalS, {color: C.yellow, marginTop: 2}]}>★ NOVO RECORDE ★</Text>}
            <Text style={S.final} testID="arcade-final">{pad(hud.score)}</Text>
            <Text style={S.modalS}>pontos · {hud.meters} m · {hud.tapes} fitas · {hud.kills} abates</Text>
            <Text style={[S.modalS, {marginTop: 2, color: cause === 'damage' || cause === 'crush' ? '#ff8aa3' : '#8fd4ff'}]} testID="arcade-cause">{cause === 'damage' ? 'Acabaram as vidas.' : cause === 'crush' ? 'O teto te alcançou.' : 'Você caiu.'}</Text>
            <Text style={[S.modalS, {marginTop: 2}]}>Recorde de {info.name}: {pad(save.best[hero])}</Text>
            <Btn text="JOGAR DE NOVO" icon="refresh" onPress={() => start()} style={{marginTop: 16}} />
            <View style={{gap: 8, marginTop: 10}}>
              <Btn kind="ghost" small icon="people" text="TROCAR PERSONAGEM" onPress={() => setPhase('select')} />
              <Btn kind="danger" small icon="exit-outline" text="SAIR DO FLIPERAMA" onPress={onClose} />
            </View>
          </Card>
        </Animated.View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject, backgroundColor: NEON.bg, zIndex: 50},
  hudWrap: {...StyleSheet.absoluteFillObject},
  hudTop: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, gap: 8},
  scoreWrap: {marginRight: 4, marginBottom: 4},
  scoreShadow: {position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, borderRadius: R.md, backgroundColor: NEON.pink},
  score: {backgroundColor: '#1a0f33', borderRadius: R.md, borderWidth: 2, borderColor: '#10091f', paddingHorizontal: 10, paddingVertical: 4, minWidth: 120, overflow: 'hidden'},
  scoreRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  badge: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#10091f', borderWidth: 2, borderColor: NEON.pink, alignItems: 'center', justifyContent: 'center'},
  pill: {backgroundColor: NEON.glass, borderRadius: R.pill, borderWidth: 2, borderColor: '#4A5580', paddingHorizontal: 10, paddingVertical: 3},
  scoreN: {fontSize: 30, fontWeight: '900', color: C.white, letterSpacing: 1, lineHeight: 32},
  kick: {fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#B7C1E3'},
  side: {overflow: 'hidden', flex: 1, backgroundColor: NEON.glass, borderRadius: R.md, borderWidth: 2, borderColor: '#4A5580', paddingHorizontal: 10, paddingVertical: 6, gap: 2},
  sideN: {color: C.white, fontWeight: '900'},
  pauseBtn: {width: 44, height: 44, borderRadius: 22, backgroundColor: NEON.glass, borderWidth: 2, borderColor: '#4A5580', alignItems: 'center', justifyContent: 'center'},
  strip: {flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8},
  stripT: {fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: '#D9DEF5', textShadowColor: '#000', textShadowRadius: 4},
  hint: {position: 'absolute', bottom: 124, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: NEON.glass, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 10},
  hintT: {fontSize: 12, fontWeight: '900', letterSpacing: 1.4, color: C.white},
  perf: {position: 'absolute', left: 8, right: 8, bottom: 6, backgroundColor: 'rgba(0,0,0,.7)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  perfT: {fontSize: 10, color: '#9DFFB0', fontWeight: '700'},
  modal: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,5,22,.82)', alignItems: 'center', justifyContent: 'center', padding: 20},
  settings: {marginTop: 14, backgroundColor: C.paper, borderRadius: R.md, borderWidth: 2, borderColor: C.ink, padding: 12},
  modalT: {fontSize: 34, fontWeight: '900', color: C.white, letterSpacing: 1, textAlign: 'center'},
  modalS: {fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: '#B7C1E3', textAlign: 'center'},
  final: {fontSize: 56, fontWeight: '900', color: C.yellow, textAlign: 'center', letterSpacing: 2, lineHeight: 60},
});

