/** Cassete que acompanha a posição da música. Fica separado para que só ele re-renderize a cada atualização de posição
 * (as telas inteiras não precisam disso). */
import React from 'react';
import Cassette from './Cassette';
import {useMusicProgress} from './MusicProvider';

export default function LiveCassette({playing, label}: {playing: boolean; label: string}) {
  const {position, duration} = useMusicProgress();
  return <Cassette playing={playing} label={label} progress={duration > 0 ? position / duration : 0} />;
}
