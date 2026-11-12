import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Hello} from './compositions/Hello';
import {Captions, CaptionsProps, Transcript} from './compositions/Captions';
import {Styled, StyledProps} from './styles/referencia/Styled';
import {totalFrames} from './lib/cuts';
import type {CutsFile} from './lib/types';

const FPS = 30;

export const Root: React.FC = () => (
  <>
    <Composition id="Hello" component={Hello} durationInFrames={90} fps={30} width={1080} height={1920} />
    <Composition
      id="Captions"
      component={Captions}
      width={720}  // = resolucion REAL del video normalizado (ver scripts/normalize_video.js)
      height={1280}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={{videoSrc: 'ACTUALLY.mp4', transcript: null, wordsPerPage: 3, fontSize: 52} as CaptionsProps}
      // Lee public/<video sin extension>.transcript.json y ajusta la duracion
      calculateMetadata={async ({props}) => {
        const name = props.videoSrc.replace(/\.[^.]+$/, '');
        const transcript: Transcript = await (await fetch(staticFile(`${name}.transcript.json`))).json();
        return {durationInFrames: Math.ceil(transcript.duration * FPS), props: {...props, transcript}};
      }}
    />
    <Composition
      id="Styled"
      component={Styled}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={{videoSrc: 'ACTUALLY.mp4', transcript: null, keeps: []} as StyledProps}
      // Lee <video>.transcript.json y <video>.cuts.json (si falta, conserva el video completo)
      calculateMetadata={async ({props}) => {
        const name = props.videoSrc.replace(/\.[^.]+$/, '');
        const transcript: Transcript = await (await fetch(staticFile(`${name}.transcript.json`))).json();
        const res = await fetch(staticFile(`${name}.cuts.json`));
        const keeps = res.ok ? ((await res.json()) as CutsFile).keeps : [{start: 0, end: transcript.duration}];
        return {durationInFrames: totalFrames(keeps, FPS), props: {...props, transcript, keeps}};
      }}
    />
  </>
);
