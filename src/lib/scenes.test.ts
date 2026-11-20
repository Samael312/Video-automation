import {describe, expect, test} from 'vitest';
import {sceneEnvelope, sceneFrames, transitionStyle} from './scenes';

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

describe('transitionStyle', () => {
  test('por defecto fade + slide vertical', () => {
    expect(transitionStyle(undefined, 1)).toEqual({opacity: 1, transform: 'translateY(0px)'});
    expect(transitionStyle('fade-slide', 0)).toEqual({opacity: 0, transform: 'translateY(60px)'});
  });
  test('slides entran desde lados opuestos', () => {
    expect(transitionStyle('slide-left', 0).transform).toBe('translateX(-720px)');
    expect(transitionStyle('slide-right', 0).transform).toBe('translateX(720px)');
    expect(transitionStyle('slide-left', 1).transform).toBe('translateX(0px)');
  });
  test('wipe abre un circulo', () => {
    expect(transitionStyle('wipe', 0).clipPath).toBe('circle(0.00% at 50% 50%)');
    expect(transitionStyle('wipe', 1).clipPath).toBe('circle(80.00% at 50% 50%)');
  });
  test('zoom y flip terminan en su estado normal', () => {
    expect(transitionStyle('zoom', 1)).toEqual({opacity: 1, transform: 'scale(1)'});
    expect(transitionStyle('flip', 1).transform).toContain('rotateY(0deg)');
  });
  test('env fuera de rango se recorta', () => expect(transitionStyle('zoom', 5)).toEqual(transitionStyle('zoom', 1)));
});
