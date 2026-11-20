import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const req = require('./requisitos.js');

let root: string;
let home: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'req-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
});
afterEach(() => {
  fs.rmSync(root, {recursive: true, force: true});
  fs.rmSync(home, {recursive: true, force: true});
});

type Item = {id: string; ok: boolean; titulo: string; detalle: string; arreglo: string};
const IDS = ['claude', 'venv', 'ffmpeg', 'ffprobe', 'hf_token', 'deepfilter', 'musica', 'node_modules'];
const por = (items: Item[], id: string) => items.find((i) => i.id === id) as Item;
const nada = () => null;
const todo = (n: string) => `/bin/${n}`;

describe('comprobarRequisitos', () => {
  it('devuelve todos los ids con la forma esperada', () => {
    const items: Item[] = req.comprobarRequisitos(root, {}, {which: nada, home});
    expect(items.map((i) => i.id)).toEqual(IDS);
    for (const i of items) {
      expect(typeof i.ok).toBe('boolean');
      expect(i.titulo).toBeTruthy();
      expect(i.detalle).toBeTruthy();
    }
  });
  it('en un PC vacío todo falla y trae arreglo', () => {
    const items: Item[] = req.comprobarRequisitos(root, {}, {which: nada, home});
    for (const i of items) {
      expect(i.ok).toBe(false);
      expect(i.arreglo.length).toBeGreaterThan(5);
    }
    expect(por(items, 'ffmpeg').arreglo).toContain('winget install Gyan.FFmpeg');
  });
  it('todo listo: ok y sin arreglo', () => {
    fs.mkdirSync(path.join(root, '.venv', 'Scripts'), {recursive: true});
    fs.writeFileSync(path.join(root, '.venv', 'Scripts', 'python.exe'), '');
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.mkdirSync(path.join(root, 'media', 'music'), {recursive: true});
    fs.writeFileSync(path.join(root, 'media', 'music', 'a.MP3'), '');
    fs.mkdirSync(path.join(home, '.video-cleanup', 'bin'), {recursive: true});
    fs.writeFileSync(path.join(home, '.video-cleanup', 'bin', 'deep-filter.exe'), '');
    const items: Item[] = req.comprobarRequisitos(root, {HF_TOKEN: 'hf_abc123'}, {which: todo, home});
    for (const i of items) {
      expect(i.ok, i.id).toBe(true);
      expect(i.arreglo).toBe('');
    }
  });
  it('which se consulta por nombre', () => {
    const items: Item[] = req.comprobarRequisitos(root, {}, {which: (n: string) => (n === 'ffmpeg' ? '/x/ffmpeg' : null), home});
    expect(por(items, 'ffmpeg').ok).toBe(true);
    expect(por(items, 'ffprobe').ok).toBe(false);
    expect(por(items, 'claude').ok).toBe(false);
  });
  it('hf_token desde .env, .env.txt o entorno; el ejemplo no cuenta', () => {
    const ok = () => por(req.comprobarRequisitos(root, {}, {which: nada, home}), 'hf_token').ok;
    expect(ok()).toBe(false);
    fs.writeFileSync(path.join(root, '.env'), 'HF_TOKEN=tu_token_de_huggingface_aqui\n');
    expect(ok()).toBe(false);
    fs.writeFileSync(path.join(root, '.env'), 'HF_TOKEN=hf_real\n');
    expect(ok()).toBe(true);
    fs.rmSync(path.join(root, '.env'));
    fs.writeFileSync(path.join(root, '.env.txt'), '\r\nHF_TOKEN = "hf_real"\r\n');
    expect(ok()).toBe(true);
    fs.rmSync(path.join(root, '.env.txt'));
    expect(por(req.comprobarRequisitos(root, {HF_TOKEN: 'hf_env'}, {which: nada, home}), 'hf_token').ok).toBe(true);
  });
  it('musica requiere al menos un mp3', () => {
    fs.mkdirSync(path.join(root, 'media', 'music'), {recursive: true});
    fs.writeFileSync(path.join(root, 'media', 'music', 'nota.txt'), '');
    expect(por(req.comprobarRequisitos(root, {}, {which: nada, home}), 'musica').ok).toBe(false);
  });
  it('acepta un fs inyectado', () => {
    const fake = {existsSync: () => true, readdirSync: () => ['x.mp3'], readFileSync: () => 'HF_TOKEN=abc'};
    const items: Item[] = req.comprobarRequisitos('/falso', {}, {which: todo, fs: fake, home: '/h'});
    expect(items.every((i) => i.ok)).toBe(true);
  });
});

describe('tokenEnTexto', () => {
  it('detecta valores reales y descarta vacíos', () => {
    expect(req.tokenEnTexto('A=1\nHF_TOKEN=abc')).toBe(true);
    expect(req.tokenEnTexto('HF_TOKEN=')).toBe(false);
    expect(req.tokenEnTexto('# HF_TOKEN=abc')).toBe(false);
    expect(req.tokenEnTexto(null)).toBe(false);
  });
});

describe('whichPorDefecto', () => {
  it('encuentra un ejecutable en el PATH dado', () => {
    const nombre = process.platform === 'win32' ? 'herr.exe' : 'herr';
    fs.writeFileSync(path.join(root, nombre), '');
    // en Windows el sistema de archivos no distingue mayúsculas: herr.EXE y herr.exe son el mismo archivo
    expect(String(req.whichPorDefecto('herr', {PATH: root, PATHEXT: '.EXE'})).toLowerCase()).toBe(path.join(root, nombre).toLowerCase());
    expect(req.whichPorDefecto('no_existe_zz', {PATH: root})).toBeNull();
  });
});
