import type React from 'react';
import type {SceneType} from '../lib/plan';
import type {Theme} from '../styles/themes';
import {Translate} from './translate';
import {FalseFriend} from './false-friend';
import {Mistake} from './mistake';
import {Example} from './example';

export type TemplateProps<D> = {data: D; theme: Theme; durationInFrames: number};

/** Plantillas por tipo de escena. `generated` se resuelve aparte (src/scenes/generated). */
export const TEMPLATES: Partial<Record<Exclude<SceneType, 'generated'>, React.FC<TemplateProps<any>>>> = {
  translate: Translate,
  'false-friend': FalseFriend,
  mistake: Mistake,
  example: Example,
};
