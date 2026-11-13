import {describe, expect, test} from 'vitest';
import {leadDelays} from './leadTiming';
import type {Word} from '../lib/types';

const w = (word: string, start: number): Word => ({word, start, end: start + 0.15, speaker: 'S'});
const words = [w('te', 4.0), w('deja', 4.2), w('en,', 4.5), w('Shock', 4.7)];

describe('leadDelays', () => {
  test('una demora por palabra, ignorando puntuacion y mayusculas', () => expect(leadDelays('Te deja en', words, 4.0, 5.0)).toEqual([0, 0.2, 0.5].map((x) => expect.closeTo(x, 5))));
  test('leadDelays sin coincidencia devuelve ceros', () => expect(leadDelays('otra cosa', words, 4, 5)).toEqual([0, 0]));
  test('palabras fuera del beat no cuentan', () => expect(leadDelays('te deja', words, 4.1, 5)).toEqual([0, expect.closeTo(0.1, 5)]));
  test('una palabra no encontrada toma la demora de la anterior', () => expect(leadDelays('te xx en', words, 4.0, 5.0)).toEqual([0, 0, expect.closeTo(0.5, 5)]));
  test('lead vacio -> lista vacia', () => expect(leadDelays('', words, 4, 5)).toEqual([]));
});
