import React, {useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';
import {Text} from '../text';
import {formatClock} from '../../logic';
import {Icon, Press} from '../ui';
import {C, T} from '../theme';
import {useMusic, useMusicProgress} from './MusicProvider';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Barra com bolinha: toque para ir direto ao ponto, ou SEGURE a bolinha e arraste (a posição acompanha o dedo; o som só muda ao soltar,
 * a não ser que `live` seja verdadeiro, como no volume). Usa PanResponder: funciona dentro de janelas (Modal), no Android e no navegador. */
function Scrub({pct, onLive, onCommit, label, valueText, fill, disabled, onDrag}: {pct: number; onLive?: (p: number) => void; onCommit: (p: number) => void; label: string; valueText: string; fill: string; disabled?: boolean; onDrag?: (p: number | null) => void}) {
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const wRef = useRef(0); wRef.current = w;
  const start = useRef(0);
  const cb = useRef({onLive, onCommit, onDrag}); cb.current = {onLive, onCommit, onDrag};
  const off = useRef(!!disabled); off.current = !!disabled;
  const move = (p: number) => { setDrag(p); cb.current.onDrag?.(p); cb.current.onLive?.(p); };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !off.current,
    onMoveShouldSetPanResponder: () => !off.current,
    onMoveShouldSetPanResponderCapture: () => !off.current,   // a rolagem da tela não rouba o arrasto
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { start.current = clamp01(e.nativeEvent.locationX / Math.max(1, wRef.current)); move(start.current); },
    onPanResponderMove: (_, g) => move(clamp01(start.current + g.dx / Math.max(1, wRef.current))),
    onPanResponderRelease: (_, g) => { const p = clamp01(start.current + g.dx / Math.max(1, wRef.current)); setDrag(null); cb.current.onDrag?.(null); cb.current.onCommit(p); },
    onPanResponderTerminate: () => { setDrag(null); cb.current.onDrag?.(null); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const shown = drag ?? pct;
  const nudge = (d: number) => { if (!off.current) cb.current.onCommit(clamp01(pct + d)); };
  return (
    <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[B.seek, disabled && {opacity: 0.5}]}
      accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{text: valueText}}
      accessibilityActions={[{name: 'increment', label: 'Avançar'}, {name: 'decrement', label: 'Voltar'}]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)}>
      <View pointerEvents="none" style={B.seekTrack}><View style={[B.seekFill, {width: `${shown * 100}%`, backgroundColor: fill}]} /></View>
      <View pointerEvents="none" style={[B.seekKnob, {left: `${shown * 100}%`}, drag != null && B.seekKnobOn]} />
    </View>
  );
}

export function SeekBar() {
  const m = useMusic();
  const {position, duration} = useMusicProgress();
  const [drag, setDrag] = useState<number | null>(null);
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;
  const shownSec = drag != null ? drag * duration : position;
  return (
    <View>
      <Scrub pct={pct} fill={C.pink} disabled={duration <= 0} label="Posição da música" valueText={`${formatClock(position)} de ${formatClock(duration)}`}
        onDrag={setDrag} onCommit={(p) => { if (duration > 0) m.seek(p * duration); }} />
      <View style={B.times}>
        <Text style={[T.small, drag != null && B.timeOn]} accessibilityLiveRegion="polite">{formatClock(shownSec)}</Text>
        <Text style={T.small}>{formatClock(duration)}</Text>
      </View>
    </View>
  );
}

export function VolumeBar() {
  const m = useMusic();
  const v = m.lib.volume ?? 1;
  return (
    <View style={B.volRow}>
      <Press accessibilityRole="button" accessibilityLabel={v === 0 ? 'Ativar som' : 'Silenciar'} onPress={() => m.setVolume(v === 0 ? 1 : 0)} quiet haptic={false} style={{padding: 4}}>
        <Icon name={v === 0 ? 'volume-mute' : v < 0.5 ? 'volume-low' : 'volume-high'} size={20} color={C.ink} />
      </Press>
      <View style={{flex: 1}}>
        <Scrub pct={v} fill={C.sky} label="Volume" valueText={`${Math.round(v * 100)} por cento`} onLive={(p) => m.setVolume(p)} onCommit={(p) => m.setVolume(p)} />
      </View>
      <Text style={B.volPct}>{Math.round(v * 100)}%</Text>
    </View>
  );
}

const B = StyleSheet.create({
  seek: {height: 40, justifyContent: 'center'},
  seekTrack: {height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink},
  seekFill: {height: 8, backgroundColor: C.pink},
  seekKnob: {position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: C.yellow, marginLeft: -12, top: 8, borderWidth: 2.5, borderColor: C.ink},
  seekKnobOn: {transform: [{scale: 1.3}], backgroundColor: C.pink},
  timeOn: {fontWeight: '900', color: C.ink, fontSize: 14},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: -2},
  volRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  volPct: {width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700', color: C.muted},
});
