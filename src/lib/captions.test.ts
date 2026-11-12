import {describe, expect, test} from 'vitest';
import {buildPages, tokenStyle} from './captions';
import type {Word} from './types';

const mk = (n: number): Word[] =>
  Array.from({length: n}, (_, i) => ({word: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4, speaker: 'S'}));

describe('buildPages', () => {
  test('agrupa en páginas de maxWords', () => expect(buildPages(mk(6), 3)).toHaveLength(2));
  test('el fin de una página es el inicio de la siguiente', () => {
    const p = buildPages(mk(6), 3);
    expect(p[0].end).toBeCloseTo(p[1].start, 5);
  });
  test('los tokens conservan los tiempos de su palabra', () => {
    const t = buildPages(mk(6), 3)[1].tokens;
    expect(t.map((x) => x.text.trim())).toEqual(['w3', 'w4', 'w5']);
    expect(t[0].start).toBeCloseTo(1.5, 3);
    expect(t[2].end).toBeCloseTo(2.9, 3);
  });
  test('la última página termina 0.3 s tras su última palabra', () => {
    const p = buildPages(mk(6), 3);
    expect(p[1].end).toBeCloseTo(2.9 + 0.3, 3);
  });
  test('sin palabras no hay páginas', () => expect(buildPages([], 3)).toEqual([]));
  test('ninguna página tiene end < start', () => {
    for (const p of buildPages(mk(10), 4)) expect(p.end).toBeGreaterThanOrEqual(p.start);
  });
  test('un punto final cierra la página', () => {
    const ws = mk(4);
    ws[1] = {...ws[1], word: 'hola.'};
    expect(buildPages(ws, 5).map((p) => p.tokens.length)).toEqual([2, 2]);
  });
  test('los tokens no llevan espacios (el componente los separa)', () => {
    for (const p of buildPages(mk(6), 3)) for (const t of p.tokens) expect(t.text).toBe(t.text.trim());
  });
});

describe('tokenStyle', () => {
  const tok = {text: 'hola', start: 1, end: 2};
  test('karaoke: la palabra que se dice va en color destacado y algo mas grande', () => {
    expect(tokenStyle(tok, 1.5, {karaoke: true, highlight: '#FCF4B0', color: '#fff'})).toEqual({color: '#FCF4B0', transform: 'scale(1.08)'});
    expect(tokenStyle(tok, 2.5, {karaoke: true, highlight: '#FCF4B0', color: '#fff'})).toEqual({color: '#fff', transform: undefined});
  });
  test('sin karaoke: todas las palabras iguales aunque se esten diciendo', () => {
    expect(tokenStyle(tok, 1.5, {karaoke: false, highlight: '#FCF4B0', color: '#fff'})).toEqual({color: '#fff', transform: undefined});
  });
});
