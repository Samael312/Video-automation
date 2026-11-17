import {describe, expect, test} from 'vitest';
import {beatFrames, blockFrames, cameraScale, insideBlocks, staggerDelays, tickFrames, withUnderlay} from './timing';
import type {Block} from '../lib/motion';
import type {Keep} from '../lib/cuts';

const keeps: Keep[] = [{start: 1, end: 8}, {start: 9, end: 19}];
const b: Block = {start: 9, end: 13, bg: 'light', beats: [{at: 9, layout: 'word', key: 'a'}, {at: 10.5, layout: 'word', key: 'b'}, {at: 12, layout: 'big', key: 'c'}]};

describe('motion timing', () => {
  test('blockFrames en borde de tramo', () => expect(blockFrames(b, keeps, 30)).toEqual({from: 7 * 30, duration: 4 * 30}));
  test('beatFrames: primer from = 0 y suma = duracion del bloque', () => {
    const fr = beatFrames(b, keeps, 30);
    expect(fr[0].from).toBe(0);
    expect(fr.map((x) => x.from)).toEqual([0, 45, 90]);
    expect(fr.reduce((s, x) => s + x.duration, 0)).toBe(120);
  });
  test('tickFrames omite el primero y los que estan a menos de 0.5 s del ultimo', () => expect(tickFrames([0, 10, 20, 40], 30)).toEqual([20, 40]));
  test('cameraScale: golpe al inicio del beat', () => expect(cameraScale(0, 300, [0])).toBeCloseTo(1.04, 2));
  test('cameraScale: empuje llega a 1.06 al final', () => expect(cameraScale(299, 300, [0])).toBeCloseTo(1.06, 2));
  test('cameraScale nunca pasa 1.10', () => {
    for (let f = 0; f < 300; f++) expect(cameraScale(f, 300, [0, 3, 6, 290])).toBeLessThanOrEqual(1.1);
  });
  test('insideBlocks', () => {
    const m = {blocks: [b]};
    expect(insideBlocks(9, m, keeps)).toBe(true); // tiempo final 9 = original 11
    expect(insideBlocks(3, m, keeps)).toBe(false);
    expect(insideBlocks(9, undefined, keeps)).toBe(false);
  });
});

describe('staggerDelays', () => {
  test('beat largo: 4 + i*5 frames', () => expect(staggerDelays(3, 60, 4, 5)).toEqual([4, 9, 14]));
  test('beat corto: el ultimo item entra antes del 40 % del beat', () => {
    const d = staggerDelays(3, 18, 4, 5);
    expect(d[2]).toBeLessThanOrEqual(Math.floor(18 * 0.4));
    expect(d[0]).toBeLessThan(d[1]);
  });
});

describe('withUnderlay', () => {
  test('alarga un bloque si el siguiente empieza pegado (el wipe abre sobre el, no sobre el fondo vacio)', () =>
    expect(withUnderlay([{from: 0, duration: 100}, {from: 100, duration: 50}], 8)).toEqual([{from: 0, duration: 108}, {from: 100, duration: 50}]));
  test('tolera 1 frame de redondeo (y lo tapa)', () =>
    expect(withUnderlay([{from: 0, duration: 100}, {from: 101, duration: 50}], 8)[0]!.duration).toBe(109));
  test('no alarga si hay profe entre bloques', () =>
    expect(withUnderlay([{from: 0, duration: 100}, {from: 130, duration: 50}], 8)[0]!.duration).toBe(100));
  test('el ultimo no cambia y los nulos se respetan', () =>
    expect(withUnderlay([{from: 0, duration: 10}, null, {from: 10, duration: 5}], 8)).toEqual([{from: 0, duration: 18}, null, {from: 10, duration: 5}]));
});
