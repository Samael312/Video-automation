// Web local de guiones y edicion de video. Uso: npm run web  (o doble clic en Iniciar-web.bat)
// Escucha solo en 127.0.0.1. Lanza `claude -p` (Claude Code sin pantalla, con la sesion ya iniciada en este PC) y los
// scripts del pipeline dentro de la carpeta del proyecto. Contrato de la API: docs/WEB_API.md
const http = require('http');
const fs = require('fs');
const path = require('path');
const {execFile} = require('child_process');
const lib = require('./lib');
const estadoMod = require('./estado');
const files = require('./files');
const prompts = require('./prompts');
const requisitos = require('./requisitos');
const jobs = require('./jobs');
const {crearFlujo, REQ_PIPELINE} = require('./flujo');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'media', 'input');
const PUBLIC = path.join(__dirname, 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 10 * 1024;
const RE_PLAN = /^[A-Za-z0-9_-]{1,80}$/;
const RE_NOMBRE = /^[A-Za-z0-9_-]{1,120}$/;
const RE_ESTATICO = /^\/[A-Za-z0-9_.-]+\.(js|css|png|svg|ico|html)$/;
const TIPOS_ESTATICO = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8'};

// Archivos intermedios de un video que dejan de valer si se sube otro archivo (solo estos nombres, nunca comodines).
const SUFIJOS_PREPARACION = ['.mp4', '.raw.wav', '.transcript.json', '.transcript.whisper.json', '.cuts.json', '.edit.json', '.matte.json', '.matte.webm'];

const gestor = new jobs.Gestor();
let ultimoGuiones = null; // id del ultimo trabajo de guiones (para GET /api/guiones/progreso)

// ---------- requisitos ----------
const revisarRequisitos = () => requisitos.comprobarRequisitos(ROOT, process.env);
const faltantes = async (ids) => revisarRequisitos().filter((r) => !r.ok && ids.includes(r.id));

const flujo = crearFlujo({root: ROOT, inputDir: INPUT, gestor, faltantes});

// ---------- generar guiones ----------
const ARGS_GUIONES = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep', '--disallowedTools', prompts.DENEGADAS.join(',')];

async function generarGuiones(request) {
  const job = gestor.crear({tipo: 'guiones', pesado: true});
  ultimoGuiones = job.id;
  const before = lib.listFolders(INPUT);
  job.emitir({type: 'progreso', mensaje: 'Empezando…'});
  (async () => {
    try {
      const r = lib.resolveClaude();
      if (!r) {
        job.emitir({type: 'fin', ok: false, error: 'No encuentro Claude Code en este PC.'});
        return;
      }
      const onEvento = (ev) => {
        const m = lib.progressMessage(ev);
        if (m) job.emitir({type: 'progreso', mensaje: m});
      };
      const lanzar = (prompt) => jobs.correrClaude(job, [...r.prefijo, ...ARGS_GUIONES], prompt, {cwd: ROOT, env: lib.claudeEnv(), comando: r.cmd, shell: false, timeoutMs: 10 * 60 * 1000, onEvento});
      let run = await lanzar(lib.buildPrompt(request));
      let changed = lib.changedFolders(before, lib.listFolders(INPUT));
      // Plan B: si el modo -p no reconocio la skill como comando y no se creo nada, se pide por texto normal.
      const text = String((run.result && run.result.result) || '');
      if (!job.cancelado && changed.length === 0 && /unknown|not found|no such|isn't available|no está/i.test(text)) {
        job.emitir({type: 'progreso', mensaje: 'Reintentando…'});
        run = await lanzar(lib.buildFallbackPrompt(request));
        changed = lib.changedFolders(before, lib.listFolders(INPUT));
      }
      if (job.cancelado) job.emitir({type: 'fin', ok: false, cancelado: true});
      else if (run.result && !run.result.is_error && changed.length > 0) job.emitir({type: 'fin', ok: true, carpetas: changed});
      else if (run.result && !run.result.is_error) job.emitir({type: 'fin', ok: false, error: 'Claude respondió pero no creó ninguna carpeta con guiones. Vuelve a intentar con otra petición.'});
      else job.emitir({type: 'fin', ok: false, error: lib.friendlyError((run.result && run.result.result) || run.stderr)});
    } catch (err) {
      job.emitir({type: 'fin', ok: false, error: lib.friendlyError(String(err && err.message))});
    } finally {
      job.terminar();
    }
  })();
  return job;
}

// ---------- http ----------
const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
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
function allowed(req, esSubida) {
  const host = String(req.headers.host || '');
  if (host !== `localhost:${PORT}` && host !== `${HOST}:${PORT}`) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://${HOST}:${PORT}`) return false;
  if (req.method === 'POST') {
    const tipo = String(req.headers['content-type'] || '');
    if (!(esSubida ? tipo.startsWith('application/octet-stream') : tipo.startsWith('application/json'))) return false;
  }
  return true;
}

function checkClaude() {
  return new Promise((resolve) => {
    const r = lib.resolveClaude();
    if (!r) return resolve({claude: false});
    execFile(r.cmd, [...r.prefijo, '--version'], {shell: false, windowsHide: true, timeout: 15000, env: lib.claudeEnv()}, (err, stdout) => {
      const perfil = lib.detectClaudeConfig().profile;
      resolve(err ? {claude: false} : {claude: true, version: String(stdout).trim(), perfil, sesion: perfil !== 'ninguno'});
    });
  });
}

const archivosDe = (plan, nombre) => ({
  entrada: Boolean(files.resolverArchivo(ROOT, plan, nombre, 'entrada')),
  preview: Boolean(files.resolverArchivo(ROOT, plan, nombre, 'preview')),
  video: Boolean(files.resolverArchivo(ROOT, plan, nombre, 'video')),
  caption: Boolean(files.resolverArchivo(ROOT, plan, nombre, 'caption')),
});

function carpetaConEstados(plan) {
  const carpeta = lib.getFolder(INPUT, plan);
  if (!carpeta) return null;
  for (const g of carpeta.guiones) {
    const e = estadoMod.leerEstado(INPUT, plan, g.nombre);
    g.estado = {fase: e.fase, actualizado: e.actualizado};
  }
  return carpeta;
}

function listaListos() {
  return estadoMod.listarListos(INPUT).map((v) => {
    const carpeta = lib.getFolder(INPUT, v.plan);
    const g = carpeta && carpeta.guiones.find((x) => x.nombre === v.nombre);
    return {plan: v.plan, nombre: v.nombre, titulo: (g && g.info && g.info.gancho) || v.nombre, actualizado: v.actualizado};
  });
}

/** POST /api/subidas/<PLAN>/<NOMBRE>?ext=m4a (cuerpo binario). */
async function subir(req, res, plan, nombre, url) {
  const ext = String(url.searchParams.get('ext') || '').toLowerCase().replace(/^\./, '');
  const bytes = Number(req.headers['content-length']);
  const v = files.validarSubida({ext, bytes: Number.isFinite(bytes) ? bytes : undefined});
  if (!v.ok) return send(res, 400, {error: v.error});
  if (!fs.existsSync(path.join(INPUT, plan, `${nombre}.txt`))) return send(res, 404, {error: 'No encuentro ese guion.'});
  const actual = estadoMod.leerEstado(INPUT, plan, nombre);
  if (estadoMod.EN_CURSO.includes(actual.fase) && gestor.activoDe(plan, nombre)) return send(res, 409, {error: 'Este video se está editando ahora mismo.'});
  const destino = path.join(INPUT, plan, `${nombre}.${ext}`);
  let guardado;
  try {
    guardado = await files.guardarSubida(req, destino, {max: files.MAX_SUBIDA});
  } catch (err) {
    return send(res, /grande|excede|límite/i.test(String(err.message)) ? 413 : 400, {error: String(err.message)});
  }
  // se borran entradas anteriores con otra extension y lo intermedio del archivo viejo
  for (const otra of files.EXT_PERMITIDAS) {
    if (otra !== ext) fs.rmSync(path.join(INPUT, plan, `${nombre}.${otra}`), {force: true});
  }
  for (const suf of SUFIJOS_PREPARACION) fs.rmSync(path.join(ROOT, 'public', `${nombre}${suf}`), {force: true});
  const estado = estadoMod.escribirEstado(INPUT, plan, nombre, {
    fase: 'subido',
    entrada: {archivo: `${nombre}.${ext}`, tipo: files.tipoDeEntrada(ext), bytes: guardado.bytes},
    estilo: null,
    sessionId: null,
    resumen: '',
    cambios: [],
    mensaje: 'Archivo subido',
    accion: null,
    error: null,
    trabajo: null,
  });
  return send(res, 200, {estado});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const esSubida = req.method === 'POST' && url.pathname.startsWith('/api/subidas/');
  if (!allowed(req, esSubida)) return send(res, 403, {error: 'No permitido'});
  const p = url.pathname;
  try {
    // ----- pagina -----
    if (req.method === 'GET' && (p === '/' || RE_ESTATICO.test(p))) {
      const nombre = p === '/' ? 'index.html' : p.slice(1);
      const archivo = path.join(PUBLIC, nombre);
      if (!fs.existsSync(archivo)) return send(res, 404, {error: 'No encontrado'});
      return send(res, 200, fs.readFileSync(archivo), TIPOS_ESTATICO[path.extname(nombre)] || 'application/octet-stream');
    }

    // ----- estado general -----
    if (req.method === 'GET' && p === '/api/estado') return send(res, 200, {...(await checkClaude()), ocupado: Boolean(gestor.activoPesado())});
    if (req.method === 'GET' && p === '/api/requisitos') return send(res, 200, revisarRequisitos());
    if (req.method === 'GET' && p === '/api/videos') return send(res, 200, listaListos());

    // ----- planes y guiones -----
    if (req.method === 'GET' && p === '/api/carpetas') return send(res, 200, lib.listFolders(INPUT));
    let m = /^\/api\/carpetas\/([^/]+)$/.exec(p);
    if (req.method === 'GET' && m) {
      const carpeta = carpetaConEstados(decodeURIComponent(m[1]));
      return carpeta ? send(res, 200, carpeta) : send(res, 404, {error: 'No encontrado'});
    }
    if (req.method === 'POST' && p === '/api/guiones') {
      const built = lib.buildRequest(await readJson(req));
      if (!built.ok) return send(res, 400, {error: built.error});
      const activo = gestor.activoPesado();
      if (activo) return send(res, 409, {error: 'Ya hay un trabajo en curso. Espera a que termine o cancélalo.', trabajo: activo.id});
      await generarGuiones(built.request);
      return send(res, 202, {request: built.request});
    }
    if (req.method === 'GET' && p === '/api/guiones/progreso') {
      const job = gestor.obtener(ultimoGuiones);
      if (!job) return send(res, 204, '');
      return job.suscribir(req, res);
    }

    // ----- trabajos -----
    if (req.method === 'GET' && p === '/api/trabajos') return send(res, 200, gestor.activos());
    m = /^\/api\/trabajos\/([A-Za-z0-9]+)\/progreso$/.exec(p);
    if (req.method === 'GET' && m) {
      const job = gestor.obtener(m[1]);
      return job ? job.suscribir(req, res) : send(res, 404, {error: 'No encontrado'});
    }
    if (req.method === 'POST' && p === '/api/cancelar') {
      const cuerpo = await readJson(req);
      const objetivo = gestor.obtener(cuerpo.trabajo);
      if (objetivo) objetivo.cancelar();
      else for (const t of gestor.trabajos.values()) if (t.corriendo) t.cancelar();
      return send(res, 200, {ok: true});
    }

    // ----- video: estado, archivos, subidas y acciones -----
    m = /^\/api\/video\/([^/]+)\/([^/]+)$/.exec(p);
    if (req.method === 'GET' && m) {
      const [plan, nombre] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])];
      if (!RE_PLAN.test(plan) || !RE_NOMBRE.test(nombre) || !fs.existsSync(path.join(INPUT, plan, `${nombre}.txt`))) return send(res, 404, {error: 'No encontrado'});
      const activo = gestor.activoDe(plan, nombre);
      return send(res, 200, {estado: estadoMod.leerEstado(INPUT, plan, nombre), log: estadoMod.leerLog(INPUT, plan, nombre, 200), archivos: archivosDe(plan, nombre), trabajo: activo ? activo.id : null});
    }
    m = /^\/api\/video\/([^/]+)\/([^/]+)\/(empezar|recomendar|cambios|aprobar|reintentar)$/.exec(p);
    if (req.method === 'POST' && m) {
      const [plan, nombre, accion] = [decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]];
      const cuerpo = await readJson(req);
      const r = accion === 'empezar' ? await flujo.empezar(plan, nombre, cuerpo.estilo)
        : accion === 'recomendar' ? await flujo.recomendar(plan, nombre)
        : accion === 'cambios' ? await flujo.cambios(plan, nombre, cuerpo.texto)
        : accion === 'aprobar' ? await flujo.aprobar(plan, nombre)
        : await flujo.reintentar(plan, nombre);
      if (!r.ok) return send(res, r.status || 400, {error: r.error, ...(r.trabajo ? {trabajo: r.trabajo} : {}), ...(r.faltantes ? {faltantes: r.faltantes} : {})});
      return r.trabajo ? send(res, 202, {trabajo: r.trabajo}) : send(res, 200, {estado: r.estado});
    }
    m = /^\/api\/subidas\/([^/]+)\/([^/]+)$/.exec(p);
    if (req.method === 'POST' && m) {
      const [plan, nombre] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])];
      if (!RE_PLAN.test(plan) || !RE_NOMBRE.test(nombre)) return send(res, 400, {error: 'Nombre no válido.'});
      return subir(req, res, plan, nombre, url);
    }
    m = /^\/api\/archivo\/([^/]+)\/([^/]+)\/(entrada|preview|video|caption)$/.exec(p);
    if (req.method === 'GET' && m) {
      const archivo = files.resolverArchivo(ROOT, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]);
      if (!archivo) return send(res, 404, {error: 'No encontrado'});
      return files.servirArchivo(req, res, archivo, {descargar: url.searchParams.get('descargar') === '1'});
    }
    return send(res, 404, {error: 'No encontrado'});
  } catch (err) {
    if (!res.headersSent) return send(res, 400, {error: String(err && err.message)});
    res.end();
  }
});

// Las subidas son archivos grandes: sin limite de tiempo por peticion (el tope es el tamano).
server.requestTimeout = 0;

const interrumpidos = estadoMod.marcarInterrumpidos(INPUT);

server.listen(PORT, HOST, () => {
  console.log(`\nWeb de guiones y edición lista: http://localhost:${PORT}\nPerfil de Claude: ${lib.detectClaudeConfig().profile}`);
  if (interrumpidos) console.log(`${interrumpidos} edición(es) se habían interrumpido: se pueden reintentar desde la web.`);
  const faltan = revisarRequisitos().filter((r) => !r.ok && REQ_PIPELINE.includes(r.id));
  if (faltan.length) console.log(`Faltan requisitos para editar video: ${faltan.map((f) => f.titulo).join(', ')} (la web lo explica).`);
  console.log('(Deja esta ventana abierta mientras la uses; ciérrala para apagar la web.)');
});
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `El puerto ${PORT} ya está en uso. ¿Ya tienes la web abierta?` : err.message);
  process.exit(1);
});
