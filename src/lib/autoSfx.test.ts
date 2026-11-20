import {describe, expect, it} from 'vitest';
import {overlaySfx, thinEvents, type AutoSfxEvent} from './autoSfx';

const ev = (at: number): AutoSfxEvent => ({at, name: 'pop', volume: 0.5});

describe('overlaySfx', () => {
  it('da un sonido a cada tipo de overlay', () => {
    expect(overlaySfx('emoji').name).toBe('pop2');
    expect(overlaySfx('label').name).toBe('pop');
    expect(overlaySfx('item').name).toBe('tick');
    expect(overlaySfx('chat').name).toBe('message');
  });
});

describe('thinEvents', () => {
  it('ordena y descarta eventos amontonados', () => {
    expect(thinEvents([ev(1.1), ev(1), ev(2)]).map((e) => e.at)).toEqual([1, 2]);
  });
  it('conserva eventos separados', () => {
    expect(thinEvents([ev(1), ev(1.5), ev(2)]).map((e) => e.at)).toEqual([1, 1.5, 2]);
  });
  it('no duplica un sfx manual cercano', () => {
    expect(thinEvents([ev(1), ev(3)], [1.05]).map((e) => e.at)).toEqual([3]);
  });
});
