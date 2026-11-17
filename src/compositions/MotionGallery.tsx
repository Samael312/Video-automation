import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {Beat} from '../lib/motion';
import {referencia} from '../styles/referencia/theme';
import {Background} from '../motion/Background';
import {palette} from '../motion/palette';
import {LAYOUT_UI} from '../motion/layouts';

export const GALLERY_STEP = 45;

/** Ejemplos con el contenido de Plot_Twist (los recursos salen del video, no de la referencia). */
const SAMPLES: Beat[] = [
  {at: 0, layout: 'word', lead: 'en la historia que te', key: 'plot twist'},
  {at: 0, layout: 'prop', emoji: '1f631', lead: 'te deja en', key: 'shock'},
  {at: 0, layout: 'ring', emoji: '1f4d6', lead: 'un capitulo que', key: 'termina'},
  {at: 0, layout: 'list', title: '3 palabras de BookTok', items: ['plot twist', 'cliffhanger', 'page turner'], active: 1},
  {at: 0, layout: 'strike', items: ['aburrido', 'lento', 'page turner']},
  {at: 0, layout: 'swap', lead: 'plot twist =', from: 'plot twist', to: 'giro inesperado'},
  {at: 0, layout: 'card', frame: 'player', lead: 'cuando un capitulo', key: 'cliffhanger'},
  {at: 0, layout: 'big', key: '3'},
];
export const GALLERY_FRAMES = SAMPLES.length * 2 * GALLERY_STEP;

/** Los 8 layouts en claro y luego en oscuro, 45 frames cada uno, para revisarlos a ojo. */
export const MotionGallery: React.FC = () => (
  <AbsoluteFill>
    {(['light', 'dark'] as const).flatMap((bg, k) =>
      SAMPLES.map((beat, i) => (
        <Sequence key={`${bg}${i}`} from={(k * SAMPLES.length + i) * GALLERY_STEP} durationInFrames={GALLERY_STEP}>
          <Background bg={bg} props={i % 2 ? ['1f4da'] : ['1f4d6', '1f300']} durationInFrames={GALLERY_STEP} />
          {React.createElement(LAYOUT_UI[beat.layout], {
            beat,
            theme: referencia,
            pal: palette(bg),
            dark: bg === 'dark',
            durationInFrames: GALLERY_STEP,
            leadDelays: (beat.lead ?? beat.title ?? '').split(/\s+/).filter(Boolean).map((_, j) => j * 0.12),
          })}
        </Sequence>
      )),
    )}
  </AbsoluteFill>
);
