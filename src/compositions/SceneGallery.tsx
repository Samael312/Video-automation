import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {TEMPLATES} from '../templates';
import type {SceneType} from '../lib/plan';
import {referencia} from '../styles/referencia/theme';

export const SCENE_GALLERY_STEP = 90;

/** Un ejemplo por plantilla fija, para revisarlas a ojo (`npm run studio` -> SceneGallery). */
const SAMPLES: {type: Exclude<SceneType, 'generated'>; data: Record<string, unknown>}[] = [
  {type: 'translate', data: {word: 'actually', translation: 'en realidad', emoji: '1f92b'}},
  {type: 'false-friend', data: {a: 'library', b: 'librería', note: 'library = biblioteca'}},
  {type: 'pronounce', data: {word: 'Christmas', syllables: ['Chris', 'mas'], phonetic: '/ˈkrɪs.məs/'}},
  {type: 'mistake', data: {wrong: 'Christmas night', right: 'Christmas Eve'}},
  {type: 'example', data: {sentence: 'I was so embarrassed yesterday', highlight: 'embarrassed'}},
  {type: 'quiz', data: {question: '¿Cómo se dice reno?', options: ['rain deer', 'reindeer', 'reno deer'], answer: 1, countdown: 2}},
  {type: 'before-after', data: {before: "I'm very tired", after: "I'm exhausted"}},
  {type: 'versus', data: {left: 'lift', right: 'elevator', leftLabel: 'Reino Unido', rightLabel: 'Estados Unidos'}},
  {type: 'listen', data: {phrase: 'What are you up to', hint: '¿Qué haces?'}},
  {type: 'countdown', data: {title: '3 palabras de Navidad', items: ['stocking', 'ornament', 'wrapping paper']}},
];
export const SCENE_GALLERY_FRAMES = SAMPLES.length * SCENE_GALLERY_STEP;

export const SceneGallery: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: referencia.sceneBg}}>
    {SAMPLES.map((s, i) => (
      <Sequence key={s.type} from={i * SCENE_GALLERY_STEP} durationInFrames={SCENE_GALLERY_STEP}>
        {React.createElement(TEMPLATES[s.type], {data: s.data, theme: referencia, durationInFrames: SCENE_GALLERY_STEP})}
      </Sequence>
    ))}
  </AbsoluteFill>
);
