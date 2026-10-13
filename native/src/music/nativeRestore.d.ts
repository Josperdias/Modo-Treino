import type {NativeTrack} from '../../modules/modo-playback';
import type {Track} from './MusicProvider';
export declare function buildRestorePlan(
  saved: unknown,
  knownTracks: Track[],
  now?: number,
): {tracks: Track[]; items: NativeTrack[]; index: number; positionMs: number} | null;
