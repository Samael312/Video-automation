import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {crearFlujo, lineaDeEvento, REQ_PIPELINE} = require('./flujo.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {Gestor} = require('./jobs.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const estadoMod = require('./estado.js');

type Cfg = {
  prepCode: number;
  prepCola: string[];
  renderCode: number;
  resumeFalla: boolean;
  accion: string;
  sinPreview: boolean;
  sinCaption: boolean;
  recomendacion: string;
  esperar: Promise<void> | null;
  denegaciones: object[];
};

let root: string;
let inputDir: string;
let cfg: Cfg;
let llamadasClaude: {args: string[]; prompt: string}[];
let comandos: string[][];
let gestor: InstanceType<typeof Gestor>;
let faltan: {id: string; titulo: string}[];

const PLAN = 'NAVIDAD';
const N = 'NAVIDAD_EVE';
const resultado = (texto: string, extra: object = {}) => ({type: 'result', subtype: 'success', is_error: false, result: texto, session_id: 'sesion-fake-123', ...extra});

let envs: Record<string, string | undefined>[] = [];
const correrComando = async (job: unknown, cmd: string, args: string[], opts: {onLine: (l: string) => void; env?: Record<string, string | undefined>}) => {
  comandos.push(args);
  envs.push(opts.env ?? {});
  if (cfg.esperar) await cfg.esperar;
  if (args.includes('edit')) {
    opts.onLine('== normalizar ==');
    opts.onLine('== transcribir ==');
    if (cfg.prepCode === 0) {
      fs.writeFileSync(path.join(root, 'public', `${N}.cuts.json`), '{}');
      fs.writeFileSync(path.join(root, 'public', `${N}.transcript.json`), '{}');
    }
    return {code: cfg.prepCode, cola: cfg.prepCola};
  }
  if (args.includes('render:plan')) {
    opts.onLine('Rendered 10/100');
    opts.onLine('Rendered 50/100');
    if (cfg.renderCode === 0) {
      fs.mkdirSync(path.join(root, 'media', 'output', 'edited', N), {recursive: true});
      fs.writeFileSync(path.join(root, 'media', 'output', 'edited', N, `${N}_edited.mp4`), 'mp4');
    }
    return {code: cfg.renderCode, cola: cfg.renderCode ? ['FALLO en el paso: render'] : []};
  }
  return {code: 0, cola: []};
};

const correrClaude = async (job: unknown, args: string[], prompt: string, opts: {onEvento: (e: object) => void}) => {
  llamadasClaude.push({args, prompt});
  if (cfg.esperar) await cfg.esperar;
  opts.onEvento({type: 'system', subtype: 'init'});
  opts.onEvento({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Bash', input: {command: `npm run inspect -- ${N}`}}]}});
  if (args.includes('--resume') && cfg.resumeFalla) return {code: 1, result: {type: 'result', is_error: true, result: 'No conversation found with session ID'}, stderr: ''};
  if (prompt.includes('RECOMENDACION')) return {code: 0, result: resultado(`texto\nRECOMENDACION: ${cfg.recomendacion}`), stderr: ''};
  if (prompt.includes('caption.md')) {
    if (!cfg.sinCaption) {
      fs.mkdirSync(path.join(root, 'media', 'output', 'edited', N), {recursive: true});
      fs.writeFileSync(path.join(root, 'media', 'output', 'edited', N, `${N}_caption.txt`), 'caption');
    }
    return {code: 0, result: resultado('caption listo'), stderr: ''};
  }
  // planificar o cambios
  if (!cfg.sinPreview) {
    fs.writeFileSync(path.join(root, 'public', `${N}.edit.json`), '{}');
    fs.writeFileSync(path.join(root, 'media', 'output', `${N}_preview.png`), 'png');
  }
  const texto = cfg.accion ? `no puedo\nNECESITA_ACCION: ${cfg.accion}` : 'hecho\nRESUMEN:\nGancho: No digas X\nEscenas: 2';
  return {code: 0, result: resultado(texto, {permission_denials: cfg.denegaciones}), stderr: ''};
};

const crear = (extra: object = {}) =>
  crearFlujo({
    root,
    inputDir,
    gestor,
    env: () => ({}),
    claudeEnv: () => ({}),
    resolveClaude: () => ({cmd: 'claude', prefijo: []}),
    correrComando,
    correrClaude,
    faltantes: async () => faltan,
    uuid: () => '11111111-2222-3333-4444-555555555555',
    npm: 'npm',
    ...extra,
  });

const esperarFin = async (r: {ok: boolean; trabajo?: string}) => {
  expect(r.ok).toBe(true);
  const job = gestor.obtener(r.trabajo!);
  for (let i = 0; i < 400 && job.corriendo; i++) await new Promise((x) => setTimeout(x, 10));
  expect(job.corriendo).toBe(false);
  return job;
};
const estado = () => estadoMod.leerEstado(inputDir, PLAN, N);
const subir = (tipo = 'video', archivo = `${N}.mp4`) =>
  estadoMod.escribirEstado(inputDir, PLAN, N, {fase: 'subido', entrada: {archivo, tipo, bytes: 10}});

beforeEach(() => {
  envs = [];
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo-'));
  inputDir = path.join(root, 'media', 'input');
  fs.mkdirSync(path.join(inputDir, PLAN), {recursive: true});
  fs.mkdirSync(path.join(root, 'public'), {recursive: true});
  fs.mkdirSync(path.join(root, 'media', 'output'), {recursive: true});
  fs.writeFileSync(path.join(inputDir, PLAN, `${N}.txt`), 'guion');
  cfg = {prepCode: 0, prepCola: [], renderCode: 0, resumeFalla: false, accion: '', sinPreview: false, sinCaption: false, recomendacion: 'mixed | habla de un falso amigo', esperar: null, denegaciones: [], };
  llamadasClaude = [];
  comandos = [];
  gestor = new Gestor();
  faltan = [];
  subir();
});
afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

describe('empezar', () => {
  it('prepara, planifica y deja el video en revisión', async () => {
    const f = crear();
    const job = await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    const e = estado();
    expect(e).toMatchObject({fase: 'revision', estilo: 'mixed', sessionId: 'sesion-fake-123', trabajo: null, error: null});
    expect(e.resumen).toContain('Gancho: No digas X');
    expect(comandos[0]).toEqual(['run', 'edit', '--', `media/input/${PLAN}/${N}.mp4`, '--plan-only']);
    expect(llamadasClaude).toHaveLength(1);
    const {args, prompt} = llamadasClaude[0];
    expect(args).toContain('--session-id');
    expect(args).toContain('--allowedTools');
    expect(prompt).toContain('edit-mixed');
    expect(job.log.some((ev: {type: string; estado?: {fase: string}}) => ev.type === 'estado' && ev.estado?.fase === 'planificando')).toBe(true);
    expect(job.log[job.log.length - 1]).toMatchObject({type: 'fin', ok: true});
    expect(estadoMod.leerLog(inputDir, PLAN, N).join('\n')).toContain('normalizar');
  });
  it('si ya está preparado no repite la preparación', async () => {
    fs.writeFileSync(path.join(root, 'public', `${N}.cuts.json`), '{}');
    fs.writeFileSync(path.join(root, 'public', `${N}.transcript.json`), '{}');
    await esperarFin(await crear().empezar(PLAN, N, 'captions'));
    expect(comandos).toHaveLength(0);
    expect(estado().fase).toBe('revision');
  });
  it('una nota de voz solo admite el estilo voice', async () => {
    subir('audio', `${N}.m4a`);
    const f = crear();
    expect(await f.empezar(PLAN, N, 'captions')).toMatchObject({ok: false, status: 400});
    await esperarFin(await f.empezar(PLAN, N, 'voice'));
    expect(estado().fase).toBe('revision');
  });
  it('un video con cámara no admite voice', async () => {
    expect(await crear().empezar(PLAN, N, 'voice')).toMatchObject({ok: false, status: 400});
  });
  it('valida el estilo antes de hablar de requisitos', async () => {
    faltan = [{id: 'ffmpeg', titulo: 'ffmpeg'}];
    const r = await crear().empezar(PLAN, N, 'voice');
    expect(r).toMatchObject({ok: false, status: 400});
    expect(r.error).toContain('cámara');
  });
  it('sin archivo subido o sin guion da error claro', async () => {
    fs.rmSync(path.join(inputDir, PLAN, `${N}.estado.json`));
    expect(await crear().empezar(PLAN, N, 'mixed')).toMatchObject({ok: false});
    fs.rmSync(path.join(inputDir, PLAN, `${N}.txt`));
    expect(await crear().empezar(PLAN, N, 'mixed')).toMatchObject({ok: false, status: 404});
  });
  it('si falla la preparación explica el motivo en español', async () => {
    cfg.prepCode = 1;
    cfg.prepCola = ['ERROR: falta HF_TOKEN en el .env'];
    await esperarFin(await crear().empezar(PLAN, N, 'mixed'));
    const e = estado();
    expect(e.fase).toBe('error');
    expect(e.error).toContain('HF_TOKEN');
    expect(llamadasClaude).toHaveLength(0);
  });
  it('NECESITA_ACCION pasa a necesita_accion con el texto', async () => {
    cfg.accion = 'El audio no coincide con el guion';
    await esperarFin(await crear().empezar(PLAN, N, 'mixed'));
    expect(estado()).toMatchObject({fase: 'necesita_accion', accion: 'El audio no coincide con el guion'});
  });
  it('sin preview da error y menciona los permisos denegados', async () => {
    cfg.sinPreview = true;
    cfg.denegaciones = [{tool_name: 'Bash', tool_input: {command: 'npm run render:plan -- X'}}];
    const job = await esperarFin(await crear().empezar(PLAN, N, 'mixed'));
    const e = estado();
    expect(e.fase).toBe('error');
    expect(e.error).toContain('permiso');
    expect(estadoMod.leerLog(inputDir, PLAN, N).join('\n')).toContain('Permiso denegado: Bash');
    expect(job.log[job.log.length - 1]).toMatchObject({type: 'fin', ok: false});
  });
  it('claude no instalado da error claro', async () => {
    const f = crearFlujo({root, inputDir, gestor, env: () => ({}), claudeEnv: () => ({}), resolveClaude: () => null, correrComando, correrClaude, faltantes: async () => [], uuid: () => '11111111-2222-3333-4444-555555555555'});
    await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    expect(estado().error).toContain('no está instalado');
  });
  it('un segundo trabajo pesado recibe 409 con el trabajo en curso', async () => {
    let soltar!: () => void;
    cfg.esperar = new Promise<void>((r) => (soltar = r));
    const f = crear();
    const primero = await f.empezar(PLAN, N, 'mixed');
    expect(primero.ok).toBe(true);
    const otro = 'OTRO_VIDEO';
    fs.writeFileSync(path.join(inputDir, PLAN, `${otro}.txt`), 'g');
    estadoMod.escribirEstado(inputDir, PLAN, otro, {fase: 'subido', entrada: {archivo: `${otro}.mp4`, tipo: 'video', bytes: 1}});
    const r = await f.empezar(PLAN, otro, 'mixed');
    expect(r).toMatchObject({ok: false, status: 409, trabajo: primero.trabajo});
    soltar();
    await esperarFin(primero);
  });
  it('requisitos que faltan bloquean con la lista', async () => {
    faltan = [{id: 'ffmpeg', titulo: 'ffmpeg'}];
    const r = await crear().empezar(PLAN, N, 'mixed');
    expect(r).toMatchObject({ok: false, status: 400});
    expect(r.error).toContain('ffmpeg');
    expect(r.faltantes).toHaveLength(1);
  });
  it('cancelar devuelve el video a "subido"', async () => {
    let soltar!: () => void;
    cfg.esperar = new Promise<void>((r) => (soltar = r));
    const r = await crear().empezar(PLAN, N, 'mixed');
    const job = gestor.obtener(r.trabajo);
    job.cancelar();
    soltar();
    await esperarFin(r);
    expect(estado().fase).toBe('subido');
    expect(job.log[job.log.length - 1]).toMatchObject({type: 'fin', cancelado: true});
  });
});

describe('cambios', () => {
  const enRevision = async (f: ReturnType<typeof crear>) => {
    await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    llamadasClaude.length = 0;
  };
  it('retoma la sesión, guarda el cambio y regenera el preview', async () => {
    const f = crear();
    await enRevision(f);
    await esperarFin(await f.cambios(PLAN, N, 'Cambia el gancho por "No digas esto"'));
    const e = estado();
    expect(e.fase).toBe('revision');
    expect(e.cambios).toHaveLength(1);
    expect(e.cambios[0].texto).toContain('No digas esto');
    expect(llamadasClaude[0].args).toEqual(expect.arrayContaining(['--resume', 'sesion-fake-123']));
    expect(llamadasClaude[0].prompt).toContain('<cambios_profe>');
  });
  it('si no se puede retomar la sesión, sigue con una nueva', async () => {
    const f = crear();
    await enRevision(f);
    cfg.resumeFalla = true;
    await esperarFin(await f.cambios(PLAN, N, 'más corto'));
    expect(llamadasClaude).toHaveLength(2);
    expect(llamadasClaude[1].args).not.toContain('--resume');
    expect(llamadasClaude[1].prompt).toContain('Retomas una edición');
    expect(estado().fase).toBe('revision');
  });
  it('acepta cambios de un video ya listo y vuelve a revisión', async () => {
    const f = crear();
    await enRevision(f);
    estadoMod.escribirEstado(path.join(root, 'media', 'input'), PLAN, N, {fase: 'listo'});
    await esperarFin(await f.cambios(PLAN, N, 'quita la música'));
    expect(estado().fase).toBe('revision');
    expect(estado().cambios.slice(-1)[0].texto).toBe('quita la música');
  });
  it('rechaza texto vacío, enorme o un video que aún no tiene plan', async () => {
    const f = crear();
    expect(await f.cambios(PLAN, N, '   ')).toMatchObject({ok: false, status: 400});
    expect(await f.cambios(PLAN, N, 'x'.repeat(1501))).toMatchObject({ok: false, status: 400});
    expect(await f.cambios(PLAN, N, 'algo')).toMatchObject({ok: false, status: 400});
  });
});

describe('aprobar', () => {
  it('renderiza, escribe el caption y deja el video listo', async () => {
    const f = crear();
    await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    const job = await esperarFin(await f.aprobar(PLAN, N));
    expect(estado()).toMatchObject({fase: 'listo', error: null});
    expect(comandos.some((a) => a.includes('render:plan') && a.includes(N))).toBe(true);
    expect(job.log.some((ev: {porcentaje?: number}) => ev.porcentaje === 50)).toBe(true);
  });
  it('si falla el render queda en error con el motivo', async () => {
    const f = crear();
    await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    cfg.renderCode = 1;
    await esperarFin(await f.aprobar(PLAN, N));
    expect(estado().fase).toBe('error');
    expect(estado().error).toBeTruthy();
  });
  it('si no se escribe el caption igual queda listo, con aviso', async () => {
    const f = crear();
    await esperarFin(await f.empezar(PLAN, N, 'mixed'));
    cfg.sinCaption = true;
    await esperarFin(await f.aprobar(PLAN, N));
    expect(estado().fase).toBe('listo');
    expect(estado().mensaje).toContain('caption');
  });
  it('solo se aprueba desde revisión', async () => {
    expect(await crear().aprobar(PLAN, N)).toMatchObject({ok: false, status: 400});
  });
});

describe('recomendar', () => {
  it('prepara si hace falta, pide la recomendación y la emite sin cambiar de fase', async () => {
    const job = await esperarFin(await crear().recomendar(PLAN, N));
    const rec = job.log.find((ev: {type: string}) => ev.type === 'recomendacion');
    expect(rec).toMatchObject({estilo: 'mixed', texto: 'habla de un falso amigo'});
    expect(estado().fase).toBe('subido');
    expect(llamadasClaude[0].args).toContain('--allowedTools');
    expect(llamadasClaude[0].args[llamadasClaude[0].args.indexOf('--allowedTools') + 1]).not.toContain('Write');
  });
  it('una recomendación inválida avisa y deja elegir', async () => {
    cfg.recomendacion = 'voice | no aplica';
    await esperarFin(await crear().recomendar(PLAN, N));
    expect(estado().error).toContain('Elígelo tú');
  });
});

describe('reintentar', () => {
  it('tras un error sin preview rehace con el estilo guardado', async () => {
    const f = crear();
    cfg.prepCode = 1;
    cfg.prepCola = ['falta HF_TOKEN'];
    await esperarFin(await f.empezar(PLAN, N, 'motion'));
    expect(estado().fase).toBe('error');
    cfg.prepCode = 0;
    await esperarFin(await f.reintentar(PLAN, N));
    expect(estado()).toMatchObject({fase: 'revision', estilo: 'motion'});
  });
  it('con preview y plan en disco vuelve directo a revisión', async () => {
    fs.writeFileSync(path.join(root, 'public', `${N}.edit.json`), '{}');
    fs.writeFileSync(path.join(root, 'media', 'output', `${N}_preview.png`), 'png');
    estadoMod.escribirEstado(inputDir, PLAN, N, {fase: 'interrumpido', estilo: 'mixed'});
    const r = await crear().reintentar(PLAN, N);
    expect(r.ok).toBe(true);
    expect(r.estado.fase).toBe('revision');
  });
  it('no hay nada que reintentar en otras fases', async () => {
    expect(await crear().reintentar(PLAN, N)).toMatchObject({ok: false, status: 400});
  });
});

describe('lineaDeEvento', () => {
  it('resume herramientas y errores de herramienta', () => {
    expect(lineaDeEvento({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Bash', input: {command: 'npm run validate -- X'}}]}})).toBe('> Bash npm run validate -- X');
    expect(lineaDeEvento({type: 'user', message: {content: [{type: 'tool_result', is_error: true, content: 'permission denied'}]}})).toBe('! permission denied');
    expect(lineaDeEvento({type: 'system'})).toBeNull();
    expect(lineaDeEvento(null)).toBeNull();
  });
});

describe('transcriptor en memoria', () => {
  it('la preparación recibe TRANSCRIBIR_URL si hay trabajador', async () => {
    subir();
    await esperarFin(await crear({transcriptorUrl: () => 'http://127.0.0.1:5000'}).empezar(PLAN, N, 'mixed'));
    const i = comandos.findIndex((a) => a.includes('edit'));
    expect(envs[i].TRANSCRIBIR_URL).toBe('http://127.0.0.1:5000');
  });
  it('sin trabajador no la recibe', async () => {
    subir();
    await esperarFin(await crear({transcriptorUrl: () => null}).empezar(PLAN, N, 'mixed'));
    const i = comandos.findIndex((a) => a.includes('edit'));
    expect(envs[i]).not.toHaveProperty('TRANSCRIBIR_URL');
  });
});

describe('requisitos de preparar', () => {
  it('ya no pide el token de Hugging Face (la edición no separa voces)', () => {
    expect(REQ_PIPELINE).not.toContain('hf_token');
  });
});
