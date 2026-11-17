import type React from 'react';
import type {Theme} from '../../styles/themes';
import {Demo} from './demo';
import {GsapDemo} from './gsap-demo';

export type GeneratedProps = {props: Record<string, unknown>; theme: Theme; durationInFrames: number};

/**
 * Registro de escenas generadas. Convencion: un archivo `<nombre>.tsx` en esta carpeta
 * (componente `React.FC<GeneratedProps>`) + una linea aqui con su nombre.
 * El plan las usa con `{type: 'generated', data: {component: '<nombre>', props: {...}}}`.
 */
export const GENERATED: Record<string, React.FC<GeneratedProps>> = {
  demo: Demo,
  'gsap-demo': GsapDemo,
};
