import path from 'node:path';
import {describe, expect, test} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {resolveInput} = require('./voiceInput.js');

const dir = path.join('media', 'input');
const at = (f: string) => path.join(dir, f);

describe('resolveInput', () => {
  test('guion sin nota de voz -> voz IA', () =>
    expect(resolveInput(at('PT.txt'), () => ['PT.txt'])).toEqual({kind: 'script', name: 'PT', source: at('PT.ai.mp3'), noPrompt: true}));
  test('nota de voz real (mayusculas) gana', () => {
    const r = resolveInput(at('PT.txt'), () => ['PT.txt', 'PT.M4A']);
    expect(r).toMatchObject({kind: 'audio', name: 'PT', realVoice: 'PT.M4A'});
    expect(r.source).toBe(at('PT.M4A'));
  });
  test('el audio IA no cuenta como nota real', () =>
    expect(resolveInput(at('PT.txt'), () => ['PT.txt', 'PT.ai.mp3']).kind).toBe('script'));
  test('entrada .ai.mp3 conserva el nombre', () =>
    expect(resolveInput(at('PT.ai.mp3'), () => [])).toMatchObject({kind: 'audio', name: 'PT', source: at('PT.ai.mp3')}));
  test('voz IA transcribe sin prompt de vocabulario (empuja a Whisper al ingles)', () => {
    expect(resolveInput(at('PT.txt'), () => ['PT.txt']).noPrompt).toBe(true);
    expect(resolveInput(at('PT.txt'), () => ['PT.txt', 'PT.m4a']).noPrompt).toBeUndefined();
  });
  test('video', () => expect(resolveInput(at('X.mov'), () => [])).toMatchObject({kind: 'video', name: 'X'}));
});

describe('resolveInput (Windows)', () => {
  test('la nota real se reconoce sin importar mayusculas del nombre', () =>
    expect(resolveInput(path.join('media', 'input', 'PT.txt'), () => ['PT.txt', 'pt.m4a'])).toMatchObject({kind: 'audio', realVoice: 'pt.m4a'}));
});
