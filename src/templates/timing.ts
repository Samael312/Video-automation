/** Tamaño de letra que cabe en `maxWidth` px (estimacion por ancho medio de caracter). Nunca baja de `min`. */
export const fitFontSize = (text: string, maxWidth: number, base: number, charWidth = 0.55, min = 28): number => {
  if (!text.length) return base;
  return Math.max(min, Math.min(base, maxWidth / (text.length * charWidth)));
};

/** Cuantas de `total` palabras ya son visibles: aparecen repartidas en el primer 60 % de la escena. */
export const wordsVisible = (frame: number, fps: number, total: number, durationInFrames: number): number => {
  void fps;
  if (total <= 0 || durationInFrames <= 0) return 0;
  const span = durationInFrames * 0.6;
  return Math.max(0, Math.min(total, Math.floor((frame / span) * total)));
};

/** Fase del quiz: opciones tras el 20 % de la escena, cuenta regresiva hasta el reveal, reveal en los ultimos 1.5 s (nunca antes de la mitad). */
export const quizPhase = (frame: number, fps: number, durationInFrames: number, countdown: number): {optionsShown: boolean; secondsLeft: number; revealed: boolean} => {
  const optionsAt = durationInFrames * 0.2;
  const revealAt = Math.max(durationInFrames * 0.5, durationInFrames - 1.5 * fps);
  const revealed = frame >= revealAt;
  const optionsShown = frame >= optionsAt;
  const remaining = Math.ceil((revealAt - frame) / fps);
  return {optionsShown, revealed, secondsLeft: revealed ? 0 : Math.max(0, Math.min(countdown, remaining))};
};

/** Cuantas de `n` silabas estan iluminadas: se encienden una a una entre el 10 % y el 70 % de la escena. */
export const litSyllables = (frame: number, durationInFrames: number, n: number): number => {
  if (n <= 0 || durationInFrames <= 0) return 0;
  const p = (frame - durationInFrames * 0.1) / (durationInFrames * 0.6);
  return Math.max(0, Math.min(n, Math.ceil(p * n)));
};
