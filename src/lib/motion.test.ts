import {describe, expect, test} from 'vitest';
import {defaultPlan, validatePlan, type EditPlan, type Scene, type ValidateCtx} from './plan';
import {beatSpans, motionShare, motionWarnings, voiceGaps, type Beat, type Block} from './motion';

const ctx: ValidateCtx = {
  video: 'v.mp4',
  duration: 20,
  keeps: [{start: 1, end: 8}, {start: 9, end: 19}],
  knownStyles: ['referencia'],
  knownGenerated: ['demo'],
  knownEmojis3d: ['1f4da'],
};
const block = (over: Partial<Block> = {}): Block => ({
  start: 2,
  end: 6,
  bg: 'light',
  beats: [{at: 2, layout: 'word', key: 'a'}, {at: 3, layout: 'word', key: 'b'}],
  ...over,
});
const withBeat = (b: Partial<Beat> & {layout: Beat['layout']}): Block => block({beats: [{at: 2, ...b} as Beat]});
const plan = (blocks: unknown, scenes: Scene[] = []): EditPlan => ({...defaultPlan('v.mp4'), strategy: 'motion', motion: {blocks} as never, scenes});
const errs = (p: unknown) => validatePlan(p, ctx);
const has = (p: unknown, word: string) => expect(errs(p).join('\n')).toContain(word);

describe('motion: valido', () => {
  test('plan sin motion sigue valido', () => expect(errs(defaultPlan('v.mp4'))).toEqual([]));
  test('bloque valido', () => expect(errs(plan([block()]))).toEqual([]));
  test('beatSpans: cada beat dura hasta el siguiente o el fin del bloque', () =>
    expect(beatSpans(block()).map(({start, end}) => ({start, end}))).toEqual([{start: 2, end: 3}, {start: 3, end: 6}]));
  test('todos los layouts con sus campos son validos', () => {
    const beats: Beat[] = [
      {at: 2, layout: 'word', key: 'k'},
      {at: 2.5, layout: 'prop', emoji: '1f4da', pos: 'top'},
      {at: 3, layout: 'ring', emoji: '1f4da'},
      {at: 3.5, layout: 'list', items: ['a', 'b', 'c'], active: 2},
      {at: 4, layout: 'strike', items: ['a', 'b']},
      {at: 4.5, layout: 'swap', from: 'a', to: 'b'},
      {at: 5, layout: 'card', key: 'k', frame: 'phone'},
      {at: 5.5, layout: 'big', key: '3'},
    ];
    expect(errs(plan([block({beats})]))).toEqual([]);
  });
});

describe('motion: bloques', () => {
  test('blocks no es lista', () => has({...defaultPlan('v.mp4'), motion: {blocks: 3}}, 'blocks'));
  test('bloque que cruza un corte', () => has(plan([block({start: 7, end: 8.5, beats: [{at: 7, layout: 'word', key: 'a'}]})]), 'corte'));
  test('bloques solapados', () => has(plan([block(), block({start: 5, end: 7.5, beats: [{at: 5, layout: 'word', key: 'a'}]})]), 'solapa'));
  test('bloque solapado con escena', () =>
    has(plan([block()], [{type: 'translate', start: 4, end: 7, data: {word: 'a', translation: 'b'}}]), 'escena'));
  test('bg desconocido', () => has(plan([block({bg: 'neon' as never})]), 'bg'));
});

describe('motion: beats', () => {
  test('primer beat no empieza en el bloque', () => has(plan([block({beats: [{at: 2.2, layout: 'word', key: 'a'}]})]), 'primer beat'));
  test('at no creciente', () =>
    has(plan([block({beats: [{at: 2, layout: 'word', key: 'a'}, {at: 4, layout: 'word', key: 'b'}, {at: 3, layout: 'word', key: 'c'}]})]), 'orden'));
  test('beat de 0.3 s', () => has(plan([block({beats: [{at: 2, layout: 'word', key: 'a'}, {at: 2.3, layout: 'word', key: 'b'}]})]), '0.4'));
  test('beat fuera del bloque', () => has(plan([block({beats: [{at: 2, layout: 'word', key: 'a'}, {at: 6.5, layout: 'word', key: 'b'}]})]), 'fuera'));
  test('layout desconocido', () => has(plan([withBeat({layout: 'karaoke' as never})]), 'layout'));
  test('word sin key', () => has(plan([withBeat({layout: 'word'})]), 'key'));
  test('prop sin emoji', () => has(plan([withBeat({layout: 'prop'})]), 'emoji'));
  test('emoji que no esta en emoji3d', () => has(plan([withBeat({layout: 'ring', emoji: '1f999'})]), 'emoji3d'));
  test('list con 1 item', () => has(plan([withBeat({layout: 'list', items: ['a']})]), 'items'));
  test('list con 6 items', () => has(plan([withBeat({layout: 'list', items: ['a', 'b', 'c', 'd', 'e', 'f']})]), 'items'));
  test('list con active fuera de rango', () => has(plan([withBeat({layout: 'list', items: ['a', 'b', 'c'], active: 4})]), 'active'));
  test('strike con 5 items', () => has(plan([withBeat({layout: 'strike', items: ['a', 'b', 'c', 'd', 'e']})]), 'items'));
  test('swap sin to', () => has(plan([withBeat({layout: 'swap', from: 'a'})]), 'to'));
  test('card sin frame', () => has(plan([withBeat({layout: 'card', key: 'k'})]), 'frame'));
  test('card con frame tv', () => has(plan([withBeat({layout: 'card', key: 'k', frame: 'tv' as never})]), 'frame'));
  test('prop con pos left', () => has(plan([withBeat({layout: 'prop', emoji: '1f4da', pos: 'left' as never})]), 'pos'));
});

describe('motionShare y motionWarnings', () => {
  // keeps [1,8] + [9,19] = 17 s finales
  const end = {start: 18, line1: 'x', line2: 'y'};
  const words3 = (start: number): Beat[] => [{at: start, layout: 'word', key: 'a'}, {at: start + 1, layout: 'prop', emoji: '1f4da'}];
  const warn = (blocks: Block[], extra: Partial<EditPlan> = {}) => motionWarnings({...plan(blocks), end, ...extra}, ctx).join('\n');
  // 4 + 7 = 11/17 = 0.65
  const good = (): Block[] => [block({start: 4, end: 8, beats: words3(4).concat({at: 6, layout: 'word', key: 'c'})}), block({start: 10, end: 17, beats: [
    {at: 10, layout: 'word', key: 'a'}, {at: 12, layout: 'big', key: 'b'}, {at: 14, layout: 'word', key: 'c'}, {at: 15.5, layout: 'list', items: ['a', 'b']}]})];

  test('motionShare = duracion de bloques / duracion final', () => expect(motionShare(plan([block()]), ctx.keeps)).toBeCloseTo(4 / 17, 5));
  test('plan bueno no da avisos', () => expect(warn(good())).toBe(''));
  test('beat de mas de 2.5 s', () => expect(warn([block({start: 3, end: 7, beats: [{at: 3, layout: 'word', key: 'a'}]}), good()[1]])).toContain('divide'));
  test('3 layouts iguales seguidos', () =>
    expect(warn([block({start: 3, end: 7, beats: [{at: 3, layout: 'word', key: 'a'}, {at: 4, layout: 'word', key: 'b'}, {at: 5, layout: 'word', key: 'c'}]}), good()[1]])).toContain('iguales'));
  test('menos de 1 s de profe entre bloques', () =>
    expect(warn([block({start: 3, end: 7.5, beats: words3(3).concat({at: 5, layout: 'word', key: 'c'})}), good()[1]].concat(block({start: 7.8, end: 8, beats: [{at: 7.8, layout: 'word', key: 'z'}]})))).toContain('profe'));
  test('motion por debajo del 50 %', () => expect(warn([good()[0]])).toContain('50'));
  test('motion por encima del 80 %', () =>
    expect(warn([block({start: 3, end: 8, beats: [{at: 3, layout: 'word', key: 'a'}, {at: 4.5, layout: 'big', key: 'b'}, {at: 6, layout: 'word', key: 'c'}]}),
      block({start: 9, end: 18, beats: [{at: 9, layout: 'word', key: 'a'}, {at: 11, layout: 'big', key: 'b'}, {at: 13, layout: 'word', key: 'c'}, {at: 15, layout: 'big', key: 'd'}, {at: 16.5, layout: 'word', key: 'e'}]})])).toContain('80'));
  test('bloque en el gancho', () => expect(warn([block({start: 2, end: 6, beats: words3(2).concat({at: 4, layout: 'word', key: 'c'})}), good()[1]])).toContain('gancho'));
  test('bloque despues del cierre', () => expect(warn(good(), {end: {start: 15, line1: 'x', line2: 'y'}})).toContain('cierre'));
});

describe('strategy voice', () => {
  // keeps [0,5] + [6,10] -> finales 0-5 y 5-9
  const vctx: ValidateCtx = {...ctx, duration: 10, keeps: [{start: 0, end: 5}, {start: 6, end: 10}]};
  const vb = (start: number, end: number, bg: Block['bg'] = 'light'): Block => ({start, end, bg, beats: [{at: start, layout: 'word', key: 'a'}, {at: start + 1, layout: 'word', key: 'b'}]});
  const vplan = (blocks: Block[], extra: Partial<EditPlan> = {}): EditPlan => ({...defaultPlan('v.mp4'), strategy: 'voice', motion: {blocks}, ...extra});
  const verrs = (p: unknown) => validatePlan(p, vctx).join('\n');
  const vwarn = (p: EditPlan, c: ValidateCtx = vctx) => motionWarnings(p, c).join('\n');

  test('voice es valida con cobertura total', () => expect(validatePlan(vplan([vb(0, 5), vb(6, 10, 'dark')]), vctx)).toEqual([]));
  test('hueco es error con el tramo', () => expect(verrs(vplan([vb(0, 4), vb(6, 10, 'dark')]))).toContain('hueco 4.0–5.0 s sin bloque'));
  test('voice sin motion es error', () => expect(verrs({...defaultPlan('v.mp4'), strategy: 'voice'})).toContain('voice necesita motion.blocks'));
  test('voiceGaps ignora tramos mas cortos que un beat', () => {
    const keeps = [{start: 0, end: 5}, {start: 5.5, end: 5.8}, {start: 6, end: 10}];
    expect(voiceGaps([vb(0, 5), vb(6, 10)], keeps)).toEqual([]);
  });
  test('sin avisos de gancho, profe ni % de motion', () => {
    const w = vwarn(vplan([vb(0, 5), vb(6, 10, 'dark')]));
    ['gancho', 'profe', 'motion cubre'].forEach((x) => expect(w).not.toContain(x));
  });
  test('aviso si no empieza en 0', () => expect(vwarn(vplan([vb(0.5, 5), vb(6, 10, 'dark')]))).toContain('no empieza en 0'));
  test('aviso si el ultimo no es dark', () => expect(vwarn(vplan([vb(0, 5, 'dark'), vb(6, 10)]))).toContain('ultimo bloque deberia ser dark'));
  test('aviso con 3 bloques seguidos del mismo fondo', () =>
    expect(vwarn(vplan([vb(0, 2), vb(2, 4), vb(4, 5), vb(6, 10, 'dark')]))).toContain('3 bloques seguidos con fondo light'));
  test('aviso si hay title', () =>
    expect(vwarn(vplan([vb(0, 5), vb(6, 10, 'dark')], {title: {line1: 'a', line2: 'b', start: 0, end: 2}}))).toContain('title no se ve en voice'));
  test('beat largo sigue avisando', () => {
    const long: Block = {start: 0, end: 5, bg: 'light', beats: [{at: 0, layout: 'word', key: 'a'}]};
    expect(vwarn(vplan([long, vb(6, 10, 'dark')]))).toContain('divide en dos beats');
  });
});
