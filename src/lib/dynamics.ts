import type {Word} from './types';

/** Escala del video en el instante t: 1 fuera de eventos; sube a `peak` y vuelve a 1 en `duration` s desde cada evento (seno suave). */
export const zoomScale = (t: number, events: number[], peak: number, duration: number): number => {
  let best = 1;
  for (const e of events) {
    const p = (t - e) / duration;
    if (p < 0 || p > 1) continue;
    best = Math.max(best, 1 + (peak - 1) * Math.sin(Math.PI * p));
  }
  return best;
};

/**
 * Modo "punch": estilo jump-cut. El video alterna entre escala 1 y `peak` en cada corte y se queda ahi
 * (tramos pares a 1, impares a `peak`). `cuts` son los instantes de corte en tiempo de salida.
 */
export const punchScale = (t: number, cuts: number[], peak: number): number => {
  const passed = cuts.filter((c) => c <= t).length;
  return passed % 2 === 1 ? peak : 1;
};

export type CutFxState = {flash: number; dx: number; dy: number; filter: string | undefined};
const NO_FX: CutFxState = {flash: 0, dx: 0, dy: 0, filter: undefined};
export const CUT_FX_SECONDS = 0.22;

/** Efecto de corte en el instante t: destello (0..1), desplazamiento en px y filtro de color. Solo dura CUT_FX_SECONDS tras cada corte. */
export const cutFxState = (t: number, cuts: number[], fx: 'none' | 'flash' | 'shake' | 'glitch' | undefined): CutFxState => {
  if (!fx || fx === 'none') return NO_FX;
  const last = cuts.filter((c) => c <= t).pop();
  if (last === undefined || t - last >= CUT_FX_SECONDS) return NO_FX;
  const p = (t - last) / CUT_FX_SECONDS; // 0..1
  const k = 1 - p;
  if (fx === 'flash') return {...NO_FX, flash: 0.85 * Math.max(0, 1 - p / 0.55)};
  if (fx === 'shake') return {flash: 0, dx: 16 * k * Math.sin(t * 150), dy: 10 * k * Math.cos(t * 190), filter: undefined};
  return {flash: 0, dx: 26 * k * Math.sin(t * 230), dy: 6 * k * Math.cos(t * 310), filter: `hue-rotate(${Math.round(70 * k * Math.sin(t * 90))}deg) saturate(${(1 + 0.8 * k).toFixed(2)}) contrast(${(1 + 0.25 * k).toFixed(2)})`};
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Inicio (tiempo de `words`) de cada palabra que esta en `keywords`. */
export const keywordEvents = (words: Word[], keywords: string[]): number[] => {
  const set = new Set(keywords.map(norm));
  return words.filter((w) => set.has(norm(w.word))).map((w) => w.start);
};
