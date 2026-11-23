// Lista de sonidos de un plan: una sola fuente de verdad para el render (Edit.tsx) y el validador.
import {KEYWORD_SFX, overlaySfx, thinEvents, TITLE_SFX, type AutoSfxEvent} from './autoSfx';
import {chatTimes} from './overlayTiming';
import {keywordEvents} from './dynamics';
import {insideBlocks} from '../motion/timing';
import type {Keep} from './cuts';
import type {EditPlan, Overlay, SfxName} from './plan';
import type {Word} from './types';

/** Sonidos que suenan siempre que haga falta (cortes, escenas, bloques de motion, cierre). */
export const BASE_SFX: SfxName[] = ['swoosh', 'tick', 'ding'];

export type AutoSfxInput = {
  plan: EditPlan;
  /** overlays ya remapeados a tiempos del video final */
  overlays: Overlay[];
  cuts: number[];
  hookEnd: number;
  title: {start: number} | null;
  /** palabras ya remapeadas */
  words: Word[];
  keeps: Keep[];
  /** tiempos (video final) de los sfx manuales del plan */
  manualAt: number[];
};

/** Sonidos automaticos (tiempos del video final). Se omiten dentro de bloques de motion y cerca de un sfx manual; `autoSfx: false` los apaga. */
export const autoSfxEvents = ({plan, overlays, cuts, hookEnd, title, words, keeps, manualAt}: AutoSfxInput): AutoSfxEvent[] => {
  if (plan.autoSfx === false) return [];
  const events: AutoSfxEvent[] = [
    ...overlays.flatMap((o): AutoSfxEvent[] => {
      const s = overlaySfx(o.kind);
      if (!s) return [];
      return o.kind === 'chat' ? chatTimes(o).map((at) => ({at, ...s})) : [{at: o.start, ...s}];
    }),
    ...(plan.cutFx === 'glitch' ? cuts.map((at) => ({at, name: 'glitch' as const, volume: 0.5})) : []),
    ...(plan.cutFx === 'shake' ? cuts.map((at) => ({at, name: 'hit' as const, volume: 0.3})) : []),
    ...(hookEnd > 0 ? [{at: 0, ...TITLE_SFX}] : []),
    ...(title ? [{at: title.start, ...TITLE_SFX}] : []),
    ...keywordEvents(words, plan.zoom.keywords).map((at) => ({at, ...KEYWORD_SFX})),
  ];
  return thinEvents(
    events.filter((e) => !insideBlocks(e.at, plan.motion, keeps)),
    manualAt,
  );
};

/** Todos los sonidos que el plan puede tocar (sin repetir, ordenados). Sirve para comprobar que existen en public/sfx. */
export const sfxNamesUsed = (plan: EditPlan): SfxName[] => {
  const names = new Set<SfxName>([...BASE_SFX, ...(plan.sfx ?? []).map((s) => s.name)]);
  if (plan.autoSfx !== false) {
    for (const o of plan.overlays ?? []) {
      const s = overlaySfx(o.kind);
      if (s) names.add(s.name);
    }
    if (plan.cutFx === 'glitch') names.add('glitch');
    if (plan.cutFx === 'shake' || plan.hook || plan.title) names.add('hit');
    if (plan.zoom?.keywords?.length) names.add(KEYWORD_SFX.name);
  }
  return [...names].sort();
};
