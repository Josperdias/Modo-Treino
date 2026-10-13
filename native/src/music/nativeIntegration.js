/** Pure functions for the opt-in Media3 integration.
 * Do not mutate bags; radio and temporary playlists use in-memory references.
 */
export function nativePlaylistForTrack(track, temporaryPool, tape, knownTracks) {
  if (!track || !track.id) throw new Error('Faixa ausente');
  if (Array.isArray(temporaryPool) && temporaryPool.some(x => x?.id === track.id)) {
    return temporaryPool;
  }
  const byId = new Map((knownTracks || []).filter(Boolean).map(x => [x.id, x]));
  if (tape && Array.isArray(tape.ids) && tape.ids.includes(track.id)) {
    const bag = tape.ids.map(id => byId.get(id) || (id === track.id ? track : undefined)).filter(Boolean);
    if (bag.some(x => x.id === track.id)) return bag;
  }
  return [track];
}
export function nativeRadioQueue(station) {
  if (!station || station.source !== 'radio') throw new Error('Estação inválida');
  return [station];
}
export function nativeTrackFromId(id, recentQueue, knownTracks) {
  if (!id) return null;
  return (recentQueue || []).find(x => x.id === id) || (knownTracks || []).find(x => x.id === id) || null;
}
