import {describe, expect, test} from 'vitest';
import {fitFontSize, wordsVisible} from './timing';

describe('fitFontSize', () => {
  test('texto corto conserva el tamaño base', () => expect(fitFontSize('hi', 600, 80)).toBe(80));
  test('texto largo se achica pero respeta el mínimo', () => {
    const v = fitFontSize('x'.repeat(40), 600, 80);
    expect(v).toBeLessThan(80);
    expect(v).toBeGreaterThanOrEqual(28);
  });
  test('texto larguísimo queda en el mínimo', () => expect(fitFontSize('x'.repeat(500), 600, 80)).toBe(28));
  test('texto vacío conserva el tamaño base', () => expect(fitFontSize('', 600, 80)).toBe(80));
});

describe('wordsVisible', () => {
  test('al inicio no hay palabras', () => expect(wordsVisible(0, 30, 5, 150)).toBe(0));
  test('al final están todas', () => expect(wordsVisible(149, 30, 5, 150)).toBe(5));
  test('es monótona no decreciente', () => {
    let prev = 0;
    for (let f = 0; f < 150; f++) {
      const v = wordsVisible(f, 30, 5, 150);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  test('oración vacía', () => expect(wordsVisible(10, 30, 0, 150)).toBe(0));
  test('todas las palabras ya son visibles pasado el 60 % de la escena', () => expect(wordsVisible(91, 30, 5, 150)).toBe(5));
});
