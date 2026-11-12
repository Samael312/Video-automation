// Analisis de videos de referencia (npm run reference): ritmo, gancho, cierre y cortes de camara.

export type RefWord = {word: string; start: number; end: number};

export type ReferenceStats = {
  duration: number;
  shotCount: number; // tomas = cortes de camara + 1
  avgShot: number; // s por toma
  wordsPerSec: number;
  longPauses: number; // silencios > PAUSE_S entre palabras (lo que nuestro pipeline cortaria)
  hook: string; // lo que dice en los primeros HOOK_S
  cta: string; // lo que dice en los ultimos CTA_S
};

export const HOOK_S = 3;
export const CTA_S = 4;
export const PAUSE_S = 0.7;

/** Tiempos de cambio de escena desde la salida de ffmpeg `select='gt(scene,X)',showinfo`. */
export const parseSceneTimes = (log: string): number[] =>
  [...log.matchAll(/showinfo[^\n]*?pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]));

const text = (words: RefWord[]) => words.map((x) => x.word.trim()).join(' ');

export const referenceStats = ({duration, sceneTimes, words}: {duration: number; sceneTimes: number[]; words: RefWord[]}): ReferenceStats => {
  const shotCount = sceneTimes.length + 1;
  let longPauses = 0;
  for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end > PAUSE_S) longPauses++;
  return {
    duration,
    shotCount,
    avgShot: duration / shotCount,
    wordsPerSec: duration > 0 ? words.length / duration : 0,
    longPauses,
    hook: text(words.filter((x) => x.start < HOOK_S)),
    cta: text(words.filter((x) => x.start >= duration - CTA_S)),
  };
};

export const formatReport = ({name, stats, sceneTimes, sheets, words}: {
  name: string; stats: ReferenceStats; sceneTimes: number[]; sheets: string[]; words: RefWord[];
}): string => {
  const s = stats;
  return [
    `# Referencia: ${name}`,
    '',
    '## Ritmo',
    `- Duración: ${s.duration.toFixed(1)} s`,
    `- Tomas: ${s.shotCount} (una cada ${s.avgShot.toFixed(1)} s)`,
    `- Palabras por segundo: ${s.wordsPerSec.toFixed(2)}`,
    `- Pausas > ${PAUSE_S} s: ${s.longPauses} (si son 0, ella ya corta sus silencios)`,
    '',
    '## Texto',
    `- Gancho (0–${HOOK_S} s): "${s.hook}"`,
    `- Cierre (últimos ${CTA_S} s): "${s.cta}"`,
    '',
    '## Cortes de cámara (s, aprox.: un gesto brusco también cuenta; confírmalos en las hojas)',
    sceneTimes.length ? sceneTimes.map((t) => t.toFixed(1)).join(', ') : '(ninguno)',
    '',
    '## Hojas de fotogramas',
    'Un fotograma por segundo, 6 por fila, 30 por hoja: hoja N, casilla k (desde 1) = segundo (N-1)*30 + k-1.',
    ...sheets.map((f) => `- ${f}`),
    '',
    '## Transcript',
    ...words.map((x) => `[${x.start.toFixed(2)}] ${x.word.trim()}`),
    '',
  ].join('\n');
};
