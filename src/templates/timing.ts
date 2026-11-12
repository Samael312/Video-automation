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
