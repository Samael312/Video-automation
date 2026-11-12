import {mapTimeNext, type Keep} from './cuts';

/** Frames de una escena en la linea de tiempo recortada. null si colapsa a 0 frames. */
export const sceneFrames = (start: number, end: number, keeps: Keep[], fps: number): {from: number; duration: number} | null => {
  const from = Math.round(mapTimeNext(start, keeps) * fps);
  const to = Math.round(mapTimeNext(end, keeps) * fps);
  return to > from ? {from, duration: to - from} : null;
};

/**
 * Opacidad/avance 0..1 de una escena: sube durante `inFrames`, baja en los ultimos `outFrames`.
 * Si la escena es mas corta que ambas animaciones, cada una usa como maximo la mitad de la duracion.
 */
export const sceneEnvelope = (frame: number, duration: number, inFrames: number, outFrames: number): number => {
  const half = duration / 2;
  const i = Math.min(inFrames, half);
  const o = Math.min(outFrames, half);
  const up = i > 0 ? frame / i : 1;
  const down = o > 0 ? (duration - frame) / o : 1;
  return Math.max(0, Math.min(1, up, down));
};
