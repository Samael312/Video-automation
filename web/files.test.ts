import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const files = require('./files.js');

let root: string;
let server: http.Server | null = null;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'files-'));
});
afterEach(async () => {
  if (server) await new Promise((r) => server!.close(r));
  server = null;
  fs.rmSync(root, {recursive: true, force: true});
});

const escribir = (rel: string, contenido: string | Buffer = 'x') => {
  const f = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, contenido);
  return f;
};

describe('parseRange', () => {
  it('sin header: null', () => {
    expect(files.parseRange(undefined, 100)).toBeNull();
    expect(files.parseRange('', 100)).toBeNull();
  });
  it('rangos válidos', () => {
    expect(files.parseRange('bytes=0-9', 100)).toEqual({start: 0, end: 9});
    expect(files.parseRange('bytes=10-', 100)).toEqual({start: 10, end: 99});
    expect(files.parseRange('bytes=-5', 100)).toEqual({start: 95, end: 99});
    expect(files.parseRange('bytes=90-500', 100)).toEqual({start: 90, end: 99});
    expect(files.parseRange('bytes=-500', 100)).toEqual({start: 0, end: 99});
  });
  it('inválidos', () => {
    for (const h of ['bytes=100-', 'bytes=5-2', 'bytes=-', 'bytes=-0', 'items=0-1', 'bytes=0-1,5-6', 'bytes=a-b', 'basura']) {
      expect(files.parseRange(h, 100), h).toBe('invalido');
    }
    expect(files.parseRange('bytes=0-0', 0)).toBe('invalido');
  });
});

describe('validarSubida y tipoDeEntrada', () => {
  it('acepta extensiones permitidas', () => {
    for (const ext of files.EXT_PERMITIDAS) expect(files.validarSubida({ext, bytes: 10}).ok).toBe(true);
    expect(files.validarSubida({ext: 'M4A', bytes: 10}).ok).toBe(true);
    expect(files.validarSubida({ext: 'mp4'}).ok).toBe(true);
  });
  it('rechaza ext, vacío y demasiado grande', () => {
    for (const ext of ['exe', 'js', '', undefined, 'mp4.exe']) expect(files.validarSubida({ext, bytes: 1}).ok).toBe(false);
    expect(files.validarSubida({ext: 'mp4', bytes: 0}).ok).toBe(false);
    expect(files.validarSubida({ext: 'mp4', bytes: NaN}).ok).toBe(false);
    const r = files.validarSubida({ext: 'mp4', bytes: files.MAX_SUBIDA + 1});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/grande/);
  });
  it('tipoDeEntrada', () => {
    expect(files.tipoDeEntrada('m4a')).toBe('audio');
    expect(files.tipoDeEntrada('.MP3')).toBe('audio');
    expect(files.tipoDeEntrada('mov')).toBe('video');
    expect(files.tipoDeEntrada('exe')).toBeNull();
  });
  it('MAX_SUBIDA es 3 GB', () => expect(files.MAX_SUBIDA).toBe(3 * 1024 ** 3));
});

describe('tipoMime', () => {
  it('por extensión', () => {
    expect(files.tipoMime('a.mp4')).toBe('video/mp4');
    expect(files.tipoMime('a.PNG')).toBe('image/png');
    expect(files.tipoMime('a.txt')).toContain('text/plain');
    expect(files.tipoMime('a.zzz')).toBe('application/octet-stream');
  });
});

describe('resolverArchivo', () => {
  it('resuelve los cuatro tipos', () => {
    const entrada = escribir('media/input/PLAN/V1.m4a');
    const preview = escribir('media/output/V1_preview.png');
    const video = escribir('media/output/edited/V1/V1_edited.mp4');
    const caption = escribir('media/output/edited/V1/V1_caption.txt');
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'entrada')).toBe(entrada);
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'preview')).toBe(preview);
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'video')).toBe(video);
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'caption')).toBe(caption);
  });
  it('null si no existe o el tipo es desconocido', () => {
    escribir('media/input/PLAN/V1.mp4');
    expect(files.resolverArchivo(root, 'PLAN', 'V2', 'entrada')).toBeNull();
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'preview')).toBeNull();
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'otro')).toBeNull();
  });
  it('entrada solo con extensiones permitidas', () => {
    escribir('media/input/PLAN/V1.exe');
    escribir('media/input/PLAN/V1.estado.json', '{}');
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'entrada')).toBeNull();
  });
  it('rechaza traversal y nombres raros', () => {
    escribir('media/input/PLAN/V1.mp4');
    escribir('secreto.mp4');
    for (const [p, n] of [['..', 'secreto'], ['PLAN', '../../../secreto'], ['PLAN/..', 'V1'], ['PLAN', 'V1.mp4'], ['PLAN', ''], ['', 'V1'], ['PLAN', 'a\\b'], [undefined, 'V1']]) {
      expect(files.resolverArchivo(root, p, n, 'entrada'), `${p} ${n}`).toBeNull();
    }
  });
  it('rechaza symlinks (si el sistema deja crearlos)', () => {
    const fuera = escribir('fuera/secreto.mp4');
    fs.mkdirSync(path.join(root, 'media', 'input', 'PLAN'), {recursive: true});
    try {
      fs.symlinkSync(fuera, path.join(root, 'media', 'input', 'PLAN', 'LINK.mp4'));
    } catch {
      return; // sin permiso para symlinks en este PC
    }
    expect(files.resolverArchivo(root, 'PLAN', 'LINK', 'entrada')).toBeNull();
  });
  it('rechaza carpetas que son enlaces hacia fuera', () => {
    escribir('fuera/V1.mp4');
    fs.mkdirSync(path.join(root, 'media', 'input'), {recursive: true});
    try {
      fs.symlinkSync(path.join(root, 'fuera'), path.join(root, 'media', 'input', 'PLAN'), 'junction');
    } catch {
      return;
    }
    expect(files.resolverArchivo(root, 'PLAN', 'V1', 'entrada')).toBeNull();
  });
});

const levantar = async (handler: http.RequestListener) => {
  server = http.createServer(handler);
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return (server.address() as AddressInfo).port;
};

const pedir = (port: number, opts: http.RequestOptions, cuerpo?: Buffer | string) =>
  new Promise<{status: number; headers: http.IncomingHttpHeaders; body: Buffer}>((resolve, reject) => {
    const r = http.request({host: '127.0.0.1', port, agent: false, ...opts}, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({status: res.statusCode as number, headers: res.headers, body: Buffer.concat(partes)}));
    });
    r.on('error', reject);
    r.end(cuerpo);
  });

describe('servirArchivo', () => {
  const contenido = '0123456789abcdefghij';
  const montar = async (opts = {}) => {
    const f = escribir('v.mp4', contenido);
    return levantar((req, res) => files.servirArchivo(req, res, f, opts));
  };

  it('200 completo con cabeceras', async () => {
    const port = await montar();
    const r = await pedir(port, {path: '/'});
    expect(r.status).toBe(200);
    expect(r.body.toString()).toBe(contenido);
    expect(r.headers['accept-ranges']).toBe('bytes');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-type']).toBe('video/mp4');
    expect(r.headers['content-length']).toBe(String(contenido.length));
    expect(r.headers['content-disposition']).toBeUndefined();
  });
  it('206 con Content-Range', async () => {
    const port = await montar();
    const r = await pedir(port, {path: '/', headers: {Range: 'bytes=5-9'}});
    expect(r.status).toBe(206);
    expect(r.body.toString()).toBe('56789');
    expect(r.headers['content-range']).toBe('bytes 5-9/20');
    expect(r.headers['content-length']).toBe('5');
  });
  it('206 con rango abierto y de sufijo', async () => {
    const port = await montar();
    expect((await pedir(port, {path: '/', headers: {Range: 'bytes=15-'}})).body.toString()).toBe('fghij');
    const r = await pedir(port, {path: '/', headers: {Range: 'bytes=-3'}});
    expect(r.body.toString()).toBe('hij');
    expect(r.headers['content-range']).toBe('bytes 17-19/20');
  });
  it('416 con Content-Range bytes */size', async () => {
    const port = await montar();
    const r = await pedir(port, {path: '/', headers: {Range: 'bytes=50-60'}});
    expect(r.status).toBe(416);
    expect(r.headers['content-range']).toBe('bytes */20');
    expect(r.body.length).toBe(0);
  });
  it('descargar pone Content-Disposition', async () => {
    const port = await montar({descargar: true});
    const r = await pedir(port, {path: '/'});
    expect(r.headers['content-disposition']).toBe('attachment; filename="v.mp4"');
  });
  it('HEAD no manda cuerpo', async () => {
    const port = await montar();
    const r = await pedir(port, {path: '/', method: 'HEAD'});
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(0);
    expect(r.headers['content-length']).toBe('20');
  });
  it('archivo inexistente: 404', async () => {
    const port = await levantar((req, res) => files.servirArchivo(req, res, path.join(root, 'nada.mp4')));
    const r = await pedir(port, {path: '/'});
    expect(r.status).toBe(404);
    expect(JSON.parse(r.body.toString()).error).toBeTruthy();
  });
  it('archivo vacío: 200 sin cuerpo', async () => {
    const f = escribir('vacio.txt', '');
    const port = await levantar((req, res) => files.servirArchivo(req, res, f));
    const r = await pedir(port, {path: '/'});
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(0);
  });
});

describe('guardarSubida', () => {
  const montar = (max: number, destino: string) =>
    levantar(async (req, res) => {
      try {
        const r = await files.guardarSubida(req, destino, {max});
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(r));
      } catch (err) {
        req.resume();
        res.writeHead((err as {code?: string}).code === 'EXCEDE_MAX' ? 413 : 500, {'Content-Type': 'application/json', Connection: 'close'});
        res.end(JSON.stringify({error: (err as Error).message}));
      }
    });
  const restos = () => fs.readdirSync(path.join(root, 'media', 'input', 'PLAN')).sort();

  it('guarda el cuerpo y renombra sin dejar temporales', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    const port = await montar(1000, destino);
    const datos = Buffer.alloc(300, 7);
    const r = await pedir(port, {path: '/', method: 'POST'}, datos);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body.toString())).toEqual({bytes: 300});
    expect(fs.readFileSync(destino).equals(datos)).toBe(true);
    expect(restos()).toEqual(['V1.m4a']);
  });
  it('acepta exactamente max bytes', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    const port = await montar(100, destino);
    const r = await pedir(port, {path: '/', method: 'POST'}, Buffer.alloc(100));
    expect(r.status).toBe(200);
  });
  it('excede max: rechaza y borra el temporal sin crear el destino', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    const port = await montar(50, destino);
    const r = await pedir(port, {path: '/', method: 'POST'}, Buffer.alloc(500));
    expect(r.status).toBe(413);
    expect(restos()).toEqual([]);
  });
  it('cuerpo vacío: rechaza', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    const port = await montar(50, destino);
    const r = await pedir(port, {path: '/', method: 'POST'}, '');
    expect(r.status).toBe(500);
    expect(restos()).toEqual([]);
  });
  it('cliente que aborta: rechaza y borra el temporal', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    let rechazo: Promise<unknown> | null = null;
    const port = await levantar((req) => {
      rechazo = files.guardarSubida(req, destino, {max: 10000}).catch((e: Error) => e);
    });
    await new Promise<void>((resolve) => {
      const r = http.request({host: '127.0.0.1', port, method: 'POST', agent: false, headers: {'Content-Length': '1000'}});
      r.on('error', () => resolve());
      r.write(Buffer.alloc(100));
      setTimeout(() => {
        r.destroy();
        resolve();
      }, 100);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(rechazo).not.toBeNull();
    expect(await rechazo).toBeInstanceOf(Error);
    expect(restos()).toEqual([]);
  });
  it('si ya existía el destino y falla, no lo toca', async () => {
    const destino = path.join(root, 'media', 'input', 'PLAN', 'V1.m4a');
    fs.mkdirSync(path.dirname(destino), {recursive: true});
    fs.writeFileSync(destino, 'viejo');
    const port = await montar(10, destino);
    await pedir(port, {path: '/', method: 'POST'}, Buffer.alloc(100));
    expect(fs.readFileSync(destino, 'utf8')).toBe('viejo');
    expect(restos()).toEqual(['V1.m4a']);
  });
});
