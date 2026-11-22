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
  test('chat con emoji que no está en public/emoji avisa cómo bajarlo', () =>
    expect(validatePlan(ov(chat({messages: [{text: 'Hi 😀', side: 'left'}]})), {...ctx, knownEmojis: ['1f92b']}).join(' ')).toContain('npm run emoji -- 1f600'));
  test('chat con emoji disponible es válido', () =>
    expect(validatePlan(ov(chat({messages: [{text: 'Hi 😀', side: 'left'}]})), {...ctx, knownEmojis: ['1f600']})).toEqual([]));
  test('kind desconocido',() => has(ov({kind: 'sticker', start: 2, end: 3}), 'kind'));

  const noMatte = {...ctx, matte: null};
  const yesMatte = {...ctx, matte: {version: 1 as const, fps: 30, ranges: [[1.5, 4.2]] as [number, number][], top: {}}};
  test('behind sin matte avisa cómo generarlo', () =>
    expect(validatePlan(ov(item({behind: true})), noMatte).join(' ')).toContain('npm run matte'));
  test('title behind sin matte también', () =>
    expect(validatePlan({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, behind: true}}, noMatte).join(' ')).toContain('matte'));
  test('behind con matte que lo cubre es válido', () => expect(validatePlan(ov(item({behind: true})), yesMatte)).toEqual([]));
  test('behind fuera de lo recortado pide volver a correr matte', () =>
    expect(validatePlan(ov(item({behind: true, start: 4, end: 5})), yesMatte).join(' ')).toContain('vuelve a correr: npm run matte'));
  test('sin behind no exige matte', () => expect(validatePlan(ov(item()), noMatte)).toEqual([]));
});

describe('validatePlan: title.y', () => {
  test('y no numérico', () => has({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, y: 'alto'}}, 'title.y'));
  test('y numérico es válido', () => expect(errs({...base(), title: {line1: 'a', line2: 'b', start: 0, end: 2, y: 300}})).toEqual([]));
});

describe('validatePlan: music', () => {
  const mctx: ValidateCtx = {...ctx, knownMusic: ['curious__a.mp3']};
  const m = (music: unknown) => validatePlan({...base(), music}, mctx).join('\n');
  test('plan sin music sigue valido', () => expect(validatePlan(base(), mctx)).toEqual([]));
  test('music valida', () => expect(m({file: 'curious__a.mp3'})).toBe(''));
  test('music valida con volume y duck', () => expect(m({file: 'curious__a.mp3', volume: 0.2, duck: 0.05})).toBe(''));
  test('music inexistente', () => {
    expect(m({file: 'nope.mp3'})).toContain('media/music');
    expect(m({file: 'nope.mp3'})).toContain('curious__a.mp3');
  });
  test('volume fuera de rango', () => expect(m({file: 'curious__a.mp3', volume: 0.5})).toContain('volume'));
  test('duck mayor que volume', () => expect(m({file: 'curious__a.mp3', duck: 0.2})).toContain('duck'));
  test('music sin file', () => expect(m({volume: 0.1})).toContain('file'));
});

describe('validatePlan: hook y zoom', () => {
  test('hook válido', () => expect(errs({...base(), hook: {text: 'No digas esto', end: 1.8}})).toEqual([]));
  test('hook sin texto', () => has({...base(), hook: {text: '', end: 1.5}}, 'hook'));
  test('hook demasiado largo en tiempo', () => has({...base(), hook: {text: 'hola', end: 3}}, 'hook.end'));
  test('hook con texto largo', () => has({...base(), hook: {text: 'x'.repeat(41), end: 2}}, 'caracteres'));
  test('hook cae en zona cortada', () => has({...base(), hook: {text: 'hola', end: 0.5}}, 'zona cortada'));
  test('titulo solapado con el hook', () =>
    has({...base(), hook: {text: 'hola', end: 2}, title: {line1: 'a', line2: 'b', start: 1, end: 3}}, 'solapa'));
  test('zoom.mode punch válido', () => expect(errs({...base(), zoom: {peak: 1.08, duration: 0.35, keywords: [], mode: 'punch', punch: 1.15}})).toEqual([]));
  test('zoom.mode inválido', () => has({...base(), zoom: {peak: 1.08, duration: 0.35, keywords: [], mode: 'spin' as never}}, 'zoom.mode'));
  test('zoom.punch fuera de rango', () => has({...base(), zoom: {peak: 1.08, duration: 0.35, keywords: [], mode: 'punch', punch: 2}}, 'zoom.punch'));
});

describe('validatePlan: plantillas nuevas', () => {
  const sc = (type: Scene['type'], data: Record<string, unknown>) => withScenes(scene({type, data}));
  test('before-after válida', () => expect(errs(sc('before-after', {before: "I'm tired", after: "I'm exhausted"}))).toEqual([]));
  test('before-after sin after', () => has(sc('before-after', {before: 'x'}), 'after'));
  test('versus válida', () => expect(errs(sc('versus', {left: 'lift', right: 'elevator', leftLabel: 'UK', rightLabel: 'US'}))).toEqual([]));
  test('versus sin right', () => has(sc('versus', {left: 'x'}), 'right'));
  test('listen válida', () => expect(errs(sc('listen', {phrase: 'What are you up to'}))).toEqual([]));
  test('listen sin phrase', () => has(sc('listen', {}), 'phrase'));
  test('countdown válida', () => expect(errs(sc('countdown', {title: '3 errores', items: ['a', 'b', 'c']}))).toEqual([]));
  test('countdown con 1 item', () => has(sc('countdown', {items: ['a']}), 'items'));
  test('countdown con 6 items', () => has(sc('countdown', {items: ['a', 'b', 'c', 'd', 'e', 'f']}), 'items'));
});

describe('validatePlan: transiciones y cutFx', () => {
  test('transition válida', () => expect(errs(withScenes(scene({transition: 'wipe'})))).toEqual([]));
  test('transition inválida', () => has(withScenes(scene({transition: 'spin' as never})), 'transition'));
  test('cutFx válido', () => expect(errs({...base(), cutFx: 'glitch'})).toEqual([]));
  test('cutFx inválido', () => has({...base(), cutFx: 'boom'}, 'cutFx'));
});

describe('validatePlan: overlay fx (componente GSAP transparente sobre la profe)', () => {
  const fx = (over: Record<string, unknown> = {}) => ({...base(), overlays: [{kind: 'fx', component: 'demo', start: 2, end: 6, cues: [2.5, 5], ...over}]});
  test('fx registrado con cues dentro del overlay', () => expect(errs(fx())).toEqual([]));
  test('fx con componente no registrado', () => has(fx({component: 'nope'}), 'nope'));
  test('fx sin componente', () => has(fx({component: undefined}), 'component'));
  test('cue fuera del overlay', () => has(fx({cues: [7]}), 'cues'));
  test('fx puede cruzar un corte (los cues se reubican)', () => expect(errs(fx({start: 2, end: 12, cues: [3, 10]}))).toEqual([]));
});
