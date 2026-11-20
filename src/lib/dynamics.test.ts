import {describe, expect, test} from 'vitest';
import {CUT_FX_SECONDS, cutFxState, keywordEvents, punchScale, zoomScale} from './dynamics';
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

describe('punchScale', () => {
  test('alterna 1 y peak en cada corte y se queda', () => {
    const cuts = [3, 6, 9];
    expect(punchScale(0, cuts, 1.12)).toBe(1);
    expect(punchScale(3, cuts, 1.12)).toBe(1.12);
    expect(punchScale(5.9, cuts, 1.12)).toBe(1.12);
    expect(punchScale(6, cuts, 1.12)).toBe(1);
    expect(punchScale(9.5, cuts, 1.12)).toBe(1.12);
  });
  test('sin cortes no hace zoom', () => expect(punchScale(4, [], 1.12)).toBe(1));
});

describe('cutFxState', () => {
  const cuts = [3, 6];
  test('sin efecto o fuera de ventana no hace nada', () => {
    expect(cutFxState(3.05, cuts, 'none')).toEqual({flash: 0, dx: 0, dy: 0, filter: undefined});
    expect(cutFxState(3 + CUT_FX_SECONDS + 0.01, cuts, 'shake').dx).toBe(0);
    expect(cutFxState(1, cuts, 'glitch').filter).toBeUndefined();
  });
  test('flash: maximo en el corte y se apaga', () => {
    expect(cutFxState(3, cuts, 'flash').flash).toBeCloseTo(0.85);
    expect(cutFxState(3.15, cuts, 'flash').flash).toBe(0);
  });
  test('shake mueve el video y glitch ademas cambia el color', () => {
    expect(cutFxState(3.02, cuts, 'shake').dx).not.toBe(0);
    expect(cutFxState(3.02, cuts, 'glitch').filter).toContain('hue-rotate');
  });
});
