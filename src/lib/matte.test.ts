import {describe, expect, test} from 'vitest';
import {autoBehindY, behindSpans, matteCovers, type MatteInfo} from './matte';

const info = (over: Partial<MatteInfo> = {}): MatteInfo => ({version: 1, fps: 30, ranges: [[0, 4.6]], top: {}, ...over});

describe('behindSpans', () => {
  test('solo título e items con behind', () => {
    const plan = {
      title: {line1: 'a', line2: 'b', start: 0, end: 2.6, behind: true},
      overlays: [
        {kind: 'item' as const, n: 1, text: 'x', start: 2.6, end: 4.4, behind: true},
        {kind: 'item' as const, n: 2, text: 'y', start: 5, end: 6},
        {kind: 'label' as const, text: 'z', start: 7, end: 8, x: 0, y: 0, dir: 'left' as const},
      ],
    };
    expect(behindSpans(plan)).toEqual([[0, 2.6], [2.6, 4.4]]);
  });
  test('sin behind: vacío', () => expect(behindSpans({overlays: []})).toEqual([]));
});

describe('matteCovers', () => {
  test('cubre si cada tramo cae dentro de uno del matte', () => {
    expect(matteCovers(info({ranges: [[0, 4.6], [11.5, 13.2]]}), [[0, 2.6], [12, 13]])).toBe(true);
  });
  test('no cubre si un tramo se sale', () => expect(matteCovers(info(), [[4, 6]])).toBe(false));
  test('sin matte no cubre nada', () => expect(matteCovers(null, [[0, 1]])).toBe(false));
});

describe('autoBehindY', () => {
  // cabeza en y=300 en los frames 0..59 (0–2 s), con un frame raro
  const top: Record<string, number> = {};
  for (let f = 0; f < 60; f++) top[String(f)] = f === 10 ? 40 : 300;
  const m = info({top});

  test('título: mediana de la cabeza + 30 − 181', () => expect(autoBehindY('title', m, 0, 2)).toBe(300 + 30 - 181));
  test('item: mediana de la cabeza + 8 − 152', () => expect(autoBehindY('item', m, 0, 2)).toBe(300 + 8 - 152));
  test('sin datos en el tramo: undefined', () => expect(autoBehindY('item', m, 5, 6)).toBeUndefined());
  test('sin matte: undefined', () => expect(autoBehindY('title', null, 0, 2)).toBeUndefined());
  test('no se sale por arriba del cuadro', () => {
    const alto = info({top: {'0': 0, '1': 0, '2': 0}});
    expect(autoBehindY('title', alto, 0, 0.1)).toBeGreaterThanOrEqual(0);
  });
});
