import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const estado = require('./estado.js');

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estado-'));
  fs.mkdirSync(path.join(dir, 'NAVIDAD'));
});
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

describe('estadoPath', () => {
  it('arma la ruta con nombres seguros', () => {
    expect(estado.estadoPath(dir, 'NAVIDAD', 'EVE_1')).toBe(path.join(dir, 'NAVIDAD', 'EVE_1.estado.json'));
  });
  it('rechaza nombres inseguros', () => {
    for (const [p, n] of [['../x', 'a'], ['a', '../b'], ['a/b', 'c'], ['a', 'b.c'], ['', 'a'], ['a', ''], ['a', 'x'.repeat(121)], ['x'.repeat(81), 'a'], [undefined, 'a']]) {
      expect(estado.estadoPath(dir, p, n)).toBeNull();
    }
  });
});

describe('leerEstado', () => {
  it('sin archivo: sin_grabar con valores por defecto', () => {
    const e = estado.leerEstado(dir, 'NAVIDAD', 'EVE');
    expect(e).toMatchObject({version: 1, plan: 'NAVIDAD', nombre: 'EVE', fase: 'sin_grabar', estilo: null, entrada: null, sessionId: null, cambios: [], accion: null, error: null, trabajo: null});
  });
  it('sin archivo pero con entrada: subido', () => {
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.mp4'), 'x');
    expect(estado.leerEstado(dir, 'NAVIDAD', 'EVE').fase).toBe('subido');
  });
  it('nombre inseguro: null', () => expect(estado.leerEstado(dir, '../x', 'EVE')).toBeNull());
  it('JSON corrupto no lanza', () => {
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.estado.json'), '{"fase": "revi');
    expect(estado.leerEstado(dir, 'NAVIDAD', 'EVE').fase).toBe('sin_grabar');
  });
  it('JSON que no es objeto no lanza', () => {
    for (const raw of ['null', '[]', '42', '"x"']) {
      fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.estado.json'), raw);
      expect(estado.leerEstado(dir, 'NAVIDAD', 'EVE').fase).toBe('sin_grabar');
    }
  });
  it('fase desconocida vuelve al defecto pero conserva lo válido', () => {
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.estado.json'), JSON.stringify({fase: 'rara', estilo: 'motion', resumen: 'hola', mensaje: 7, cambios: 'no', entrada: 5, trabajo: {}}));
    const e = estado.leerEstado(dir, 'NAVIDAD', 'EVE');
    expect(e).toMatchObject({fase: 'sin_grabar', estilo: 'motion', resumen: 'hola', mensaje: '', cambios: [], entrada: null, trabajo: null});
  });
  it('ignora plan/nombre escritos en el archivo y limpia cambios y estilo', () => {
    fs.writeFileSync(
      path.join(dir, 'NAVIDAD', 'EVE.estado.json'),
      JSON.stringify({plan: '../../x', nombre: 'otro', fase: 'listo', estilo: 'raro', cambios: [{texto: 'a', en: 'no-fecha'}, 5, {texto: ''}]}),
    );
    const e = estado.leerEstado(dir, 'NAVIDAD', 'EVE');
    expect(e).toMatchObject({plan: 'NAVIDAD', nombre: 'EVE', fase: 'listo', estilo: null});
    expect(e.cambios).toEqual([{texto: 'a', en: ''}]);
  });
  it('entrada de audio fuerza estilo voice', () => {
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.estado.json'), JSON.stringify({estilo: 'mixed', entrada: {archivo: 'EVE.m4a', tipo: 'audio', bytes: 10}}));
    expect(estado.leerEstado(dir, 'NAVIDAD', 'EVE').estilo).toBe('voice');
  });
});

describe('escribirEstado', () => {
  it('mezcla el parche, fija actualizado y devuelve el estado nuevo', () => {
    const a = estado.escribirEstado(dir, 'NAVIDAD', 'EVE', {fase: 'planificando', estilo: 'mixed'});
    expect(a.fase).toBe('planificando');
    expect(Date.parse(a.actualizado)).not.toBeNaN();
    const b = estado.escribirEstado(dir, 'NAVIDAD', 'EVE', {mensaje: 'hola'});
    expect(b).toMatchObject({fase: 'planificando', estilo: 'mixed', mensaje: 'hola'});
    expect(estado.leerEstado(dir, 'NAVIDAD', 'EVE')).toEqual(b);
  });
  it('rechaza fases no válidas y no escribe', () => {
    expect(() => estado.escribirEstado(dir, 'NAVIDAD', 'EVE', {fase: 'rara'})).toThrow(/Fase/);
    expect(fs.existsSync(path.join(dir, 'NAVIDAD', 'EVE.estado.json'))).toBe(false);
  });
  it('rechaza nombres inseguros', () => {
    expect(() => estado.escribirEstado(dir, '../x', 'EVE', {})).toThrow(/no válido/);
    expect(() => estado.escribirEstado(dir, 'NAVIDAD', 'a/b', {})).toThrow(/no válido/);
  });
  it('no deja temporales y crea la carpeta del plan', () => {
    estado.escribirEstado(dir, 'NUEVO', 'EVE', {fase: 'subido'});
    expect(fs.readdirSync(path.join(dir, 'NUEVO'))).toEqual(['EVE.estado.json']);
  });
  it('un patch no puede cambiar plan ni nombre', () => {
    const e = estado.escribirEstado(dir, 'NAVIDAD', 'EVE', {plan: 'otro', nombre: 'otro', version: 9});
    expect(e).toMatchObject({plan: 'NAVIDAD', nombre: 'EVE', version: 1});
  });
});

describe('marcarInterrumpidos', () => {
  it('pasa a interrumpido solo las fases en curso y cuenta', () => {
    fs.mkdirSync(path.join(dir, 'OTRO'));
    estado.escribirEstado(dir, 'NAVIDAD', 'A', {fase: 'preparando', trabajo: 'j1'});
    estado.escribirEstado(dir, 'NAVIDAD', 'B', {fase: 'revision'});
    estado.escribirEstado(dir, 'OTRO', 'C', {fase: 'renderizando'});
    estado.escribirEstado(dir, 'OTRO', 'D', {fase: 'planificando'});
    expect(estado.marcarInterrumpidos(dir)).toBe(3);
    expect(estado.leerEstado(dir, 'NAVIDAD', 'A')).toMatchObject({fase: 'interrumpido', trabajo: null});
    expect(estado.leerEstado(dir, 'NAVIDAD', 'B').fase).toBe('revision');
    expect(estado.leerEstado(dir, 'OTRO', 'C').fase).toBe('interrumpido');
    expect(estado.marcarInterrumpidos(dir)).toBe(0);
  });
  it('tolera carpeta inexistente y archivos dañados', () => {
    expect(estado.marcarInterrumpidos(path.join(dir, 'nada'))).toBe(0);
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'X.estado.json'), '¡roto!');
    expect(estado.marcarInterrumpidos(dir)).toBe(0);
  });
});

describe('estadosDePlan y listarListos', () => {
  it('resume fase y actualizado por video', () => {
    estado.escribirEstado(dir, 'NAVIDAD', 'A', {fase: 'listo'});
    estado.escribirEstado(dir, 'NAVIDAD', 'B', {fase: 'error', error: 'falló'});
    const r = estado.estadosDePlan(dir, 'NAVIDAD');
    expect(Object.keys(r).sort()).toEqual(['A', 'B']);
    expect(r.A.fase).toBe('listo');
    expect(r.B).toEqual({fase: 'error', actualizado: expect.any(String)});
    expect(estado.estadosDePlan(dir, 'NOEXISTE')).toEqual({});
    expect(estado.estadosDePlan(dir, '../x')).toEqual({});
  });
  it('lista solo los listos de todos los planes', () => {
    fs.mkdirSync(path.join(dir, 'OTRO'));
    estado.escribirEstado(dir, 'NAVIDAD', 'A', {fase: 'listo'});
    estado.escribirEstado(dir, 'NAVIDAD', 'B', {fase: 'revision'});
    estado.escribirEstado(dir, 'OTRO', 'C', {fase: 'listo'});
    const r = estado.listarListos(dir);
    expect(r.map((x: {plan: string; nombre: string}) => `${x.plan}/${x.nombre}`).sort()).toEqual(['NAVIDAD/A', 'OTRO/C']);
  });
});

describe('log', () => {
  it('agrega y lee líneas', () => {
    estado.agregarLog(dir, 'NAVIDAD', 'EVE', 'uno');
    estado.agregarLog(dir, 'NAVIDAD', 'EVE', 'dos\ncon salto');
    expect(estado.leerLog(dir, 'NAVIDAD', 'EVE')).toEqual(['uno', 'dos con salto']);
  });
  it('recorta a las últimas 400 líneas', () => {
    for (let i = 1; i <= 410; i++) estado.agregarLog(dir, 'NAVIDAD', 'EVE', `l${i}`);
    const todo = estado.leerLog(dir, 'NAVIDAD', 'EVE', 1000);
    expect(todo).toHaveLength(400);
    expect(todo[0]).toBe('l11');
    expect(todo[399]).toBe('l410');
  });
  it('leerLog respeta max y tolera ausencia o nombre inseguro', () => {
    for (const l of ['a', 'b', 'c']) estado.agregarLog(dir, 'NAVIDAD', 'EVE', l);
    expect(estado.leerLog(dir, 'NAVIDAD', 'EVE', 2)).toEqual(['b', 'c']);
    expect(estado.leerLog(dir, 'NAVIDAD', 'OTRO')).toEqual([]);
    expect(estado.leerLog(dir, '../x', 'EVE')).toEqual([]);
  });
  it('agregarLog con nombre inseguro lanza', () => {
    expect(() => estado.agregarLog(dir, '../x', 'EVE', 'x')).toThrow(/no válido/);
  });
});

describe('carpetas sin guion', () => {
  it('existeVideo: con guion, o en VIDEOS_PROFE/AUDIOS_PROFE aunque no haya .txt', () => {
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.txt'), 'hola');
    expect(estado.existeVideo(dir, 'NAVIDAD', 'EVE')).toBe(true);
    expect(estado.existeVideo(dir, 'NAVIDAD', 'OTRO')).toBe(false);
    expect(estado.existeVideo(dir, 'VIDEOS_PROFE', 'CLASE_1')).toBe(true);
    expect(estado.existeVideo(dir, 'AUDIOS_PROFE', 'NOTA_1')).toBe(true);
    expect(estado.existeVideo(dir, 'VIDEOS_PROFE', '../x')).toBe(false);
  });
  it('esSinGuion y tipo de cada carpeta', () => {
    expect(estado.esSinGuion('VIDEOS_PROFE')).toBe(true);
    expect(estado.esSinGuion('NAVIDAD')).toBe(false);
    expect(estado.esSinGuion('toString')).toBe(false);
    expect(estado.CARPETAS_SIN_GUION).toEqual({VIDEOS_PROFE: 'video', AUDIOS_PROFE: 'audio'});
  });
  it('nombreOcupado: ya editado, guion o estado en otro plan', () => {
    const edited = path.join(dir, '_edited');
    fs.mkdirSync(path.join(edited, 'HECHO'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'EVE.txt'), 'hola');
    fs.writeFileSync(path.join(dir, 'NAVIDAD', 'SOLO.estado.json'), '{}');
    expect(estado.nombreOcupado(dir, edited, 'HECHO')).toBe(true);
    expect(estado.nombreOcupado(dir, edited, 'EVE')).toBe(true);
    expect(estado.nombreOcupado(dir, edited, 'SOLO')).toBe(true);
    expect(estado.nombreOcupado(dir, edited, 'NUEVO')).toBe(false);
  });
});

describe('videos editados fuera de la web', () => {
  let root: string;
  let input: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'adopta-'));
    input = path.join(root, 'media', 'input');
    fs.mkdirSync(path.join(input, 'NAVIDAD'), {recursive: true});
    fs.mkdirSync(path.join(root, 'media', 'output', 'edited', 'VIEJO'), {recursive: true});
    fs.writeFileSync(path.join(root, 'media', 'output', 'edited', 'VIEJO', 'VIEJO_edited.mp4'), 'x');
    fs.mkdirSync(path.join(root, 'public'));
    fs.writeFileSync(path.join(root, 'public', 'VIEJO.edit.json'), '{"strategy": "mixed"}');
  });
  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  it('planDeVideo: primero el estado, luego el guion, si no null', () => {
    expect(estado.planDeVideo(input, 'VIEJO')).toBeNull();
    fs.writeFileSync(path.join(input, 'NAVIDAD', 'VIEJO.txt'), 'g');
    expect(estado.planDeVideo(input, 'VIEJO')).toBe('NAVIDAD');
    fs.mkdirSync(path.join(input, 'VIDEOS_PROFE'));
    fs.writeFileSync(path.join(input, 'VIDEOS_PROFE', 'VIEJO.estado.json'), '{}');
    expect(estado.planDeVideo(input, 'VIEJO')).toBe('VIDEOS_PROFE');
  });
  it('adoptarEditado crea estado listo con el estilo del plan', () => {
    const e = estado.adoptarEditado(input, root, 'VIDEOS_PROFE', 'VIEJO');
    expect(e).toMatchObject({fase: 'listo', estilo: 'mixed', plan: 'VIDEOS_PROFE'});
    expect(estado.leerEstado(input, 'VIDEOS_PROFE', 'VIEJO').fase).toBe('listo');
    expect(estado.adoptarEditado(input, root, 'VIDEOS_PROFE', 'VIEJO')).toBeNull(); // ya tiene estado
  });
  it('no adopta sin mp4 o sin edit.json, ni en un plan que no es el suyo', () => {
    expect(estado.adoptarEditado(input, root, 'VIDEOS_PROFE', 'OTRO')).toBeNull();
    fs.rmSync(path.join(root, 'public', 'VIEJO.edit.json'));
    expect(estado.adoptarEditado(input, root, 'VIDEOS_PROFE', 'VIEJO')).toBeNull();
    fs.writeFileSync(path.join(root, 'public', 'VIEJO.edit.json'), '{}');
    fs.writeFileSync(path.join(input, 'NAVIDAD', 'VIEJO.txt'), 'g');
    expect(estado.adoptarEditado(input, root, 'VIDEOS_PROFE', 'VIEJO')).toBeNull();
    expect(estado.adoptarEditado(input, root, 'NAVIDAD', 'VIEJO')).toMatchObject({fase: 'listo', estilo: null});
  });
});
