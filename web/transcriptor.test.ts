import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {crearTranscriptor, parsearListo} = require('./transcriptor');

const fakeSpawn = () => {
  const lanzados: {cmd: string; args: string[]; opts: Record<string, unknown>; proc: EventEmitter & {stdout: PassThrough; stderr: PassThrough; kill: () => void; matado: boolean}}[] = [];
  const spawn = (cmd: string, args: string[], opts: Record<string, unknown>) => {
    const proc = Object.assign(new EventEmitter(), {stdout: new PassThrough(), stderr: new PassThrough(), matado: false, kill() {
      proc.matado = true;
    }});
    lanzados.push({cmd, args, opts, proc});
    return proc;
  };
  return {spawn, lanzados};
};
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('parsearListo', () => {
  it('lee el puerto', () => {
    expect(parsearListo('LISTO 51234')).toBe(51234);
    expect(parsearListo('LISTO 51234\r')).toBe(51234);
    expect(parsearListo('otra cosa')).toBeNull();
  });
});

describe('crearTranscriptor', () => {
  it('url null hasta LISTO, luego la url; null al morir', async () => {
    const {spawn, lanzados} = fakeSpawn();
    const t = crearTranscriptor({root: 'C:/p', py: 'C:/p/.venv/Scripts/python.exe', spawn, log: () => {}});
    t.iniciar();
    expect(t.url()).toBeNull();
    lanzados[0].proc.stdout.write('cargando...\nLISTO 51234\n');
    await tick();
    expect(t.url()).toBe('http://127.0.0.1:51234');
    lanzados[0].proc.emit('exit', 1);
    expect(t.url()).toBeNull();
  });
  it('argumentos: parent-pid, warm, oculto', () => {
    const {spawn, lanzados} = fakeSpawn();
    crearTranscriptor({root: 'C:/p', py: 'py.exe', spawn, log: () => {}}).iniciar();
    const {cmd, args, opts} = lanzados[0];
    expect(cmd).toBe('py.exe');
    expect(args.join(' ')).toContain('transcribe_worker.py');
    expect(args).toEqual(expect.arrayContaining(['--port', '0', '--parent-pid', String(process.pid), '--warm']));
    expect(opts).toMatchObject({cwd: 'C:/p', windowsHide: true});
  });
  it('iniciar dos veces con el proceso vivo no lanza otro; tras morir sí', () => {
    const {spawn, lanzados} = fakeSpawn();
    const t = crearTranscriptor({root: 'C:/p', py: 'py', spawn, log: () => {}});
    t.iniciar();
    t.iniciar();
    expect(lanzados).toHaveLength(1);
    lanzados[0].proc.emit('exit', 0);
    t.iniciar();
    expect(lanzados).toHaveLength(2);
  });
  it('parar mata el proceso', () => {
    const {spawn, lanzados} = fakeSpawn();
    const t = crearTranscriptor({root: 'C:/p', py: 'py', spawn, log: () => {}});
    t.iniciar();
    t.parar();
    expect(lanzados[0].proc.matado).toBe(true);
    expect(t.url()).toBeNull();
  });
  it('si spawn lanza error no rompe', () => {
    const t = crearTranscriptor({root: 'C:/p', py: 'py', spawn: () => {
      throw new Error('ENOENT');
    }, log: () => {}});
    expect(() => t.iniciar()).not.toThrow();
    expect(t.url()).toBeNull();
  });
});

describe('urlConRelanzo', () => {
  it('mientras arranca no gasta el relanzamiento; tras morir relanza una sola vez', async () => {
    const {spawn, lanzados} = fakeSpawn();
    const t = crearTranscriptor({root: 'C:/p', py: 'py', spawn, log: () => {}});
    t.iniciar();
    expect(t.urlConRelanzo()).toBeNull(); // arrancando: sin puerto aun
    expect(lanzados).toHaveLength(1);
    lanzados[0].proc.stdout.write('LISTO 4000\n');
    await tick();
    expect(t.urlConRelanzo()).toBe('http://127.0.0.1:4000');
    lanzados[0].proc.emit('exit', 1);
    expect(t.urlConRelanzo()).toBeNull();
    expect(lanzados).toHaveLength(2); // relanzado
    lanzados[1].proc.emit('exit', 1);
    expect(t.urlConRelanzo()).toBeNull();
    expect(lanzados).toHaveLength(2); // solo una vez
  });
});
