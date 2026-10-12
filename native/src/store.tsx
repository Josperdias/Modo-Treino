import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DEFAULT_SOUNDS, normalizeSoundSettings, setSoundSettings, SoundSettings} from '../SoundFX';
import type {Session} from '../logic';
import {clampSeries, normalizeRest, snapshotSession, workoutProgress} from '../logic';
import {EXERCISES, Exercise, Persona, Treino} from './data';
import type {ExVideo} from './video';

export type Override = {peso: string; series: number; reps: number};
export type Store = {
  persona: Persona;
  restExercise: number;
  restSet: number;
  sets: Record<string, Record<string, boolean[]>>;
  override: Record<string, Override>;
  sessions: Session[];
  notifyUpdates: boolean;
  keepAwake: boolean;
  notifyWorkout: boolean;
  /** Voz do treino (fala exercício, série e descanso). Desligada por padrão. */
  voice: boolean;
  /** Vídeo próprio de cada exercício (cópia dentro do app). Fica só neste celular: não entra no backup. */
  videos: Record<string, ExVideo>;
  sounds: SoundSettings;
};

export const STORAGE = 'modo-treino-native-v1';
const INITIAL: Store = {
  persona: 'vinho', restExercise: 60, restSet: 0, sets: {}, override: {}, sessions: [],
  notifyUpdates: true, keepAwake: false, notifyWorkout: true, voice: false, videos: {}, sounds: {...DEFAULT_SOUNDS},
};

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Ctx = {
  state: Store;
  loaded: boolean;
  update: (f: (prev: Store) => Store) => void;
  conf: (e: Exercise) => Override;
  total: (e: Exercise) => number;
  done: (e: Exercise) => boolean[];
  progress: (t: Treino) => ReturnType<typeof workoutProgress>;
  setDone: (e: Exercise, next: boolean[]) => void;
  saveOverride: (e: Exercise, o: Override) => void;
  finishWorkout: (t: Treino) => {ok: true; session: Session} | {ok: false; reason: 'empty' | 'already'};
  resetToday: (t: Treino) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<Store>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE).then((v) => {
      if (!v) return;
      try {
        const j = JSON.parse(v);
        setState({...INITIAL, ...j, ...normalizeRest(j), persona: j.persona === 'loira' ? 'loira' : 'vinho', sounds: normalizeSoundSettings(j.sounds), voice: j.voice === true, videos: j.videos && typeof j.videos === 'object' ? j.videos : {}});
      } catch { /* dados antigos corrompidos: começa do zero sem travar */ }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(() => { if (loaded) AsyncStorage.setItem(STORAGE, JSON.stringify(state)).catch(() => {}); }, [state, loaded]);
  useEffect(() => { setSoundSettings(state.sounds || DEFAULT_SOUNDS); }, [state.sounds]);

  const update = useCallback((f: (prev: Store) => Store) => setState(f), []);
  const conf = useCallback((e: Exercise): Override => ref.current.override[e.id] || {peso: e.peso, series: e.series, reps: e.reps}, []);
  const total = useCallback((e: Exercise) => clampSeries(ref.current.override[e.id]?.series || e.series), []);
  const done = useCallback((e: Exercise) => ref.current.sets[`${todayKey()}:${e.treino}`]?.[e.id] || [], []);

  const value = useMemo<Ctx>(() => {
    const progress = (t: Treino) => workoutProgress({exercises: EXERCISES, treino: t, getConf: conf, getDone: done});
    return {
      state, loaded, update, conf, total, done, progress,
      setDone: (e, next) => {
        const key = `${todayKey()}:${e.treino}`;
        setState((s) => ({...s, sets: {...s.sets, [key]: {...(s.sets[key] || {}), [e.id]: next}}}));
      },
      saveOverride: (e, o) => setState((s) => ({...s, override: {...s.override, [e.id]: o}})),
      finishWorkout: (t) => {
        const p = progress(t);
        if (p.sets < 1) return {ok: false, reason: 'empty'};
        if (ref.current.sessions.some((x) => x.date === todayKey() && x.treino === t)) return {ok: false, reason: 'already'};
        const d = new Date();
        const session = snapshotSession({exercises: EXERCISES, treino: t, date: todayKey(), time: d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), getConf: conf, getDone: done});
        setState((s) => ({...s, sessions: [...s.sessions, session]}));
        return {ok: true, session};
      },
      resetToday: (t) => setState((s) => { const sets = {...s.sets}; delete sets[`${todayKey()}:${t}`]; return {...s, sets}; }),
    };
    // state muda → recalcula; conf/done leem o ref já atualizado
  }, [state, loaded, update, conf, total, done]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppProvider ausente');
  return v;
}
