import {describe, expect, test} from 'vitest';
import {fitFontSize, litSyllables, quizPhase, wordsVisible, itemsShown, revealWords} from './timing';

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

describe('quizPhase (150 frames, 30 fps, countdown 3)', () => {
  test('al inicio no hay opciones ni reveal', () => {
    const p = quizPhase(0, 30, 150, 3);
    expect(p.optionsShown).toBe(false);
    expect(p.revealed).toBe(false);
  });
  test('a mitad hay opciones, cuenta regresiva y sin reveal', () => {
    const p = quizPhase(60, 30, 150, 3);
    expect(p.optionsShown).toBe(true);
    expect(p.revealed).toBe(false);
    expect(p.secondsLeft).toBeGreaterThan(0);
    expect(p.secondsLeft).toBeLessThanOrEqual(3);
  });
  test('al final está revelado y la cuenta es 0', () => {
    const p = quizPhase(149, 30, 150, 3);
    expect(p.revealed).toBe(true);
    expect(p.secondsLeft).toBe(0);
  });
  test('secondsLeft nunca es negativo', () => {
    for (let f = 0; f < 150; f++) expect(quizPhase(f, 30, 150, 3).secondsLeft).toBeGreaterThanOrEqual(0);
  });
  test('escena de 1 s: no revienta, no revela en el primer frame y termina revelada', () => {
    expect(quizPhase(0, 30, 30, 3).revealed).toBe(false);
    expect(quizPhase(29, 30, 30, 3).revealed).toBe(true);
  });
});

describe('litSyllables', () => {
  test('al inicio ninguna', () => expect(litSyllables(0, 150, 3)).toBe(0));
  test('al final todas', () => expect(litSyllables(149, 150, 3)).toBe(3));
  test('monótona no decreciente con 5 sílabas', () => {
    let prev = 0;
    for (let f = 0; f < 150; f++) {
      const v = litSyllables(f, 150, 5);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  test('sin sílabas', () => expect(litSyllables(10, 150, 0)).toBe(0));
});

describe('revealWords', () => {
  test('nada antes del 45 %, todas al 85 %', () => {
    expect(revealWords(0, 100, 4)).toBe(0);
    expect(revealWords(44, 100, 4)).toBe(0);
    expect(revealWords(85, 100, 4)).toBe(4);
    expect(revealWords(100, 100, 4)).toBe(4);
  });
  test('sin palabras o duracion 0', () => {
    expect(revealWords(10, 100, 0)).toBe(0);
    expect(revealWords(10, 0, 3)).toBe(0);
  });
});

describe('itemsShown', () => {
  test('el primero sale en el frame 0 y todos al final', () => {
    expect(itemsShown(0, 100, 3)).toBe(1);
    expect(itemsShown(100, 100, 3)).toBe(3);
  });
  test('crece de forma pareja', () => {
    expect(itemsShown(30, 100, 3)).toBe(2);
    expect(itemsShown(60, 100, 3)).toBe(3);
  });
});
