import {createTikTokStyleCaptions, type Caption} from '@remotion/captions';
import type {Word} from './types';

export type CaptionToken = {text: string; start: number; end: number};
/** Tiempos en segundos del video final (ya remapeados). */
export type CaptionPage = {start: number; end: number; tokens: CaptionToken[]};

const TAIL = 0.3; // la ultima pagina se queda un poco tras su ultima palabra
const BREAK_ON_SILENCE_MS = 400;

/** Agrupa palabras en paginas de hasta `maxWords` (cierra antes con . ? !). El fin de cada pagina = inicio de la siguiente. */
export const buildPages = (words: Word[], maxWords: number): CaptionPage[] => {
  if (!words.length) return [];
  let count = 0;
  const captions: Caption[] = words.map((w, i) => {
    count += 1;
    const brk = count >= maxWords || /[.?!]$/.test(w.word);
    if (brk) count = 0;
    return {
      text: (i === 0 ? '' : ' ') + w.word,
      startMs: w.start * 1000,
      endMs: w.end * 1000,
      timestampMs: null,
      confidence: null,
      pageBreakAfter: brk,
    };
  });
  const {pages} = createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds: 1e9, breakOnSilenceAfterMilliseconds: BREAK_ON_SILENCE_MS});
  const out: CaptionPage[] = pages.map((p) => ({
    start: p.startMs / 1000,
    end: 0,
    tokens: p.tokens.map((t) => ({text: t.text.trim(), start: t.fromMs / 1000, end: t.toMs / 1000})),
  }));
  out.forEach((p, i) => {
    p.end = i < out.length - 1 ? out[i + 1].start : p.tokens[p.tokens.length - 1].end + TAIL;
  });
  return out;
};
