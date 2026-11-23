import {describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {transcribirConTrabajador, avisoBajaConfianza} = require('./transcribeClient.js');

const resp = (body: unknown, status = 200) => ({ok: status < 400, status, json: async () => body});
const base = {url: 'http://127.0.0.1:5000', video: 'C:/p/public/A.mp4', out: 'C:/p/public/A.transcript.json', model: 'medium', prompt: 'vocab'};

describe('transcribirConTrabajador', () => {
  it('salud y transcribir OK → ok, envía diarize:false', async () => {
    const llamadas: {url: string; body?: unknown}[] = [];
    const fetch = async (url: string, init?: {body?: string}) => {
      llamadas.push({url, body: init?.body ? JSON.parse(init.body) : undefined});
      return url.endsWith('/salud') ? resp({ok: true}) : resp({ok: true, palabras: 9, baja_confianza: 0.4});
    };
    expect(await transcribirConTrabajador({...base, fetch})).toEqual({ok: true, palabras: 9, bajaConfianza: 0.4});
    expect(llamadas.map((l) => l.url)).toEqual(['http://127.0.0.1:5000/salud', 'http://127.0.0.1:5000/transcribir']);
    expect(llamadas[1].body).toEqual({video: base.video, out: base.out, model: 'medium', prompt: 'vocab', diarize: false});
  });
  it('salud con conexión rechazada → no responde', async () => {
    const fetch = async () => {
      throw Object.assign(new TypeError('fetch failed'), {cause: {code: 'ECONNREFUSED'}});
    };
    const r = await transcribirConTrabajador({...base, fetch});
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/no responde/);
  });
  it('salud lenta → aborta y no responde', async () => {
    const fetch = (_u: string, init?: {signal?: AbortSignal}) =>
      new Promise<never>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
    const r = await transcribirConTrabajador({...base, fetch, saludMs: 50});
    expect(r).toMatchObject({ok: false});
    expect(r.motivo).toMatch(/no responde/);
  });
  it('transcribir ok:false → motivo con el error', async () => {
    const fetch = async (url: string) => (url.endsWith('/salud') ? resp({ok: true}) : resp({ok: false, error: 'sin memoria'}, 500));
    const r = await transcribirConTrabajador({...base, fetch});
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/sin memoria/);
  });
  it('sin url → no llama a fetch', async () => {
    let n = 0;
    const r = await transcribirConTrabajador({...base, url: '', fetch: async () => (n++, resp({}))});
    expect(r.ok).toBe(false);
    expect(n).toBe(0);
  });
});

describe('avisoBajaConfianza', () => {
  it('mismo aviso que la linea de comandos si pasa de 25 %', () => {
    expect(avisoBajaConfianza(0.4, 'public/A.transcript.json')).toBe('AVISO: 40% de palabras con baja confianza; revisa public/A.transcript.json antes de renderizar');
    expect(avisoBajaConfianza(0.25, 'x')).toBeNull();
    expect(avisoBajaConfianza(undefined, 'x')).toBeNull();
  });
});
