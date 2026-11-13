import type {Word} from '../lib/types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}']/gu, '');

/**
 * Segundos (desde `start`) en que aparece cada palabra de `lead`, siguiendo la voz: busca cada palabra en orden
 * entre las palabras del transcript que empiezan dentro de [start, end). Las no encontradas toman la demora de la anterior.
 */
export const leadDelays = (lead: string, words: Word[], start: number, end: number): number[] => {
  const tokens = lead.split(/\s+/).filter(Boolean);
  const pool = words.filter((w) => w.start >= start && w.start < end);
  let cursor = 0;
  let last = 0;
  return tokens.map((t) => {
    const n = norm(t);
    const k = pool.findIndex((w, i) => i >= cursor && norm(w.word) === n);
    if (k >= 0) {
      cursor = k + 1;
      last = Math.max(last, pool[k].start - start);
    }
    return last;
  });
};
