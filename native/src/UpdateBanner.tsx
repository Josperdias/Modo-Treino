/** Aviso de versão nova NO TOPO do app (no lugar do aviso genérico do Android): cartão estilizado com as novidades,
 * botão "Atualizar agora" que baixa aqui mesmo (com progresso) e leva ao arquivo para instalar. */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from './text';
import Animated, {FadeOutUp, SlideInUp, useAnimatedStyle, useSharedValue, withTiming, Easing} from 'react-native-reanimated';
import {Btn, Card, Icon, Pattern, Press} from './ui';
import {C, R} from './theme';
import {baixaNoApp} from './updates';
import type {UpdatesApi} from './updates';

const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',');

export default function UpdateBanner({u, current}: {u: UpdatesApi; current: string}) {
  const [open, setOpen] = useState(false);
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(u.progress, {duration: 260, easing: Easing.out(Easing.cubic)}); }, [u.progress, w]);
  const fill = useAnimatedStyle(() => ({width: `${Math.max(0.03, w.value) * 100}%`}));
  const info = u.update;
  if (!info || !u.visible) return null;
  const busy = u.phase === 'downloading';
  const total = info.size;
  return (
    <Animated.View entering={SlideInUp.duration(340)} exiting={FadeOutUp.duration(200)} style={S.wrap} accessibilityRole="alert" accessibilityLabel={`Nova versão ${info.tag} disponível`}>
      <Card color={C.yellow} offset={5} style={{paddingTop: 14, paddingBottom: 14}} pattern={<Pattern kind="dots" opacity={0.13} size={16} />}>
        <View style={S.row}>
          <View style={S.chip}><Icon name={busy ? 'cloud-download' : 'rocket'} size={24} color={C.yellow} /></View>
          <View style={{flex: 1}}>
            <View style={S.tag}><Text style={S.tagText}>NOVA VERSÃO</Text></View>
            <Text style={S.title} numberOfLines={1}>{info.tag} CHEGOU!</Text>
            <Text style={S.sub} numberOfLines={1}>{total > 0 ? `${mb(total)} MB · ` : ''}você está na {current}</Text>
          </View>
          {!busy && <Press accessibilityRole="button" accessibilityLabel="Depois" onPress={u.dismiss} style={S.close} quiet><Icon name="close" size={18} /></Press>}
        </View>

        {info.notes.length > 0 && (
          <Press accessibilityRole="button" accessibilityLabel={open ? 'Esconder novidades' : 'Ver novidades'} onPress={() => setOpen(!open)} quiet style={S.notesHead}>
            <Text style={S.notesTitle}>O QUE HÁ DE NOVO</Text><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
          </Press>
        )}
        {open && info.notes.slice(0, 8).map((n, i) => <Text key={i} style={S.note}>• {n}</Text>)}

        {u.phase === 'idle' && (
          <View style={{marginTop: 12}}>
            <Btn small kind="dark" icon="download" text="ATUALIZAR AGORA" label="Atualizar agora" onPress={() => { void u.download(); }} />
            <Text style={[S.sub, {marginTop: 6}]}>{baixaNoApp() ? 'Baixa aqui mesmo, com barra de progresso. No fim, o Android pede para você confirmar a instalação.' : 'Abre o download. Quando terminar, toque em Abrir e depois em Instalar.'}</Text>
          </View>
        )}
        {busy && (
          <View style={{marginTop: 12}}>
            <View style={S.bar}><Animated.View style={[S.fill, fill]} /></View>
            <View style={S.barRow}>
              <Text style={S.sub}>Baixando… {Math.round(u.progress * 100)}%{total > 0 ? ` · ${mb(Math.min(u.received, total))} de ${mb(total)} MB` : ''}</Text>
              <Press accessibilityRole="button" accessibilityLabel="Cancelar o download" onPress={() => { void u.cancel(); }} quiet style={{padding: 6}}><Text style={S.cancel}>CANCELAR</Text></Press>
            </View>
          </View>
        )}
        {u.phase === 'ready' && (
          <View style={{marginTop: 12, gap: 8}}>
            <Text style={S.sub}>Baixado e conferido ✓. Abra os Downloads, toque em <Text style={{fontWeight: '900'}}>modo-treino-{info.tag}.apk</Text> e confirme a instalação (também dá para tocar na notificação de download).</Text>
            <Btn small kind="dark" icon="checkmark-circle" text="ABRIR E INSTALAR" label="Abrir os downloads para instalar a atualização" onPress={() => { void u.install(); }} />
          </View>
        )}
        {u.phase === 'error' && (
          <View style={{marginTop: 12, gap: 8}}>
            <Text style={S.err}>{u.error}</Text>
            <Btn small kind="dark" icon="refresh" text="TENTAR DE NOVO" onPress={() => { void u.download(); }} />
            <Btn small kind="ghost" text="NO NAVEGADOR" label="Baixar pelo navegador" onPress={u.openBrowser} />
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  wrap: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, backgroundColor: C.paper},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  chip: {width: 48, height: 48, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-6deg'}]},
  tag: {alignSelf: 'flex-start', backgroundColor: C.pink, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 2, borderWidth: 2, borderColor: C.ink, transform: [{rotate: '-2deg'}]},
  tagText: {fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: C.ink},
  title: {fontSize: 28, fontWeight: '900', color: C.ink, lineHeight: 30, marginTop: 2},
  sub: {fontSize: 12.5, fontWeight: '700', color: 'rgba(20,27,52,.78)', flexShrink: 1},
  close: {width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,27,52,.1)', alignItems: 'center', justifyContent: 'center'},
  notesHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 4},
  notesTitle: {fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: C.ink},
  note: {fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.ink, marginTop: 3},
  bar: {height: 16, borderRadius: 8, backgroundColor: C.card, borderWidth: 2, borderColor: C.ink, overflow: 'hidden'},
  fill: {height: '100%', backgroundColor: C.pink},
  barRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8},
  cancel: {fontSize: 12, fontWeight: '900', letterSpacing: 1, color: C.ink},
  err: {fontSize: 13, fontWeight: '700', color: '#9B2C4A'},
});
