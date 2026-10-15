/** Personalizar a fita: cor, figurinhas, imagem de capa e anotação ("fita anotada"). Tudo fica só neste celular. */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, TextInput} from '../text';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {Btn, Icon, Press, Sheet} from '../ui';
import {C, R, T} from '../theme';
import {MiniTape, TAPES} from './Cassette';
import {tapeIndex} from './tapeIndex';
import {Track, useMusic} from './MusicProvider';

export const STICKERS = ['⭐', '🔥', '💪', '🎧', '❤️', '⚡', '🏋️', '🏃', '🎵', '🌈', '🌸', '👑', '💥', '😎', '🚀', '🎯'];
const MAX_STICKERS = 4, MAX_NOTE = 280;
const CAPAS = () => (FileSystem.documentDirectory || '') + 'capas/';
const isOurs = (uri?: string) => !!uri && uri.startsWith(CAPAS());
const drop = (uri?: string) => { if (isOurs(uri)) FileSystem.deleteAsync(uri!, {idempotent: true}).catch(() => {}); };

export default function FitaDecoSheet({track, open, onClose}: {track: Track | null; open: boolean; onClose: () => void}) {
  const m = useMusic();
  const [color, setColor] = useState<number | undefined>();
  const [stickers, setStickers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [oldImage, setOldImage] = useState<string | undefined>();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!track || !open) return;
    const d = m.deco(track.id);
    setColor(d?.color); setStickers(d?.stickers || []); setNote(d?.note || ''); setImage(d?.image); setOldImage(d?.image); setErr('');
  }, [track?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!track) return null;
  const toggle = (s: string) => setStickers((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length >= MAX_STICKERS ? cur : [...cur, s]));

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
    m.setDeco(track.id, {color: color ?? null, stickers, note, image: image ?? null} as never);
    if (oldImage && oldImage !== image) drop(oldImage);
    onClose();
  };
  const reset = () => {
    m.setDeco(track.id, null);
    drop(oldImage); if (image && image !== oldImage) drop(image);
    onClose();
  };
  const cancel = () => { if (image && image !== oldImage) drop(image); onClose(); };

  return (
    <Sheet visible={open} onClose={cancel} title="Personalizar a fita" scroll>
      <View style={{gap: 14, paddingBottom: 12}}>
        <View style={S.preview} accessible accessibilityLabel={`Prévia da fita ${track.title}`}>
          <MiniTape id={track.id} size={190} color={color} stickers={stickers} image={image} note={!!note.trim()} />
          <Text style={S.name} numberOfLines={2}>{track.title}</Text>
        </View>

        <Text style={T.kicker}>COR DA FITA</Text>
        <View style={S.swatches}>
          {TAPES.map((t, i) => {
            const on = (color ?? tapeIndex(track.id)) === i;
            return (
              <Press key={i} accessibilityRole="button" accessibilityLabel={`Cor ${i + 1} de 8`} accessibilityState={{selected: color === i}} onPress={() => setColor(i)} quiet style={[S.swatch, {backgroundColor: t.body}, on && S.swatchOn]}>
                {on ? <Icon name="checkmark" size={20} color={C.white} /> : null}
              </Press>
            );
          })}
          <Press accessibilityRole="button" accessibilityLabel="Voltar à cor original" onPress={() => setColor(undefined)} quiet style={[S.swatch, {backgroundColor: C.card}]}><Icon name="refresh" size={18} /></Press>
        </View>

        <Text style={T.kicker}>FIGURINHAS <Text style={{color: C.ink}}>{stickers.length}/{MAX_STICKERS}</Text></Text>
        <View style={S.stickers}>
          {STICKERS.map((s) => {
            const on = stickers.includes(s);
            return (
              <Press key={s} accessibilityRole="button" accessibilityLabel={`Figurinha ${s}`} accessibilityState={{selected: on}} onPress={() => toggle(s)} quiet style={[S.sticker, on && S.stickerOn]}>
                <Text style={{fontSize: 24}}>{s}</Text>
              </Press>
            );
          })}
        </View>

        <Text style={T.kicker}>IMAGEM DA CAPA</Text>
        <View style={{flexDirection: 'row', gap: 10}}>
          <View style={{flex: 1}}><Btn small kind="ghost" icon="image" text={image ? 'TROCAR IMAGEM' : 'ESCOLHER IMAGEM'} label="Escolher imagem da capa" onPress={() => { void pickImage(); }} /></View>
          {image ? <View style={{flex: 1}}><Btn small kind="ghost" icon="close-circle-outline" text="TIRAR IMAGEM" onPress={() => setImage(undefined)} /></View> : null}
        </View>
        {err ? <Text style={[T.small, {color: '#9B2C4A'}]}>{err}</Text> : null}

        <Text style={T.kicker}>ANOTAÇÃO <Text style={{color: C.ink}}>{note.length}/{MAX_NOTE}</Text></Text>
        <TextInput value={note} onChangeText={(v) => setNote(v.slice(0, MAX_NOTE))} multiline accessibilityLabel="Anotação da fita" placeholder="Ex.: fazer 3 séries de supino ouvindo esta fita; descanso de 45 s" placeholderTextColor="#8E99BF" style={S.note} />

        <Btn icon="checkmark" text="SALVAR FITA" onPress={save} />
        <Btn small kind="ghost" icon="refresh" text="VOLTAR AO PADRÃO" label="Voltar a fita ao padrão" onPress={reset} />
      </View>
    </Sheet>
  );
}

const S = StyleSheet.create({
  preview: {alignItems: 'center', gap: 10, backgroundColor: C.soft, borderRadius: R.lg, paddingVertical: 18, paddingHorizontal: 12},
  name: {fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center'},
  swatches: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  swatch: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink},
  swatchOn: {borderWidth: 4},
  stickers: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  sticker: {width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.line},
  stickerOn: {backgroundColor: C.yellow, borderColor: C.ink},
  note: {minHeight: 96, textAlignVertical: 'top', backgroundColor: '#FFF6C9', borderRadius: R.md, padding: 12, fontSize: 15, color: C.ink, borderWidth: 2, borderColor: C.ink},
});
