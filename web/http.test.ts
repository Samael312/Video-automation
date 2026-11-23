import {PassThrough} from 'node:stream';
import {describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {allowed, readJson, RE_ESTATICO} = require('./http.js');

const req = (method: string, headers: Record<string, string>) => ({method, headers});
const cfg = {host: '127.0.0.1', port: 3000};

describe('allowed', () => {
  it('Host propio; Origin propio o ausente', () => {
    expect(allowed(req('GET', {host: 'localhost:3000'}), false, cfg)).toBe(true);
    expect(allowed(req('GET', {host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000'}), false, cfg)).toBe(true);
    expect(allowed(req('GET', {host: 'evil.com'}), false, cfg)).toBe(false);
    expect(allowed(req('GET', {host: 'localhost:3000', origin: 'http://evil.com'}), false, cfg)).toBe(false);
  });
  it('POST: JSON para la API y octet-stream para subidas', () => {
    const h = {host: 'localhost:3000'};
    expect(allowed(req('POST', {...h, 'content-type': 'application/json'}), false, cfg)).toBe(true);
    expect(allowed(req('POST', {...h, 'content-type': 'text/plain'}), false, cfg)).toBe(false);
    expect(allowed(req('POST', {...h, 'content-type': 'application/octet-stream'}), true, cfg)).toBe(true);
    expect(allowed(req('POST', {...h, 'content-type': 'application/json'}), true, cfg)).toBe(false);
  });
});

describe('readJson', () => {
  const cuerpo = (txt: string) => {
    const s = new PassThrough();
    setTimeout(() => s.end(txt), 0);
    return s;
  };
  it('lee JSON y {} si vacío', async () => {
    expect(await readJson(cuerpo('{"a":1}'), 100)).toEqual({a: 1});
    expect(await readJson(cuerpo(''), 100)).toEqual({});
  });
  it('rechaza JSON inválido y cuerpos grandes', async () => {
    await expect(readJson(cuerpo('{no'), 100)).rejects.toThrow('JSON inválido');
    await expect(readJson(cuerpo('x'.repeat(200)), 100)).rejects.toThrow('Petición demasiado grande');
  });
});

describe('RE_ESTATICO', () => {
  it('solo archivos de la raíz con extensiones conocidas', () => {
    expect(RE_ESTATICO.test('/main.js')).toBe(true);
    expect(RE_ESTATICO.test('/mis-videos.js')).toBe(true);
    expect(RE_ESTATICO.test('/a/b.js')).toBe(false);
    expect(RE_ESTATICO.test('/x.exe')).toBe(false);
  });
});
