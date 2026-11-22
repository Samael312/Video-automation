import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, test} from 'vitest';
import {aiAudioPath, needsTts, synthesize, ttsError, ttsRequest, ttsText, writeAtomic} from './elevenlabs';

describe('ttsText', () => {
  test('une lineas del parrafo y separa parrafos con linea vacia', () =>
    expect(ttsText('Hola.\nQué tal\n\n\nPlot twist.\n')).toBe('Hola. Qué tal\n\nPlot twist.'));
  test('guion vacio', () => expect(() => ttsText('  \n ')).toThrow('el guion está vacío'));
  test('guion demasiado largo', () =>
    expect(() => ttsText('a'.repeat(10001))).toThrow('guion demasiado largo (10001 caracteres, máx 10000)'));
});

describe('ttsRequest', () => {
  test('url, cabeceras y cuerpo', () => {
    const {url, init} = ttsRequest({apiKey: 'k', voiceId: 'v1', text: 'hola'});
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({'xi-api-key': 'k', 'content-type': 'application/json'});
    expect(JSON.parse(init.body as string)).toEqual({
      text: 'hola',
      model_id: 'eleven_multilingual_v2',
      voice_settings: {stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true},
    });
  });
});

describe('ttsError', () => {
  test('401', () => expect(ttsError(401, '', 'v')).toBe('API key inválida'));
  test('402', () => expect(ttsError(402, '', 'v')).toBe('sin créditos en ElevenLabs'));
  test('quota_exceeded', () =>
    expect(ttsError(400, '{"detail":{"status":"quota_exceeded"}}', 'v')).toBe('sin créditos en ElevenLabs'));
  test('404', () => expect(ttsError(404, '', 'v9')).toBe('la voz v9 no existe en tu cuenta'));
  test('otro', () => expect(ttsError(500, 'boom', 'v')).toBe('ElevenLabs 500: boom'));
});

describe('synthesize', () => {
  const o = {apiKey: 'k', voiceId: 'v', text: 'hola'};
  test('ok devuelve el audio', async () => {
    const fake = (async () => ({ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer})) as unknown as typeof fetch;
    expect((await synthesize(o, fake)).length).toBe(3);
  });
  test('error mapeado', async () => {
    const fake = (async () => ({ok: false, status: 401, text: async () => ''})) as unknown as typeof fetch;
    await expect(synthesize(o, fake)).rejects.toThrow('API key inválida');
  });
});

describe('archivos', () => {
  test('aiAudioPath', () =>
    expect(aiAudioPath(path.join('media', 'input', 'PT_ai.txt'))).toBe(path.join('media', 'input', 'PT_ai.ai.mp3')));
  test('writeAtomic no deja .part', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
    const f = path.join(dir, 'x.mp3');
    writeAtomic(f, Buffer.from([1]));
    expect(fs.existsSync(f)).toBe(true);
    expect(fs.existsSync(f + '.part')).toBe(false);
    fs.rmSync(dir, {recursive: true});
  });
});

describe('needsTts', () => {
  test('sin audio IA -> generar', () => expect(needsTts({force: false, txtMtimeMs: 1, mp3MtimeMs: null})).toBe(true));
  test('audio IA mas nuevo que el guion -> reusar', () => expect(needsTts({force: false, txtMtimeMs: 1, mp3MtimeMs: 2})).toBe(false));
  test('guion editado despues del audio -> regenerar', () => expect(needsTts({force: false, txtMtimeMs: 3, mp3MtimeMs: 2})).toBe(true));
  test('--force -> generar', () => expect(needsTts({force: true, txtMtimeMs: 1, mp3MtimeMs: 2})).toBe(true));
});
