/** Cassete que acompanha a posição da música. Fica separado para que só ele re-renderize a cada atualização de posição
 * (as telas inteiras não precisam disso). */
import React from 'react';
import Cassette from './Cassette';
import type {FitaDeco} from '../../logic';
import {useMusicProgress} from './MusicProvider';

export default function LiveCassette({playing, label, deco}: {playing: boolean; label: string; deco?: FitaDeco}) {
  const {position, duration} = useMusicProgress();
  return <Cassette playing={playing} label={label} progress={duration > 0 ? position / duration : 0} deco={deco} />;
}
