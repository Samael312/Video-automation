import {describe, expect, test} from 'vitest';
import {cutPoints, keepFrames, mapTimeNext, keptDuration, mapTime, remapWords, totalFrames, type Keep} from './cuts';
import type {Word} from './types';

const keeps: Keep[] = [{start: 0.9, end: 2.1}, {start: 3.9, end: 5.1}];
const word = (w: string, start: number, end: number): Word => ({word: w, start, end, speaker: 'S'});
const close = (a: number | null, b: number) => {
  expect(a).not.toBeNull();
  expect(a as number).toBeCloseTo(b, 5);
};

describe('cuts', () => {
  test('keptDuration suma los tramos', () => expect(keptDuration(keeps)).toBeCloseTo(2.4, 5));
  test('mapTime dentro del primer tramo', () => close(mapTime(1.0, keeps), 0.1));
  test('mapTime al inicio del segundo tramo', () => close(mapTime(3.9, keeps), 1.2));
  test('mapTime en zona cortada es null', () => expect(mapTime(3.0, keeps)).toBeNull());
  test('mapTime en el final de un tramo cuenta como dentro', () => close(mapTime(2.1, keeps), 1.2));
  test('cutPoints devuelve el inicio nuevo de cada tramo salvo el primero', () => {
    const pts = cutPoints(keeps);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toBeCloseTo(1.2, 5);
  });
  test('remapWords descarta palabras cortadas y reubica el resto', () => {
    const out = remapWords([word('a', 1.0, 1.5), word('b', 2.5, 3.0), word('c', 4.0, 5.0)], keeps);
    expect(out.map((x) => x.word)).toEqual(['a', 'c']);
    expect(out[1].start).toBeCloseTo(1.3, 5);
    expect(out[1].end).toBeCloseTo(2.3, 5);
  });
  test('un solo tramo completo deja las palabras idénticas', () => {
    const ws = [word('a', 0.2, 0.8)];
    expect(remapWords(ws, [{start: 0, end: 5}])).toEqual(ws);
  });
  test('remapWords con lista vacía', () => expect(remapWords([], keeps)).toEqual([]));
  test('keepFrames usa frames redondeados del original', () => expect(keepFrames({start: 0.9, end: 2.1}, 30)).toBe(36));
  test('totalFrames es la suma de keepFrames', () => expect(totalFrames(keeps, 30)).toBe(72));
  test('totalFrames con lista vacía es 0', () => expect(totalFrames([], 30)).toBe(0));
  test('mapTimeNext antes del primer tramo es 0', () => expect(mapTimeNext(0, keeps)).toBe(0));
  test('mapTimeNext en zona cortada salta al siguiente tramo', () => expect(mapTimeNext(3.0, keeps)).toBeCloseTo(1.2, 5));
  test('mapTimeNext después del último tramo es la duración total', () => expect(mapTimeNext(9, keeps)).toBeCloseTo(2.4, 5));
  test('mapTimeNext dentro de un tramo coincide con mapTime', () => expect(mapTimeNext(4.0, keeps)).toBeCloseTo(1.3, 5));
});
