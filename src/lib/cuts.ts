import type {Word} from './types';

/** Tramo conservado, en segundos del video original. */
export type Keep = {start: number; end: number};

export const keptDuration = (keeps: Keep[]): number => keeps.reduce((sum, k) => sum + (k.end - k.start), 0);

/** Tiempo original -> tiempo nuevo. null si cae en una zona cortada. */
export const mapTime = (t: number, keeps: Keep[]): number | null => {
  let offset = 0;
  for (const k of keeps) {
    if (t >= k.start && t <= k.end) return offset + (t - k.start);
    offset += k.end - k.start;
  }
  return null;
};

/** Palabras con tiempos nuevos; descarta las que tocan una zona cortada. */
export const remapWords = (words: Word[], keeps: Keep[]): Word[] => {
  const out: Word[] = [];
  for (const w of words) {
    const start = mapTime(w.start, keeps);
    const end = mapTime(w.end, keeps);
    if (start === null || end === null) continue;
    out.push({...w, start, end});
  }
  return out;
};

/** Tiempos nuevos donde empieza cada tramo salvo el primero. */
export const cutPoints = (keeps: Keep[]): number[] => {
  const pts: number[] = [];
  let offset = 0;
  keeps.forEach((k, i) => {
    if (i > 0) pts.push(offset);
    offset += k.end - k.start;
  });
  return pts;
};

/** Frames de un tramo (redondeando sobre el tiempo original para no acumular error). */
export const keepFrames = (k: Keep, fps: number): number => Math.round(k.end * fps) - Math.round(k.start * fps);

export const totalFrames = (keeps: Keep[], fps: number): number => keeps.reduce((sum, k) => sum + keepFrames(k, fps), 0);
