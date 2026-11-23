// Smoke test HTTP: levanta el servidor real (sin transcriptor ni Claude) sobre un root temporal.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {crearServidor} = require('./server.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobs = require('./jobs.js');

let root: string;
let server: http.Server;
let port: number;
const llamadas: unknown[][] = [];

const pedir = (ruta: string, opts: {method?: string; headers?: Record<string, string>; body?: string} = {}) =>
  new Promise<{status: number; headers: http.IncomingHttpHeaders; body: string}>((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path: ruta, method: opts.method || 'GET', headers: {host: `localhost:${port}`, ...opts.headers}}, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
const json = {'content-type': 'application/json'};

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
  const w = (rel: string, txt: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
    fs.writeFileSync(path.join(root, rel), txt);
  };
  w('media/input/PLANX/G1.txt', 'GANCHO: Hola\nguion de prueba');
  w('media/output/edited/ED1/ED1_edited.mp4', '0123456789abcdef');
  const flujoFalso = new Proxy({}, {get: (_t, accion) => async (...args: unknown[]) => (llamadas.push([accion, ...args]), {ok: true, trabajo: 'T1'})});
  server = crearServidor({
    root,
    inputDir: path.join(root, 'media', 'input'),
    publicDir: path.join(__dirname, 'public'),
    host: '127.0.0.1',
    port: 0,
    gestor: new jobs.Gestor(),
    flujo: flujoFalso,
    trabajosGuion: flujoFalso,
    revisarRequisitos: () => [],
    checkClaude: async () => ({claude: false}),
    voces: {listarVoces: () => []},
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(root, {recursive: true, force: true});
});

describe('servidor (smoke)', () => {
  it('sirve la página y los scripts sin caché', async () => {
    const a = await pedir('/');
    expect(a.status).toBe(200);
    expect(a.headers['content-type']).toMatch(/text\/html/);
    const b = await pedir('/style.css');
    expect(b.status).toBe(200);
    expect(b.headers['content-type']).toMatch(/text\/css/);
    expect(b.headers['cache-control']).toBe('no-store');
  });
  it('carpetas, Mis videos y estado de un video', async () => {
    const c = JSON.parse((await pedir('/api/carpetas')).body);
    expect(c.map((x: {name: string}) => x.name)).toEqual(['PLANX']);
    const v = JSON.parse((await pedir('/api/videos')).body);
    expect(v.map((x: {nombre: string; plan: string}) => [x.plan, x.nombre])).toEqual([['VIDEOS_PROFE', 'ED1']]);
    const e = await pedir('/api/video/PLANX/G1');
    expect(e.status).toBe(200);
    expect(JSON.parse(e.body).estado.fase).toBe('sin_grabar');
  });
  it('Host u Origin ajenos → 403', async () => {
    expect((await pedir('/api/carpetas', {headers: {host: 'evil.com'}})).status).toBe(403);
    expect((await pedir('/api/cancelar', {method: 'POST', headers: {...json, origin: 'http://evil.com'}, body: '{}'})).status).toBe(403);
    expect((await pedir('/api/cancelar', {method: 'POST', headers: {'content-type': 'text/plain'}, body: '{}'})).status).toBe(403);
  });
  it('rutas desconocidas, nombres malos y JSON inválido', async () => {
    expect((await pedir('/api/nada')).status).toBe(404);
    expect((await pedir('/api/video/PLANX/..%2Fx')).status).toBe(404);
    expect((await pedir('/api/subidas/PLANX/a%20b?ext=mp4', {method: 'POST', headers: {'content-type': 'application/octet-stream'}, body: 'x'})).status).toBe(400);
    const r = await pedir('/api/video/PLANX/G1/empezar', {method: 'POST', headers: json, body: '{no'});
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe('JSON inválido');
  });
  it('archivo con Range → 206', async () => {
    const r = await pedir('/api/archivo/VIDEOS_PROFE/ED1/video', {headers: {range: 'bytes=0-3'}});
    expect(r.status).toBe(206);
    expect(r.body).toBe('0123');
  });
  it('empezar llama al flujo y responde 202 {trabajo}', async () => {
    const r = await pedir('/api/video/PLANX/G1/empezar', {method: 'POST', headers: json, body: JSON.stringify({estilo: 'mixed'})});
    expect(r.status).toBe(202);
    expect(JSON.parse(r.body)).toEqual({trabajo: 'T1'});
    expect(llamadas.slice(-1)[0]).toEqual(['empezar', 'PLANX', 'G1', 'mixed']);
  });
});
