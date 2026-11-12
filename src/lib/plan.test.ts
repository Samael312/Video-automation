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

describe('validatePlan: emojis y countdown', () => {
  const withEmojis = {...ctx, knownEmojis: ['1f92b', '1f4da']};
  const emojiOverlay = (file: string) => ({...base(), overlays: [{kind: 'emoji', file, start: 2, end: 3, x: 1, y: 1, size: 10}]});
  test('overlay con emoji existente', () => expect(validatePlan(emojiOverlay('1f92b'), withEmojis)).toEqual([]));
  test('overlay con emoji inexistente', () => expect(validatePlan(emojiOverlay('1f600'), withEmojis).join(' | ')).toContain('1f600'));
  test('translate con emoji inexistente', () =>
    expect(validatePlan(withScenes(scene({data: {word: 'a', translation: 'b', emoji: '1f600'}})), withEmojis).join(' | ')).toContain('1f600'));
  test('sin lista de emojis en el contexto no se comprueba', () => expect(errs(emojiOverlay('1f600'))).toEqual([]));
  test('quiz con countdown de texto', () =>
    has(withScenes(scene({type: 'quiz', data: {question: 'q', options: ['a', 'b'], answer: 0, countdown: '3'}})), 'countdown'));
  test('quiz con countdown válido', () =>
    expect(errs(withScenes(scene({type: 'quiz', data: {question: 'q', options: ['a', 'b'], answer: 0, countdown: 3}})))).toEqual([]));
});

describe('validatePlan: title y end', () => {
  test('title válido', () => expect(errs({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2}})).toEqual([]));
  test('title sin line1', () => has({...base(), title: {line2: 'b', start: 0, end: 2}}, 'title'));
  test('title con start no numérico', () => has({...base(), title: {line1: 'a', line2: 'b', start: '0', end: 2}}, 'title'));
  test('end válido', () => expect(errs({...base(), end: {start: 17.7, line1: 'a', line2: 'b'}})).toEqual([]));
  test('end sin line2', () => has({...base(), end: {start: 17.7, line1: 'a'}}, 'end'));
  test('end con start en zona cortada', () => has({...base(), end: {start: 8.5, line1: 'a', line2: 'b'}}, 'cortada'));
});

describe('validatePlan: robustez (no lanza)', () => {
  const bad: unknown[] = [null, undefined, 42, 'x', {}, [], {...base(), scenes: 'x'}, {...base(), scenes: [null]},
    {...base(), scenes: [{type: 'translate', start: '2', end: 3, data: null}]}, {...base(), overlays: 5}, {...base(), sfx: [{at: 'x'}]}];
  test.each(bad.map((b, i) => [i, b] as const))('entrada mal formada #%i devuelve errores', (_i, b) => {
    expect(() => errs(b)).not.toThrow();
    expect(errs(b).length).toBeGreaterThan(0);
  });
});

describe('validatePlan: item, chat y behind', () => {
  const ov = (...overlays: unknown[]) => ({...base(), overlays});
  const item = (over: Record<string, unknown> = {}) => ({kind: 'item', n: 1, text: 'actually', start: 2, end: 4, ...over});
  const chat = (over: Record<string, unknown> = {}) => ({kind: 'chat', start: 2, end: 6, messages: [{text: 'How are you?', side: 'left'}, {text: "I'm fine", side: 'right', at: 3}], ...over});

  test('item válido (sin x/y)', () => expect(errs(ov(item()))).toEqual([]));
  test('item con n fuera de 1..10', () => has(ov(item({n: 0})), 'n'));
  test('item sin texto', () => has(ov(item({text: ''})), 'text'));
  test('chat válido', () => expect(errs(ov(chat()))).toEqual([]));
  test('chat sin mensajes', () => has(ov(chat({messages: []})), 'messages'));
  test('chat con 5 mensajes', () => has(ov(chat({messages: Array(5).fill({text: 'x', side: 'left'})})), 'messages'));
  test('chat con side inválido', () => has(ov(chat({messages: [{text: 'x', side: 'up'}]})), 'side'));
  test('chat con at fuera del overlay', () => has(ov(chat({messages: [{text: 'x', side: 'left', at: 7}]})), 'at'));
  test('kind desconocido', () => has(ov({kind: 'sticker', start: 2, end: 3}), 'kind'));

  const noMatte = {...ctx, hasMatte: false};
  const yesMatte = {...ctx, hasMatte: true};
  test('behind sin matte avisa cómo generarlo', () =>
    expect(validatePlan(ov(item({behind: true})), noMatte).join(' ')).toContain('npm run matte'));
  test('title behind sin matte también', () =>
    expect(validatePlan({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, behind: true}}, noMatte).join(' ')).toContain('matte'));
  test('behind con matte es válido', () => expect(validatePlan(ov(item({behind: true})), yesMatte)).toEqual([]));
  test('sin behind no exige matte', () => expect(validatePlan(ov(item()), noMatte)).toEqual([]));
});

describe('validatePlan: title.y', () => {
  test('y no numérico', () => has({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, y: 'alto'}}, 'title.y'));
  test('y numérico es válido', () => expect(errs({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, y: 300}})).toEqual([]));
});
