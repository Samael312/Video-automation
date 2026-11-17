import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Hello} from './compositions/Hello';
import {Captions, CaptionsProps, Transcript} from './compositions/Captions';
import {Edit, EditProps} from './Edit';
import {GALLERY_FRAMES, MotionGallery} from './compositions/MotionGallery';
import {defaultPlan, type EditPlan} from './lib/plan';
import {quantizeKeeps, totalFrames} from './lib/cuts';
import type {CutsFile} from './lib/types';
import {AbsoluteFill} from 'remotion';
import {GsapDemo} from './scenes/generated/gsap-demo';
import {referencia} from './styles/referencia/theme';

/** Prueba aislada de la escena GSAP sobre fondo oscuro. */
const GsapTest: React.FC = () => (
  <AbsoluteFill style={{background: '#1b1b1b'}}>
    <GsapDemo props={{}} theme={referencia} durationInFrames={90} />
  </AbsoluteFill>
);

const FPS = 30;

export const Root: React.FC = () => (
  <>
    <Composition id="MotionGallery" component={MotionGallery} durationInFrames={GALLERY_FRAMES} fps={FPS} width={720} height={1280} />
    <Composition id="GsapTest" component={GsapTest} durationInFrames={90} fps={FPS} width={720} height={1280} />
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
      id="Edit"
      component={Edit}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={{videoSrc: 'ACTUALLY.mp4', transcript: null, keeps: [], plan: null} as unknown as EditProps}
      // Lee <video>.transcript.json, <video>.cuts.json (si falta: video completo) y <video>.edit.json (si falta: plan por defecto)
      calculateMetadata={async ({props}) => {
        const name = props.videoSrc.replace(/\.[^.]+$/, '');
        const transcript: Transcript = await (await fetch(staticFile(`${name}.transcript.json`))).json();
        const cutsRes = await fetch(staticFile(`${name}.cuts.json`));
        const rawKeeps = cutsRes.ok ? ((await cutsRes.json()) as CutsFile).keeps : [{start: 0, end: transcript.duration}];
        // Tramos alineados a frames: video, subtitulos, zoom y escenas comparten la misma linea de tiempo
        const keeps = quantizeKeeps(rawKeeps, FPS);
        // Si las props ya traen plan (p. ej. render --no-music), se usa ese; si no, public/<video>.edit.json
        const planRes = props.plan ? null : await fetch(staticFile(`${name}.edit.json`));
        const plan: EditPlan = props.plan ?? (planRes?.ok ? await planRes.json() : defaultPlan(props.videoSrc));
        return {durationInFrames: totalFrames(keeps, FPS), props: {...props, transcript, keeps, plan}};
      }}
    />
  </>
);
