// Archivos de la web local: rutas seguras, servir con Range y guardar subidas en streaming. Se prueba en web/files.test.ts
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXT_PERMITIDAS = ['mov', 'mp4', 'm4v', 'm4a', 'mp3', 'wav', 'ogg', 'opus'];
const EXT_AUDIO = ['m4a', 'mp3', 'wav', 'ogg', 'opus'];
const EXT_VIDEO = ['mov', 'mp4', 'm4v'];
const MAX_SUBIDA = 3 * 1024 * 1024 * 1024;
const PLAN_SEGURO = /^[A-Za-z0-9_-]{1,80}$/;
const NOMBRE_SEGURO = /^[A-Za-z0-9_-]{1,120}$/;

const MIMES = {
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  png: 'image/png',
  jpg: 'image/jpeg',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

const extDe = (archivo) => path.extname(String(archivo || '')).slice(1).toLowerCase();

/** Content-Type según la extensión; octet-stream si no se conoce. */
function tipoMime(archivo) {
  return MIMES[extDe(archivo)] || 'application/octet-stream';
}

/** 'audio' | 'video' | null según la extensión (con o sin punto). */
function tipoDeEntrada(ext) {
  const e = String(ext || '').replace(/^\./, '').toLowerCase();
  if (EXT_AUDIO.includes(e)) return 'audio';
  if (EXT_VIDEO.includes(e)) return 'video';
  return null;
}

/** Comprueba extensión y tamaño declarado antes de aceptar una subida. */
function validarSubida({ext, bytes} = {}) {
  const e = String(ext || '').replace(/^\./, '').toLowerCase();
  if (!EXT_PERMITIDAS.includes(e)) return {ok: false, error: `Formato no permitido. Usa: ${EXT_PERMITIDAS.join(', ')}.`};
  if (bytes !== undefined && bytes !== null) {
    if (!Number.isFinite(bytes) || bytes <= 0) return {ok: false, error: 'El archivo está vacío.'};
    if (bytes > MAX_SUBIDA) return {ok: false, error: 'El archivo es demasiado grande (máximo 3 GB).'};
  }
  return {ok: true};
}

/** Interpreta el header Range (un solo rango). null = sin header; 'invalido' = 416; {start, end} inclusivo. */
function parseRange(header, size) {
  if (header === undefined || header === null || header === '') return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '') || !(size > 0)) return 'invalido';
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'invalido';
    return {start: Math.max(0, size - n), end: size - 1};
  }
  const start = Number(m[1]);
  if (start >= size) return 'invalido';
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (end < start) return 'invalido';
  return {start, end};
}

/** ¿`hijo` está dentro de `base` (ya resueltas y reales)? */
const dentroDe = (base, hijo) => hijo.startsWith(base + path.sep);

/** Devuelve la ruta si es un archivo normal (no symlink) dentro de la base; si no, null. */
function archivoSeguro(base, candidato) {
  try {
    const resuelto = path.resolve(candidato);
    const baseResuelta = path.resolve(base);
    if (!dentroDe(baseResuelta, resuelto)) return null;
    const st = fs.lstatSync(resuelto);
    if (st.isSymbolicLink() || !st.isFile()) return null;
    // ningún tramo intermedio puede ser un enlace que escape de la base
    if (!dentroDe(fs.realpathSync(baseResuelta), fs.realpathSync(resuelto))) return null;
    return resuelto;
  } catch {
    return null;
  }
}

/** Ruta absoluta del archivo pedido (entrada|preview|video|caption) o null si no existe o no es seguro. */
function resolverArchivo(root, plan, nombre, tipo) {
  if (typeof root !== 'string' || !PLAN_SEGURO.test(plan || '') || !NOMBRE_SEGURO.test(nombre || '')) return null;
  const input = path.join(root, 'media', 'input');
  const output = path.join(root, 'media', 'output');
  const edited = path.join(output, 'edited');
  switch (tipo) {
    case 'entrada':
      for (const ext of EXT_PERMITIDAS) {
        const r = archivoSeguro(input, path.join(input, plan, `${nombre}.${ext}`));
        if (r) return r;
      }
      return null;
    case 'preview':
      return archivoSeguro(output, path.join(output, `${nombre}_preview.png`));
    case 'video':
      return archivoSeguro(edited, path.join(edited, nombre, `${nombre}_edited.mp4`));
    case 'caption':
      return archivoSeguro(edited, path.join(edited, nombre, `${nombre}_caption.txt`));
    default:
      return null;
  }
}

/** Videos terminados en media/output/edited/<N>/<N>_edited.mp4: [{nombre, actualizado}] (más nuevos primero). */
function listarEditados(root) {
  const edited = path.join(root, 'media', 'output', 'edited');
  let dirs;
  try {
    dirs = fs.readdirSync(edited, {withFileTypes: true});
  } catch {
    return [];
  }
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !NOMBRE_SEGURO.test(d.name)) continue;
    const mp4 = archivoSeguro(edited, path.join(edited, d.name, `${d.name}_edited.mp4`));
    if (!mp4) continue;
    try {
      out.push({nombre: d.name, actualizado: fs.statSync(mp4).mtime.toISOString()});
    } catch {
      /* se ignora */
    }
  }
  return out.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

/** Sirve un archivo en streaming con soporte de Range. */
function servirArchivo(req, res, archivo, {descargar = false} = {}) {
  let st;
  try {
    st = fs.statSync(archivo);
    if (!st.isFile()) throw new Error('no es archivo');
  } catch {
    res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify({error: 'No se encontró el archivo.'}));
    return;
  }
  const size = st.size;
  const headers = {
    'Content-Type': tipoMime(archivo),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (descargar) {
    const limpio = path.basename(archivo).replace(/[^A-Za-z0-9._-]/g, '_');
    headers['Content-Disposition'] = `attachment; filename="${limpio}"`;
  }
  const rango = parseRange(req.headers && req.headers.range, size);
  if (rango === 'invalido') {
    res.writeHead(416, {...headers, 'Content-Range': `bytes */${size}`});
    res.end();
    return;
  }
  let status = 200;
  let opciones;
  if (rango) {
    status = 206;
    headers['Content-Range'] = `bytes ${rango.start}-${rango.end}/${size}`;
    headers['Content-Length'] = rango.end - rango.start + 1;
    opciones = {start: rango.start, end: rango.end};
  } else {
    headers['Content-Length'] = size;
  }
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || size === 0) {
    res.end();
    return;
  }
  const stream = fs.createReadStream(archivo, opciones);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

/**
 * Guarda el cuerpo de `req` en `destino` en streaming: archivo temporal al lado, límite `max` aplicado mientras
 * llega, rename al terminar. Rechaza (y borra el temporal) si excede, se aborta o falla.
 * Si rechaza por exceso (err.code 'EXCEDE_MAX'), el que llama debe responder 413 con `Connection: close`.
 */
function guardarSubida(req, destino, {max = MAX_SUBIDA} = {}) {
  return new Promise((resolve, reject) => {
    const tmp = `${destino}.${crypto.randomBytes(4).toString('hex')}.part`;
    let bytes = 0;
    let terminado = false;
    try {
      fs.mkdirSync(path.dirname(destino), {recursive: true});
    } catch (err) {
      reject(err);
      return;
    }
    const ws = fs.createWriteStream(tmp);

    const fallar = (err) => {
      if (terminado) return;
      terminado = true;
      req.unpipe(ws);
      ws.destroy();
      const borrar = () => fs.rm(tmp, {force: true, maxRetries: 10, retryDelay: 50}, () => reject(err));
      if (ws.closed) borrar();
      else ws.once('close', borrar);
    };

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > max) {
        const e = new Error('El archivo es demasiado grande.');
        e.code = 'EXCEDE_MAX';
        fallar(e);
      }
    });
    req.on('error', fallar);
    req.on('aborted', () => fallar(new Error('La subida se canceló.')));
    req.on('close', () => {
      if (req.complete === false) fallar(new Error('La subida se canceló.'));
    });
    ws.on('error', fallar);
    ws.on('close', () => {
      if (terminado) return;
      if (bytes === 0) return fallar(new Error('El archivo está vacío.'));
      terminado = true;
      try {
        fs.renameSync(tmp, destino);
        resolve({bytes});
      } catch (err) {
        fs.rm(tmp, {force: true}, () => reject(err));
      }
    });
    req.pipe(ws);
  });
}

module.exports = {EXT_PERMITIDAS, MAX_SUBIDA, parseRange, validarSubida, tipoDeEntrada, resolverArchivo, listarEditados, tipoMime, servirArchivo, guardarSubida};
