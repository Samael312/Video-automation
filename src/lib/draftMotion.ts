import {keptDuration, mapTimeNext, type Keep} from './cuts';
import {MIN_BEAT, MIN_PROFE_GAP, type Beat, type Block, type MotionPlan} from './motion';
import type {Word} from './types';

/** `from`/`until`: segundos ORIGINALES donde puede haber motion (tras el gancho, antes del CTA). `target`: fraccion de la duracion final. */
export type DraftOpts = {from: number; until: number; target?: number; full?: boolean};

const MIN_BLOCK = 3;
const MAX_BLOCK = 8;
const PAD_IN = 0.1;
const PAD_OUT = 0.2;
const MAX_CHUNK = 4;
const PAUSE = 0.25;
const MAX_RATIO = 0.9;

const PUNCT = /[.,!?¿¡;:"“”…]+/g;
const endsClause = (w: Word) => /[.,!?;:…]$/.test(w.word);

/** Grupos de 2–4 palabras; corta tras puntuacion o en pausas > 0.25 s. Un grupo suelto de 1 palabra se une al anterior si cabe. */
export const chunkWords = (words: Word[]): Word[][] => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const prev = out[out.length - 1];
    const joined = prev && cur.length === 1 && cur[0].start - prev[prev.length - 1].end <= PAUSE && !endsClause(prev[prev.length - 1]);
    if (joined && prev.length < MAX_CHUNK) prev.push(cur[0]);
    else if (joined && prev.length > 2) out.push([prev.pop()!, ...cur]); // grupo lleno: le presta su ultima palabra
    else out.push(cur);
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && prev && w.start - prev.end > PAUSE) flush();
    cur.push(w);
    if (cur.length === MAX_CHUNK || endsClause(w)) flush();
  });
  flush();
  return out;
};

const clean = (w: string) => w.replace(PUNCT, '').trim();

const toBeat = (at: number, ws: Word[]): Beat => {
  const key = clean(ws[ws.length - 1].word);
  const lead = ws.slice(0, -1).map((w) => w.word.trim()).join(' ');
  return lead ? {at, layout: 'word', lead, key} : {at, layout: 'word', key};
};

/** Arma beats (uno por grupo) fusionando los que quedarian por debajo de MIN_BEAT. */
const buildBeats = (start: number, end: number, chunks: Word[][]): Beat[] => {
  const groups: {at: number; ws: Word[]}[] = [];
  chunks.forEach((c, i) => {
    const at = i === 0 ? start : c[0].start;
    const last = groups[groups.length - 1];
    if (last && at - last.at < MIN_BEAT) last.ws.push(...c);
    else groups.push({at, ws: [...c]});
  });
  while (groups.length > 1 && end - groups[groups.length - 1].at < MIN_BEAT) {
    const tail = groups.pop()!;
    groups[groups.length - 1].ws.push(...tail.ws);
  }
  return groups.map((g) => toBeat(+g.at.toFixed(3), g.ws));
};

/** Fin del proximo bloque en [cursor, end]: el ultimo fin de frase (o, si no hay, de palabra) que deje bloques de 3–8 s. */
const nextCut = (words: Word[], cursor: number, end: number): number => {
  const lo = cursor + MIN_BLOCK;
  const hi = Math.min(cursor + MAX_BLOCK, end - MIN_BLOCK);
  const cutAt = (k: number) => Math.min(words[k].end + PAD_OUT, words[k + 1]?.start ?? Infinity, end);
  const fits = (k: number) => words[k].end >= cursor && cutAt(k) >= lo && cutAt(k) <= hi;
  const idx = words.map((_, k) => k).filter(fits);
  const clause = idx.filter((k) => endsClause(words[k]));
  const pick = clause.length ? clause[clause.length - 1] : idx[idx.length - 1];
  return pick !== undefined ? cutAt(pick) : hi;
};

/** strategy voice: bloques contiguos que cubren cada tramo conservado entero; fondos alternos y el ultimo oscuro. */
const draftFull = (words: Word[], keeps: Keep[], opts: DraftOpts): MotionPlan => {
  const spans: {start: number; end: number}[] = [];
  keeps
    .map((k) => ({start: Math.max(k.start, opts.from), end: Math.min(k.end, opts.until)}))
    .filter((r) => r.end - r.start >= MIN_BEAT)
    .forEach((r) => {
      const ws = words.filter((w) => w.start >= r.start && w.end <= r.end);
      let cursor = r.start;
      while (r.end - cursor > MAX_BLOCK) {
        const cut = nextCut(ws, cursor, r.end);
        spans.push({start: cursor, end: cut});
        cursor = cut;
      }
      spans.push({start: cursor, end: r.end});
    });
  const n = spans.length;
  return {
    blocks: spans.map(({start, end}, i) => {
      const s = +start.toFixed(3);
      const e = +end.toFixed(3);
      const inside = words.filter((w) => w.start >= start && w.start < end);
      const beats: Beat[] = inside.length ? buildBeats(s, e, chunkWords(inside)) : [{at: s, layout: 'word', key: '…'}];
      return {start: s, end: e, bg: (n - 1 - i) % 2 === 0 ? 'dark' : 'light', beats};
    }),
  };
};

/** Borrador: bloques de 3–8 s con beats `word` cada 2–4 palabras, repartidos para cubrir ~target de la duracion final.
 * Con `full` (strategy voice) cubre todo: ver draftFull. */
export const draftMotion = (words: Word[], keeps: Keep[], opts: DraftOpts): MotionPlan => {
  if (opts.full) return draftFull(words, keeps, opts);
  const target = opts.target ?? 0.65;
  const total = keptDuration(keeps);
  const ranges = keeps
    .map((k) => ({start: Math.max(k.start, opts.from), end: Math.min(k.end, opts.until)}))
    .filter((r) => r.end - r.start >= MIN_BLOCK);
  const usable = ranges.reduce((s, r) => s + (r.end - r.start), 0);
  if (!usable || !total) return {blocks: []};
  const ratio = Math.min(MAX_RATIO, (target * total) / usable);

  const blocks: Block[] = [];
  let covered = 0;
  let nextFree = -Infinity; // tiempo FINAL desde el que puede empezar el proximo bloque
  for (const r of ranges) {
    const chunks = chunkWords(words.filter((w) => w.start >= r.start && w.end <= r.end));
    let i = 0;
    while (i < chunks.length && covered < target * total) {
      const start = Math.max(r.start, chunks[i][0].start - PAD_IN);
      if (mapTimeNext(start, keeps) < nextFree) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < chunks.length && chunks[j + 1][chunks[j + 1].length - 1].end + PAD_OUT - start <= MAX_BLOCK) j++;
      const end = Math.min(r.end, chunks[j][chunks[j].length - 1].end + PAD_OUT);
      if (end - start < MIN_BLOCK || end - start > MAX_BLOCK) {
        i++;
        continue;
      }
      const s = +start.toFixed(3);
      const e = +end.toFixed(3);
      blocks.push({start: s, end: e, bg: 'light', beats: buildBeats(s, e, chunks.slice(i, j + 1))});
      const len = e - s;
      covered += len;
      nextFree = mapTimeNext(e, keeps) + Math.max(MIN_PROFE_GAP, (len * (1 - ratio)) / ratio);
      i = j + 1;
    }
  }
  return {blocks};
};
