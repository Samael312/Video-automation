import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const voces = require('./voces.js');

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voces-'));
});
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

const env = {ELEVENLABS_API_KEY: 'sk-secreto', ELEVENLABS_VOICE_ID_LAURA: 'vid123'};
const okFetch = (calls: any[] = []) => async (url: string, opts: any) => {
  calls.push({url, opts});
  return {ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, text: async () => ''};
};

describe('leerConfig', () => {
  it('lee de env', () => {
    expect(voces.leerConfig(dir, env)).toEqual({apiKey: 'sk-secreto', voiceIdLaura: 'vid123'});
  });
  it('lee de .env', () => {
    fs.writeFileSync(path.join(dir, '.env'), 'ELEVENLABS_API_KEY="k1"\nELEVENLABS_VOICE_ID_LAURA=v1\n');
    expect(voces.leerConfig(dir, {})).toEqual({apiKey: 'k1', voiceIdLaura: 'v1'});
  });
  it('vacio si falta', () => {
    expect(voces.leerConfig(dir, {})).toEqual({apiKey: '', voiceIdLaura: ''});
  });
});

describe('listarVoces / VOCES', () => {
  it('VOCES tiene laura y profe', () => {
    expect(voces.VOCES.map((v: any) => v.id)).toEqual(['laura', 'profe']);
  });
  it('laura no disponible sin voice id, con motivo', () => {
    const l = voces.listarVoces(dir, {ELEVENLABS_API_KEY: 'k'});
    expect(l[0].disponible).toBe(false);
    expect(l[0].motivo).toContain('ELEVENLABS_VOICE_ID_LAURA');
    expect(l[1].disponible).toBe(false);
  });
  it('laura disponible con config', () => {
    expect(voces.listarVoces(dir, env)[0].disponible).toBe(true);
  });
});

describe('generarVoz', () => {
  it('falla con config faltante', async () => {
    await expect(
      voces.generarVoz({root: dir, voz: 'laura', texto: 'hola', destino: path.join(dir, 'a.mp3'), fetchImpl: okFetch(), env: {}}),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });
  it('rechaza voz profe', async () => {
    await expect(
      voces.generarVoz({root: dir, voz: 'profe', texto: 'hola', destino: path.join(dir, 'a.mp3'), fetchImpl: okFetch(), env}),
    ).rejects.toThrow(/profe/);
  });
  it('rechaza texto vacio y largo', async () => {
    const base = {root: dir, voz: 'laura', destino: path.join(dir, 'a.mp3'), fetchImpl: okFetch(), env};
    await expect(voces.generarVoz({...base, texto: '  '})).rejects.toThrow(/vacio/);
    await expect(voces.generarVoz({...base, texto: 'x'.repeat(5001)})).rejects.toThrow(/largo/);
  });
  it('error HTTP sin filtrar la clave', async () => {
    const f = async () => ({ok: false, status: 401, text: async () => 'bad key sk-secreto'});
    const p = voces.generarVoz({root: dir, voz: 'laura', texto: 'hola', destino: path.join(dir, 'a.mp3'), fetchImpl: f, env});
    await expect(p).rejects.toThrow(/401/);
    await p.catch((e: Error) => expect(e.message).not.toContain('sk-secreto'));
    expect(fs.existsSync(path.join(dir, 'a.mp3'))).toBe(false);
  });
  it('exito: llama API y escribe mp3', async () => {
    const calls: any[] = [];
    const destino = path.join(dir, 'sub', 'a.mp3');
    const r = await voces.generarVoz({root: dir, voz: 'laura', texto: 'hola', destino, fetchImpl: okFetch(calls), env});
    expect(r.bytes).toBe(3);
    expect(fs.readFileSync(destino)).toEqual(Buffer.from([1, 2, 3]));
    expect(calls[0].url).toContain('https://api.elevenlabs.io/v1/text-to-speech/vid123');
    expect(calls[0].opts.headers['xi-api-key']).toBe('sk-secreto');
    expect(JSON.parse(calls[0].opts.body).model_id).toBe('eleven_multilingual_v2');
    expect(fs.readdirSync(path.dirname(destino))).toEqual(['a.mp3']);
  });
});
