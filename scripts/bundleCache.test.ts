import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {borrarBundle, esBundleValido, getServeUrl, hashFuentes, instalar, limpiarViejos, marcarUso} from './bundleCache';

let dir: string;
const w = (rel: string, txt = 'x') => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, txt);
  return p;
};
const junction = (target: string, link: string) => {
  try {
    fs.symlinkSync(target, link, 'junction');
    return true;
  } catch {
    return false;
  }
};
const puedeJunction = (() => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-'));
  fs.mkdirSync(path.join(t, 'a'));
  const ok = junction(path.join(t, 'a'), path.join(t, 'b'));
  try {
    if (ok) fs.unlinkSync(path.join(t, 'b'));
  } catch {
    fs.rmdirSync(path.join(t, 'b'));
  }
  fs.rmSync(t, {recursive: true, force: true});
  return ok;
})();

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-'));
  w('src/a.ts', 'uno');
  w('package-lock.json', '{}');
  w('remotion.config.ts', '//');
  w('public/keep.txt', 'real');
});
afterEach(() => {
  // por si un test falló a medias: quitar enlaces antes de borrar
  const cache = path.join(dir, 'media', 'output', '.remotion-bundle');
  const dirs = [...['b1', 'b2', 'tmp1'].map((d) => path.join(dir, d)), ...(fs.existsSync(cache) ? fs.readdirSync(cache).map((d) => path.join(cache, d)) : [])];
  for (const d of dirs) {
    const pub = path.join(d, 'public');
    try {
      if (fs.lstatSync(pub).isSymbolicLink()) fs.unlinkSync(pub);
    } catch {
      /* nada */
    }
  }
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('hashFuentes', () => {
  it('estable, cambia con src y no con public', () => {
    const h = hashFuentes(dir);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(hashFuentes(dir)).toBe(h);
    w('public/x.mp4', 'video');
    expect(hashFuentes(dir)).toBe(h);
    w('src/a.ts', 'dos');
    expect(hashFuentes(dir)).not.toBe(h);
  });
});

describe.skipIf(!puedeJunction)('bundle con junction', () => {
  const pub = () => path.join(dir, 'public');
  it('esBundleValido', () => {
    const b = path.join(dir, 'b1');
    fs.mkdirSync(b);
    expect(esBundleValido(b, pub())).toBe(false); // sin index.html
    w('b1/index.html', '<html>');
    fs.mkdirSync(path.join(b, 'public'));
    expect(esBundleValido(b, pub())).toBe(false); // carpeta normal
    fs.rmdirSync(path.join(b, 'public'));
    junction(path.join(dir, 'src'), path.join(b, 'public'));
    expect(esBundleValido(b, pub())).toBe(false); // apunta a otro sitio
    fs.unlinkSync(path.join(b, 'public'));
    junction(pub(), path.join(b, 'public'));
    expect(esBundleValido(b, pub())).toBe(true);
  });
  it('borrarBundle no toca la public real', () => {
    w('b1/index.html');
    junction(pub(), path.join(dir, 'b1', 'public'));
    borrarBundle(path.join(dir, 'b1'));
    expect(fs.existsSync(path.join(dir, 'b1'))).toBe(false);
    expect(fs.readFileSync(path.join(pub(), 'keep.txt'), 'utf8')).toBe('real');
  });
  it('instalar: destino libre', () => {
    w('tmp1/index.html');
    junction(pub(), path.join(dir, 'tmp1', 'public'));
    expect(instalar(path.join(dir, 'tmp1'), path.join(dir, 'b2'))).toBe('instalado');
    expect(fs.existsSync(path.join(dir, 'tmp1'))).toBe(false);
    expect(esBundleValido(path.join(dir, 'b2'), pub())).toBe(true);
  });
  it('instalar: destino ya existe → descarta el temporal sin tocar public', () => {
    w('b2/index.html', 'ganador');
    junction(pub(), path.join(dir, 'b2', 'public'));
    w('tmp1/index.html', 'perdedor');
    junction(pub(), path.join(dir, 'tmp1', 'public'));
    expect(instalar(path.join(dir, 'tmp1'), path.join(dir, 'b2'))).toBe('ya-existia');
    expect(fs.existsSync(path.join(dir, 'tmp1'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'b2', 'index.html'), 'utf8')).toBe('ganador');
    expect(fs.readFileSync(path.join(pub(), 'keep.txt'), 'utf8')).toBe('real');
  });
});

describe.skipIf(!puedeJunction)('limpieza y getServeUrl', () => {
  const pub = () => path.join(dir, 'public');
  const bundleFalso = (llamadas: string[]) => async (o: {outDir?: string | null}) => {
    llamadas.push(String(o.outDir));
    fs.mkdirSync(path.join(o.outDir!, 'public'), {recursive: true});
    fs.writeFileSync(path.join(o.outDir!, 'index.html'), '<html>');
    return o.outDir!;
  };
  it('limpiarViejos borra solo los paquetes sin uso reciente y nunca toca public', () => {
    const cache = path.join(dir, 'cache');
    for (const n of ['actual', 'reciente', 'viejo']) {
      w(`cache/${n}/index.html`);
      junction(pub(), path.join(cache, n, 'public'));
      marcarUso(path.join(cache, n));
    }
    const hace2h = (Date.now() - 2 * 3600 * 1000) / 1000;
    fs.utimesSync(path.join(cache, 'viejo', '.usado'), hace2h, hace2h);
    limpiarViejos(cache, 'actual', {log: () => {}});
    expect(fs.readdirSync(cache).sort()).toEqual(['actual', 'reciente']);
    expect(fs.readFileSync(path.join(pub(), 'keep.txt'), 'utf8')).toBe('real');
  });
  it('getServeUrl empaqueta una vez y luego reutiliza', async () => {
    const llamadas: string[] = [];
    const a = await getServeUrl({root: dir, log: () => {}, bundleFn: bundleFalso(llamadas)});
    const b = await getServeUrl({root: dir, log: () => {}, bundleFn: bundleFalso(llamadas)});
    expect(a).toBe(b);
    expect(llamadas).toHaveLength(1);
    expect(esBundleValido(a, pub())).toBe(true);
  });
  it('un error de compilacion sale tal cual, sin segundo empaquetado', async () => {
    let n = 0;
    const bundleFn = async () => {
      n++;
      throw new Error('TS2304: Cannot find name foo');
    };
    await expect(getServeUrl({root: dir, log: () => {}, bundleFn})).rejects.toThrow(/TS2304/);
    expect(n).toBe(1);
  });
});
