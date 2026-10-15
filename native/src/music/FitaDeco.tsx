/** Personalizar a fita: cor, padrão, figurinhas (arraste até o lugar que quiser), imagem no rótulo e anotação ("fita anotada").
 * Tudo fica só neste celular. */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {Btn, Icon, Pattern, Press, Sheet} from '../ui';
import {C, R, T} from '../theme';
import type {FitaEdge, FitaPattern, FitaSticker} from '../../logic';
import Cassette, {EDGES, PATTERNS, TAPES} from './Cassette';
import {tapeIndex} from './tapeIndex';
import {Track, useMusic} from './MusicProvider';

export const STICKERS = ['⭐', '🔥', '💪', '🎧', '❤️', '⚡', '🏋️', '🏃', '🎵', '🌈', '🌸', '👑', '💥', '😎', '🚀', '🎯'];
const MAX_STICKERS = 6, MAX_NOTE = 280;
const SLOTS: [number, number][] = [[0.88, 0.2], [0.12, 0.8], [0.88, 0.82], [0.12, 0.2], [0.5, 0.9], [0.5, 0.1]];
const CAPAS = () => (FileSystem.documentDirectory || '') + 'capas/';
const isOurs = (uri?: string) => !!uri && uri.startsWith(CAPAS());
const drop = (uri?: string) => { if (isOurs(uri)) FileSystem.deleteAsync(uri!, {idempotent: true}).catch(() => {}); };

export default function FitaDecoSheet({track, open, onClose}: {track: Track | null; open: boolean; onClose: () => void}) {
  const m = useMusic();
  const [color, setColor] = useState<number | undefined>();
  const [pattern, setPattern] = useState<FitaPattern | undefined>();
  const [edge, setEdge] = useState<FitaEdge | undefined>();
  const [stickers, setStickers] = useState<FitaSticker[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [oldImage, setOldImage] = useState<string | undefined>();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!track || !open) return;
    const d = m.deco(track.id);
    setColor(d?.color); setPattern(d?.pattern); setEdge(d?.edge); setStickers(d?.stickers || []); setSel(null); setNote(d?.note || ''); setImage(d?.image); setOldImage(d?.image); setErr('');
  }, [track?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!track) return null;
  const add = (e: string) => setStickers((cur) => {
    if (cur.length >= MAX_STICKERS) return cur;
    const [x, y] = SLOTS[cur.length % SLOTS.length];
    setSel(cur.length);
    return [...cur, {e, x, y, s: 1}];
  });
  const move = (i: number, x: number, y: number) => setStickers((cur) => cur.map((s, k) => (k === i ? {...s, x, y} : s)));
  const resize = (d: number) => setStickers((cur) => cur.map((s, k) => (k === sel ? {...s, s: Math.max(0.6, Math.min(2.2, Math.round((s.s + d) * 100) / 100))} : s)));
  const remove = () => { setStickers((cur) => cur.filter((_, k) => k !== sel)); setSel(null); };

  const pickImage = async () => {
    setErr('');
    try {
      const out = await DocumentPicker.getDocumentAsync({type: 'image/*', multiple: false, copyToCacheDirectory: true});
      if (out.canceled || !out.assets?.[0]) return;
      const file = out.assets[0];
      let uri = file.uri;
      try {
        await FileSystem.makeDirectoryAsync(CAPAS(), {intermediates: true});
        const ext = (file.name.match(/\.[A-Za-z0-9]{2,5}$/) || ['.jpg'])[0];
        const to = CAPAS() + `${Date.now().toString(36)}${ext}`;
        await FileSystem.copyAsync({from: file.uri, to});
        uri = to;
      } catch { /* sem cópia (navegador): usa o arquivo escolhido mesmo */ }
      if (image && image !== oldImage) drop(image);   // imagem escolhida e trocada antes de salvar
      setImage(uri);
    } catch { setErr('Não consegui abrir essa imagem. Tente outra.'); }
  };
  const save = () => {
    m.setDeco(track.id, {color: color ?? null, pattern: pattern ?? null, edge: edge ?? null, stickers, note, image: image ?? null} as never);
    if (oldImage && oldImage !== image) drop(oldImage);
    onClose();
  };
  const reset = () => {
    m.setDeco(track.id, null);
    drop(oldImage); if (image && image !== oldImage) drop(image);
    onClose();
  };
  const cancel = () => { if (image && image !== oldImage) drop(image); onClose(); };
  const draft = {color, pattern, edge, stickers, image};
  const tone = TAPES[color ?? tapeIndex(track.id)];

  return (
    <Sheet visible={open} onClose={cancel} title="Personalizar a fita">
      <View style={{gap: 10}}>
        <View style={S.stage}>
          <Pattern kind="dots" color="#FFFFFF" opacity={0.18} size={14} />
          <View style={{width: '80%'}}>
            <Cassette playing={false} label={track.title} deco={draft} edit={{selected: sel, onSelect: setSel, onMove: move}} />
          </View>
          <Text style={S.hint}>{stickers.length ? 'Arraste as figurinhas para onde quiser na fita.' : 'Escolha figurinhas abaixo e arraste para o lugar que quiser.'}</Text>
        </View>

        {sel !== null && stickers[sel] ? (
          <View style={S.tools} accessibilityLabel="Ajustes da figurinha selecionada">
            <Text style={{fontSize: 26}}>{stickers[sel].e}</Text>
            <View style={{flex: 1}} />
            <Press accessibilityRole="button" accessibilityLabel="Figurinha menor" onPress={() => resize(-0.2)} quiet style={S.toolBtn}><Icon name="remove" size={22} /></Press>
            <Press accessibilityRole="button" accessibilityLabel="Figurinha maior" onPress={() => resize(0.2)} quiet style={S.toolBtn}><Icon name="add" size={22} /></Press>
            <Press accessibilityRole="button" accessibilityLabel="Tirar a figurinha da fita" onPress={remove} quiet style={[S.toolBtn, {backgroundColor: '#FBE3E8'}]}><Icon name="trash-outline" size={20} color="#9B2C4A" /></Press>
          </View>
        ) : null}

      </View>
      <ScrollView style={{flexGrow: 0, flexShrink: 1, marginTop: 10}} contentContainerStyle={{gap: 12, paddingBottom: 8}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
        <Text style={T.kicker}>COR DA FITA · LISA OU XADREZ</Text>
        <View style={S.row}>
          {TAPES.map((t, i) => {
            const on = (color ?? tapeIndex(track.id)) === i && color !== undefined;
            return (
              <Press key={i} accessibilityRole="button" accessibilityLabel={`Cor ${i + 1} de ${TAPES.length}${t.alt ? ', xadrez' : ''}`} accessibilityState={{selected: color === i}} onPress={() => setColor(i)} quiet style={[S.swatch, {backgroundColor: t.body}, on && S.swatchOn]}>
                {t.alt ? (
                  <View pointerEvents="none" style={S.check}>
                    <View style={[S.sq, {backgroundColor: t.body}]} /><View style={[S.sq, {backgroundColor: t.alt}]} />
                    <View style={[S.sq, {backgroundColor: t.alt}]} /><View style={[S.sq, {backgroundColor: t.body}]} />
                  </View>
                ) : null}
                {on ? <Icon name="checkmark" size={20} color={t.alt && t.alt !== '#141B34' && t.body !== '#141B34' ? C.ink : C.white} /> : null}
              </Press>
            );
          })}
          <Press accessibilityRole="button" accessibilityLabel="Voltar à cor original" accessibilityState={{selected: color === undefined}} onPress={() => setColor(undefined)} quiet style={[S.swatch, {backgroundColor: '#25316C'}, color === undefined && S.swatchOn]}>
            <Text style={{fontSize: 10, fontWeight: '900', color: C.white}}>PADRÃO</Text>
          </Press>
        </View>

        <Text style={T.kicker}>PADRÃO NO CORPO DA FITA</Text>
        <View style={S.row}>
          <Press accessibilityRole="button" accessibilityLabel="Sem padrão" accessibilityState={{selected: !pattern}} onPress={() => setPattern(undefined)} quiet style={[S.chip, !pattern && S.chipOn]}><Text style={S.chipText}>LISA</Text></Press>
          {PATTERNS.map((p) => (
            <Press key={p.key} accessibilityRole="button" accessibilityLabel={`Padrão ${p.name}`} accessibilityState={{selected: pattern === p.key}} onPress={() => setPattern(p.key)} quiet style={[S.chip, pattern === p.key && S.chipOn]}>
              <Text style={S.chipText}>{p.name.toUpperCase()}</Text>
            </Press>
          ))}
        </View>

        <Text style={T.kicker}>BORDA DA FITA</Text>
        <View style={S.row}>
          <Press accessibilityRole="button" accessibilityLabel="Borda normal" accessibilityState={{selected: !edge}} onPress={() => setEdge(undefined)} quiet style={[S.chip, !edge && S.chipOn]}><Text style={S.chipText}>NORMAL</Text></Press>
          {EDGES.map((e) => (
            <Press key={e.key} accessibilityRole="button" accessibilityLabel={`Borda ${e.name}`} accessibilityState={{selected: edge === e.key}} onPress={() => setEdge(e.key)} quiet style={[S.chip, edge === e.key && S.chipOn]}>
              <Text style={S.chipText}>{e.name.toUpperCase()}</Text>
            </Press>
          ))}
        </View>

        <Text style={T.kicker}>FIGURINHAS <Text style={{color: C.ink}}>{stickers.length}/{MAX_STICKERS}</Text></Text>
        <View style={S.row}>
          {STICKERS.map((s) => (
            <Press key={s} accessibilityRole="button" accessibilityLabel={`Colocar figurinha ${s}`} disabled={stickers.length >= MAX_STICKERS} onPress={() => add(s)} quiet style={[S.sticker, stickers.length >= MAX_STICKERS && {opacity: 0.4}]}>
              <Text style={{fontSize: 24}}>{s}</Text>
            </Press>
          ))}
        </View>

        <Text style={T.kicker}>IMAGEM NO RÓTULO</Text>
        <Text style={T.small}>A imagem fica atrás do nome da fita, onde fica a etiqueta.</Text>
        <View style={{flexDirection: 'row', gap: 10}}>
          <View style={{flex: 1}}><Btn small kind="ghost" icon="image" text={image ? 'TROCAR IMAGEM' : 'ESCOLHER IMAGEM'} label="Escolher imagem do rótulo" onPress={() => { void pickImage(); }} /></View>
          {image ? <View style={{flex: 1}}><Btn small kind="ghost" icon="close-circle-outline" text="TIRAR IMAGEM" onPress={() => setImage(undefined)} /></View> : null}
        </View>
        {err ? <Text style={[T.small, {color: '#9B2C4A'}]}>{err}</Text> : null}

        <Text style={T.kicker}>ANOTAÇÃO <Text style={{color: C.ink}}>{note.length}/{MAX_NOTE}</Text></Text>
        <TextInput value={note} onChangeText={(v) => setNote(v.slice(0, MAX_NOTE))} multiline accessibilityLabel="Anotação da fita" placeholder="Ex.: fazer 3 séries de supino ouvindo esta fita; descanso de 45 s" placeholderTextColor="#8E99BF" style={S.note} />

      </ScrollView>
      <View style={{gap: 8, marginTop: 10}}>
        <Btn icon="checkmark" text="SALVAR FITA" onPress={save} />
        <Btn small kind="ghost" icon="refresh" text="VOLTAR AO PADRÃO" label="Voltar a fita ao padrão" onPress={reset} />
      </View>
    </Sheet>
  );
}

const S = StyleSheet.create({
  stage: {alignItems: 'center', gap: 10, backgroundColor: '#17104A', borderRadius: R.lg, paddingTop: 16, paddingBottom: 10, paddingHorizontal: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.ink, borderBottomWidth: 5},
  hint: {fontSize: 12, fontWeight: '700', color: '#C9D2F5', textAlign: 'center'},
  tools: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.yellow, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: C.ink},
  toolBtn: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.ink},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  swatch: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  check: {...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 20, overflow: 'hidden'},
  sq: {width: '50%', height: '50%'},
  swatchOn: {borderWidth: 4, borderColor: C.ink, transform: [{scale: 1.08}]},
  chip: {paddingHorizontal: 14, height: 40, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.line},
  chipOn: {backgroundColor: C.yellow, borderColor: C.ink},
  chipText: {fontSize: 13, fontWeight: '900', letterSpacing: 0.8, color: C.ink},
  sticker: {width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.line},
  note: {minHeight: 96, textAlignVertical: 'top', backgroundColor: '#FFF6C9', borderRadius: R.md, padding: 12, fontSize: 15, color: C.ink, borderWidth: 2, borderColor: C.ink},
});
