import type {Word} from './types';

export type MusicOpts = {volume: number; duck: number};
export const MUSIC_DEFAULTS: MusicOpts = {volume: 0.12, duck: 0.04};

const DUCK_IN = 0.15; // baja antes de que empiece a hablar
const DUCK_OUT = 0.4; // sube despues de que termina
const FADE_IN = 0.5;
const FADE_OUT = 1;

/** Tramos con voz (tiempo final), uniendo palabras separadas por menos de `joinGap` s. */
export const speechSpans = (words: Word[], joinGap = 0.3): {start: number; end: number}[] => {
  const out: {start: number; end: number}[] = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && w.start - last.end < joinGap) last.end = Math.max(last.end, w.end);
    else out.push({start: w.start, end: w.end});
  }
  return out;
};

/** 0..1 de "cuanto ducking" en t: 1 dentro de la voz, rampa lineal antes (DUCK_IN) y despues (DUCK_OUT). */
const duckAmount = (t: number, spans: {start: number; end: number}[]): number => {
  let d = 0;
  for (const s of spans) {
    if (t >= s.start && t <= s.end) return 1;
    if (t < s.start && s.start - t < DUCK_IN) d = Math.max(d, 1 - (s.start - t) / DUCK_IN);
    if (t > s.end && t - s.end < DUCK_OUT) d = Math.max(d, 1 - (t - s.end) / DUCK_OUT);
  }
  return d;
};

/** Volumen de la musica en el segundo `t` (tiempo final): fades de entrada/salida y ducking bajo la voz. */
export const musicVolume = (t: number, spans: {start: number; end: number}[], total: number, opts: MusicOpts): number => {
  const fade = Math.max(0, Math.min(1, t / FADE_IN, (total - t) / FADE_OUT));
  const level = opts.volume - (opts.volume - opts.duck) * duckAmount(t, spans);
  return fade * level;
};
