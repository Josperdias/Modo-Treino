import type {Track, Tape} from './MusicProvider';
export declare function nativePlaylistForTrack(track: Track, temporaryPool: Track[] | null, tape: Tape | undefined, knownTracks: Track[]): Track[];
export declare function nativeRadioQueue(station: Track): Track[];
export declare function nativeTrackFromId(id: string | null, recentQueue: Track[], knownTracks: Track[]): Track | null;
