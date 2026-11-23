import http from 'node:http';
import {afterEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {Gestor, Trabajo, lineSplitter, correrComando, correrClaude, MAX_LOG} = require('./jobs.js');

const node = process.execPath;
const run = (code: string) => ['-e', code];

describe('lineSplitter', () => {
  it('parte en líneas completas y guarda el resto hasta flush', () => {
    const out: string[] = [];
    const s = lineSplitter((l: string) => out.push(l));
    s.push('uno\ndo');
    s.push('s\r\ntres');
    expect(out).toEqual(['uno', 'dos']);
    s.flush();
    expect(out).toEqual(['uno', 'dos', 'tres']);
  });
  it('flush sin resto no emite', () => {
    const out: string[] = [];
    const s = lineSplitter((l: string) => out.push(l));
    s.push('x\n');
    s.flush();
    expect(out).toEqual(['x']);
  });
});

describe('Gestor', () => {
  it('permite un solo trabajo pesado a la vez', () => {
    const g = new Gestor();
    const a = g.crear({tipo: 'preparar', plan: 'P', nombre: 'A'});
    expect(g.activoPesado()).toBe(a);
    const ligero = g.crear({tipo: 'recomendar', plan: 'P', nombre: 'B', pesado: false});
    expect(g.activoPesado()).toBe(a);
    a.terminar();
    expect(g.activoPesado()).toBeNull();
    expect(g.activos().map((x: {id: string}) => x.id)).toEqual([ligero.id]);
  });
  it('encuentra el trabajo en curso de un video', () => {
    const g = new Gestor();
    const a = g.crear({tipo: 'planificar', plan: 'P', nombre: 'A'});
    expect(g.activoDe('P', 'A')).toBe(a);
    expect(g.activoDe('P', 'B')).toBeNull();
    a.terminar();
    expect(g.activoDe('P', 'A')).toBeNull();
  });
  it('obtener tolera ids raros', () => {
    const g = new Gestor();
    expect(g.obtener(undefined)).toBeNull();
    expect(g.obtener('nope')).toBeNull();
  });
  it('solo recuerda los últimos terminados', () => {
    const g = new Gestor();
    for (let i = 0; i < 30; i++) g.crear({tipo: 'x'}).terminar();
    g.crear({tipo: 'y'});
    expect(g.trabajos.size).toBeLessThanOrEqual(22);
  });
});

describe('Trabajo', () => {
  it('cada evento lleva su hora (en) para que al reconectar los tiempos sean reales', () => {
    const t = new Trabajo('T9', 'x', 'P', 'N');
    const antes = Date.now();
    t.emitir({type: 'progreso', mensaje: 'a'});
    expect(t.log[0].en).toBeGreaterThanOrEqual(antes);
    t.emitir({type: 'progreso', mensaje: 'b', en: 123});
    expect(t.log[1].en).toBe(123);
  });
  it('limita el registro', () => {
    const t = new Trabajo({tipo: 'x'});
    for (let i = 0; i < MAX_LOG + 50; i++) t.emitir({type: 'progreso', mensaje: String(i)});
    expect(t.log).toHaveLength(MAX_LOG);
    expect(t.log[t.log.length - 1].mensaje).toBe(String(MAX_LOG + 49));
  });
  it('cancelar marca el trabajo aunque no haya proceso', () => {
    const t = new Trabajo({tipo: 'x'});
    t.cancelar();
    expect(t.cancelado).toBe(true);
  });
});

describe('SSE', () => {
  let server: http.Server;
  afterEach(() => server && server.close());
  it('reenvía el registro al conectar y sigue en vivo hasta terminar', async () => {
    const t = new Trabajo({tipo: 'x'});
    t.emitir({type: 'progreso', mensaje: 'antes'});
    server = http.createServer((req, res) => t.suscribir(req, res));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as {port: number}).port;
    const recibido = await new Promise<string>((resolve) => {
      let data = '';
      http.get({port, host: '127.0.0.1'}, (res) => {
        res.on('data', (c) => {
          data += c;
          if (data.includes('antes') && !data.includes('despues')) setTimeout(() => {
            t.emitir({type: 'progreso', mensaje: 'despues'});
            t.terminar();
          }, 20);
        });
        res.on('end', () => resolve(data));
      });
    });
    expect(recibido).toContain('"antes"');
    expect(recibido).toContain('"despues"');
  });
  it('un trabajo ya terminado responde el registro y cierra', async () => {
    const t = new Trabajo({tipo: 'x'});
    t.emitir({type: 'fin', ok: true});
    t.terminar();
    server = http.createServer((req, res) => t.suscribir(req, res));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as {port: number}).port;
    const body = await new Promise<string>((resolve) => {
      http.get({port, host: '127.0.0.1'}, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      });
    });
    expect(body).toContain('"fin"');
  });
});

describe('correrComando', () => {
  it('captura líneas, código de salida y cola', async () => {
    const t = new Trabajo({tipo: 'x'});
    const lineas: string[] = [];
    const r = await correrComando(t, node, run('console.log("== paso 1 =="); console.error("aviso"); process.exit(3)'), {shell: false, onLine: (l: string) => lineas.push(l)});
    expect(r.code).toBe(3);
    expect(lineas).toEqual(expect.arrayContaining(['== paso 1 ==', 'aviso']));
    expect(r.cola).toContain('== paso 1 ==');
  });
  it('comando inexistente no lanza: da código -1 y mensaje', async () => {
    const t = new Trabajo({tipo: 'x'});
    const r = await correrComando(t, 'comando-que-no-existe-xyz', [], {shell: false});
    expect(r.code).toBe(-1);
    expect(r.cola[0]).toContain('No se encontró');
  });
  it('cancelar mata el proceso', async () => {
    const t = new Trabajo({tipo: 'x'});
    const p = correrComando(t, node, run('setInterval(() => {}, 1000)'), {shell: false});
    await new Promise((r) => setTimeout(r, 300));
    t.cancelar();
    const r = await p;
    expect(t.cancelado).toBe(true);
    expect(r.code).not.toBe(0);
  });
  it('el tiempo máximo corta el proceso', async () => {
    const t = new Trabajo({tipo: 'x'});
    const r = await correrComando(t, node, run('setInterval(() => {}, 1000)'), {shell: false, timeoutMs: 300});
    expect(r.code).not.toBe(0);
    expect(r.cola.join(' ')).toContain('tiempo máximo');
  });
});

describe('correrClaude (con un claude falso)', () => {
  const fake = (events: object[], exit = 0, stderr = '') =>
    run(`let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ ${events
      .map((e) => `console.log(JSON.stringify(${JSON.stringify(e)}));`)
      .join(' ')} console.log('esto no es json'); console.log(JSON.stringify({type:'eco', prompt:d})); ${stderr ? `console.error(${JSON.stringify(stderr)});` : ''} process.exit(${exit}); });`);

  it('entrega el prompt por stdin, parsea eventos y guarda el resultado', async () => {
    const t = new Trabajo({tipo: 'x'});
    const vistos: {type: string; prompt?: string}[] = [];
    const r = await correrClaude(t, fake([{type: 'system', subtype: 'init'}, {type: 'result', is_error: false, result: 'ok'}]), 'hola desde la web', {comando: node, shell: false, onEvento: (e: {type: string}) => vistos.push(e)});
    expect(r.code).toBe(0);
    expect(r.result).toMatchObject({type: 'result', result: 'ok'});
    expect(vistos.map((v) => v.type)).toEqual(['system', 'result', 'eco']);
    expect(vistos[2].prompt).toBe('hola desde la web');
  });
  it('sin evento result devuelve null y el stderr', async () => {
    const t = new Trabajo({tipo: 'x'});
    const r = await correrClaude(t, fake([], 1, 'Not logged in'), 'x', {comando: node, shell: false});
    expect(r.result).toBeNull();
    expect(r.stderr).toContain('Not logged in');
    expect(r.code).toBe(1);
  });
  it('si el comando no existe responde con mensaje claro', async () => {
    const t = new Trabajo({tipo: 'x'});
    const r = await correrClaude(t, [], 'x', {comando: 'claude-no-existe-xyz', shell: false});
    expect(r.code).toBe(-1);
    expect(r.stderr).toContain('no instalado');
  });
});
