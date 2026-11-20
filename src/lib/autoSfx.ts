import type {Overlay, SfxName} from './plan';

export type AutoSfx = {name: SfxName; volume: number};

/** Sonido que acompana a cada overlay al aparecer (multiplicador del sfxVolume del tema). */
export const overlaySfx = (kind: Overlay['kind']): AutoSfx => {
  switch (kind) {
    case 'emoji':
      return {name: 'pop2', volume: 0.7};
    case 'label':
      return {name: 'pop', volume: 0.6};
    case 'item':
      return {name: 'tick', volume: 0.8};
    case 'chat':
      return {name: 'message', volume: 0.6};
  }
};

/** Golpe grave al abrir el titulo. */
export const TITLE_SFX: AutoSfx = {name: 'hit', volume: 0.5};
/** Golpe suave en cada palabra clave con zoom. */
export const KEYWORD_SFX: AutoSfx = {name: 'pop2', volume: 0.35};

/** Separacion minima (s) entre dos sfx automaticos, para que no suenen amontonados. */
export const MIN_GAP = 0.18;

export type AutoSfxEvent = AutoSfx & {at: number};

/**
 * Quita los eventos que caen a menos de MIN_GAP del anterior ya aceptado,
 * o muy cerca (±0.12 s) de un sfx manual del plan, para no duplicar sonido.
 * Los tiempos son del video final (segundos).
 */
export const thinEvents = (events: AutoSfxEvent[], manualAt: number[] = []): AutoSfxEvent[] => {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const out: AutoSfxEvent[] = [];
  for (const e of sorted) {
    if (manualAt.some((m) => Math.abs(m - e.at) < 0.12)) continue;
    const prev = out[out.length - 1];
    if (prev && e.at - prev.at < MIN_GAP) continue;
    out.push(e);
  }
  return out;
};
