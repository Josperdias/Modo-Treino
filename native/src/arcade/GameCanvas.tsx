import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {GestureResponderEvent, Platform, StyleSheet, View} from 'react-native';
import {Canvas, Picture, createPicture, type SkPicture} from '@shopify/react-native-skia';
import {useSharedValue} from 'react-native-reanimated';
import {Accelerometer} from 'expo-sensors';
import type {Session, Hud} from './session.ts';
import type {SimEvent} from './core/types.ts';
import type {Control, Hero} from './save';
import {Quality, recordDraw, type QLevel} from './perf.ts';
import {FIELD_W} from './data/neon.ts';
import {loadSprites, type SpriteSet} from './render/assets';
import {drawScene} from './render/scene';
import {inFireZone} from './render/layout.ts';

export type GameCanvasProps = {
  session: Session;
  hero: Hero;
  running: boolean;
  control: Control;
  tiltInvert: boolean;
  onHud: (h: Hud) => void;
  onEvents: (e: SimEvent[]) => void;
  onOver: () => void;
  /** Pedido de pausa vindo do teclado (web). */
  onPauseKey?: () => void;
  /** Modo leve escolhido pelo usuário: começa (e fica) no nível mínimo de desenho. */
  lite?: boolean;
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const EMPTY: SpriteSet = {josperd: [], camila: []};

/**
 * Eixo e tiro a partir dos dedos na tela: metade esquerda = -1, direita = +1, os dois lados = 0.
 * Um dedo dentro do botão de tiro (centro de baixo) atira e não move.
 */
function readTouches(e: GestureResponderEvent, w: number, h: number): {axis: number; fire: boolean} {
  const half = w / 2;
  let left = false;
  let right = false;
  let fire = false;
  for (const t of e.nativeEvent.touches || []) {
    const x = t.locationX ?? t.pageX;
    const y = t.locationY ?? t.pageY;
    if (inFireZone(x, y, w, h)) fire = true;
    else if (x < half) left = true;
    else right = true;
  }
  return {axis: (right ? 1 : 0) - (left ? 1 : 0), fire};
}

export default function GameCanvas(p: GameCanvasProps) {
  const [size, setSize] = useState<{w: number; h: number} | null>(null);
  const [sprites, setSprites] = useState<SpriteSet>(EMPTY);
  // Erro dentro do laço de quadros (fora do React): reenvia para o ErrorBoundary da tela em vez de derrubar o app.
  const [, setFatal] = useState(0);
  // Qualidade adaptativa: aparelho lento desenha mais simples, a 30 quadros/s e numa resolução menor (a simulação segue exata).
  const quality = useRef(new Quality(p.lite ? 2 : 0));
  const [qLevel, setQLevel] = useState<QLevel>(quality.current.level);
  useEffect(() => { quality.current.setFloor(p.lite ? 2 : 0); setQLevel(quality.current.level); }, [p.lite]);
  const blank = useMemo(() => createPicture(() => {}, {width: 1, height: 1}), []);
  const picture = useSharedValue<SkPicture>(blank);
  const props = useRef(p);
  props.current = p;
  // Cada quadro vira um Picture nativo; os antigos são liberados com 2 quadros de atraso (a UI
  // ainda pode estar desenhando o anterior) para a memória nativa não crescer até o GC do JS.
  const retired = useRef<SkPicture[]>([]);
  const publish = useCallback((next: SkPicture) => {
    const prev = picture.value;
    picture.value = next;
    retired.current.push(prev);
    while (retired.current.length > 2) { try { retired.current.shift()?.dispose(); } catch { /* já liberado */ } }
  }, [picture]);

  useEffect(() => {
    let alive = true;
    loadSprites().then((s) => { if (alive) setSprites(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { for (const old of retired.current.splice(0)) { try { old.dispose(); } catch { /* já liberado */ } } }, []);

  // Laço de quadros: simulação em passo fixo + desenho do quadro como um Picture do Skia.
  useEffect(() => {
    if (!size || !p.running) return;
    let raf = 0;
    let lastHud = 0;
    let overSent = false;
    let lastDraw = -1000;
    const q = quality.current;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      try {
        frame(ts);
      } catch (e) {
        cancelAnimationFrame(raf);
        setFatal(() => { throw e; });
      }
    };
    const frame = (ts: number) => {
      const {session, hero, onHud, onEvents, onOver} = props.current;
      const changed = session.frame(ts);
      if (changed && !q.skipDraw(ts, lastDraw)) {
        const t0 = now();
        const sc = q.scale;
        const w = size.w * sc, h = size.h * sc;
        publish(createPicture((canvas) => { drawScene(canvas, {session, hero, width: w, height: h, sprites, quality: q.level}, now); }, {width: w, height: h}));
        const dt = now() - t0;
        recordDraw(session.perf, dt);
        if (q.feed(dt, lastDraw < 0 ? 17 : ts - lastDraw, ts)) setQLevel(q.level);
        lastDraw = ts;
      }
      if (changed) {
        const ev = session.drain();
        if (ev.length) onEvents(ev);
        if (ts - lastHud > 100 || ev.length) { lastHud = ts; onHud(session.hud()); }
        if (session.over && !overSent) { overSent = true; onHud(session.hud()); onOver(); }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, p.running, sprites, picture, publish]);

  // Inclinação do aparelho (opcional).
  useEffect(() => {
    if (p.control !== 'tilt' || Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(16);
    // No Android o eixo X do acelerômetro é negativo quando o aparelho inclina para a direita.
    const sign = (Platform.OS === 'android' ? -1 : 1) * (p.tiltInvert ? -1 : 1);
    const sub = Accelerometer.addListener(({x}) => {
      const a = x * sign;
      const dead = 0.04;
      const v = Math.abs(a) < dead ? 0 : (a - Math.sign(a) * dead) / 0.28;
      props.current.session.setAxis(v);
    });
    return () => sub.remove();
  }, [p.control, p.tiltInvert]);

  // Teclado (web / desktop): setas ou A e D; P ou Esc pausam.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const held = {l: false, r: false};
    const push = () => props.current.session.setAxis((held.r ? 1 : 0) - (held.l ? 1 : 0));
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { held.l = true; push(); e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { held.r = true; push(); e.preventDefault(); }
      else if ((k === ' ' || k === 'arrowup' || k === 'w' || k === 'z') && !e.repeat) { props.current.session.setFire(true); e.preventDefault(); }
      else if ((k === 'p' || k === 'escape') && !e.repeat) props.current.onPauseKey?.();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { held.l = false; push(); }
      else if (k === 'arrowright' || k === 'd') { held.r = false; push(); }
      else if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'z') props.current.session.setFire(false);
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
  }, []);

  const sizeRef = useRef<{w: number; h: number} | null>(null);
  sizeRef.current = size;
  const touch = useCallback((e: GestureResponderEvent) => {
    const z = sizeRef.current;
    if (!z) return;
    const r = readTouches(e, z.w, z.h);
    props.current.session.setFire(r.fire);
    if (props.current.control === 'touch') props.current.session.setAxis(r.axis);
  }, []);

  useEffect(() => {
    if (!size) return;
    props.current.session.setViewH(size.h / (size.w / FIELD_W));
    // Primeiro quadro estático (antes de o laço rodar).
    const sc = quality.current.scale;
    publish(createPicture((canvas) => { drawScene(canvas, {session: props.current.session, hero: props.current.hero, width: size.w * sc, height: size.h * sc, sprites, quality: quality.current.level}, now); }, {width: size.w * sc, height: size.h * sc}));
  }, [size, sprites, picture, publish, qLevel]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const {width, height} = e.nativeEvent.layout;
        if (width > 0 && height > 0 && Number.isFinite(width + height)) setSize({w: width, h: height});
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={touch}
      onResponderStart={touch}
      onResponderMove={touch}
      onResponderEnd={touch}
      onResponderRelease={touch}
      onResponderTerminate={touch}
      accessible
      accessibilityLabel="Jogo NEON STEP DX. Segure o lado esquerdo ou direito da tela para mover o personagem e toque no botão redondo de baixo para atirar."
    >
      {/* Nível mínimo: o canvas é menor e ampliado (menos pixels para a GPU de aparelhos fracos). */}
      <Canvas
        style={qLevel >= 2 ? {position: 'absolute', left: 0, top: 0, width: (size?.w ?? 0) * 0.75, height: (size?.h ?? 0) * 0.75, transformOrigin: 'top left', transform: [{scale: 1 / 0.75}]} : StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
