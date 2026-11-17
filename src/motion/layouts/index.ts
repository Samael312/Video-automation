import type React from 'react';
import type {Beat, Layout} from '../../lib/motion';
import type {Theme} from '../../styles/themes';
import type {Palette} from '../palette';
import {Word} from './word';
import {Prop} from './prop';
import {Ring} from './ring';
import {List} from './list';
import {Strike} from './strike';
import {Swap} from './swap';
import {Card} from './card';
import {Big} from './big';

/** `leadDelays`: segundos desde el inicio del beat en que aparece cada palabra de `beat.lead`. */
export type LayoutProps = {beat: Beat; theme: Theme; pal: Palette; dark: boolean; durationInFrames: number; leadDelays: number[]};

export const LAYOUT_UI: Record<Layout, React.FC<LayoutProps>> = {word: Word, prop: Prop, ring: Ring, list: List, strike: Strike, swap: Swap, card: Card, big: Big};
