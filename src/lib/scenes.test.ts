import {describe, expect, test} from 'vitest';
import {sceneEnvelope, sceneFrames} from './scenes';

const keeps = [{start: 1, end: 8}, {start: 9, end: 19}];

describe('sceneFrames', () => {
  test('escena en el primer tramo', () => expect(sceneFrames(2, 4, keeps, 30)).toEqual({from: 30, duration: 60}));
  test('escena tras un corte se reubica', () => expect(sceneFrames(10, 12, keeps, 30)).toEqual({from: 240, duration: 60}));
  test('escena dentro de una zona cortada colapsa a null', () => expect(sceneFrames(8.2, 8.8, keeps, 30)).toBeNull());
});

describe('sceneEnvelope', () => {
  test('empieza en 0', () => expect(sceneEnvelope(0, 60, 6, 6)).toBe(0));
  test('en el centro vale 1', () => expect(sceneEnvelope(30, 60, 6, 6)).toBe(1));
  test('al final baja pero no es negativa', () => {
    const v = sceneEnvelope(59, 60, 6, 6);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
  test('escena de 1 s con animaciones largas: siempre en [0,1]', () => {
    for (let f = 0; f < 30; f++) {
      const v = sceneEnvelope(f, 30, 20, 20);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  test('escena de 1 s con animaciones largas: el centro es visible', () => expect(sceneEnvelope(15, 30, 20, 20)).toBeGreaterThan(0.9));
});
