// Contenido editable del estilo "Referencia". Tiempos en segundos.
export const CREAM = '#FCF4B0'; // color medido en Referencia.mp4

export type LabelCfg = {text: string; start: number; end: number; x: number; y: number; dir: 'left' | 'right'};

export const styledConfig = {
  title: {line1: 'Sabias que??', line2: 'en inglés', start: 0, end: 2.8},
  subtitles: {from: 2.8, maxWords: 5, highlight: CREAM},
  // Zoom (punch-in) en cada corte y al decir una palabra clave
  dynamics: {zoom: 1.08, duration: 0.35, keywords: ['actually', 'library', 'embarrassed']},
  end: {start: 17.7, line1: '¿Te sirvió?', line2: '¿Qué otro dato conoces?'},
  // dir: 'right' = la flecha curva hacia la derecha-abajo; 'left' = hacia la izquierda-abajo
  labels: [
    {text: 'actually', start: 4.7, end: 6.4, x: 170, y: 400, dir: 'right'},
    {text: 'en realidad', start: 6.4, end: 7.6, x: 540, y: 400, dir: 'left'},
    {text: 'library', start: 8.0, end: 10.4, x: 170, y: 400, dir: 'right'},
    {text: 'biblioteca', start: 11.1, end: 12.4, x: 540, y: 400, dir: 'left'},
    {text: 'embarrassed', start: 12.7, end: 16.2, x: 170, y: 400, dir: 'right'},
    {text: 'avergonzado', start: 16.3, end: 17.6, x: 540, y: 400, dir: 'left'},
  ] as LabelCfg[],
  emojis: [
    {file: '1f92b', start: 1.3, end: 2.8, x: 560, y: 560, size: 110},
    {file: '1f4da', start: 8.0, end: 10.4, x: 570, y: 560, size: 110},
    {file: '1f633', start: 12.7, end: 16.0, x: 570, y: 560, size: 110},
    {file: '1f64c', start: 17.8, end: 20.2, x: 130, y: 560, size: 110},
  ],
  sfx: {popAt: [0.55, 1.3, 4.7, 6.4, 8.0, 11.1, 12.7, 16.3, 17.8], swooshAt: [0.15, 4.65, 7.95, 12.65], volume: 0.5},
};
