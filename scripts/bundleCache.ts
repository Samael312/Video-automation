// Paquete de Remotion compartido entre preview y render.
// Se empaqueta una vez por hash de las fuentes (src/**, package-lock.json, remotion.config.ts) en
// media/output/.remotion-bundle/<hash>/, con `public` como junction a la public/ real (Remotion en Windows
// siempre la copia: 281 MB por render). Si no se puede enlazar, se empaqueta copiando como antes.
// SEGURIDAD: nunca se borra recursivamente una carpeta que aun tiene el junction (borraria public/ real).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';

const listar = (base: string, rel = ''): string[] => {
  const d = path.join(base, rel);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d, {withFileTypes: true})
    .flatMap((e) => {
      const r = rel ? `${rel}/${e.name}` : e.name;
      return e.isDirectory() ? listar(base, r) : e.isFile() ? [r] : [];
    })
    .sort();
};

/** Hash (12 hex) del contenido de src/**, package-lock.json y remotion.config.ts. */
export const hashFuentes = (root: string): string => {
  const h = crypto.createHash('sha256');
  for (const rel of listar(path.join(root, 'src'))) {
    h.update(`src/${rel}\0`);
    h.update(fs.readFileSync(path.join(root, 'src', rel)));
  }
  for (const f of ['package-lock.json', 'remotion.config.ts']) {
    const p = path.join(root, f);
    h.update(`${f}\0`);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest('hex').slice(0, 12);
};

const esEnlace = (p: string) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const real = (p: string) => fs.realpathSync.native(p).toLowerCase();

/** Bundle usable: tiene index.html y `public` es un enlace a la public real. */
export const esBundleValido = (dir: string, publicReal: string): boolean => {
  try {
    const pub = path.join(dir, 'public');
    return fs.existsSync(path.join(dir, 'index.html')) && esEnlace(pub) && real(pub) === real(publicReal);
  } catch {
    return false;
  }
};

const quitarEnlace = (p: string) => {
  if (!esEnlace(p)) return;
  try {
    fs.unlinkSync(p);
  } catch {
    fs.rmdirSync(p); // junctions en algunos Windows
  }
};

/** Borra un bundle: primero quita el enlace `public` (sin seguirlo), luego la carpeta. */
export const borrarBundle = (dir: string): void => {
  const pub = path.join(dir, 'public');
  quitarEnlace(pub);
  if (esEnlace(pub)) throw new Error(`no se pudo quitar el enlace ${pub}; no borro ${dir}`);
  fs.rmSync(dir, {recursive: true, force: true});
};

/** Mueve el bundle temporal a su sitio; si otro proceso ya lo dejó, descarta el temporal. */
export const instalar = (tmpDir: string, destino: string): 'instalado' | 'ya-existia' => {
  if (fs.existsSync(destino)) {
    borrarBundle(tmpDir);
    return 'ya-existia';
  }
  try {
    fs.renameSync(tmpDir, destino);
    return 'instalado';
  } catch (err) {
    if (fs.existsSync(destino)) {
      borrarBundle(tmpDir);
      return 'ya-existia';
    }
    throw err;
  }
};

const USO = '.usado';
const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Apunta que este paquete se esta usando (la limpieza no borra paquetes usados hace poco). */
export const marcarUso = (dir: string): void => {
  try {
    fs.writeFileSync(path.join(dir, USO), new Date().toISOString());
  } catch {
    /* sin marca: solo afecta a la limpieza */
  }
};

const ultimoUso = (dir: string): number => {
  for (const f of [path.join(dir, USO), dir]) {
    try {
      return fs.statSync(f).mtimeMs;
    } catch {
      /* siguiente */
    }
  }
  return 0;
};

/**
 * Borra paquetes de otro hash sin uso en la ultima hora y temporales de mas de 10 min.
 * Un render largo con un paquete viejo sigue usandolo aunque Claude haya cambiado src/ y empaquetado otro.
 */
export const limpiarViejos = (cache: string, actual: string, opts: {log: (s: string) => void; ahora?: number; maxUsoMs?: number}): void => {
  const ahora = opts.ahora ?? Date.now();
  const maxUso = opts.maxUsoMs ?? 60 * 60 * 1000;
  let nombres: string[] = [];
  try {
    nombres = fs.readdirSync(cache);
  } catch {
    return;
  }
  for (const n of nombres) {
    if (n === actual) continue;
    const d = path.join(cache, n);
    try {
      const limite = n.includes('.tmp-') ? 10 * 60 * 1000 : maxUso;
      if (ahora - ultimoUso(d) < limite) continue;
      borrarBundle(d);
    } catch (err) {
      opts.log(`aviso: no se pudo borrar el paquete viejo ${n} (${msg(err)})`);
    }
  }
};

type BundleFn = (o: {entryPoint: string; outDir?: string | null; publicDir?: string | null; enableCaching?: boolean}) => Promise<string>;

/** serveUrl de Remotion: el bundle compartido si se puede, si no uno copiado como antes. */
export const getServeUrl = async (opts: {log?: (s: string) => void; root?: string; bundleFn?: BundleFn} = {}): Promise<string> => {
  const log = opts.log ?? ((s: string) => console.log(s));
  const root = opts.root ?? path.join(__dirname, '..');
  const bundleFn: BundleFn = opts.bundleFn ?? ((o) => bundle(o));
  const entryPoint = path.join(root, 'src', 'index.ts');
  const publicReal = path.join(root, 'public');
  const cache = path.join(root, 'media', 'output', '.remotion-bundle');
  const hash = hashFuentes(root);
  const destino = path.join(cache, hash);
  if (esBundleValido(destino, publicReal)) {
    marcarUso(destino);
    log(`(paquete de Remotion reutilizado: ${hash})`);
    return destino;
  }
  fs.mkdirSync(cache, {recursive: true});
  if (fs.existsSync(destino)) borrarBundle(destino); // a medias o invalido
  const tmp = path.join(cache, `${hash}.tmp-${crypto.randomBytes(3).toString('hex')}`);
  const vacia = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-public-vacia-'));
  try {
    // un error de compilacion de src/ sale tal cual (no se reintenta copiando: fallaria igual)
    await bundleFn({entryPoint, outDir: tmp, publicDir: vacia, enableCaching: true});
  } catch (err) {
    try {
      borrarBundle(tmp);
    } catch {
      /* se limpia en la proxima */
    }
    throw err;
  } finally {
    fs.rmSync(vacia, {recursive: true, force: true});
  }
  try {
    fs.rmSync(path.join(tmp, 'public'), {recursive: true, force: true}); // solo la copia vacia
    fs.symlinkSync(publicReal, path.join(tmp, 'public'), 'junction');
  } catch (err) {
    try {
      borrarBundle(tmp);
    } catch {
      /* se limpia en la proxima */
    }
    log(`aviso: no se pudo enlazar public/ (${msg(err)}), empaqueto copiando`);
    return bundleFn({entryPoint});
  }
  instalar(tmp, destino);
  marcarUso(destino);
  limpiarViejos(cache, hash, {log});
  log(`(paquete de Remotion nuevo: ${hash})`);
  return destino;
};
