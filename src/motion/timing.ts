import {mapTimeNext, type Keep} from '../lib/cuts';
import {sceneFrames} from '../lib/scenes';
import {beatSpans, type Beat, type Block, type MotionPlan} from '../lib/motion';

const PUSH = 0.06;
const BUMP = 0.04;
const BUMP_FRAMES = 6;

/** Frames del bloque en la linea de tiempo recortada (mismo calculo que las escenas). */
export const blockFrames = (b: Block, keeps: Keep[], fps: number): {from: number; duration: number} | null => sceneFrames(b.start, b.end, keeps, fps);

/** Frames de cada beat, relativos al inicio del bloque. Las duraciones suman exactamente la del bloque. */
export const beatFrames = (b: Block, keeps: Keep[], fps: number): {beat: Beat; from: number; duration: number}[] => {
  const base = Math.round(mapTimeNext(b.start, keeps) * fps);
  const blockEnd = Math.round(mapTimeNext(b.end, keeps) * fps) - base;
  const spans = beatSpans(b);
  const froms = spans.map((s, i) => (i === 0 ? 0 : Math.round(mapTimeNext(s.start, keeps) * fps) - base));
  return spans.map((s, i) => ({beat: s.beat, from: froms[i], duration: (i + 1 < froms.length ? froms[i + 1] : blockEnd) - froms[i]}));
};

/** Frames (relativos al bloque) donde suena un tick: cada cambio de beat salvo el primero, como mucho 1 cada `minGap` s. */
export const tickFrames = (beatFroms: number[], fps: number, minGap = 0.5): number[] => {
  const out: number[] = [];
  let last = beatFroms[0] ?? 0;
  beatFroms.slice(1).forEach((f) => {
    if (f - last >= minGap * fps) {
      out.push(f);
      last = f;
    }
  });
  return out;
};

/** Escala de camara: empuje lento 1 -> 1.06 durante el bloque + golpe de 0.04 que decae en 6 frames en cada cambio de beat. */
export const cameraScale = (frame: number, duration: number, beatFroms: number[]): number => {
  const push = 1 + PUSH * Math.min(1, Math.max(0, frame / Math.max(1, duration)));
  const since = beatFroms.filter((b) => b <= frame).map((b) => frame - b);
  const d = since.length ? Math.min(...since) : Infinity;
  const bump = d < BUMP_FRAMES ? BUMP * (1 - d / BUMP_FRAMES) : 0;
  return push + bump;
};

/** ¿El tiempo FINAL `t` cae dentro de algun bloque de motion? */
export const insideBlocks = (t: number, motion: MotionPlan | undefined, keeps: Keep[]): boolean =>
  !!motion?.blocks.some((b) => t >= mapTimeNext(b.start, keeps) && t < mapTimeNext(b.end, keeps));

/** Demoras (frames) para que `n` items entren escalonados: `base + i*step`, comprimido para que el ultimo entre antes del 40 % del beat. */
export const staggerDelays = (n: number, durationInFrames: number, base: number, step: number): number[] => {
  const lastAllowed = Math.floor(durationInFrames * 0.4);
  const b = Math.min(base, Math.max(0, lastAllowed - n + 1));
  const s = n > 1 ? Math.min(step, Math.max(0, (lastAllowed - b) / (n - 1))) : 0;
  return Array.from({length: n}, (_, i) => Math.round(b + i * s));
};
