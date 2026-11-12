import {describe, expect, test} from 'vitest';
import {keywordEvents, zoomScale} from './dynamics';
import type {Word} from './types';

const word = (w: string, start: number): Word => ({word: w, start, end: start + 0.3, speaker: 'S'});

describe('zoomScale', () => {
  test('sin eventos es 1', () => expect(zoomScale(0, [], 1.08, 0.35)).toBe(1));
  test('en el instante del evento es 1', () => expect(zoomScale(2, [2], 1.08, 0.35)).toBeCloseTo(1, 5));
  test('a mitad de la duración llega al pico', () => expect(zoomScale(2.175, [2], 1.08, 0.35)).toBeCloseTo(1.08, 5));
  test('al terminar la duración vuelve a 1', () => expect(zoomScale(2.35, [2], 1.08, 0.35)).toBeCloseTo(1, 5));
  test('antes del evento es 1', () => expect(zoomScale(1.9, [2], 1.08, 0.35)).toBe(1));
  test('eventos solapados no se suman', () => expect(zoomScale(2.175, [2, 2.1], 1.08, 0.35)).toBeLessThanOrEqual(1.08));
});

describe('keywordEvents', () => {
  test('ignora mayúsculas y signos', () => expect(keywordEvents([word('Actually,', 1.5)], ['actually'])).toEqual([1.5]));
  test('sin coincidencias devuelve []', () => expect(keywordEvents([word('hola', 1)], ['actually'])).toEqual([]));
  test('con acentos coincide igual', () => expect(keywordEvents([word('Librería', 2)], ['librería'])).toEqual([2]));
});
