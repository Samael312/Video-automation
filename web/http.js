// Utilidades HTTP de la web: respuestas, cuerpo JSON, quien puede llamar y estaticos.
const fs = require('fs');
const path = require('path');

const MAX_BODY = 10 * 1024;
const RE_ESTATICO = /^\/[A-Za-z0-9_.-]+\.(js|css|png|svg|ico|html)$/;
const TIPOS_ESTATICO = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8'};

/** Respuesta sin cache (la pagina y la API cambian a menudo: el navegador nunca usa copias viejas). */
const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readJson(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        reject(new Error('Petición demasiado grande'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

/** Solo nuestra propia pagina puede llamar a la API (evita que otra web abierta en el navegador lance trabajos). */
function allowed(req, esSubida, {host, port}) {
  const h = String(req.headers.host || '');
  if (h !== `localhost:${port}` && h !== `${host}:${port}`) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://localhost:${port}` && origin !== `http://${host}:${port}`) return false;
  if (req.method === 'POST') {
    const tipo = String(req.headers['content-type'] || '');
    if (!(esSubida ? tipo.startsWith('application/octet-stream') : tipo.startsWith('application/json'))) return false;
  }
  return true;
}

/** GET / o /<archivo>.<ext> de publicDir. Devuelve true si atendio la peticion. */
function servirEstatico(req, res, publicDir, p) {
  if (req.method !== 'GET' || !(p === '/' || RE_ESTATICO.test(p))) return false;
  const nombre = p === '/' ? 'index.html' : p.slice(1);
  const archivo = path.join(publicDir, nombre);
  if (!fs.existsSync(archivo)) send(res, 404, {error: 'No encontrado'});
  else send(res, 200, fs.readFileSync(archivo), TIPOS_ESTATICO[path.extname(nombre)] || 'application/octet-stream');
  return true;
}

module.exports = {MAX_BODY, RE_ESTATICO, TIPOS_ESTATICO, send, readJson, allowed, servirEstatico};
