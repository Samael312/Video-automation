import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Hello} from './compositions/Hello';
import {Captions, CaptionsProps, Transcript} from './compositions/Captions';
import {Styled, StyledProps} from './styles/referencia/Styled';

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
      defaultProps={{videoSrc: 'ACTUALLY.mp4', transcript: null} as StyledProps}
      calculateMetadata={async ({props}) => {
        const name = props.videoSrc.replace(/\.[^.]+$/, '');
        const transcript: Transcript = await (await fetch(staticFile(`${name}.transcript.json`))).json();
        return {durationInFrames: Math.ceil(transcript.duration * FPS), props: {...props, transcript}};
      }}
    />
  </>
);
