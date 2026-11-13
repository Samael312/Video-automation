import {describe, expect, test} from 'vitest';
import {chunkWords, draftMotion} from './draftMotion';
import {mapTimeNext, keepIndexOf, type Keep} from './cuts';
import {beatSpans, motionShare, validateMotion} from './motion';
import {defaultPlan} from './plan';
import type {Word} from './types';

// palabras de 0.3 s separadas 0.05 s; coma cada 5 palabras
const mkWords = (from: number, to: number): Word[] => {
  const out: Word[] = [];
  let t = from;
  let i = 0;
  while (t + 0.3 <= to) {
    i++;
    out.push({word: i % 5 === 0 ? `w${i},` : `w${i}`, start: +t.toFixed(3), end: +(t + 0.3).toFixed(3), speaker: 'S'});
    t += 0.35;
  }
  return out;
};
const keeps: Keep[] = [{start: 0, end: 12}, {start: 12.5, end: 30}];
const words = [...mkWords(0, 12), ...mkWords(12.5, 30)];
const opts = {from: 2.5, until: 27};
const draft = draftMotion(words, keeps, opts);
const blocks = draft.blocks;
const at = (t: number) => mapTimeNext(t, keeps);

describe('chunkWords', () => {
  const chunks = chunkWords(mkWords(0, 6));
  test('grupos de 2 a 4 palabras', () => chunks.slice(0, -1).forEach((c) => expect(c.length).toBeGreaterThanOrEqual(2)));
  test('nunca mas de 4', () => chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(4)));
  test('corta despues de la coma', () => chunks.forEach((c) => c.slice(0, -1).forEach((w) => expect(w.word.endsWith(',')).toBe(false))));
  test('corta en pausa > 0.25 s', () => {
    const ws: Word[] = [{word: 'a', start: 0, end: 0.2, speaker: 'S'}, {word: 'b', start: 0.25, end: 0.4, speaker: 'S'}, {word: 'c', start: 0.8, end: 1, speaker: 'S'}, {word: 'd', start: 1.05, end: 1.2, speaker: 'S'}];
    expect(chunkWords(ws).map((c) => c.map((w) => w.word))).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('draftMotion', () => {
  test('crea bloques', () => expect(blocks.length).toBeGreaterThan(0));
  test('cada bloque cae en un solo tramo y entre from y until', () =>
    blocks.forEach((b) => {
      expect(keepIndexOf(b.start, keeps)).toBe(keepIndexOf(b.end, keeps));
      expect(keepIndexOf(b.start, keeps)).toBeGreaterThanOrEqual(0);
      expect(b.start).toBeGreaterThanOrEqual(opts.from);
      expect(b.end).toBeLessThanOrEqual(opts.until);
    }));
  test('no crea bloques de menos de 3 s ni de mas de 8 s', () =>
    blocks.forEach((b) => {
      expect(b.end - b.start).toBeGreaterThanOrEqual(3);
      expect(b.end - b.start).toBeLessThanOrEqual(8);
    }));
  test('hay al menos 1 s de profe entre bloques', () => blocks.slice(1).forEach((b, i) => expect(at(b.start) - at(blocks[i].end)).toBeGreaterThanOrEqual(1)));
  test('primer beat en block.start y at crecientes', () =>
    blocks.forEach((b) => {
      expect(b.beats[0].at).toBe(b.start);
      b.beats.slice(1).forEach((x, i) => expect(x.at).toBeGreaterThan(b.beats[i].at));
    }));
  test('ningun beat < 0.4 s', () => blocks.forEach((b) => beatSpans(b).forEach(({start, end}) => expect(end - start).toBeGreaterThanOrEqual(0.4))));
  test('todos los beats son word con key = ultima palabra sin puntuacion y lead = resto', () =>
    blocks.forEach((b) =>
      b.beats.forEach((x) => {
        expect(x.layout).toBe('word');
        expect(x.key).toMatch(/^w\d+$/);
        if (x.lead !== undefined) expect(x.lead).toMatch(/^(w\d+,? ?)+$/);
      })));
  test('el resultado pasa validateMotion', () =>
    expect(validateMotion(draft, {video: 'v.mp4', duration: 30, keeps, knownStyles: [], knownGenerated: []}, [])).toEqual([]));
  test('share final entre 0.5 y target + 0.15', () => {
    const share = motionShare({...defaultPlan('v.mp4'), motion: draft}, keeps);
    expect(share).toBeGreaterThanOrEqual(0.5);
    expect(share).toBeLessThanOrEqual(0.65 + 0.15);
  });
  test('no crea bloques de menos de 3 s en tramos cortos', () => {
    const k: Keep[] = [{start: 0, end: 4}, {start: 5, end: 7.5}];
    const d = draftMotion([...mkWords(0, 4), ...mkWords(5, 7.5)], k, {from: 0, until: 7.5});
    d.blocks.forEach((b) => expect(b.end - b.start).toBeGreaterThanOrEqual(3));
  });
});
