import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, LayoutChangeEvent, PanResponder, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import Animated, {useReducedMotion, cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import Svg, {Circle, Defs, G, Line, Path, Pattern as SvgPattern, Rect} from 'react-native-svg';
import {C} from '../theme';
import type {FitaDeco, FitaEdge, FitaImgFit, FitaPattern, FitaSticker} from '../../logic';
import {Icon} from '../ui';
import {tapeIndex} from './tapeIndex';

const W = 320, H = 200;
const LEFT = {x: 98, y: 124}, RIGHT = {x: 222, y: 124};

function Hub({size}: {size: number}) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c - 1} fill="#E9E4DA" />
      <Circle cx={c} cy={c} r={c * 0.58} fill="#101733" />
      <G stroke="#E9E4DA" strokeWidth={size * 0.07} strokeLinecap="round">
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const rad = (a * Math.PI) / 180;
          return <Line key={a} x1={c + Math.cos(rad) * c * 0.22} y1={c + Math.sin(rad) * c * 0.22} x2={c + Math.cos(rad) * c * 0.5} y2={c + Math.sin(rad) * c * 0.5} />;
        })}
      </G>
    </Svg>
  );
}

/** Padrões que a pessoa pode pôr no corpo da fita (desenhados por cima da cor, bem de leve). */
export const PATTERNS: {key: FitaPattern; name: string}[] = [{key: 'dots', name: 'Bolinhas'}, {key: 'stripes', name: 'Listras'}, {key: 'check', name: 'Xadrez'}, {key: 'stars', name: 'Estrelas'}];
/** Bordas que a pessoa pode pôr no contorno da fita. */
export const EDGES: {key: FitaEdge; name: string}[] = [{key: 'check', name: 'Xadrez'}, {key: 'hazard', name: 'Listras de obra'}, {key: 'candy', name: 'Docinho'}];
function PatternDefs() {
  const star = 'M10 2l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z';
  return (
    <Defs>
      <SvgPattern id="pt-dots" patternUnits="userSpaceOnUse" width={16} height={16}><Circle cx={8} cy={8} r={3} fill="#FFFFFF" opacity={0.22} /></SvgPattern>
      <SvgPattern id="pt-stripes" patternUnits="userSpaceOnUse" width={18} height={18} patternTransform="rotate(45)"><Rect x={0} y={0} width={9} height={18} fill="#FFFFFF" opacity={0.2} /></SvgPattern>
      <SvgPattern id="pt-check" patternUnits="userSpaceOnUse" width={24} height={24}><Rect x={0} y={0} width={12} height={12} fill="#FFFFFF" opacity={0.2} /><Rect x={12} y={12} width={12} height={12} fill="#FFFFFF" opacity={0.2} /></SvgPattern>
      {TAPES.map((t, i) => (t.alt ? (
        <SvgPattern key={i} id={`ck-${i}`} patternUnits="userSpaceOnUse" width={40} height={40}>
          <Rect x={0} y={0} width={40} height={40} fill={t.body} /><Rect x={20} y={0} width={20} height={20} fill={t.alt} /><Rect x={0} y={20} width={20} height={20} fill={t.alt} />
        </SvgPattern>
      ) : null))}
      <SvgPattern id="ed-check" patternUnits="userSpaceOnUse" width={16} height={16}><Rect x={0} y={0} width={16} height={16} fill="#FFFFFF" /><Rect x={0} y={0} width={8} height={8} fill="#0B1033" /><Rect x={8} y={8} width={8} height={8} fill="#0B1033" /></SvgPattern>
      <SvgPattern id="ed-hazard" patternUnits="userSpaceOnUse" width={18} height={18} patternTransform="rotate(45)"><Rect x={0} y={0} width={18} height={18} fill="#FFC93C" /><Rect x={0} y={0} width={9} height={18} fill="#0B1033" /></SvgPattern>
      <SvgPattern id="ed-candy" patternUnits="userSpaceOnUse" width={18} height={18} patternTransform="rotate(45)"><Rect x={0} y={0} width={18} height={18} fill="#FFFFFF" /><Rect x={0} y={0} width={9} height={18} fill="#F0568A" /></SvgPattern>
      <SvgPattern id="pt-stars" patternUnits="userSpaceOnUse" width={30} height={30}><Path d={star} fill="#FFFFFF" opacity={0.24} transform="translate(5 5)" /></SvgPattern>
    </Defs>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const wrap180 = (deg: number) => { let r = Math.round(deg) % 360; if (r > 180) r -= 360; if (r < -180) r += 360; return r; };
const touchDist = (t: {pageX: number; pageY: number}[]) => Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY);
const touchAngle = (t: {pageX: number; pageY: number}[]) => (Math.atan2(t[1].pageY - t[0].pageY, t[1].pageX - t[0].pageX) * 180) / Math.PI;

/** Uma figurinha sobre a fita. Em modo de edição: arrasta com um dedo, e muda de tamanho e gira com DOIS dedos (pinça e giro)
 * ou arrastando a bolinha do canto (puxar para longe aumenta, em volta do centro gira). */
function StickerView({st, i, w, h, edit, selected, onSelect, onMove, onXform}: {st: FitaSticker; i: number; w: number; h: number; edit: boolean; selected: boolean; onSelect?: (i: number) => void; onMove?: (i: number, x: number, y: number) => void; onXform?: (i: number, s: number, r: number) => void}) {
  const fs = Math.max(14, w * 0.12 * st.s);
  const box = fs * 1.7;
  // A figurinha pode ir até a beira e passar do contorno da fita, cobrindo a borda e a moldura em volta (a moldura amarela do player a recorta
  // na sua própria beira). O centro nunca sai da fita, então sempre dá para pegar de volta.
  const left = st.x * w - box / 2, top = st.y * h - box / 2;
  const live = useRef({st, w, h, i, box, onSelect, onMove, onXform});
  live.current = {st, w, h, i, box, onSelect, onMove, onXform};
  const start = useRef({x: 0, y: 0});
  const pinch = useRef<{d0: number; a0: number; s0: number; r0: number} | null>(null);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,   // a rolagem do painel não rouba o arrasto
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = {x: live.current.st.x, y: live.current.st.y}; pinch.current = null; live.current.onSelect?.(live.current.i); },
    onPanResponderMove: (e, g) => {
      const c = live.current;
      const t = e.nativeEvent.touches as unknown as {pageX: number; pageY: number}[];
      if (t && t.length >= 2) {   // dois dedos: pinça muda o tamanho, giro muda o ângulo
        const d = touchDist(t), a = touchAngle(t);
        if (!pinch.current) pinch.current = {d0: Math.max(1, d), a0: a, s0: c.st.s, r0: c.st.r || 0};
        const p = pinch.current;
        c.onXform?.(c.i, clamp(p.s0 * (d / p.d0), 0.6, 2.2), wrap180(p.r0 + (a - p.a0)));
        return;
      }
      if (pinch.current) { start.current = {x: c.st.x - g.dx / Math.max(1, c.w), y: c.st.y - g.dy / Math.max(1, c.h)}; pinch.current = null; }
      c.onMove?.(c.i, clamp(start.current.x + g.dx / Math.max(1, c.w), 0, 1), clamp(start.current.y + g.dy / Math.max(1, c.h), 0, 1));
    },
    onPanResponderRelease: () => { pinch.current = null; },
  }), []);
  // Bolinha do canto (um dedo): a distância até o centro dá o tamanho e o ângulo dá o giro.
  const grip = useRef({vx: 0, vy: 0, s0: 1, r0: 0});
  const handle = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const c = live.current, a = ((c.st.r || 0) * Math.PI) / 180, half = c.box / 2;
      grip.current = {vx: half * Math.cos(a) - half * Math.sin(a), vy: half * Math.sin(a) + half * Math.cos(a), s0: c.st.s, r0: c.st.r || 0};
    },
    onPanResponderMove: (_, g) => {
      const c = live.current, v0 = grip.current;
      const vx = v0.vx + g.dx, vy = v0.vy + g.dy;
      const d0 = Math.max(1, Math.hypot(v0.vx, v0.vy)), d = Math.hypot(vx, vy);
      const da = (Math.atan2(vy, vx) - Math.atan2(v0.vy, v0.vx)) * 180 / Math.PI;
      c.onXform?.(c.i, clamp(v0.s0 * (d / d0), 0.6, 2.2), wrap180(v0.r0 + da));
    },
  }), []);
  return (
    <View {...(edit ? pan.panHandlers : {})} pointerEvents={edit ? 'auto' : 'none'} accessible={edit} accessibilityRole={edit ? 'button' : undefined} accessibilityLabel={edit ? `Figurinha ${st.e}, arraste para mudar de lugar` : undefined}
      style={{position: 'absolute', left, top, width: box, height: box, alignItems: 'center', justifyContent: 'center', transform: [{rotate: `${st.r || 0}deg`}], borderRadius: fs, borderWidth: edit && selected ? 2 : 0, borderColor: C.ink, borderStyle: 'dashed', backgroundColor: edit && selected ? 'rgba(255,255,255,.35)' : 'transparent'}}>
      <Text style={{fontSize: fs, lineHeight: fs * 1.5, textAlign: 'center'}}>{st.e}</Text>
      {edit && selected ? (
        <View {...handle.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Arraste para girar e mudar o tamanho da figurinha"
          style={{position: 'absolute', right: -13, bottom: -13, width: 28, height: 28, borderRadius: 14, backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="sync" size={15} />
        </View>
      ) : null}
    </View>
  );
}

/** Imagem do rótulo: cobre o quadro (como "cover") e depois recebe zoom (1 a 3) e deslocamento (-1 a 1). Em modo de edição:
 * arrastar com um dedo move a imagem e a pinça de dois dedos dá zoom — a pessoa escolhe a região que aparece. */
function FitImage({uri, fit, w, h, radius, editable, onFit}: {uri: string; fit?: FitaImgFit; w: number; h: number; radius: number; editable?: boolean; onFit?: (f: FitaImgFit) => void}) {
  const [nat, setNat] = useState<{w: number; h: number} | null>(null);
  useEffect(() => {
    let on = true;
    Image.getSize(uri, (iw, ih) => { if (on && iw > 0 && ih > 0) setNat({w: iw, h: ih}); }, () => {});
    return () => { on = false; };
  }, [uri]);
  const m = fit?.m ?? 'cover', z = fit?.z ?? 1, x = fit?.x ?? 0, y = fit?.y ?? 0;
  // preencher (cover): a imagem cobre toda a área; inteira (contain): aparece inteira e pode ficar menor que a área; esticar: força o ajuste à área.
  let dw = w * z, dh = h * z;
  if (nat && m !== 'stretch') { const base = m === 'contain' ? Math.min(w / nat.w, h / nat.h) : Math.max(w / nat.w, h / nat.h); dw = nat.w * base * z; dh = nat.h * base * z; }
  const live = useRef({fit: {m, z, x, y}, w, h, dw, dh, onFit});
  live.current = {fit: {m, z, x, y}, w, h, dw, dh, onFit};
  const start = useRef({x: 0, y: 0});
  const pinch = useRef<{d0: number; z0: number} | null>(null);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = {x: live.current.fit.x, y: live.current.fit.y}; pinch.current = null; },
    onPanResponderMove: (e, g) => {
      const c = live.current;
      const t = e.nativeEvent.touches as unknown as {pageX: number; pageY: number}[];
      if (t && t.length >= 2) {
        const d = touchDist(t);
        if (!pinch.current) pinch.current = {d0: Math.max(1, d), z0: c.fit.z};
        c.onFit?.({...c.fit, z: Math.round(clamp(pinch.current.z0 * (d / pinch.current.d0), 0.25, 3) * 100) / 100});
        return;
      }
      if (pinch.current) { start.current = {x: c.fit.x, y: c.fit.y}; pinch.current = null; return; }
      const rx = Math.abs(c.dw - c.w) / 2, ry = Math.abs(c.dh - c.h) / 2;
      // arrastar para a direita leva a imagem para a direita (mostra a região da esquerda); imagem menor que a área anda dentro da folga
      c.onFit?.({m: c.fit.m, z: c.fit.z, x: rx > 0.5 ? Math.round(clamp(start.current.x + g.dx / rx, -1, 1) * 100) / 100 : c.fit.x, y: ry > 0.5 ? Math.round(clamp(start.current.y + g.dy / ry, -1, 1) * 100) / 100 : c.fit.y});
    },
    onPanResponderRelease: () => { pinch.current = null; },
  }), []);
  return (
    <View {...(editable ? pan.panHandlers : {})} pointerEvents={editable ? 'auto' : 'none'} accessible={!!editable} accessibilityLabel={editable ? 'Imagem do rótulo: arraste para escolher a região e use dois dedos para dar zoom' : undefined}
      style={{width: w, height: h, borderRadius: radius, overflow: 'hidden', borderWidth: editable ? 2 : 0, borderColor: C.ink, borderStyle: 'dashed'}}>
      <Image source={{uri}} resizeMode={m === 'stretch' ? 'stretch' : 'cover'} style={{position: 'absolute', width: dw, height: dh, left: (w - dw) / 2 + x * Math.abs(dw - w) / 2, top: (h - dh) / 2 + y * Math.abs(dh - h) / 2}} />
    </View>
  );
}

export type CassetteEdit = {selected: number | null; onSelect: (i: number) => void; onMove: (i: number, x: number, y: number) => void; onXform: (i: number, s: number, r: number) => void;
  /** Modo "ajustar imagem": as figurinhas ficam paradas e o dedo move/dá zoom na imagem do rótulo. */
  imageMode?: boolean; onFit?: (f: FitaImgFit) => void};

/** Fita cassete: os carretéis giram enquanto toca e a fita passa de um lado para o outro conforme a faixa avança.
 * `deco`: a cor, o padrão, a imagem do rótulo e as figurinhas escolhidas pela pessoa. `edit`: modo de personalizar (figurinhas arrastáveis). */
export default function Cassette({playing, label, side = 'LADO A', progress = 0, deco, edit}: {playing: boolean; label: string; side?: string; progress?: number; deco?: FitaDeco; edit?: CassetteEdit}) {
  const [w, setW] = useState(300);
  const spin = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (playing && !reduce) spin.value = withRepeat(withTiming(spin.value + 360, {duration: 2400, easing: Easing.linear}), -1, false);
    else cancelAnimation(spin);
    return () => cancelAnimation(spin);
  }, [playing, spin, reduce]);
  const style = useAnimatedStyle(() => ({transform: [{rotate: `${spin.value % 360}deg`}]}));
  const k = w / W;
  const h = w * (H / W);
  const p = Math.max(0, Math.min(1, progress));
  const left = 31 - p * 11, right = 20 + p * 11; // raio da fita enrolada em cada lado
  const hub = 40 * k;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const tone = deco?.color != null ? TAPES[deco.color] : null;
  const shell = tone ? (tone.alt ? `url(#ck-${deco!.color})` : tone.body) : '#25316C';
  const labelBg = tone ? tone.label : '#FBD4D4';
  const band = tone ? (tone.alt || tone.body) : '#F6A4C1';
  const ink = tone ? tone.ink : '#443765';
  const hasImg = !!deco?.image;
  return (
    <View onLayout={onLayout} style={CS.wrap} accessible accessibilityRole="image" accessibilityLabel={`Fita cassete ${label}${playing ? ', tocando' : ''}`}>
      <Svg width="100%" height={h} viewBox={`0 0 ${W} ${H}`}>
        <PatternDefs />
        <Rect x={4} y={4} width={W - 8} height={H - 8} rx={20} fill={shell} stroke="#0B1033" strokeWidth={5} />
        {deco?.pattern ? <Rect x={6} y={6} width={W - 12} height={H - 12} rx={18} fill={`url(#pt-${deco.pattern})`} /> : null}
        {deco?.edge ? (
          <>
            <Rect x={8} y={8} width={W - 16} height={H - 16} rx={17} fill="none" stroke={`url(#ed-${deco.edge})`} strokeWidth={10} />
            <Rect x={3} y={3} width={W - 6} height={H - 6} rx={20.5} fill="none" stroke="#0B1033" strokeWidth={2.2} />
            <Rect x={13.2} y={13.2} width={W - 26.4} height={H - 26.4} rx={12} fill="none" stroke="#0B1033" strokeWidth={1.6} />
          </>
        ) : null}
        <Rect x={22} y={18} width={W - 44} height={74} rx={10} fill={labelBg} stroke={tone ? '#0B1033' : '#EA9CC9'} strokeWidth={2} />
        {!hasImg && <Rect x={22} y={70} width={W - 44} height={22} rx={0} fill={band} opacity={tone ? 0.35 : 0.55} />}
        <Rect x={44} y={92} width={W - 88} height={66} rx={33} fill="#090D23" stroke="#53629D" strokeWidth={3} />
        <Circle cx={LEFT.x} cy={LEFT.y} r={left} fill="#3A2A22" />
        <Circle cx={RIGHT.x} cy={RIGHT.y} r={right} fill="#3A2A22" />
        <Rect x={102} y={156} width={116} height={26} rx={6} fill="#101733" opacity={0.7} />
        <Circle cx={118} cy={170} r={4} fill="#53629D" /><Circle cx={202} cy={170} r={4} fill="#53629D" />
      </Svg>
      {hasImg ? <View pointerEvents={edit?.imageMode ? 'auto' : 'none'} style={{position: 'absolute', left: 23 * k, top: 19 * k, zIndex: edit?.imageMode ? 5 : 0}}><FitImage uri={deco!.image!} fit={deco!.imgFit} w={(W - 46) * k} h={72 * k} radius={9 * k} editable={!!edit?.imageMode} onFit={edit?.onFit} /></View> : null}
      <Animated.View style={[CS.reel, {left: (LEFT.x - 20) * k, top: (LEFT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <Animated.View style={[CS.reel, {left: (RIGHT.x - 20) * k, top: (RIGHT.y - 20) * k, width: hub, height: hub}, style]}><Hub size={hub} /></Animated.View>
      <View style={[CS.sticker, {left: 34 * k, right: 34 * k, top: 24 * k}]} pointerEvents="none">
        <Text style={[CS.side, {color: hasImg ? '#FFFFFF' : ink, textShadowColor: hasImg ? 'rgba(11,16,51,.7)' : 'transparent', textShadowRadius: 4}]}>MODO MÚSICA · {side}</Text>
        <View style={hasImg ? CS.titleOnImg : undefined}><Text numberOfLines={1} style={[CS.title, hasImg && {marginTop: 0}]}>{label.toUpperCase()}</Text></View>
      </View>
      {deco?.stickers?.length ? (
        <View pointerEvents="box-none" accessibilityLabel="Figurinhas da fita" style={{position: 'absolute', left: 0, top: 0, width: w, height: h}}>
          {deco.stickers.map((st, i) => (
            <StickerView key={i} st={st} i={i} w={w} h={h} edit={!!edit && !edit.imageMode} selected={edit?.selected === i} onSelect={edit?.onSelect} onMove={edit?.onMove} onXform={edit?.onXform} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const CS = StyleSheet.create({
  wrap: {width: '100%'},
  reel: {position: 'absolute'},
  sticker: {position: 'absolute'},
  side: {fontSize: 9, letterSpacing: 1.4, fontWeight: '900', color: '#443765'},
  title: {fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 4, letterSpacing: -0.4},
  titleOnImg: {alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,.82)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4},
});

// Cada fita tem a sua cor, para reconhecer uma música de relance na lista (corpo, rótulo e carretéis combinam).
export const TAPES: {body: string; label: string; ink: string; alt?: string}[] = [
  {body: '#F0568A', label: '#FFD3E3', ink: '#7A1740'},   // rosa
  {body: '#3F7BEA', label: '#CFE0FF', ink: '#173E8F'},   // azul
  {body: '#F5B71F', label: '#FFEDB0', ink: '#7A5200'},   // amarelo
  {body: '#2DB67C', label: '#C9F3DF', ink: '#0F5E3E'},   // verde
  {body: '#8A5CE6', label: '#E2D4FF', ink: '#42218F'},   // roxo
  {body: '#F2793A', label: '#FFD9C2', ink: '#8A3410'},   // laranja
  {body: '#1FB5C9', label: '#C7F1F7', ink: '#0B5D69'},   // turquesa
  {body: '#E0453F', label: '#FFD0CD', ink: '#7C1814'},   // vermelho
  // 8 a 13: xadrez de duas cores (corpo em quadradinhos `body` e `alt`)
  {body: '#141B34', alt: '#F7F3EA', label: '#F7F3EA', ink: '#141B34'},   // preto e branco
  {body: '#F0568A', alt: '#FFFFFF', label: '#FFD3E3', ink: '#7A1740'},   // rosa e branco
  {body: '#F5B71F', alt: '#141B34', label: '#FFEDB0', ink: '#141B34'},   // amarelo e preto
  {body: '#3F7BEA', alt: '#FFFFFF', label: '#CFE0FF', ink: '#173E8F'},   // azul e branco
  {body: '#E0453F', alt: '#141B34', label: '#FFD0CD', ink: '#7C1814'},   // vermelho e preto
  {body: '#8A5CE6', alt: '#F0568A', label: '#E2D4FF', ink: '#42218F'},   // roxo e rosa
];
const BORDER = '#0B1033';

/** Mini cassete de UMA música (uma fita), colorido por música. Estático e leve de propósito: listas com centenas de fitas.
 * Personalização opcional: `color` troca a cor, `stickers` coloca as figurinhas nos lugares escolhidos, `image` vira a capa no rótulo e `note` cola um bilhetinho amarelo. */
export const MiniTape = React.memo(function MiniTape({id, size = 76, color, stickers, image, imgFit, note, edge}: {id: string; size?: number; on?: boolean; color?: number; stickers?: FitaSticker[]; image?: string; imgFit?: FitaImgFit; note?: boolean; edge?: FitaEdge}) {
  const t = TAPES[color ?? tapeIndex(id)] || TAPES[tapeIndex(id)];
  const h = size * 0.64, k = size / 100;
  return (
    <View style={{width: size, height: h}}>
      <Svg width={size} height={h} viewBox="0 0 100 64">
        {edge ? (
          <Defs>
            {edge === 'check' ? <SvgPattern id="me" patternUnits="userSpaceOnUse" width={8} height={8}><Rect x={0} y={0} width={8} height={8} fill="#FFFFFF" /><Rect x={0} y={0} width={4} height={4} fill="#0B1033" /><Rect x={4} y={4} width={4} height={4} fill="#0B1033" /></SvgPattern> : null}
            {edge === 'hazard' ? <SvgPattern id="me" patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)"><Rect x={0} y={0} width={9} height={9} fill="#FFC93C" /><Rect x={0} y={0} width={4.5} height={9} fill="#0B1033" /></SvgPattern> : null}
            {edge === 'candy' ? <SvgPattern id="me" patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)"><Rect x={0} y={0} width={9} height={9} fill="#FFFFFF" /><Rect x={0} y={0} width={4.5} height={9} fill="#F0568A" /></SvgPattern> : null}
          </Defs>
        ) : null}
        {t.alt ? <Defs><SvgPattern id="mk" patternUnits="userSpaceOnUse" width={20} height={20}><Rect x={0} y={0} width={20} height={20} fill={t.body} /><Rect x={10} y={0} width={10} height={10} fill={t.alt} /><Rect x={0} y={10} width={10} height={10} fill={t.alt} /></SvgPattern></Defs> : null}
        <Rect x={2} y={2} width={96} height={60} rx={9} fill={t.alt ? 'url(#mk)' : t.body} stroke={BORDER} strokeWidth={3} />
        {edge ? <Rect x={4.5} y={4.5} width={91} height={55} rx={7} fill="none" stroke="url(#me)" strokeWidth={5} /> : null}
        {edge ? <Rect x={1.2} y={1.2} width={97.6} height={61.6} rx={9.4} fill="none" stroke={BORDER} strokeWidth={1.6} /> : null}
        <Rect x={9} y={7} width={82} height={24} rx={4} fill={t.label} stroke={BORDER} strokeWidth={1.5} />
        {!image && <Rect x={16} y={14} width={44} height={3} rx={1.5} fill={t.ink} opacity={0.75} />}
        {!image && <Rect x={16} y={20} width={28} height={3} rx={1.5} fill={t.ink} opacity={0.45} />}
        <Rect x={16} y={34} width={68} height={20} rx={10} fill="#0B1033" />
        <Circle cx={32} cy={44} r={6.5} fill="#F7F3EA" /><Circle cx={32} cy={44} r={2.4} fill={t.body} />
        <Circle cx={68} cy={44} r={6.5} fill="#F7F3EA" /><Circle cx={68} cy={44} r={2.4} fill={t.body} />
      </Svg>
      {image ? <View pointerEvents="none" style={{position: 'absolute', left: 10 * k, top: 8 * k}}><FitImage uri={image} fit={imgFit} w={80 * k} h={22 * k} radius={3 * k} /></View> : null}
      {stickers?.length ? (
        <View pointerEvents="none" style={{position: 'absolute', left: -size * 0.06, top: -size * 0.06, width: size * 1.12, height: h + size * 0.12, overflow: 'hidden'}}>
          {stickers.slice(0, 6).map((st, i) => {
            const fs = Math.max(9, size * 0.17 * st.s);
            const bw = fs * 1.55, bh = fs * 1.55;
            return <Text key={i} style={{position: 'absolute', left: st.x * size - bw / 2 + size * 0.06, top: st.y * h - bh / 2 + size * 0.06, width: bw, height: bh, textAlign: 'center', fontSize: fs, lineHeight: bh * 0.95, transform: [{rotate: `${st.r || 0}deg`}]}}>{st.e}</Text>;
          })}
        </View>
      ) : null}
      {note ? <View pointerEvents="none" style={{position: 'absolute', top: -2 * k, right: -3 * k, width: 15 * k, height: 15 * k, backgroundColor: '#FFE27A', borderWidth: 1.5, borderColor: BORDER, borderRadius: 2, transform: [{rotate: '8deg'}]}} /> : null}
    </View>
  );
});
