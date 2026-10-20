// Tipos da fonte única shared/logic.js (copiada para cá por scripts/sync-shared.mjs).
export type Treino = 'A' | 'B';
export type SessionItem = {id: string; nome: string; series: number; reps: number; peso: number};
export type SkippedItem = {id: string; nome: string};
export type Session = {date: string; time: string; treino: Treino; sets: number; percent: number; volume?: number; items?: SessionItem[]; skipped?: SkippedItem[]};
export type Conf = {series: number | string; reps: number | string; peso: number | string};
export type ParsedVersion = {major: number; minor: number; patch: number; pre: string[]};
export type ReleaseLike = {tag_name?: string; draft?: boolean; prerelease?: boolean; html_url?: string; body?: string | null; assets?: {name?: string; browser_download_url?: string; size?: number; digest?: string}[]};
export type UpdateState = {state: 'newer' | 'current' | 'ahead' | 'none'; release: ReleaseLike | null; tag: string};
export type BackupData = {persona: 'vinho' | 'loira'; rest: number; restExercise: number; restSet: number; sets: Record<string, Record<string, boolean[]>>; override: Record<string, {peso: string; series: number; reps: number}>; sessions: Session[]};

export const MAX_SETS: number;
export const MAX_REPS: number;
export const MAX_WEIGHT: number;
export const REST_OPTIONS: number[];
export function toNumber(value: unknown): number;
export function clampSeries(value: unknown): number;
export function parseVersion(tag: string): ParsedVersion | null;
export function compareVersions(a: string, b: string): -1 | 0 | 1;
export function pickLatestRelease(releases: unknown): ReleaseLike | null;
export function evaluateUpdate(installed: string, releases: unknown): UpdateState;
export function safeGithubUrl(url: unknown, repo?: string): string | null;
export function apkAsset(release: ReleaseLike | null, repo?: string): {name: string; url: string; size: number; sha256: string | null} | null;
export function snapshotSession(o: {exercises: {id: string; nome: string; treino: Treino}[]; treino: Treino; date: string; time?: string; getConf: (e: any) => Conf; getDone: (e: any) => boolean[]; getSkipped?: (e: any) => boolean}): Session;
export function annotateRecords(sessions: Session[]): string[][];
export function personalBests(sessions: Session[]): Record<string, {peso: number; date: string; nome: string}>;
export function totalVolume(sessions: Session[]): number;
export function streak(sessions: {date: string}[], todayKey: string): number;
export function sessionsToCsv(sessions: Session[]): string;
export function validateBackup(obj: unknown): BackupData;

export type ProgressItem = {id: string; total: number; done: number; complete: boolean; skipped: boolean};
export type WorkoutProgress = {list: ProgressItem[]; sets: number; total: number; percent: number; firstIncomplete: number; skippedCount: number};
export type NextStep = {type: 'same' | 'exercise' | 'done'; index: number};
export function doneCount(done: unknown, total: number): number;
export function withCount(k: number, total: number): boolean[];
export function tapSeries(done: unknown, k: number, total: number): boolean[];
export function workoutProgress(o: {exercises: {id: string; treino: Treino}[]; treino: Treino; getConf: (e: any) => Conf; getDone: (e: any) => boolean[]; getSkipped?: (e: any) => boolean}): WorkoutProgress;
export function setSkipped(ids: string[] | undefined, id: string, on: boolean): string[];
export function nextStep(list: ProgressItem[], i: number): NextStep;

export const REST_MAX: number;
export function normalizeRest(o: unknown): {restExercise: number; restSet: number};
export function restPlan(o: {exerciseDone?: boolean; workoutDone?: boolean; restExercise?: number; restSet?: number; rest?: number}): number;
export type TapeLike = {id: string; name: string; ids: string[]};
export type TrackLike = {id: string; title: string; artist?: string};
export function tapeAdd<T extends TapeLike>(tapes: T[], tapeId: string, trackIds: string[]): T[];
export function tapeRemove<T extends TapeLike>(tapes: T[], tapeId: string, trackId: string): T[];
export function tapeInsert<T extends TapeLike>(tapes: T[], tapeId: string, trackId: string, index: number): T[];
export function tapeMove<T extends TapeLike>(tapes: T[], tapeId: string, trackId: string, delta: number): T[];
export function forgetTrack<L extends {tracks: TrackLike[]; tapes: TapeLike[]}>(lib: L, trackId: string): L;
export function resolveTape<X extends TrackLike>(tape: TapeLike, tracks: X[]): {tracks: X[]; missing: number};
export function nextTrackId(ids: string[], currentId: string | null | undefined, dir: number, opts?: {shuffle?: boolean; repeat?: boolean; rand?: () => number}): string | null;
export function foldText(value: unknown): string;
export function searchRank<X>(items: X[], query: string, textsOf: (item: X) => string[]): X[];
export function searchTracks<X extends TrackLike>(tracks: X[], query: string): X[];
export function searchExercises<X extends {nome: string; grupo: string; codigo: string; treino: string; nota?: string; orientacao?: string}>(exercises: X[], query: string): X[];
export function searchBags<X extends {name: string}>(bags: X[], query: string): X[];
export function searchSessions<X extends {date: string; treino: string; items?: {nome: string}[]}>(sessions: X[], query: string): X[];
export function formatClock(seconds: number): string;
export function releaseNotes(body: string | null | undefined, max?: number): string[];
/** Figurinha sobre a fita: emoji, posição (0 a 1 da largura e da altura), tamanho (0,6 a 2,2) e giro em graus (-180 a 180). */
export type FitaSticker = {e: string; x: number; y: number; s: number; r: number};
export type FitaPattern = 'dots' | 'stripes' | 'check' | 'stars';
/** Borda da fita: xadrez preto e branco, listras de obra (amarelo e preto) ou listras de docinho (rosa e branco). */
export type FitaEdge = 'check' | 'hazard' | 'candy';
/** Personalização de uma fita: cor (0 a 13: 0 a 7 lisas, 8 a 13 xadrez de duas cores), padrão, até 6 figurinhas arrastáveis, imagem no rótulo (caminho do arquivo) e anotação (até 280 letras). */
/** Enquadramento da imagem do rótulo: modo (cover = preenche, contain = inteira e menor, stretch = estica para forçar o ajuste), zoom (0,25 a 3) e deslocamento (-1 a 1; 0 = centralizada). */
export type FitaImgFitMode = 'cover' | 'contain' | 'stretch';
export type FitaImgFit = {m: FitaImgFitMode; z: number; x: number; y: number};
export type FitaDeco = {imgFit?: FitaImgFit; color?: number; pattern?: FitaPattern; edge?: FitaEdge; stickers?: FitaSticker[]; note?: string; image?: string};
export function cleanDeco(raw: unknown): FitaDeco | null;
export function setDeco(deco: Record<string, FitaDeco> | undefined, id: string, patch: Partial<Omit<FitaDeco, 'stickers'>> & {stickers?: (FitaSticker | string)[]} | null): Record<string, FitaDeco>;
export function cleanDecoMap(map: unknown): Record<string, FitaDeco>;
