import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Hello} from './compositions/Hello';
import {Captions, CaptionsProps, Transcript} from './compositions/Captions';
import {Edit, EditProps} from './Edit';
import {defaultPlan, usesBehind, type EditPlan} from './lib/plan';
import {matteInfoFile, type MatteInfo} from './lib/matte';
import {quantizeKeeps, totalFrames} from './lib/cuts';
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
      id="Edit"
      component={Edit}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={{videoSrc: 'ACTUALLY.mp4', transcript: null, keeps: [], plan: defaultPlan('ACTUALLY.mp4')} as EditProps}
      // Lee <video>.transcript.json, <video>.cuts.json (si falta: video completo) y <video>.edit.json (si falta: plan por defecto)
      calculateMetadata={async ({props}) => {
        const name = props.videoSrc.replace(/\.[^.]+$/, '');
        const transcript: Transcript = await (await fetch(staticFile(`${name}.transcript.json`))).json();
        const cutsRes = await fetch(staticFile(`${name}.cuts.json`));
        const rawKeeps = cutsRes.ok ? ((await cutsRes.json()) as CutsFile).keeps : [{start: 0, end: transcript.duration}];
        // Tramos alineados a frames: video, subtitulos, zoom y escenas comparten la misma linea de tiempo
        const keeps = quantizeKeeps(rawKeeps, FPS);
        const planRes = await fetch(staticFile(`${name}.edit.json`));
        const plan: EditPlan = planRes.ok ? await planRes.json() : defaultPlan(props.videoSrc);
        // behind: matte.json da la altura de la cabeza para colocar el texto solo
        const matteRes = usesBehind(plan) ? await fetch(staticFile(matteInfoFile(props.videoSrc))) : null;
        const matte: MatteInfo | null = matteRes?.ok ? await matteRes.json() : null;
        return {durationInFrames: totalFrames(keeps, FPS), props: {...props, transcript, keeps, plan, matte}};
      }}
    />
  </>
);
