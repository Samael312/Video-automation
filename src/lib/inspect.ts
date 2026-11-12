import {keptDuration, type Keep} from './cuts';
import type {Transcript, Word} from './types';

const f2 = (n: number) => n.toFixed(2);

/**
 * Transcripcion legible para planificar: palabras con su tiempo ORIGINAL agrupadas por tramo conservado,
 * y las zonas cortadas entre medio (con las palabras que caen ahi marcadas como cortadas).
 * Los tiempos que se escriben en edit.json son estos.
 */
export const formatInspect = (transcript: Transcript, keeps: Keep[]): string => {
  const lines: string[] = [];
  const inRange = (w: Word, a: number, b: number) => w.start >= a && w.start < b;
  const wordsIn = (a: number, b: number, cut: boolean) =>
    transcript.words.filter((w) => inRange(w, a, b)).forEach((w) => lines.push(`  ${cut ? '(cortada) ' : ''}[${f2(w.start)}] ${w.word}`));
  const cutBlock = (a: number, b: number) => {
    if (b - a <= 0) return;
    lines.push(`--- CORTE (${f2(a)}–${f2(b)} s, ${f2(b - a)} s) ---`);
    wordsIn(a, b, true);
  };

  let cursor = 0;
  keeps.forEach((k, i) => {
    cutBlock(cursor, k.start);
    lines.push(`== TRAMO ${i + 1} (${f2(k.start)}–${f2(k.end)} s) ==`);
    // el fin del tramo es inclusivo para la ultima palabra del video
    wordsIn(k.start, i === keeps.length - 1 ? k.end + 1e-9 : k.end, false);
    cursor = k.end;
  });
  cutBlock(cursor, transcript.duration);
  lines.push('');
  lines.push(`Duración final: ${f2(keptDuration(keeps))} s de ${f2(transcript.duration)} s`);
  return lines.join('\n');
};
