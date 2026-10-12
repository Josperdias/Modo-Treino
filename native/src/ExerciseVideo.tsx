/** Player do vídeo do exercício (expo-video). "contain": o vídeo aparece inteiro, sem cortar. Toque para pausar/continuar. */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useVideoPlayer, VideoView} from 'expo-video';
import {R} from './theme';
import type {ExVideo} from './video';

export default function ExerciseVideo({video, height = 360}: {video: ExVideo; height?: number}) {
  const player = useVideoPlayer({uri: video.uri}, (p) => { p.loop = true; p.play(); });
  return (
    <View style={[S.box, {height}]} accessibilityLabel={`Vídeo: ${video.name}`}>
      <VideoView player={player} style={S.video} contentFit="contain" nativeControls surfaceType="textureView" />
    </View>
  );
}
const S = StyleSheet.create({
  box: {width: '100%', borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#05081A', borderWidth: 2, borderColor: '#141B34'},
  video: {width: '100%', height: '100%'},
});
