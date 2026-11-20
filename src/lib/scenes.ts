import type {CSSProperties} from 'react';
import {mapTimeNext, type Keep} from './cuts';
import type {SceneTransition} from './plan';

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

/** Estilo de una escena segun su transicion; `env` va de 0 (fuera) a 1 (dentro), igual que `sceneEnvelope`. */
export const transitionStyle = (kind: SceneTransition | undefined, env: number): CSSProperties => {
  const e = Math.max(0, Math.min(1, env));
  switch (kind) {
    case 'slide-left':
      return {opacity: 1, transform: `translateX(${(1 - e) * -720}px)`};
    case 'slide-right':
      return {opacity: 1, transform: `translateX(${(1 - e) * 720}px)`};
    case 'wipe':
      return {opacity: 1, clipPath: `circle(${(e * 80).toFixed(2)}% at 50% 50%)`};
    case 'zoom':
      return {opacity: e, transform: `scale(${0.6 + 0.4 * e})`};
    case 'flip':
      return {opacity: e, transform: `perspective(1400px) rotateY(${(1 - e) * 90}deg)`};
    default:
      return {opacity: e, transform: `translateY(${(1 - e) * 60}px)`};
  }
};
