/** Motor de música do Modo Treino. Vocabulário do app:
 * - FITA = cada música do celular (um cassete por música). Vêm do próprio aparelho (sem importar), de uma pasta escolhida ou de arquivos copiados.
 * - BAG = playlist: junta fitas e/ou rádios ao vivo. No código a bag é o tipo `Tape` (nome histórico, guardado no armazenamento).
 * - Uma bag guarda só referências: tirar uma fita da bag NUNCA apaga o arquivo.
 * Sem YouTube e sem áudio invisível. */
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {forgetTrack, nextTrackId, resolveTape, tapeAdd, tapeInsert, tapeMove, tapeRemove} from '../../logic';
import {flag} from '../data';
import {tapeIndex} from './tapeIndex';
import {clampFadeSeconds, shouldHandleFinish} from './playbackSafety';
import {parseSeekAction} from './seekAction';
import {insertNextInQueue} from './queueNext';
import {ModoNotif} from '../../modules/modo-notif';
import {ModoPlayback, NativeState} from '../../modules/modo-playback';
import {buildNativeQueue} from './nativePilotQueue';
import {nativePlaylistForTrack, nativeRadioQueue, nativeTrackFromId} from './nativeIntegration';
import {buildRestorePlan} from './nativeRestore';

const NATIVE_SESSION_KEY = 'modotreino-native-session-v1';

// Ativar somente no APK de homologação: EXPO_PUBLIC_MODO_NATIVE_AUDIO=1.
// O código legado (incluindo as notificações ilustradas) segue padrão de produção.
const NATIVE_AUDIO_TEST = process.env.EXPO_PUBLIC_MODO_NATIVE_AUDIO === '1' && ModoPlayback.available;
import {askPermission, DeviceTrack, Permission, pickMusicFolder, readPermission, scanDevice, scanFolder} from './device';

export type Track = {id: string; title: string; artist?: string; uri: string; duration?: number; source: 'device' | 'file' | 'radio'; cc?: string; country?: string};
/** Bag (playlist). `ids` são fitas (faixas) e rádios. */
export type Tape = {id: string; name: string; ids: string[]};
type Library = {tracks: Track[]; tapes: Tape[]; selected: string; fade: number; shuffle: boolean; repeat: boolean; folders: string[]; volume: number; rate: number};

export type MusicAPI = {
  lib: Library;
  now: Track | null;
  live: boolean;
  playing: boolean;
  position: number;
  duration: number;
  /** Todas as fitas (músicas) disponíveis: lista do celular, pastas e arquivos copiados. */
  library: Track[];
  /** Bag selecionada e o que há nela. */
  activeTape: Tape;
  tapeTracks: Track[];
  missing: number;
  device: DeviceTrack[];
  scanning: boolean;
  permission: Permission;
  scan: (ask?: boolean) => Promise<void>;
  addFolder: () => Promise<void>;
  addToTape: (tracks: Track[]) => void;
  removeFromTape: (id: string) => void;
  restoreToTape: (track: Track, index: number) => void;
  moveInTape: (id: string, delta: number) => void;
  newTape: (name: string) => string;
  renameTape: (name: string) => void;
  deleteTape: () => void;
  selectTape: (id: string) => void;
  importFiles: () => Promise<void>;
  forgetImported: (id: string) => void;
  /** Toca uma fita de dentro de uma bag (a fila é a bag). */
  playTrack: (id: string, tapeId?: string) => Promise<void>;
  /** Toca uma fita da biblioteca (a fila são todas as fitas, na ordem mostrada). */
  playFita: (track: Track, pool: Track[]) => Promise<void>;
  playAll: (shuffle: boolean, pool?: Track[]) => void;
  playRadio: (station: Track) => Promise<void>;
  playPause: () => void;
  skip: (delta: number) => void;
  seek: (seconds: number) => void;
  setFade: (seconds: number) => void;
  setShuffle: (value: boolean) => void;
  setRepeat: (value: boolean) => void;
  setVolume: (v: number) => void;
  setRate: (r: number) => void;
  sleepLeft: number;
  setSleep: (minutes: number) => void;
  playNext: (id: string) => void;
  copyToTape: (track: Track, tapeId: string) => void;
  playTape: (shuffle: boolean, tapeId?: string) => void;
  /** Coração do player: guarda/tira a fita (ou rádio) na bag "Favoritas" (criada se não existir). */
  isFav: (id: string) => boolean;
  toggleFav: (track: Track) => void;
  /** Rádio tocando: nome da faixa lido dos metadados do stream (quando a rádio os publica). */
  radioTrack: {id: string; title: string | null; state: 'buscando' | 'ok' | 'sem'} | null;
  setRadioTrack: (id: string, title: string | null, icy: boolean) => void;
  /** Nome da fila quando não é uma bag (ex.: "Todas as fitas"); null quando toca a bag selecionada. */
  queueName: string | null;
};

const KEY = 'modotreino-native-music-v1';
const createDefault = (): Library => ({
  tracks: [],
  tapes: [{id: 'a', name: 'Treino A', ids: []}, {id: 'b', name: 'Treino B', ids: []}, {id: 'fav', name: 'Favoritas', ids: []}],
  selected: 'a', fade: 3, shuffle: false, repeat: false, folders: [], volume: 1, rate: 1,
});
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const cleanName = (name: string) => name.replace(/\.[^.]+$/, '').trim().slice(0, 100) || 'Minha música';
const Ctx = createContext<MusicAPI | null>(null);

/** Referências a faixas do celular ou rádios que não estão em nenhuma bag não precisam ficar guardadas (o arquivo continua onde está). */
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
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [queueName, setQueueName] = useState<string | null>(null);
  const queueRef = useRef<Track[] | null>(null);
  const [radioTrack, setRadioTrackState] = useState<{id: string; title: string | null; state: 'buscando' | 'ok' | 'sem'} | null>(null);
  const [nativeState, setNativeState] = useState<NativeState | null>(null);
  const nativeQueue = useRef<Track[]>([]);
  const nativeCommand = useRef(0);
  const nativeActive = NATIVE_AUDIO_TEST;

  const one = useAudioPlayer(null, {updateInterval: 300});
  const two = useAudioPlayer(null, {updateInterval: 300});
  const stOne = useAudioPlayerStatus(one);
  const stTwo = useAudioPlayerStatus(two);
  const channel = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const changing = useRef(false);
  // Último comando recebido durante a troca: não deve ser descartado por um toque rápido.
  const queuedBegin = useRef<{src: Track; withFade: boolean} | null>(null);
  const beginRef = useRef<(src: Track, withFade: boolean) => Promise<void>>(async () => {});
  // Evita avançar várias faixas quando didJustFinish reaparece durante re-renderizações.
  const handledFinish = useRef<string | null>(null);
  const currentPlayer = channel.current === 0 ? one : two;
  const currentStatus = channel.current === 0 ? stOne : stTwo;
  const libRef = useRef(lib);
  const nowRef = useRef<Track | null>(nowTrack);
  const playingRef = useRef(playing);
  useEffect(() => { libRef.current = lib; }, [lib]);
  useEffect(() => { nowRef.current = nowTrack; }, [nowTrack]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // O Media3 é a fonte do clock e do avanço de fila no APK experimental.
  // Eventos do serviço chegam ao JS quando disponível; o progresso da UI é consultado
  // somente enquanto a tela está ativa, sem controlar o avanço das músicas.
  useEffect(() => {
    if (!nativeActive) return;
    let mounted = true;
    const apply = (state: NativeState) => {
      if (!mounted) return;
      setNativeState(state);
      const found = nativeTrackFromId(state.mediaId, nativeQueue.current, libRef.current.tracks) ||
        (state.mediaId ? {id: state.mediaId, title: state.title || 'Fita', artist: state.artist || undefined,
          uri: state.uri || '', source: state.mediaId.startsWith('radio:') ? 'radio' as const : 'file' as const} : null);
      if (found && nowRef.current?.id !== found.id) {
        nowRef.current = found; setNowTrack(found);
        setRadioTrackState(found.source === 'radio' ? {id: found.id, title: null, state: 'buscando'} : null);
      }
      if (state.count === 0) { nowRef.current = null; setNowTrack(null); }
      playingRef.current = state.playing; setPlaying(state.playing);
    };
    const unsubscribe = ModoPlayback.onState(apply);
    // Um único motor ativo: nunca iniciar expo-audio no mesmo caminho.
    one.pause(); two.pause();
    ModoNotif.musicStop();
    void ModoPlayback.getState().then(apply).catch(() => {});
    let ticker: ReturnType<typeof setInterval> | undefined;
    const updatePolling = (status: string) => {
      if (ticker) { clearInterval(ticker); ticker = undefined; }
      if (status === 'active') ticker = setInterval(() => {
        void ModoPlayback.getState().then(apply).catch(() => {});
      }, 950);
    };
    updatePolling(AppState.currentState);
    const appSub = AppState.addEventListener('change', updatePolling);
    return () => { mounted = false; unsubscribe(); appSub.remove(); if (ticker) clearInterval(ticker); };
  }, [nativeActive, one, two]);

  // Piloto Media3: guarda a fila local e a posição (a cada ~5 s) e, se o serviço morreu, recoloca tudo PAUSADO ao reabrir.
  const nativeBucket = Math.floor((nativeState?.positionMs ?? 0) / 5000);
  useEffect(() => {
    if (!nativeActive || !nativeState || nativeState.count === 0 || !nativeState.mediaId) return;
    const queue = nativeQueue.current.filter((x) => x.source !== 'radio');
    if (!queue.some((x) => x.id === nativeState.mediaId)) return;
    AsyncStorage.setItem(NATIVE_SESSION_KEY, JSON.stringify({
      ids: queue.map((x) => x.id), currentId: nativeState.mediaId, positionMs: nativeState.positionMs, savedAt: Date.now(),
    })).catch(() => {});
  }, [nativeActive, nativeState?.mediaId, nativeState?.playing, nativeBucket]);
  useEffect(() => {
    if (!nativeActive || !loaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const current = await ModoPlayback.getState();
        if (cancelled || current.count > 0) return; // o serviço ainda está vivo: nada a restaurar
        const raw = await AsyncStorage.getItem(NATIVE_SESSION_KEY);
        const plan = buildRestorePlan(raw ? JSON.parse(raw) : null, libRef.current.tracks);
        if (!plan || cancelled) return;
        nativeQueue.current = plan.tracks;
        await ModoPlayback.loadQueue(plan.items, plan.index, false); // autoplay=false: nunca toca sozinho
        if (plan.positionMs > 0) await ModoPlayback.seekTo(plan.positionMs);
        await Promise.all([
          ModoPlayback.setVolume(libRef.current.volume), ModoPlayback.setRate(libRef.current.rate),
          ModoPlayback.setRepeat(libRef.current.repeat), ModoPlayback.setShuffle(libRef.current.shuffle),
        ]);
      } catch { /* sem sessão para restaurar */ }
    })();
    return () => { cancelled = true; };
  }, [nativeActive, loaded]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (Array.isArray(d.tapes) && Array.isArray(d.tracks) && d.tapes.length) {
          setLib({...createDefault(), ...d, folders: Array.isArray(d.folders) ? d.folders : [], volume: typeof d.volume === 'number' ? d.volume : 1, rate: typeof d.rate === 'number' ? d.rate : 1, tracks: d.tracks.map((t: Track) => ({...t, source: t.source === 'device' ? 'device' : t.source === 'radio' ? 'radio' : 'file'}))});
        }
      } catch { /* biblioteca antiga ilegível: começa vazia */ }
    }).finally(() => setLoaded(true));
    setAudioModeAsync({playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix'}).catch(() => {});
    readPermission().then(setPermission).catch(() => {});
  }, []);
  useEffect(() => { if (loaded) void scanRef.current(false); }, [loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(lib)).catch(() => {}); }, [lib, loaded]);
  // Pausa, troca manual e timer não podem deixar o canal anterior audível durante um crossfade.
  const cancelFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
    const vol = Math.max(0, Math.min(1, libRef.current.volume ?? 1));
    one.volume = vol; two.volume = vol;
  }, [one, two]);
  useEffect(() => () => { if (fadeTimer.current) clearInterval(fadeTimer.current); }, []);

  // timer para dormir: pausa quando chega a hora
  useEffect(() => {
    if (!sleepAt) return;
    const t = setInterval(() => {
      setClock(Date.now());
      if (Date.now() >= sleepAt) {
        if (nativeActive) void ModoPlayback.pause().catch(() => {});
        else { cancelFade(); one.pause(); two.pause(); }
        setPlaying(false); playingRef.current = false; setSleepAt(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sleepAt, one, two, cancelFade, nativeActive]);

  const activeTape = useMemo(() => lib.tapes.find((t) => t.id === lib.selected) || lib.tapes[0], [lib]);
  const resolved = useMemo(() => resolveTape(activeTape, lib.tracks), [activeTape, lib.tracks]);
  const now = nowTrack;
  const live = nowTrack?.source === 'radio';

  const nextId = useCallback((dir: number) => {
    const s = libRef.current;
    const tape = s.tapes.find((t) => t.id === s.selected) || s.tapes[0];
    const q = queueRef.current; // tocando da biblioteca: segue todas as fitas; senão, a bag escolhida
    const ids = q ? q.map((t) => t.id) : tape.ids.filter((id) => s.tracks.some((t) => t.id === id));
    return nextTrackId(ids, nowRef.current?.id, dir, {shuffle: s.shuffle, repeat: s.repeat});
  }, []);

  const begin = useCallback(async (src: Track, withFade = true) => {
    if (nativeActive) {
      const command = ++nativeCommand.current;
      // Fitas/bags são somente referências: a fila não exclui nem copia arquivos.
      // O serviço nativo controla todas as próximas faixas com a tela bloqueada.
      const selected = libRef.current.tapes.find(t => t.id === libRef.current.selected);
      const playlist = src.source === 'radio' && !selected?.ids.includes(src.id)
        ? nativeRadioQueue(src)
        : nativePlaylistForTrack(src, queueRef.current, selected, libRef.current.tracks);
      try {
        const {items, index} = buildNativeQueue(playlist, src.id);
        // Nunca permitir sessões simultâneas de expo-audio e Media3.
        cancelFade(); one.pause(); two.pause(); ModoNotif.musicStop();
        const snapshot = await ModoPlayback.loadQueue(items, index, true);
        if (command !== nativeCommand.current) return;
        nativeQueue.current = playlist;
        nowRef.current = src; setNowTrack(src); setNativeState(snapshot);
        playingRef.current = snapshot.playing; setPlaying(snapshot.playing);
        setRadioTrackState(src.source === 'radio' ? {id: src.id, title: null, state: 'buscando'} : null);
        await Promise.all([
          ModoPlayback.setVolume(libRef.current.volume),
          ModoPlayback.setRate(src.source === 'radio' ? 1 : libRef.current.rate),
          ModoPlayback.setRepeat(libRef.current.repeat),
          ModoPlayback.setShuffle(libRef.current.shuffle && src.source !== 'radio'),
        ]);
      } catch {
        if (command === nativeCommand.current) Alert.alert('Não foi possível tocar', 'O Media3 não conseguiu abrir esta fita ou rádio. O motor antigo permanece disponível na build padrão.');
      }
      return;
    }
    if (changing.current) {
      // Ao clicar em outra música durante a troca, vence o comando mais recente.
      queuedBegin.current = {src, withFade};
      return;
    }
    changing.current = true;
    try {
      const oldIndex = channel.current;
      const old = oldIndex === 0 ? one : two;
      const other = oldIndex === 0 ? two : one;
      const hadSound = Boolean(nowRef.current && playingRef.current);
      const seconds = hadSound && withFade && src.source !== 'radio'
        ? clampFadeSeconds(libRef.current.fade, oldIndex === 0 ? stOne.duration : stTwo.duration)
        : 0;
      // Qualquer transição anterior é interrompida antes de iniciar uma nova.
      cancelFade();
      const vol = Math.max(0, Math.min(1, libRef.current.volume ?? 1));
      other.pause(); other.replace({uri: src.uri}); other.volume = seconds ? 0 : vol; other.play();
      try { other.setPlaybackRate?.(src.source === 'radio' ? 1 : libRef.current.rate || 1); } catch { /* velocidade é um extra */ }
      channel.current = 1 - oldIndex; nowRef.current = src; setNowTrack(src);
      handledFinish.current = null;
      setRadioTrackState(src.source === 'radio' ? {id: src.id, title: null, state: 'buscando'} : null); setPlaying(true); playingRef.current = true;
      if (seconds) {
        const started = Date.now();
        fadeTimer.current = setInterval(() => {
          const t = Math.min(1, (Date.now() - started) / (seconds * 1000));
          old.volume = Math.cos(t * Math.PI / 2) * vol; other.volume = Math.sin(t * Math.PI / 2) * vol;
          if (t >= 1) { old.pause(); old.volume = vol; if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; } }
        }, 60);
      } else { old.pause(); old.volume = vol; }
    } catch {
      Alert.alert('Não foi possível tocar', src.source === 'radio' ? 'Esta rádio não respondeu agora. Tente outra.' : 'Confira se a música ainda está no celular.');
      cancelFade(); one.pause(); two.pause();
      setPlaying(false); playingRef.current = false;
    } finally {
      changing.current = false;
      const pending = queuedBegin.current;
      queuedBegin.current = null;
      if (pending && pending.src.id !== nowRef.current?.id) void beginRef.current(pending.src, pending.withFade);
    }
  }, [one, two, stOne.duration, stTwo.duration, cancelFade, nativeActive]);
  beginRef.current = begin;

  const playById = useCallback((id: string, withFade = true) => {
    const t = queueRef.current?.find((x) => x.id === id) ?? libRef.current.tracks.find((x) => x.id === id);
    return t ? begin(t, withFade) : Promise.resolve();
  }, [begin]);

  const skip = useCallback((delta: number) => {
    if (nativeActive) {
      if (nowRef.current?.source !== 'radio') void (delta > 0 ? ModoPlayback.next() : ModoPlayback.previous()).catch(() => {});
      return;
    }
    const next = nextId(delta);
    if (next) void playById(next, true);
    else { cancelFade(); one.pause(); two.pause(); setPlaying(false); playingRef.current = false; }
  }, [playById, nextId, one, two, cancelFade, nativeActive]);

  // Prepara a próxima faixa antes da atual acabar: dois canais com curva de potência igual. Rádio ao vivo não tem fim.
  useEffect(() => {
    if (nativeActive || !nowTrack || !playing || changing.current) return;
    if (nowTrack.source === 'radio') { if (currentStatus.didJustFinish) { setPlaying(false); playingRef.current = false; } return; }
    const pos = currentStatus.currentTime || 0;
    const duration = currentStatus.duration || 0;
    const fade = lib.fade;
    if (shouldHandleFinish({didJustFinish: currentStatus.didJustFinish, playing, changing: changing.current,
      handledId: handledFinish.current, currentId: nowTrack.id})) {
      handledFinish.current = nowTrack.id;
      const next = nextId(1);
      if (next && next !== nowTrack.id) void playById(next, false);
      else if (next && next === nowTrack.id) {
        // Repetição de uma única fita: espere a cabeça voltar ao início.
        void currentPlayer.seekTo(0).then(() => {
          handledFinish.current = null;
          currentPlayer.play();
        }).catch(() => { setPlaying(false); playingRef.current = false; });
      }
      else { cancelFade(); one.pause(); two.pause(); setPlaying(false); playingRef.current = false; }
      return;
    }
    if (fade > 0 && duration > 0 && duration - pos <= fade + 0.25 && duration - pos > 0) {
      const next = nextId(1);
      if (next && next !== nowTrack.id && handledFinish.current !== nowTrack.id) {
        // Bloqueia múltiplos crossfades para uma mesma faixa enquanto o React atualiza os estados.
        handledFinish.current = nowTrack.id;
        void playById(next, true);
      }
    }
  }, [stOne, stTwo, nowTrack, playing, lib.fade, playById, nextId, currentPlayer, currentStatus]);

  const playPause = useCallback(() => {
    if (nativeActive && nowRef.current) {
      void (playingRef.current ? ModoPlayback.pause() : ModoPlayback.play()).catch(() => {});
      return;
    }
    if (!nowTrack) {
      const id = nextId(1);
      if (id) void playById(id, false);
      else Alert.alert('Sua bag está vazia', 'Coloque fitas (músicas do celular) ou uma rádio na bag, ou toque uma fita direto da lista.');
      return;
    }
    if (playingRef.current) {
      cancelFade(); one.pause(); two.pause(); setPlaying(false); playingRef.current = false;
    } else {
      // expo-audio mantém a cabeça de leitura no fim depois da última faixa.
      // Sem voltar a zero, tocar novamente aparenta travar após o término.
      const ended = currentStatus.didJustFinish || (
        currentStatus.duration > 0 && currentStatus.currentTime >= currentStatus.duration - 0.1
      );
      if (ended) void currentPlayer.seekTo(0).then(() => {
        handledFinish.current = null;
        currentPlayer.play(); setPlaying(true); playingRef.current = true;
      }).catch(() => {});
      else { handledFinish.current = null; currentPlayer.play(); setPlaying(true); playingRef.current = true; }
    }
  }, [nowTrack, nextId, playById, currentPlayer, currentStatus, one, two, cancelFade, nativeActive]);

  const scan = useCallback(async (ask = true) => {
    setScanning(true);
    try {
      let p = await readPermission();
      if (p !== 'granted' && ask) p = await askPermission();
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

  const scanRef = useRef(scan);
  useEffect(() => { scanRef.current = scan; }, [scan]);

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
      setLib((v) => ({...v, tracks: [...v.tracks, ...added]}));
    } catch { Alert.alert('Seletor indisponível', 'Não foi possível abrir os arquivos. Tente a lista do celular ou escolha uma pasta.'); }
  }, []);

  const library = useMemo(() => {
    const m = new Map<string, Track>();
    for (const t of device) m.set(t.id, t);
    for (const t of lib.tracks) if (t.source === 'file') m.set(t.id, t);
    return [...m.values()];
  }, [device, lib.tracks]);

  // Notificação nativa do player (cartão azul-céu no visual do app): acompanha faixa, tocar/pausar, favorito e o tempo (de 5 em 5 s).
  const bagName = queueName ?? `Bag ${activeTape.name}`;
  const favNow = !!(nowTrack && lib.tapes.find((t) => t.id === 'fav')?.ids.includes(nowTrack.id));
  const posBucket = Math.floor((currentStatus.currentTime || 0) / 5) * 5;
  const durNow = Math.round(currentStatus.duration || 0);
  useEffect(() => {
    if (nativeActive) return; // Media3 mantém apenas a própria sessão/notificação de teste.
    if (!nowTrack) { ModoNotif.musicStop(); return; }
    const radio = nowTrack.source === 'radio';
    const pais = `${flag(nowTrack.cc)} ${nowTrack.country || 'Rádio'}`;
    ModoNotif.music({
      title: radio && radioTrack?.title ? radioTrack.title : nowTrack.title,
      subtitle: radio ? (radioTrack?.title ? `${nowTrack.title} · ${pais}` : `${pais} · ao vivo`) : `${bagName}${nowTrack.artist ? ` · ${nowTrack.artist}` : ''}`,
      kicker: radio ? 'Rádio ao vivo' : 'Fita', art: radio ? -1 : tapeIndex(nowTrack.id), playing, live: radio,
      position: radio ? 0 : posBucket, duration: radio ? 0 : durNow, fav: favNow, skip: !radio,
    });
  }, [nowTrack, playing, radioTrack, bagName, favNow, posBucket, durNow, nativeActive]);
  useEffect(() => () => { ModoNotif.musicStop(); }, []);

  const api: MusicAPI = {
    lib, now, live, playing, position: nativeActive ? (nativeState?.positionMs ?? 0) / 1000 : currentStatus.currentTime || 0,
    duration: live ? 0 : nativeActive ? (nativeState?.durationMs ?? 0) / 1000 : currentStatus.duration || 0, library, activeTape,
    tapeTracks: resolved.tracks, missing: resolved.missing, device, scanning, permission, scan, addFolder, importFiles,
    addToTape: (tracks) => setLib((v) => {
      const known = new Set(v.tracks.map((x) => x.id));
      return {...v, tracks: [...v.tracks, ...tracks.filter((x) => !known.has(x.id))], tapes: tapeAdd(v.tapes, v.selected, tracks.map((x) => x.id))};
    }),
    // Só tira da bag. O arquivo do celular não é tocado.
    removeFromTape: (id) => setLib((v) => pruneRefs({...v, tapes: tapeRemove(v.tapes, v.selected, id)})),
    restoreToTape: (track, index) => setLib((v) => {
      const known = v.tracks.some((x) => x.id === track.id);
      return {...v, tracks: known ? v.tracks : [...v.tracks, track], tapes: tapeInsert(v.tapes, v.selected, track.id, index)};
    }),
    moveInTape: (id, delta) => setLib((v) => ({...v, tapes: tapeMove(v.tapes, v.selected, id, delta)})),
    newTape: (name) => {
      const id = uid();
      if (name.trim()) setLib((v) => ({...v, tapes: [...v.tapes, {id, name: name.trim().slice(0, 40), ids: []}], selected: id}));
      return id;
    },
    renameTape: (name) => { if (name.trim()) setLib((v) => ({...v, tapes: v.tapes.map((t) => (t.id === v.selected ? {...t, name: name.trim().slice(0, 40)} : t))})); },
    deleteTape: () => setLib((v) => (v.tapes.length < 2 ? v : pruneRefs({...v, tapes: v.tapes.filter((t) => t.id !== v.selected), selected: v.tapes.find((t) => t.id !== v.selected)!.id}))),
    selectTape: (id) => setLib((v) => ({...v, selected: id})),
    forgetImported: (id) => {
      const t = libRef.current.tracks.find((x) => x.id === id);
      if (!t || t.source !== 'file') return;
      if (nowRef.current?.id === id) {
        if (nativeActive) void ModoPlayback.clear().catch(() => {});
        else { cancelFade(); one.pause(); two.pause(); }
        setPlaying(false); playingRef.current = false;
        setNowTrack(null); nowRef.current = null; handledFinish.current = null;
      }
      setLib((v) => forgetTrack(v, id));
      FileSystem.deleteAsync(t.uri, {idempotent: true}).catch(() => {});
    },
    playTrack: async (id, tapeId) => {
      queueRef.current = null; setQueueName(null);
      if (tapeId && tapeId !== libRef.current.selected) { libRef.current = {...libRef.current, selected: tapeId}; setLib((v) => ({...v, selected: tapeId})); }
      await playById(id, true);
    },
    playFita: async (track, pool) => {
      queueRef.current = pool.length ? pool : [track]; setQueueName('Todas as fitas');
      await begin(track, true);
    },
    playAll: (shuffle, pool) => {
      const list = (pool && pool.length ? pool : library);
      if (!list.length) { Alert.alert('Nenhuma fita ainda', 'Permita o acesso às músicas do celular ou escolha uma pasta para ver suas fitas.'); return; }
      queueRef.current = list; setQueueName('Todas as fitas');
      setLib((v) => ({...v, shuffle})); libRef.current = {...libRef.current, shuffle};
      void begin(shuffle ? list[Math.floor(Math.random() * list.length)] : list[0], false);
    },
    playRadio: (station) => {
      // Estação ao vivo não herda uma fila antiga de músicas locais.
      queueRef.current = nativeActive ? [station] : null; setQueueName(null);
      return begin(station, false);
    },
    playPause, skip, seek: (seconds) => {
      if (nativeActive) {
        if (!live && Number.isFinite(seconds)) void ModoPlayback.seekTo(Math.max(0, seconds) * 1000).catch(() => {});
        return;
      }
      if (!live && Number.isFinite(seconds)) {
        const dur = currentStatus.duration || 0;
        const position = Math.max(0, dur > 0 ? Math.min(dur, seconds) : seconds);
        void currentPlayer.seekTo(position).catch(() => {});
      }
    },
    setFade: (seconds) => setLib((v) => ({...v, fade: Math.max(0, Math.min(8, seconds))})),
    setShuffle: (value) => { setLib((v) => ({...v, shuffle: value})); if (nativeActive) void ModoPlayback.setShuffle(value && !live).catch(() => {}); },
    setRepeat: (value) => { setLib((v) => ({...v, repeat: value})); if (nativeActive) void ModoPlayback.setRepeat(value).catch(() => {}); },
    setVolume: (v) => {
      const vol = Math.max(0, Math.min(1, v));
      libRef.current = {...libRef.current, volume: vol};
      setLib((l) => ({...l, volume: vol}));
      if (nativeActive) void ModoPlayback.setVolume(vol).catch(() => {});
      else if (!fadeTimer.current) { one.volume = vol; two.volume = vol; }
    },
    setRate: (r) => {
      setLib((l) => ({...l, rate: r}));
      if (nativeActive) { if (!live) void ModoPlayback.setRate(r).catch(() => {}); }
      else if (!live) { try { one.setPlaybackRate?.(r); two.setPlaybackRate?.(r); } catch { /* extra */ } }
    },
    sleepLeft: sleepAt ? Math.max(0, Math.ceil((sleepAt - (clock || Date.now())) / 1000)) : 0,
    setSleep: (minutes) => setSleepAt(minutes > 0 ? Date.now() + minutes * 60000 : null),
    // "Tocar a seguir" respeita a fila realmente em execução.
    // Quando ouvimos "Todas as fitas", a fila temporária muda SEM modificar a bag salva.
    playNext: (id) => {
      const track = library.find((x) => x.id === id) ?? libRef.current.tracks.find((x) => x.id === id);
      if (!track) return;
      if (nativeActive && nowRef.current) {
        // Atualiza SOMENTE a fila do motor, sem alterar uma bag persistida.
        void ModoPlayback.insertNext({id: track.id, uri: track.uri, title: track.title, artist: track.artist, source: track.source})
          .then(() => { nativeQueue.current = insertNextInQueue(nativeQueue.current, nowRef.current?.id, track); })
          .catch(() => {});
        return;
      }
      if (queueRef.current) {
        queueRef.current = insertNextInQueue(queueRef.current, nowRef.current?.id, track);
        return;
      }
      setLib((v) => ({
        ...v,
        tracks: v.tracks.some((x) => x.id === id) ? v.tracks : [...v.tracks, track],
        tapes: v.tapes.map((t) => {
          if (t.id !== v.selected) return t;
          const rest = t.ids.filter((x) => x !== id);
          const at = nowRef.current ? rest.indexOf(nowRef.current.id) : -1;
          rest.splice(at + 1, 0, id);
          return {...t, ids: rest};
        }),
      }));
    },
    copyToTape: (track, tapeId) => setLib((v) => ({...v, tracks: v.tracks.some((x) => x.id === track.id) ? v.tracks : [...v.tracks, track], tapes: tapeAdd(v.tapes, tapeId, [track.id])})),
    playTape: (shuffle, tapeId) => {
      const cur = libRef.current;
      const id = tapeId ?? cur.selected;
      const tape = cur.tapes.find((t) => t.id === id) || cur.tapes[0];
      const ids = tape.ids.filter((x) => cur.tracks.some((t) => t.id === x));
      if (!ids.length) { Alert.alert('Bag vazia', 'Coloque fitas (músicas do celular) ou uma rádio na bag para tocá-la.'); return; }
      queueRef.current = null; setQueueName(null);
      libRef.current = {...cur, selected: tape.id, shuffle};
      setLib((v) => ({...v, selected: tape.id, shuffle}));
      void playById(shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0], false);
    },
    isFav: (id) => !!lib.tapes.find((t) => t.id === 'fav')?.ids.includes(id),
    toggleFav: (track) => setLib((v) => {
      const tapes = v.tapes.some((t) => t.id === 'fav') ? v.tapes : [...v.tapes, {id: 'fav', name: 'Favoritas', ids: []}];
      const had = tapes.find((t) => t.id === 'fav')!.ids.includes(track.id);
      const tracks = v.tracks.some((x) => x.id === track.id) ? v.tracks : [...v.tracks, track];
      const next = {...v, tracks, tapes: tapes.map((t) => (t.id === 'fav' ? {...t, ids: had ? t.ids.filter((x) => x !== track.id) : [...t.ids, track.id]} : t))};
      return had ? pruneRefs(next) : next;
    }),
    radioTrack,
    setRadioTrack: (id, title, icy) => {
      if (nowRef.current?.id !== 'radio:' + id) return;      // resposta atrasada de outra rádio
      setRadioTrackState({id: nowRef.current.id, title, state: title ? 'ok' : icy ? 'buscando' : 'sem'});
    },
    queueName,
  };
  // Botões da notificação, do fone e do Bluetooth chegam aqui (a ref guarda sempre a versão mais nova das funções).
  const actions = useRef<(a: string) => void>(() => {});
  actions.current = (a) => {
    // Busca solicitada pelo controlador nativo do Android (MediaSession).
    // A barra ilustrada de RemoteViews permanece visualmente inalterada.
    const seekSeconds = parseSeekAction(a, currentStatus.duration || 0);
    if (seekSeconds !== null && nowRef.current?.source !== 'radio') {
      void currentPlayer.seekTo(seekSeconds).catch(() => {});
      return;
    }
    if (a === 'toggle') playPause();
    else if (a === 'play') { if (!playingRef.current) playPause(); }
    else if (a === 'pause') { if (playingRef.current) playPause(); }
    else if (a === 'next') skip(1);
    else if (a === 'prev') skip(-1);
    else if (a === 'fav') { if (nowRef.current) api.toggleFav(nowRef.current); }
    else if (a === 'close') {
      // Fechar precisa interromper ambos os canais, mesmo se estiver em transição.
      cancelFade(); one.pause(); two.pause(); setPlaying(false); playingRef.current = false;
      setNowTrack(null); nowRef.current = null; handledFinish.current = null;
      queueRef.current = null; setQueueName(null);
      ModoNotif.musicStop();
    }
  };
  useEffect(() => ModoNotif.onAction((e) => { if (e.kind === 'music' && !nativeActive) actions.current(e.action); }), [nativeActive]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useMusic() {
  const v = useContext(Ctx);
  if (!v) throw new Error('MusicProvider ausente');
  return v;
}
