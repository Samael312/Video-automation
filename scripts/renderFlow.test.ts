import {describe, expect, it} from 'vitest';
import {cleanDetail, runRender, type RenderIO} from './renderFlow';

const O = {final: 'F.mp4', tmp: 'F.tmp.mp4', concurrency: 8};

/** io falso: registra llamadas; `fallas` decide qué lanza (por nombre de paso, en orden de llamada). */
const fake = (fallas: Partial<Record<keyof RenderIO, (Error | null)[]>> = {}) => {
  const calls: string[] = [];
  const logs: string[] = [];
  const quizas = (k: keyof RenderIO) => {
    const e = fallas[k]?.shift();
    if (e) throw e;
  };
  const io: RenderIO = {
    validate: async () => (calls.push('validate'), quizas('validate')),
    prepare: async () => (calls.push('prepare'), quizas('prepare')),
    probe: async () => (calls.push('probe'), quizas('probe')),
    render: async (tmp, c) => (calls.push(`render(${tmp},${c})`), quizas('render')),
    loudness: async (f) => (calls.push(`loudness(${f})`), quizas('loudness')),
    rename: (a, b) => (calls.push(`rename(${a},${b})`), quizas('rename')),
    remove: (f) => calls.push(`remove(${f})`),
    cleanResidue: () => (calls.push('cleanResidue'), quizas('cleanResidue')),
    log: (l) => logs.push(l),
    detail: () => {},
  };
  return {io, calls, logs};
};
const COMP = () => new Error('Compositor error: No frame found at position 18432');

describe('runRender', () => {
  it('éxito: orden completo', async () => {
    const f = fake();
    expect(await runRender(O, f.io)).toBe(true);
    expect(f.calls).toEqual(['validate', 'prepare', 'probe', 'remove(F.tmp.mp4)', 'render(F.tmp.mp4,8)', 'loudness(F.tmp.mp4)', 'rename(F.tmp.mp4,F.mp4)', 'cleanResidue']);
    expect(f.logs.filter((l) => l.startsWith('=='))).toEqual(['== validar edit.json ==', '== preparar ==', '== prueba ==', '== renderizar ==', '== volumen final ==', '== terminar ==']);
  });
  it('compositor falla una vez: reintenta con la mitad', async () => {
    const f = fake({render: [COMP()]});
    expect(await runRender(O, f.io)).toBe(true);
    expect(f.calls).toContain('render(F.tmp.mp4,4)');
    expect(f.logs.join('\n')).toContain('reintento');
  });
  it('compositor falla dos veces: falla y borra tmp', async () => {
    const f = fake({render: [COMP(), COMP()]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls.filter((c) => c.startsWith('rename'))).toEqual([]);
    expect(f.calls.slice(-1)[0]).toBe('remove(F.tmp.mp4)');
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: renderizar');
  });
  it('otro error de render: no reintenta', async () => {
    const f = fake({render: [new Error('otra cosa')]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls.filter((c) => c.startsWith('render('))).toHaveLength(1);
  });
  it('concurrencia 1: el reintento usa 1', async () => {
    const f = fake({render: [COMP()]});
    await runRender({...O, concurrency: 1}, f.io);
    expect(f.calls.filter((c) => c.startsWith('render('))).toEqual(['render(F.tmp.mp4,1)', 'render(F.tmp.mp4,1)']);
  });
  it('prueba falla: nunca renderiza', async () => {
    const f = fake({probe: [new Error('Cannot read properties of undefined')]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls.some((c) => c.startsWith('render('))).toBe(false);
    expect(f.logs.join('\n')).toContain('el render de prueba falló: Cannot read properties of undefined');
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: prueba');
  });
  it('volumen falla: borra tmp, no renombra', async () => {
    const f = fake({loudness: [new Error('ffmpeg')]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls.filter((c) => c.startsWith('rename'))).toEqual([]);
    expect(f.calls.slice(-1)[0]).toBe('remove(F.tmp.mp4)');
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: volumen final');
  });
  it('validar falla: no hace nada más', async () => {
    const f = fake({validate: [new Error('edit.json invalido')]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls).toEqual(['validate', 'remove(F.tmp.mp4)']);
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: validar edit.json');
  });
  it('limpieza falla tras renombrar: sigue siendo éxito con aviso', async () => {
    const f = fake({cleanResidue: [new Error('EBUSY')]});
    expect(await runRender(O, f.io)).toBe(true);
    expect(f.logs.join('\n')).toMatch(/aviso/i);
    expect(f.logs.join('\n')).not.toContain('FALLO');
  });
  it('borra un tmp previo antes del primer render', async () => {
    const f = fake();
    await runRender(O, f.io);
    expect(f.calls.indexOf('remove(F.tmp.mp4)')).toBeLessThan(f.calls.indexOf('render(F.tmp.mp4,8)'));
  });
  it('la causa sale sin colores y en una línea', async () => {
    const f = fake({prepare: [new Error('\u001b[31mno existe media/music/a.mp3\u001b[39m\nstack')]});
    await runRender(O, f.io);
    expect(f.logs).toContain('no existe media/music/a.mp3');
  });
});

describe('cleanDetail', () => {
  it('quita ANSI y deja 20 líneas', () => {
    const r = cleanDetail('\u001b[31mx\u001b[39m\n'.repeat(30));
    expect(r.split('\n')).toHaveLength(20);
    expect(r).not.toContain('\u001b');
  });
});

describe('runRender: arreglos de la revisión', () => {
  it('fallo del compositor en la prueba: aviso y sigue (render tiene su reintento)', async () => {
    const f = fake({probe: [COMP()]});
    expect(await runRender(O, f.io)).toBe(true);
    expect(f.logs.join('\n')).toMatch(/aviso/i);
    expect(f.calls).toContain('render(F.tmp.mp4,8)');
  });
  it('si borrar el tmp lanza, igual imprime FALLO y devuelve false', async () => {
    const f = fake({loudness: [new Error('ffmpeg')]});
    f.io.remove = () => {
      throw new Error('EBUSY');
    };
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: volumen final');
  });
  it('tras reintentar el compositor, un fallo posterior no deja rastro de "No frame found"', async () => {
    const det: string[] = [];
    const f = fake({render: [COMP()], loudness: [new Error('ffmpeg roto')]});
    f.io.detail = (t) => det.push(t);
    await runRender(O, f.io);
    expect([...f.logs, ...det].join('\n')).not.toContain('No frame found');
  });
});

describe('runRender: pendientes menores', () => {
  it('si falla el renombrado final, conserva el tmp y dice dónde está', async () => {
    const f = fake({rename: [new Error('EPERM')]});
    expect(await runRender(O, f.io)).toBe(false);
    expect(f.calls.slice(-1)[0]).toBe('rename(F.tmp.mp4,F.mp4)');
    expect(f.logs.join('\n')).toContain('F.tmp.mp4');
    expect(f.logs.slice(-1)[0]).toBe('FALLO en el paso: terminar');
  });
});
