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

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Inicio (tiempo de `words`) de cada palabra que esta en `keywords`. */
export const keywordEvents = (words: Word[], keywords: string[]): number[] => {
  const set = new Set(keywords.map(norm));
  return words.filter((w) => set.has(norm(w.word))).map((w) => w.start);
};
