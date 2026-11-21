import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('./lib.js');

describe('buildRequest', () => {
  it('arma la frase con tema, cantidad y largo', () => {
    const r = lib.buildRequest({tema: ' videos de   Navidad ', cantidad: 6, largo: 'medio'});
    expect(r).toEqual({ok: true, request: '6 guiones sobre: videos de Navidad, de largo medio (30 a 45 segundos)'});
  });
  it('por defecto 5 guiones cortos y temas variados', () => {
    expect(lib.buildRequest({})).toEqual({ok: true, request: '5 guiones con temas variados'});
  });
  it('singular con 1', () => expect(lib.buildRequest({tema: 'gramática', cantidad: '1'}).request).toBe('1 guion sobre: gramática'));
  it('rechaza cantidades fuera de rango o no enteras', () => {
    for (const cantidad of [0, 13, 2.5, 'abc', -1]) expect(lib.buildRequest({cantidad}).ok).toBe(false);
  });
  it('rechaza largo desconocido', () => expect(lib.buildRequest({largo: 'gigante'}).ok).toBe(false));
  it('rechaza tema demasiado largo', () => expect(lib.buildRequest({tema: 'x'.repeat(301)}).ok).toBe(false));
  it('tolera entradas basura', () => {
    expect(lib.buildRequest(null).ok).toBe(true);
    expect(lib.buildRequest({tema: 42}).request).toBe('5 guiones con temas variados');
  });
  it('largo heredado de Object.prototype no se acepta', () => expect(lib.buildRequest({largo: 'constructor'}).ok).toBe(false));
});

describe('prompts', () => {
  it('usa la skill como comando', () => expect(lib.buildPrompt('5 guiones')).toBe('/edit-script 5 guiones'));
  it('plan B nombra la skill', () => expect(lib.buildFallbackPrompt('5 guiones')).toContain('edit-script'));
});

describe('isSafeFolder', () => {
  it('acepta nombres simples', () => {
    for (const n of ['NAVIDAD', 'VARIADOS_20261120', 'GRAMATICA_2', 'a-b']) expect(lib.isSafeFolder(n)).toBe(true);
  });
  it('rechaza rutas y cosas raras', () => {
    for (const n of ['../x', 'a/b', 'a\\b', '.', '..', '', 'x.txt', 'con espacio', undefined, 3, 'x'.repeat(81)]) expect(lib.isSafeFolder(n)).toBe(false);
  });
});

describe('parsePlan', () => {
  const ok = JSON.stringify({
    titulo: 'Navidad',
    tema: 'videos de Navidad',
    creado: '2026-11-20',
    orden: ['B', 'A'],
    videos: [{nombre: 'A', formato: 'Quiz', largo: 'corto', gancho: 'g', ganchos: ['g', 'h', 'i'], estrategia: 'edit-voice', duracion: '~17 s', caption: 'c', hashtags: ['#a', '#b'], notas: 'n'}],
  });
  it('lee un plan válido', () => {
    const p = lib.parsePlan(ok);
    expect(p.titulo).toBe('Navidad');
    expect(p.orden).toEqual(['B', 'A']);
    expect(p.videos.A).toMatchObject({formato: 'Quiz', ganchos: ['g', 'h', 'i'], hashtags: ['#a', '#b']});
  });
  it('JSON inválido o con otra forma da null', () => {
    for (const t of ['no es json', '[]', 'null', '3']) expect(lib.parsePlan(t)).toBeNull();
  });
  it('tolera campos con tipos equivocados', () => {
    const p = lib.parsePlan(JSON.stringify({titulo: 5, orden: 'x', videos: [null, {nombre: ''}, {nombre: 'A', ganchos: 'x', hashtags: [1, '#ok'], caption: {}}]}));
    expect(p.titulo).toBe('');
    expect(p.orden).toEqual([]);
    expect(Object.keys(p.videos)).toEqual(['A']);
    expect(p.videos.A).toMatchObject({ganchos: [], hashtags: ['#ok'], caption: ''});
  });
  it('recorta textos enormes', () => expect(lib.parsePlan(JSON.stringify({videos: [{nombre: 'A', caption: 'x'.repeat(5000)}]})).videos.A.caption.length).toBe(1500));
});

describe('listFolders, getFolder y changedFolders', () => {
  let dir: string;
  const plan = (nombres: string[], extra: object = {}) =>
    JSON.stringify({titulo: 'Mi plan', tema: 'tema', creado: '2026-11-20', orden: [...nombres].reverse(), videos: nombres.map((nombre) => ({nombre, formato: 'Quiz', gancho: `gancho ${nombre}`, ...extra}))});
  const carpeta = (name: string, guiones: Record<string, string>, planJson?: string, planMd?: string) => {
    fs.mkdirSync(path.join(dir, name));
    for (const [n, t] of Object.entries(guiones)) fs.writeFileSync(path.join(dir, name, `${n}.txt`), t);
    if (planJson) fs.writeFileSync(path.join(dir, name, 'plan.json'), planJson);
    if (planMd) fs.writeFileSync(path.join(dir, name, 'PLAN.md'), planMd);
  };
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
  });
  afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

  it('lista solo carpetas con guiones, la más reciente primero', () => {
    carpeta('VIEJA', {A: 'uno'}, plan(['A']));
    carpeta('NUEVA', {B: 'dos', C: 'tres'}, plan(['B', 'C']));
    carpeta('VACIA', {});
    fs.writeFileSync(path.join(dir, 'suelto.txt'), 'x');
    fs.mkdirSync(path.join(dir, 'mala carpeta'));
    const old = new Date(2020, 0, 1);
    for (const f of ['A.txt', 'plan.json']) fs.utimesSync(path.join(dir, 'VIEJA', f), old, old);
    fs.utimesSync(path.join(dir, 'VIEJA'), old, old);
    const out = lib.listFolders(dir);
    expect(out.map((x: {name: string}) => x.name)).toEqual(['NUEVA', 'VIEJA']);
    expect(out[0]).toMatchObject({titulo: 'Mi plan', count: 2, creado: '2026-11-20'});
  });
  it('sin plan.json usa el nombre de la carpeta como título', () => {
    carpeta('SOLO', {A: 'x'});
    expect(lib.listFolders(dir)[0].titulo).toBe('SOLO');
  });
  it('carpeta inexistente da lista vacía', () => expect(lib.listFolders(path.join(dir, 'nope'))).toEqual([]));

  it('getFolder une cada guion con su info y respeta el orden sugerido', () => {
    carpeta('P', {A: 'texto a\nlinea 2', B: 'texto b', C: 'texto c'}, plan(['A', 'B']), '# Plan');
    const f = lib.getFolder(dir, 'P');
    // el orden del plan está invertido: B, A; C no está en el plan y va al final
    expect(f.guiones.map((g: {nombre: string}) => g.nombre)).toEqual(['B', 'A', 'C']);
    expect(f.guiones[1]).toMatchObject({texto: 'texto a\nlinea 2', info: {formato: 'Quiz', gancho: 'gancho A'}});
    expect(f.guiones[2].info).toBeNull();
    expect(f).toMatchObject({hayPlan: true, planMd: '# Plan', titulo: 'Mi plan'});
  });
  it('getFolder sin plan.json igual muestra los guiones', () => {
    carpeta('P', {A: 'x'});
    const f = lib.getFolder(dir, 'P');
    expect(f.hayPlan).toBe(false);
    expect(f.guiones).toHaveLength(1);
  });
  it('getFolder rechaza nombres inseguros o inexistentes', () => {
    expect(lib.getFolder(dir, '../etc')).toBeNull();
    expect(lib.getFolder(dir, 'NOPE')).toBeNull();
  });
  it('detecta carpetas nuevas o modificadas', () => {
    const before = [{name: 'A', mtime: 1}, {name: 'B', mtime: 2}];
    const after = [{name: 'A', mtime: 1}, {name: 'B', mtime: 5}, {name: 'C', mtime: 3}];
    expect(lib.changedFolders(before, after)).toEqual(['B', 'C']);
  });
});

describe('progressMessage', () => {
  const tool = (name: string, input: object) => ({type: 'assistant', message: {content: [{type: 'tool_use', name, input}]}});
  it('traduce herramientas a mensajes en español', () => {
    expect(lib.progressMessage(tool('Read', {file_path: 'C:\\x\\brand.md'}))).toBe('Leyendo brand.md…');
    expect(lib.progressMessage(tool('Write', {file_path: 'media/input/NAVIDAD_1.txt'}))).toBe('Escribiendo NAVIDAD_1.txt…');
    expect(lib.progressMessage(tool('Glob', {pattern: '*.txt'}))).toBe('Revisando guiones anteriores…');
  });
  it('ignora eventos sin información', () => {
    expect(lib.progressMessage(null)).toBeNull();
    expect(lib.progressMessage({type: 'user'})).toBeNull();
    expect(lib.progressMessage({type: 'assistant', message: {content: []}})).toBeNull();
  });
});

describe('friendlyError', () => {
  it('explica la falta de sesión', () => expect(lib.friendlyError('Error: Not logged in · Please run /login')).toContain('sesión'));
  it('explica límites de uso', () => expect(lib.friendlyError('usage limit reached')).toContain('límite'));
  it('recorta otros errores', () => expect(lib.friendlyError('x'.repeat(1000)).length).toBeLessThanOrEqual(300));
});

describe('detectClaudeConfig / claudeEnv', () => {
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  });
  afterEach(() => fs.rmSync(home, {recursive: true, force: true}));
  const login = (dir: string) => {
    fs.mkdirSync(path.join(home, dir), {recursive: true});
    fs.writeFileSync(path.join(home, dir, '.credentials.json'), '{}');
  };

  it('respeta CLAUDE_CONFIG_DIR del entorno', () => {
    login('.claude-personal');
    expect(lib.detectClaudeConfig(home, {CLAUDE_CONFIG_DIR: 'X:\mio'})).toEqual({dir: 'X:\mio', profile: 'entorno'});
    expect(lib.claudeEnv({CLAUDE_CONFIG_DIR: 'X:\mio'}, home).CLAUDE_CONFIG_DIR).toBe('X:\mio');
  });
  it('prioriza work (claude-w) sobre personal y normal', () => {
    login('.claude-personal');
    login('.claude');
    login('.claude-work');
    const r = lib.detectClaudeConfig(home, {});
    expect(r.profile).toBe('work');
    expect(r.dir).toBe(path.join(home, '.claude-work'));
  });
  it('sin work usa personal, luego la normal (sin tocar el entorno)', () => {
    login('.claude-personal');
    login('.claude');
    expect(lib.detectClaudeConfig(home, {}).profile).toBe('personal');
    fs.rmSync(path.join(home, '.claude-personal'), {recursive: true, force: true});
    expect(lib.detectClaudeConfig(home, {})).toEqual({dir: null, profile: 'normal'});
    expect(lib.claudeEnv({A: '1'}, home)).toEqual({A: '1'});
  });
  it('la normal tambien cuenta si la cuenta esta en ~/.claude.json', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude.json'), '{"oauthAccount": {"emailAddress": "x"}}');
    expect(lib.detectClaudeConfig(home, {}).profile).toBe('normal');
  });
  it('work se usa aunque sea la unica', () => {
    login('.claude-work');
    const r = lib.detectClaudeConfig(home, {});
    expect(r.profile).toBe('work');
    expect(lib.claudeEnv({}, home).CLAUDE_CONFIG_DIR).toBe(path.join(home, '.claude-work'));
  });
  it('carpetas sin sesion no cuentan', () => {
    fs.mkdirSync(path.join(home, '.claude-personal'));
    fs.mkdirSync(path.join(home, '.claude'));
    expect(lib.detectClaudeConfig(home, {})).toEqual({dir: null, profile: 'ninguno'});
  });
});

describe('resolveClaude', () => {
  const win = (dirs: string[], existentes: string[]) =>
    lib.resolveClaude({PATH: dirs.join(path.delimiter)}, 'win32', (f: string) => existentes.includes(f));
  it('fuera de Windows basta el nombre', () => expect(lib.resolveClaude({}, 'linux')).toEqual({cmd: 'claude', prefijo: []}));
  it('Windows: prefiere claude.exe del PATH', () => {
    const exe = path.join('C:/bin', 'claude.exe');
    expect(win(['C:/x', 'C:/bin'], [exe])).toEqual({cmd: exe, prefijo: []});
  });
  it('Windows: con claude.cmd de npm corre su cli.js con node', () => {
    const cmd = path.join('C:/npm', 'claude.cmd');
    const cli = path.join('C:/npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    expect(win(['C:/npm'], [cmd, cli])).toEqual({cmd: process.execPath, prefijo: [cli]});
  });
  it('Windows: solo claude.cmd sin cli.js o nada instalado da null', () => {
    expect(win(['C:/npm'], [path.join('C:/npm', 'claude.cmd')])).toBeNull();
    expect(win(['C:/npm'], [])).toBeNull();
  });
});
