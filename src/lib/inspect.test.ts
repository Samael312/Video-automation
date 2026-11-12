import {describe, expect, test} from 'vitest';
import {formatInspect} from './inspect';
import type {Transcript} from './types';

const w = (word: string, start: number) => ({word, start, end: start + 0.2, speaker: 'S'});
const transcript: Transcript = {video: 'v.mp4', duration: 7, speakers: ['S'], words: [w('a', 1.2), w('b', 2.5), w('c', 3.4), w('d', 4.5)]};
const keeps = [{start: 1, end: 3}, {start: 4, end: 6}];

describe('formatInspect', () => {
  const out = formatInspect(transcript, keeps);
  test('cabecera del primer tramo', () => expect(out).toContain('== TRAMO 1 (1.00–3.00 s) =='));
  test('palabra con su tiempo original', () => expect(out).toContain('[1.20] a'));
  test('corte entre tramos con su duración', () => expect(out).toContain('--- CORTE (3.00–4.00 s, 1.00 s) ---'));
  test('palabra en zona cortada marcada', () => expect(out).toContain('(cortada) [3.40] c'));
  test('segundo tramo y su palabra', () => {
    expect(out).toContain('== TRAMO 2 (4.00–6.00 s) ==');
    expect(out).toContain('[4.50] d');
  });
  test('duración final', () => expect(out).toContain('Duración final: 4.00 s de 7.00 s'));
  test('el orden es tramo 1, corte, tramo 2', () => {
    expect(out.indexOf('TRAMO 1')).toBeLessThan(out.indexOf('CORTE (3.00'));
    expect(out.indexOf('CORTE (3.00')).toBeLessThan(out.indexOf('TRAMO 2'));
  });
  test('transcript sin palabras no lanza', () => expect(formatInspect({...transcript, words: []}, keeps)).toContain('Duración final'));
  test('palabras antes del primer tramo aparecen como cortadas', () =>
    expect(formatInspect({...transcript, words: [w('x', 0.3)]}, keeps)).toContain('(cortada) [0.30] x'));
});
