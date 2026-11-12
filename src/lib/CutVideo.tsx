import React from 'react';
import {Audio, OffthreadVideo, Series, staticFile} from 'remotion';
import {keepFrames, type Keep} from './cuts';

type Props = {src: string; keeps: Keep[]; fps: number; cutSfx?: string; sfxVolume?: number};

/** Muestra solo los tramos `keeps` del video, uno tras otro; sfx suave en cada corte. */
export const CutVideo: React.FC<Props> = ({src, keeps, fps, cutSfx = 'sfx/swoosh.wav', sfxVolume = 0.25}) => (
  <Series>
    {keeps.map((k, i) => (
      <Series.Sequence key={i} durationInFrames={Math.max(1, keepFrames(k, fps))}>
        <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(k.start * fps)} />
        {i > 0 ? <Audio src={staticFile(cutSfx)} volume={sfxVolume} /> : null}
      </Series.Sequence>
    ))}
  </Series>
);
