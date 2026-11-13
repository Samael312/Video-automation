import {describe, expect, test} from 'vitest';
import {MUSIC_DEFAULTS, musicVolume, speechSpans} from './music';
import type {Word} from './types';

const w = (start: number, end: number): Word => ({word: 'x', start, end, speaker: 'S'});
const o = MUSIC_DEFAULTS;

describe('speechSpans', () => {
  test('une huecos < 0.3 s', () => expect(speechSpans([w(0, 0.5), w(0.6, 1.0), w(2.0, 2.4)])).toEqual([{start: 0, end: 1}, {start: 2, end: 2.4}]));
  test('sin palabras -> []', () => expect(speechSpans([])).toEqual([]));
});

describe('musicVolume', () => {
  test('sin voz: volumen pleno salvo fades', () => {
    expect(musicVolume(5, [], 10, o)).toBeCloseTo(0.12, 5);
    expect(musicVolume(0, [], 10, o)).toBeCloseTo(0, 5);
    expect(musicVolume(0.25, [], 10, o)).toBeCloseTo(0.06, 5);
    expect(musicVolume(9.5, [], 10, o)).toBeCloseTo(0.06, 5);
    expect(musicVolume(10, [], 10, o)).toBeCloseTo(0, 5);
  });
  const sp = [{start: 3, end: 6}];
  test('durante la voz baja a duck', () => expect(musicVolume(4.5, sp, 10, o)).toBeCloseTo(0.04, 5));
  test('rampa de bajada empieza 0.15 s antes', () => {
    expect(musicVolume(2.85, sp, 10, o)).toBeCloseTo(0.12, 5);
    expect(musicVolume(2.925, sp, 10, o)).toBeCloseTo(0.08, 5);
    expect(musicVolume(3, sp, 10, o)).toBeCloseTo(0.04, 5);
  });
  test('rampa de subida dura 0.4 s', () => {
    expect(musicVolume(6.2, sp, 10, o)).toBeCloseTo(0.08, 5);
    expect(musicVolume(6.4, sp, 10, o)).toBeCloseTo(0.12, 5);
  });
  test('video corto: fades solapados', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const v = musicVolume(t, [], 1, o);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.12);
    }
  });
});
