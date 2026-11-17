import {describe, expect, test} from 'vitest';
import {alignScript, normWord, rebuildSegments, scriptTokens} from './scriptAlign';
import type {Word} from './types';

const w = (word: string, start: number, end: number): Word => ({word, start, end, speaker: 'SPEAKER_00'});
const texts = (ws: Word[]) => ws.map((x) => x.word);
const finite = (ws: Word[]) => ws.forEach((x) => {
  expect(Number.isFinite(x.start)).toBe(true);
  expect(Number.isFinite(x.end)).toBe(true);
  expect(x.start).toBeGreaterThanOrEqual(0);
  expect(x.end).toBeGreaterThanOrEqual(x.start);
});

describe('normWord / scriptTokens', () => {
  test('minusculas, sin tildes, sin puntuacion', () => expect(normWord('¿Qué?')).toBe('que'));
  test('el guion interno se conserva como un token', () => expect(scriptTokens('a  page-turner\n\nb')).toEqual(['a', 'page-turner', 'b']));
});

describe('alignScript', () => {
  test('iguales conservan tiempos', () => {
    const {words, report} = alignScript('Hola, plot twist.', [w('hola', 0, 0.3), w('plot', 0.4, 0.6), w('twist', 0.6, 0.9)]);
    expect(texts(words)).toEqual(['Hola,', 'plot', 'twist.']);
    expect(words.map((x) => [x.start, x.end])).toEqual([[0, 0.3], [0.4, 0.6], [0.6, 0.9]]);
    expect(report.match).toBe(1);
  });

  test('reemplazo 1<->2 reparte por letras', () => {
    const {words} = alignScript('a cliffhanger b', [w('a', 0, 0.2), w('clif', 1, 1.2), w('hanger', 1.2, 2), w('b', 2.1, 2.3)]);
    const c = words.find((x) => x.word === 'cliffhanger')!;
    expect([c.start, c.end]).toEqual([1, 2]);
  });

  test('reemplazo 2<->1', () => {
    const {words} = alignScript('a plot twist b', [w('a', 0, 0.2), w('plotwist', 1, 2), w('b', 2.1, 2.3)]);
    expect(words[1].start).toBeCloseTo(1, 3);
    expect(words[1].end).toBeCloseTo(1 + 4 / 9, 3);
    expect(words[2].start).toBeCloseTo(1 + 4 / 9, 3);
    expect(words[2].end).toBeCloseTo(2, 3);
  });

  test('insercion interpolada entre vecinas', () => {
    const {words} = alignScript('a b c d', [w('a', 0, 0.5), w('c', 1, 1.5), w('d', 1.6, 2)]);
    expect([words[1].start, words[1].end]).toEqual([0.5, 1]);
  });

  test('insercion sin hueco dura al menos 0.08 s', () => {
    const {words} = alignScript('a b c d', [w('a', 0, 0.5), w('c', 0.5, 1), w('d', 1, 1.2)]);
    expect(words[1].end - words[1].start).toBeGreaterThanOrEqual(0.08 - 1e-9);
    expect(words[1].start).toBeGreaterThanOrEqual(0);
    finite(words);
  });

  test('insercion al inicio y al final', () => {
    const {words} = alignScript('x a b c d e f y', [w('a', 1, 1.3), w('b', 1.4, 1.7), w('c', 1.8, 2), w('d', 2, 2.2), w('e', 2.2, 2.4), w('f', 2.4, 2.6)]);
    finite(words);
    expect(words[0].end).toBeLessThanOrEqual(1);
    expect(words[7].start).toBeGreaterThanOrEqual(2.6);
  });

  test('sobrante descartado', () => {
    const {words, report} = alignScript('a b', [w('a', 0, 0.2), w('eh', 0.3, 0.4), w('b', 0.5, 0.7)]);
    expect(texts(words)).toEqual(['a', 'b']);
    expect(report.dropped).toEqual(['eh']);
  });

  test('tildes y puntuacion no estorban y se conservan', () => {
    const {words, report} = alignScript('¿Qué significa?', [w('que', 0, 0.2), w('significa', 0.2, 0.8)]);
    expect(report.match).toBe(1);
    expect(texts(words)).toEqual(['¿Qué', 'significa?']);
  });

  test('page-turner contra page turner', () => {
    const {words, report} = alignScript('a page-turner b', [w('a', 0, 0.2), w('page', 0.3, 0.5), w('turner', 0.5, 0.9), w('b', 1, 1.2)]);
    expect(report.match).toBeGreaterThanOrEqual(0.7);
    const p = words.find((x) => x.word === 'page-turner')!;
    expect([p.start, p.end]).toEqual([0.3, 0.9]);
  });

  test('coincidencia baja lanza', () =>
    expect(() => alignScript('uno dos tres cuatro', [w('a', 0, 1), w('b', 1, 2), w('c', 2, 3), w('d', 3, 4)])).toThrow(/no parece leer este guion/));
  test('guion vacio lanza', () => expect(() => alignScript('  \n ', [w('a', 0, 1)])).toThrow(/guion vacio/));
  test('sin palabras lanza', () => expect(() => alignScript('hola', [])).toThrow(/sin palabras/));

  test('idempotente', () => {
    const src = [w('a', 0, 0.2), w('clif', 1, 1.2), w('hanger', 1.2, 2), w('eh', 2.05, 2.08), w('b', 2.1, 2.3)];
    const once = alignScript('a cliffhanger b', src).words;
    expect(alignScript('a cliffhanger b', once).words).toEqual(once);
  });
});

describe('rebuildSegments', () => {
  test('texto de cada segmento = palabras que empiezan en su tramo', () => {
    const segs = [{start: 0, end: 1, text: 'x'}, {start: 1, end: 2, text: 'y'}, {start: 3, end: 4, text: 'vacio'}];
    const out = rebuildSegments(segs, [w('Hola,', 0.1, 0.3), w('plot', 1.1, 1.3), w('twist.', 1.5, 1.8)]);
    expect(out.map((s) => s.text)).toEqual(['Hola,', 'plot twist.', 'vacio']);
  });
});
