export function clampFadeSeconds(requestedSeconds: number, durationSeconds: number): number;
export function shouldHandleFinish(s: {didJustFinish: boolean; playing: boolean; changing: boolean; handledId: string | null; currentId: string}): boolean;
