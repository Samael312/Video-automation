import type {ChatOverlay} from './plan';

/** Segundos entre burbujas cuando no se da `at`. */
export const CHAT_STAGGER = 0.8;

/** Momento (segundos del video original) en que aparece cada burbuja. */
export const chatTimes = (o: ChatOverlay): number[] => {
  const step = Math.min(CHAT_STAGGER, (o.end - o.start) / (o.messages.length + 1));
  return o.messages.map((m, j) => m.at ?? o.start + j * step);
};

/** Subtitulos visibles en t (segundos de salida): solo entre from y until, y no mientras un item ocupa su franja (arriba). */
export const captionsVisible = (t: number, o: {from: number; until: number; items: {start: number; end: number; top: boolean}[]}): boolean =>
  t >= o.from && t < o.until && !o.items.some((it) => it.top && t >= it.start && t < it.end);

/** y por defecto con `behind`: el texto cruza solo la parte alta de la cabeza (~1/3 tapado). Depende de la persona: ajusta `y` mirando el preview. */
export const BEHIND_TITLE_Y = 330;
export const BEHIND_ITEM_Y = 340;
