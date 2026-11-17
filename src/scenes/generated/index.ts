import type React from 'react';
import type {Theme} from '../../styles/themes';
import {Demo} from './demo';
import {Definition} from './definition';
import {WordList} from './wordlist';
import {GsapDemo} from './gsap-demo';
import {ScribbleSwap} from './scribble-swap';
import {DreamBubble} from './dream-bubble';
import {FlipCard} from './flip-card';
import {FlyAway} from './fly-away';
import {DoChecklist} from './do-checklist';
import {BuildVsRun} from './build-vs-run';
import {VersusIntro} from './versus-intro';
import {MakeFactory} from './make-factory';

export type GeneratedProps = {props: Record<string, unknown>; theme: Theme; durationInFrames: number};

/**
 * Registro de escenas generadas. Convencion: un archivo `<nombre>.tsx` en esta carpeta
 * (componente `React.FC<GeneratedProps>`) + una linea aqui con su nombre.
 * El plan las usa con `{type: 'generated', data: {component: '<nombre>', props: {...}}}`.
 */
export const GENERATED: Record<string, React.FC<GeneratedProps>> = {
  demo: Demo,
  wordlist: WordList,
  definition: Definition,
  'gsap-demo': GsapDemo,
  'scribble-swap': ScribbleSwap,
  'dream-bubble': DreamBubble,
  'flip-card': FlipCard,
  'fly-away': FlyAway,
  'do-checklist': DoChecklist,
  'build-vs-run': BuildVsRun,
  'versus-intro': VersusIntro,
  'make-factory': MakeFactory,
};
