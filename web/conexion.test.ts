import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {crearFlujo} = require('./flujo.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {crearTrabajosGuion, promptMasGuiones} = require('./guionesjob.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {Gestor} = require('./jobs.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const estadoMod = require('./estado.js');

const PLAN = 'NAVIDAD';
const N = 'NAVIDAD_EVE';
let root: string;
let inputDir: string;
let gestor: InstanceType<typeof Gestor>;
let prompts: string[];
let voz: {disponible: boolean; llamadas: {texto: string}[]; falla: boolean};
let tocarGuion: boolean;

const ok = (texto: string) => ({code: 0, stderr: '', result: {type: 'result', is_error: false, result: texto, session_id: 's'}});
const fin = async (id: string) => {
  const j = gestor.obtener(id);
  for (let i = 0; i < 300 && j.corriendo; i++) await new Promise((r) => setTimeout(r, 10));
  return j.log.find((e: {type: string}) => e.type === 'fin');
};

const vocesFake = {
  MAX_CHARS: 5000,
  listarVoces: () => [
    {id: 'laura', nombre: 'Laura', ...(voz.disponible ? {disponible: true} : {disponible: false, motivo: 'Falta ELEVENLABS_API_KEY en .env.'})},
    {id: 'profe', nombre: 'Profe', disponible: false, motivo: 'no'},
  ],
  generarVoz: async ({texto, destino}: {texto: string; destino: string}) => {
    voz.llamadas.push({texto});
    if (voz.falla) throw new Error('ElevenLabs devolvio error 401');
    fs.writeFileSync(destino, 'mp3-falso');
    return {destino, bytes: 9};
  },
};

const claudeFake = async (_job: unknown, _args: string[], prompt: string) => {
  prompts.push(prompt);
  if (prompt.startsWith('Modo web. Usa la skill edit-script')) {
    if (tocarGuion) fs.writeFileSync(path.join(inputDir, PLAN, `${N}.txt`), 'Guion nuevo\n');
    return ok('hecho\nRESUMEN: Lo acorte.');
  }
  if (prompt.includes('/edit-script')) {
    if (tocarGuion) fs.writeFileSync(path.join(inputDir, PLAN, 'OTRO_GUION.txt'), 'Otro\n');
    return ok('hecho\nRESUMEN: Cree uno.');
  }
  // planificar video
  fs.writeFileSync(path.join(root, 'public', `${N}.edit.json`), '{}');
  fs.writeFileSync(path.join(root, 'media', 'output', `${N}_preview.png`), 'png');
  return ok('hecho\nRESUMEN:\nGancho: X');
};

const correrComando = async (_j: unknown, _c: string, args: string[]) => {
  if (args.includes('edit')) {
    fs.writeFileSync(path.join(root, 'public', `${N}.cuts.json`), '{}');
    fs.writeFileSync(path.join(root, 'public', `${N}.transcript.json`), '{}');
  }
  return {code: 0, cola: []};
};

const mkFlujo = () =>
  crearFlujo({root, inputDir, gestor, env: () => ({}), claudeEnv: () => ({}), resolveClaude: () => ({cmd: 'claude', prefijo: []}), correrComando, correrClaude: claudeFake, faltantes: async () => [], uuid: () => '11111111-1111-4111-8111-111111111111', voces: vocesFake});
const mkGuion = () => crearTrabajosGuion({root, inputDir, gestor, resolveClaude: () => ({cmd: 'claude', prefijo: []}), claudeEnv: () => ({}), correrClaude: claudeFake});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'conexion-'));
  inputDir = path.join(root, 'media', 'input');
  fs.mkdirSync(path.join(inputDir, PLAN), {recursive: true});
  fs.mkdirSync(path.join(root, 'public'), {recursive: true});
  fs.mkdirSync(path.join(root, 'media', 'output'), {recursive: true});
  fs.writeFileSync(path.join(inputDir, PLAN, `${N}.txt`), 'Hola profe, este es el guion.\n');
  fs.writeFileSync(path.join(inputDir, PLAN, 'plan.json'), JSON.stringify({titulo: 'Navidad', orden: [N], videos: [{nombre: N, formato: 'Quiz'}]}));
  gestor = new Gestor();
  prompts = [];
  voz = {disponible: true, llamadas: [], falla: false};
  tocarGuion = true;
});
afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

describe('empezarDesdeGuion', () => {
  it('genera la voz, guarda el mp3 y encadena la planificacion voice', async () => {
    const r = await mkFlujo().empezarDesdeGuion(PLAN, N, 'laura');
    expect(r.ok).toBe(true);
    expect((await fin(r.trabajo)).ok).toBe(true);
    expect(voz.llamadas[0].texto).toBe('Hola profe, este es el guion.');
    expect(fs.readFileSync(path.join(inputDir, PLAN, `${N}.mp3`), 'utf8')).toBe('mp3-falso');
    expect(fs.existsSync(path.join(inputDir, PLAN, `${N}.voz-nueva.mp3`))).toBe(false);
    const e = estadoMod.leerEstado(inputDir, PLAN, N);
    expect(e.fase).toBe('revision');
    expect(e.estilo).toBe('voice');
    expect(e.entrada).toMatchObject({archivo: `${N}.mp3`, tipo: 'audio'});
    expect(prompts.some((p) => p.includes('edit-voice'))).toBe(true);
  });

  it('voz profe da 409 claro y no toca nada', async () => {
    const r = await mkFlujo().empezarDesdeGuion(PLAN, N, 'profe');
    expect(r).toMatchObject({ok: false, status: 409});
    expect(r.error).toMatch(/todavía no está lista/);
    expect(voz.llamadas).toHaveLength(0);
  });

  it('voz desconocida, nombre malo y guion inexistente', async () => {
    const f = mkFlujo();
    expect((await f.empezarDesdeGuion(PLAN, N, 'otra')).status).toBe(400);
    expect((await f.empezarDesdeGuion('../x', N, 'laura')).status).toBe(400);
    expect((await f.empezarDesdeGuion(PLAN, 'NOEXISTE', 'laura')).status).toBe(404);
  });

  it('voz sin configurar da 400 con el motivo, sin crear trabajo', async () => {
    voz.disponible = false;
    const r = await mkFlujo().empezarDesdeGuion(PLAN, N, 'laura');
    expect(r).toMatchObject({ok: false, status: 400, error: 'Falta ELEVENLABS_API_KEY en .env.'});
    expect(gestor.activos()).toHaveLength(0);
  });

  it('candado global: 409 si hay otro trabajo pesado', async () => {
    gestor.crear({tipo: 'x', pesado: true});
    expect((await mkFlujo().empezarDesdeGuion(PLAN, N, 'laura')).status).toBe(409);
  });

  it('si ElevenLabs falla deja error en espanol y conserva el audio anterior', async () => {
    fs.writeFileSync(path.join(inputDir, PLAN, `${N}.m4a`), 'viejo');
    voz.falla = true;
    const r = await mkFlujo().empezarDesdeGuion(PLAN, N, 'laura');
    expect((await fin(r.trabajo)).ok).toBe(false);
    const e = estadoMod.leerEstado(inputDir, PLAN, N);
    expect(e.fase).toBe('error');
    expect(e.error).toMatch(/No se pudo generar la voz/);
    expect(fs.existsSync(path.join(inputDir, PLAN, `${N}.m4a`))).toBe(true);
    expect(fs.existsSync(path.join(inputDir, PLAN, `${N}.mp3`))).toBe(false);
  });

  it('reemplaza otra entrada y borra lo intermedio viejo', async () => {
    fs.writeFileSync(path.join(inputDir, PLAN, `${N}.m4a`), 'viejo');
    fs.writeFileSync(path.join(root, 'public', `${N}.cuts.json`), 'viejo');
    const r = await mkFlujo().empezarDesdeGuion(PLAN, N, 'laura');
    await fin(r.trabajo);
    expect(fs.existsSync(path.join(inputDir, PLAN, `${N}.m4a`))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'public', `${N}.cuts.json`), 'utf8')).toBe('{}');
  });
});

describe('cambiosGuion', () => {
  it('lanza claude con el feedback como dato y termina ok si el guion cambio', async () => {
    const r = await mkGuion().cambiosGuion(PLAN, N, 'mas corto');
    expect(r.ok).toBe(true);
    expect((await fin(r.trabajo)).ok).toBe(true);
    expect(prompts[0]).toContain('<cambios_profe>\nmas corto\n</cambios_profe>');
  });
  it('error si claude no cambio el guion', async () => {
    tocarGuion = false;
    const r = await mkGuion().cambiosGuion(PLAN, N, 'mas corto');
    expect((await fin(r.trabajo)).ok).toBe(false);
  });
  it('valida texto, longitud, nombres y candado', async () => {
    const g = mkGuion();
    expect((await g.cambiosGuion(PLAN, N, '  ')).status).toBe(400);
    expect((await g.cambiosGuion(PLAN, N, 'a'.repeat(1501))).status).toBe(400);
    expect((await g.cambiosGuion('../x', N, 'hola')).status).toBe(400);
    expect((await g.cambiosGuion(PLAN, 'NOEXISTE', 'hola')).status).toBe(404);
    gestor.crear({tipo: 'x', pesado: true});
    expect((await g.cambiosGuion(PLAN, N, 'hola')).status).toBe(409);
  });
});

describe('masGuiones', () => {
  it('anade guiones al plan existente', async () => {
    const r = await mkGuion().masGuiones(PLAN, {tema: 'regalos', cantidad: 2});
    expect(r.ok).toBe(true);
    expect((await fin(r.trabajo)).ok).toBe(true);
    expect(prompts[0]).toContain('/edit-script 2 guiones');
    expect(prompts[0]).toContain('media/input/NAVIDAD/');
    expect(prompts[0]).toContain('NO crees una carpeta nueva');
  });
  it('valida cantidad, tema, plan inexistente y candado', async () => {
    const g = mkGuion();
    expect((await g.masGuiones(PLAN, {cantidad: 99})).status).toBe(400);
    expect((await g.masGuiones(PLAN, {tema: 'x'.repeat(301)})).status).toBe(400);
    expect((await g.masGuiones('../x', {})).status).toBe(400);
    expect((await g.masGuiones('NOPLAN', {})).status).toBe(404);
    gestor.crear({tipo: 'x', pesado: true});
    expect((await g.masGuiones(PLAN, {})).status).toBe(409);
  });
  it('promptMasGuiones rechaza plan inseguro', () => {
    expect(() => promptMasGuiones({plan: '../x'})).toThrow();
  });
});
