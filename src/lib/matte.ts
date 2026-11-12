import type {EditPlan} from './plan';

/** public/<video>.matte.json que escribe pipeline/matte.py.
 *  ranges: tramos (s del video original) recortados; top: frame -> primera fila con persona (cabeza). */
export type MatteInfo = {version: 1; fps: number; ranges: [number, number][]; top: Record<string, number>};

/** Ajuste medido: el texto queda con su borde inferior ~30 px (título) / ~8 px (item: letra más chica, se tapa antes) bajo el tope de la cabeza. */
const TITLE_OFFSET = 30 - 181;
const ITEM_OFFSET = 8 - 152;

export const matteInfoFile = (video: string) => video.replace(/\.[^.]+$/, '') + '.matte.json';

/** Tramos (s originales) que llevan `behind`: título e items. */
export const behindSpans = (plan: Pick<EditPlan, 'overlays'> & Partial<Pick<EditPlan, 'title'>>): [number, number][] => {
  const spans: [number, number][] = [];
  if (plan.title?.behind) spans.push([plan.title.start, plan.title.end]);
  for (const o of plan.overlays) if (o.kind === 'item' && o.behind) spans.push([o.start, o.end]);
  return spans;
};

export const matteCovers = (info: MatteInfo | null | undefined, spans: [number, number][]): boolean =>
  Boolean(info) && spans.every(([s, e]) => info!.ranges.some(([hs, he]) => hs <= s && e <= he));

/** y automática para que la cabeza tape el texto: mediana del tope de la cabeza en los frames del elemento. */
export const autoBehindY = (kind: 'title' | 'item', info: MatteInfo | null | undefined, start: number, end: number): number | undefined => {
  if (!info) return undefined;
  const vals: number[] = [];
  for (let f = Math.floor(start * info.fps); f < Math.ceil(end * info.fps); f++) {
    const v = info.top[String(f)];
    if (v !== undefined) vals.push(v);
  }
  if (!vals.length) return undefined;
  vals.sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)];
  return Math.max(0, Math.round(median + (kind === 'title' ? TITLE_OFFSET : ITEM_OFFSET)));
};
