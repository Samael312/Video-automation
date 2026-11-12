import {describe, expect, test} from 'vitest';
import {defaultPlan, validatePlan, type EditPlan, type Scene, type ValidateCtx} from './plan';

const ctx: ValidateCtx = {
  video: 'v.mp4',
  duration: 20,
  keeps: [{start: 1, end: 8}, {start: 9, end: 19}],
  knownStyles: ['referencia'],
  knownGenerated: ['demo'],
};
const base = (): EditPlan => defaultPlan('v.mp4');
const scene = (over: Partial<Scene> = {}): Scene => ({type: 'translate', start: 2, end: 4, data: {word: 'actually', translation: 'en realidad'}, ...over});
const withScenes = (...scenes: Scene[]): EditPlan => ({...base(), scenes});
const errs = (p: unknown) => validatePlan(p, ctx);
const has = (p: unknown, word: string) => expect(errs(p).join('\n')).toContain(word);

describe('validatePlan: válido', () => {
  test('defaultPlan es válido', () => expect(errs(base())).toEqual([]));
  test('plan con una escena válida', () => expect(errs(withScenes(scene()))).toEqual([]));
  test('escena generated registrada', () => expect(errs(withScenes(scene({type: 'generated', data: {component: 'demo'}})))).toEqual([]));
});

describe('validatePlan: cabecera', () => {
  test('version distinta de 1', () => has({...base(), version: 2}, 'version'));
  test('estilo desconocido', () => has({...base(), style: 'neon'}, 'estilo'));
  test('video distinto del renderizado', () => has({...base(), video: 'otro.mp4'}, 'video'));
});

describe('validatePlan: escenas', () => {
  test('tipo desconocido', () => has(withScenes(scene({type: 'karaoke' as never})), 'tipo'));
  test('data incompleta', () => has(withScenes(scene({data: {word: 'x'}})), 'translation'));
  test('generated no registrada', () => has(withScenes(scene({type: 'generated', data: {component: 'nope'}})), 'nope'));
  test('quiz con answer fuera de rango', () => has(withScenes(scene({type: 'quiz', data: {question: 'q', options: ['a', 'b'], answer: 5}})), 'answer'));
  test('quiz con 4 opciones', () => has(withScenes(scene({type: 'quiz', data: {question: 'q', options: ['a', 'b', 'c', 'd'], answer: 0}})), 'options'));
  test('start >= end', () => has(withScenes(scene({start: 4, end: 4})), 'start'));
  test('escena de 0.5 s', () => has(withScenes(scene({start: 2, end: 2.5})), 'dura'));
  test('escena de 9 s', () => has(withScenes(scene({start: 9.5, end: 18.6})), 'dura'));
  test('escenas solapadas', () => has(withScenes(scene({start: 2, end: 4}), scene({start: 3.5, end: 5.5})), 'solap'));
  test('escena fuera del video', () => has(withScenes(scene({start: 18, end: 21})), 'fuera'));
  test('escena que cruza un corte', () => has(withScenes(scene({start: 7, end: 8.5})), 'corte'));
  test('escena que cruza un corte entre dos tramos', () => has(withScenes(scene({start: 7.5, end: 9.5})), 'corte'));
});

describe('validatePlan: overlays y sfx', () => {
  test('overlay que empieza en zona cortada', () =>
    has({...base(), overlays: [{kind: 'emoji', file: '1f92b', start: 8.5, end: 9.5, x: 1, y: 1, size: 10}]}, 'cortada'));
  test('sfx en zona cortada', () => has({...base(), sfx: [{at: 8.5, name: 'pop'}]}, 'cortada'));
  test('overlay válido', () => expect(errs({...base(), overlays: [{kind: 'label', text: 'hi', start: 2, end: 3, x: 1, y: 1, dir: 'left'}]})).toEqual([]));
});

describe('validatePlan: robustez (no lanza)', () => {
  const bad: unknown[] = [null, undefined, 42, 'x', {}, [], {...base(), scenes: 'x'}, {...base(), scenes: [null]},
    {...base(), scenes: [{type: 'translate', start: '2', end: 3, data: null}]}, {...base(), overlays: 5}, {...base(), sfx: [{at: 'x'}]}];
  test.each(bad.map((b, i) => [i, b] as const))('entrada mal formada #%i devuelve errores', (_i, b) => {
    expect(() => errs(b)).not.toThrow();
    expect(errs(b).length).toBeGreaterThan(0);
  });
});
