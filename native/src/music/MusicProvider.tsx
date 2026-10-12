/** Motor de música do Modo Treino: bolsas (listas), reprodução local com transição suave e rádios ao vivo.
 * - As faixas vêm das músicas do próprio celular (sem importar), de uma pasta escolhida, de arquivos copiados ou de rádios.
 * - Uma bolsa guarda só referências: tirar uma faixa da bolsa NUNCA apaga o arquivo.
 * Sem YouTube e sem áudio invisível. */
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {forgetTrack, nextTrackId, resolveTape, tapeAdd, tapeInsert, tapeMove, tapeRemove} from '../../logic';
import {askPermission, DeviceTrack, Permission, pickMusicFolder, readPermission, scanDevice, scanFolder} from './device';

export type Track = {id: string; title: string; artist?: string; uri: string; duration?: number; source: 'device' | 'file' | 'radio'; cc?: string; country?: string};
export type Tape = {id: string; name: string; ids: string[]};
type Library = {tracks: Track[]; tapes: Tape[]; selected: string; fade: number; shuffle: boolean; repeat: boolean; folders: string[]};

export type MusicAPI = {
  lib: Library;
  now: Track | null;
  live: boolean;
  playing: boolean;
  position: number;
  duration: number;
  activeTape: Tape;
  tapeTracks: Track[];
  missing: number;
  device: DeviceTrack[];
  scanning: boolean;
  permission: Permission;
  scan: () => Promise<void>;
  addFolder: () => Promise<void>;
  addToTape: (tracks: Track[]) => void;
  removeFromTape: (id: string) => void;
  restoreToTape: (track: Track, index: number) => void;
  moveInTape: (id: string, delta: number) => void;
  newTape: (name: string) => void;
  renameTape: (name: string) => void;
  deleteTape: () => void;
  selectTape: (id: string) => void;
  importFiles: () => Promise<void>;
  forgetImported: (id: string) => void;
  playTrack: (id: string, tapeId?: string) => Promise<void>;
  playRadio: (station: Track) => Promise<void>;
  playPause: () => void;
  skip: (delta: number) => void;
  seek: (seconds: number) => void;
  setFade: (seconds: number) => void;
  setShuffle: (value: boolean) => void;
  setRepeat: (value: boolean) => void;
};

const KEY = 'modotreino-native-music-v1';
const createDefault = (): Library => ({
  tracks: [],
  tapes: [{id: 'a', name: 'Treino A', ids: []}, {id: 'b', name: 'Treino B', ids: []}, {id: 'fav', name: 'Favoritas', ids: []}],
  selected: 'a', fade: 3, shuffle: false, repeat: false, folders: [],
});
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const cleanName = (name: string) => name.replace(/\.[^.]+$/, '').trim().slice(0, 100) || 'Minha música';
const Ctx = createContext<MusicAPI | null>(null);

/** Referências a faixas do celular ou rádios que não estão em nenhuma bolsa não precisam ficar guardadas (o arquivo continua onde está). */
const pruneRefs = (lib: Library): Library => {
  const used = new Set(lib.tapes.flatMap((t) => t.ids));
  return {...lib, tracks: lib.tracks.filter((t) => t.source === 'file' || used.has(t.id))};
};

export function MusicProvider({children}: {children: React.ReactNode}) {
  const [lib, setLib] = useState<Library>(createDefault);
  const [loaded, setLoaded] = useState(false);
  const [nowTrack, setNowTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [device, setDevice] = useState<DeviceTrack[]>([]);
  const [scanning, setScanning] = useState(false);
  const [permission, setPermission] = useState<Permission>('unknown');

  const one = useAudioPlayer(null, {updateInterval: 300});
  const two = useAudioPlayer(null, {updateInterval: 300});
  const stOne = useAudioPlayerStatus(one);
  const stTwo = useAudioPlayerStatus(two);
  const channel = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const changing = useRef(false);
  const currentPlayer = channel.current === 0 ? one : two;
  const currentStatus = channel.current === 0 ? stOne : stTwo;
  const libRef = useRef(lib);
  const nowRef = useRef<Track | null>(nowTrack);
  const playingRef = useRef(playing);
  useEffect(() => { libRef.current = lib; }, [lib]);
  useEffect(() => { nowRef.current = nowTrack; }, [nowTrack]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (Array.isArray(d.tapes) && Array.isArray(d.tracks) && d.tapes.length) {
          setLib({...createDefault(), ...d, folders: Array.isArray(d.folders) ? d.folders : [], tracks: d.tracks.map((t: Track) => ({...t, source: t.source === 'device' ? 'device' : t.source === 'radio' ? 'radio' : 'file'}))});
        }
      } catch { /* biblioteca antiga ilegível: começa vazia */ }
    }).finally(() => setLoaded(true));
    setAudioModeAsync({playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers'}).catch(() => {});
    readPermission().then(setPermission).catch(() => {});
  }, []);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(lib)).catch(() => {}); }, [lib, loaded]);
  useEffect(() => () => { if (fadeTimer.current) clearInterval(fadeTimer.current); }, []);

  const activeTape = useMemo(() => lib.tapes.find((t) => t.id === lib.selected) || lib.tapes[0], [lib]);
  const resolved = useMemo(() => resolveTape(activeTape, lib.tracks), [activeTape, lib.tracks]);
  const now = nowTrack;
  const live = nowTrack?.source === 'radio';

  const nextId = useCallback((dir: number) => {
    const s = libRef.current;
    const tape = s.tapes.find((t) => t.id === s.selected) || s.tapes[0];
    const ids = tape.ids.filter((id) => s.tracks.some((t) => t.id === id));
    return nextTrackId(ids, nowRef.current?.id, dir, {shuffle: s.shuffle, repeat: s.repeat});
  }, []);

  const begin = useCallback(async (src: Track, withFade = true) => {
    if (changing.current) return;
    changing.current = true;
    try {
      const oldIndex = channel.current;
      const old = oldIndex === 0 ? one : two;
      const other = oldIndex === 0 ? two : one;
      const hadSound = Boolean(nowRef.current && playingRef.current);
      const seconds = hadSound && withFade && src.source !== 'radio' ? Math.min(8, Math.max(0, libRef.current.fade)) : 0;
      if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
      other.pause(); other.replace({uri: src.uri}); other.volume = seconds ? 0 : 1; other.play();
      try {
        old.clearLockScreenControls?.();
        other.setActiveForLockScreen?.(true, {title: src.title, artist: src.source === 'radio' ? `Rádio · ${src.country || 'ao vivo'}` : libRef.current.tapes.find((t) => t.id === libRef.current.selected)?.name || 'Modo Treino', albumTitle: 'Modo Treino'});
      } catch { /* controles da tela de bloqueio são um extra */ }
      channel.current = 1 - oldIndex; nowRef.current = src; setNowTrack(src); setPlaying(true); playingRef.current = true;
      if (seconds) {
        const started = Date.now();
        fadeTimer.current = setInterval(() => {
          const t = Math.min(1, (Date.now() - started) / (seconds * 1000));
          old.volume = Math.cos(t * Math.PI / 2); other.volume = Math.sin(t * Math.PI / 2);
          if (t >= 1) { old.pause(); old.volume = 1; if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; } }
        }, 60);
      } else { old.pause(); old.volume = 1; }
    } catch {
      Alert.alert('Não foi possível tocar', src.source === 'radio' ? 'Esta rádio não respondeu agora. Tente outra.' : 'Confira se a música ainda está no celular.');
      setPlaying(false); playingRef.current = false;
    } finally { changing.current = false; }
  }, [one, two]);

  const playById = useCallback((id: string, withFade = true) => {
    const t = libRef.current.tracks.find((x) => x.id === id);
    return t ? begin(t, withFade) : Promise.resolve();
  }, [begin]);

  const skip = useCallback((delta: number) => {
    const next = nextId(delta);
    if (next) void playById(next, true);
    else { currentPlayer.pause(); setPlaying(false); playingRef.current = false; }
  }, [playById, nextId, currentPlayer]);

  // Prepara a próxima faixa antes da atual acabar: dois canais com curva de potência igual. Rádio ao vivo não tem fim.
  useEffect(() => {
    if (!nowTrack || !playing || changing.current) return;
    if (nowTrack.source === 'radio') { if (currentStatus.didJustFinish) { setPlaying(false); playingRef.current = false; } return; }
    const pos = currentStatus.currentTime || 0;
    const duration = currentStatus.duration || 0;
    const fade = lib.fade;
    if (currentStatus.didJustFinish) {
      const next = nextId(1);
      if (next && next !== nowTrack.id) void playById(next, false);
      else if (next && next === nowTrack.id) { void currentPlayer.seekTo(0); currentPlayer.play(); }
      else { setPlaying(false); playingRef.current = false; }
      return;
    }
    if (fade > 0 && duration > 0 && duration - pos <= fade + 0.25 && duration - pos > 0) {
      const next = nextId(1);
      if (next && next !== nowTrack.id) void playById(next, true);
    }
  }, [stOne, stTwo, nowTrack, playing, lib.fade, playById, nextId, currentPlayer, currentStatus]);

  const playPause = useCallback(() => {
    if (!nowTrack) {
      const id = nextId(1);
      if (id) void playById(id, false);
      else Alert.alert('Sua bolsa está vazia', 'Toque em “Adicionar músicas” para encher a bolsa com as músicas do seu celular, ou ache uma rádio no globo.');
      return;
    }
    if (playing) { currentPlayer.pause(); setPlaying(false); playingRef.current = false; }
    else { currentPlayer.play(); setPlaying(true); playingRef.current = true; }
  }, [nowTrack, nextId, playById, playing, currentPlayer]);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      let p = await readPermission();
      if (p !== 'granted') p = await askPermission();
      setPermission(p);
      const found: DeviceTrack[] = p === 'granted' ? await scanDevice() : [];
      const folderTracks: DeviceTrack[] = [];
      for (const f of libRef.current.folders) folderTracks.push(...await scanFolder(f).catch(() => []));
      const byId = new Map<string, DeviceTrack>();
      for (const t of [...found, ...folderTracks]) byId.set(t.id, t);
      setDevice([...byId.values()]);
    } catch {
      Alert.alert('Não foi possível ler as músicas', 'Tente de novo, escolha uma pasta ou use “Arquivos”.');
    } finally { setScanning(false); }
  }, []);

  const addFolder = useCallback(async () => {
    setScanning(true);
    try {
      const r = await pickMusicFolder();
      if (!r) return;
      if (!r.tracks.length) { Alert.alert('Nenhuma música nessa pasta', 'Escolha a pasta onde ficam seus arquivos de música (por exemplo, Música ou Download).'); return; }
      setLib((v) => ({...v, folders: v.folders.includes(r.folder) ? v.folders : [...v.folders, r.folder]}));
      setDevice((d) => { const m = new Map(d.map((t) => [t.id, t])); for (const t of r.tracks) m.set(t.id, t); return [...m.values()]; });
    } catch { Alert.alert('Pasta indisponível', 'Não foi possível abrir essa pasta. Tente outra.'); }
    finally { setScanning(false); }
  }, []);

  const importFiles = useCallback(async () => {
    try {
      // "*/*": alguns seletores do Android escondem MP3 quando o filtro é só "audio/*". Filtramos pela extensão depois.
      const out = await DocumentPicker.getDocumentAsync({type: '*/*', multiple: true, copyToCacheDirectory: true});
      if (out.canceled) return;
      const folder = (FileSystem.documentDirectory || '') + 'modo-treino-audio/';
      await FileSystem.makeDirectoryAsync(folder, {intermediates: true});
      const added: Track[] = [];
      for (const file of out.assets) {
        if (!/^audio\//.test(file.mimeType || '') && !/\.(mp3|m4a|wav|aac|flac|ogg|oga|opus|wma|webm|amr)$/i.test(file.name)) continue;
        const id = uid();
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp3';
        const uri = folder + id + '.' + ext;
        try { await FileSystem.copyAsync({from: file.uri, to: uri}); added.push({id, title: cleanName(file.name), uri, source: 'file'}); } catch { /* arquivo ilegível: pula */ }
      }
      if (!added.length) { Alert.alert('Nenhuma música adicionada', 'Os arquivos escolhidos não parecem ser de áudio (MP3, M4A, WAV, FLAC…).'); return; }
      setLib((v) => ({...v, tracks: [...v.tracks, ...added], tapes: tapeAdd(v.tapes, v.selected, added.map((x) => x.id))}));
    } catch { Alert.alert('Seletor indisponível', 'Não foi possível abrir os arquivos. Tente a lista do celular ou escolha uma pasta.'); }
  }, []);

  const api: MusicAPI = {
    lib, now, live, playing, position: currentStatus.currentTime || 0, duration: live ? 0 : currentStatus.duration || 0, activeTape,
    tapeTracks: resolved.tracks, missing: resolved.missing, device, scanning, permission, scan, addFolder, importFiles,
    addToTape: (tracks) => setLib((v) => {
      const known = new Set(v.tracks.map((x) => x.id));
      return {...v, tracks: [...v.tracks, ...tracks.filter((x) => !known.has(x.id))], tapes: tapeAdd(v.tapes, v.selected, tracks.map((x) => x.id))};
    }),
    // Só tira da bolsa. O arquivo do celular não é tocado.
    removeFromTape: (id) => setLib((v) => pruneRefs({...v, tapes: tapeRemove(v.tapes, v.selected, id)})),
    restoreToTape: (track, index) => setLib((v) => {
      const known = v.tracks.some((x) => x.id === track.id);
      return {...v, tracks: known ? v.tracks : [...v.tracks, track], tapes: tapeInsert(v.tapes, v.selected, track.id, index)};
    }),
    moveInTape: (id, delta) => setLib((v) => ({...v, tapes: tapeMove(v.tapes, v.selected, id, delta)})),
    newTape: (name) => { if (name.trim()) { const id = uid(); setLib((v) => ({...v, tapes: [...v.tapes, {id, name: name.trim().slice(0, 40), ids: []}], selected: id})); } },
    renameTape: (name) => { if (name.trim()) setLib((v) => ({...v, tapes: v.tapes.map((t) => (t.id === v.selected ? {...t, name: name.trim().slice(0, 40)} : t))})); },
    deleteTape: () => setLib((v) => (v.tapes.length < 2 ? v : pruneRefs({...v, tapes: v.tapes.filter((t) => t.id !== v.selected), selected: v.tapes.find((t) => t.id !== v.selected)!.id}))),
    selectTape: (id) => setLib((v) => ({...v, selected: id})),
    forgetImported: (id) => {
      const t = libRef.current.tracks.find((x) => x.id === id);
      if (!t || t.source !== 'file') return;
      if (nowRef.current?.id === id) { one.pause(); two.pause(); setPlaying(false); playingRef.current = false; setNowTrack(null); nowRef.current = null; }
      setLib((v) => forgetTrack(v, id));
      FileSystem.deleteAsync(t.uri, {idempotent: true}).catch(() => {});
    },
    playTrack: async (id, tapeId) => {
      if (tapeId && tapeId !== libRef.current.selected) { libRef.current = {...libRef.current, selected: tapeId}; setLib((v) => ({...v, selected: tapeId})); }
      await playById(id, true);
    },
    playRadio: (station) => begin(station, false),
    playPause, skip, seek: (seconds) => { if (!live) void currentPlayer.seekTo(Math.max(0, seconds)); },
    setFade: (seconds) => setLib((v) => ({...v, fade: Math.max(0, Math.min(8, seconds))})),
    setShuffle: (value) => setLib((v) => ({...v, shuffle: value})),
    setRepeat: (value) => setLib((v) => ({...v, repeat: value})),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useMusic() {
  const v = useContext(Ctx);
  if (!v) throw new Error('MusicProvider ausente');
  return v;
}
