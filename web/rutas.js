// Rutas de la API de la web (contrato: docs/WEB_API.md). crearRutas(deps) -> {manejar(req, res)}.
// La tabla se recorre en orden y gana la primera que coincide en metodo y patron; si ninguna, 404.
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const estadoMod = require('./estado');
const files = require('./files');
const prompts = require('./prompts');
const jobs = require('./jobs');
const {SUFIJOS_PREPARACION} = require('./flujo');
const {send, readJson, allowed, servirEstatico} = require('./http');

const RE_PLAN = /^[A-Za-z0-9_-]{1,80}$/;
const RE_NOMBRE = /^[A-Za-z0-9_-]{1,120}$/;
const ARGS_GUIONES = ['-p', '--model', 'opus', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep', '--disallowedTools', prompts.DENEGADAS.join(',')];
const ACCIONES_VIDEO = ['empezar', 'recomendar', 'cambios', 'aprobar', 'reintentar'];

/**
 * deps: {root, inputDir, publicDir, host, port, gestor, flujo, trabajosGuion, revisarRequisitos, checkClaude, voces}.
 * OJO: aqui `port` es una FUNCION que devuelve el puerto real (crearServidor la arma a partir del numero).
 */
function crearRutas(deps) {
  const {root: ROOT, inputDir: INPUT, publicDir, gestor, flujo, trabajosGuion, revisarRequisitos, checkClaude, voces} = deps;
  let ultimoGuiones = null; // id del ultimo trabajo de guiones (para GET /api/guiones/progreso)

  /** Responde con el resultado de una operacion de flujo: 202 {trabajo} | 200 {estado} | error. */
  const responder = (res, r) => {
    if (!r.ok) return send(res, r.status || 400, {error: r.error, ...(r.trabajo ? {trabajo: r.trabajo} : {}), ...(r.faltantes ? {faltantes: r.faltantes} : {})});
    return r.trabajo ? send(res, 202, {trabajo: r.trabajo}) : send(res, 200, {estado: r.estado});
  };

  // ---------- generar guiones ----------
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

  // ---------- datos ----------
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

  /** Videos listos: los del flujo web (estado `listo`) + todo lo que haya en media/output/edited. */
  function listaListos() {
    const out = [];
    const vistos = new Set();
    for (const v of estadoMod.listarListos(INPUT)) {
      const carpeta = lib.getFolder(INPUT, v.plan);
      const g = carpeta && carpeta.guiones.find((x) => x.nombre === v.nombre);
      vistos.add(v.nombre);
      out.push({plan: v.plan, nombre: v.nombre, titulo: (g && g.info && g.info.gancho) || v.nombre, actualizado: v.actualizado});
    }
    // videos editados que no están en `listo` (hechos fuera de la web o con cambios en curso):
    // su plan es el que tenga su estado o su guion; si no hay, VIDEOS_PROFE (al abrirlo se le crea el estado)
    for (const e of files.listarEditados(ROOT)) {
      if (vistos.has(e.nombre)) continue;
      const plan = estadoMod.planDeVideo(INPUT, e.nombre) || 'VIDEOS_PROFE';
      out.push({plan, nombre: e.nombre, titulo: e.nombre, actualizado: e.actualizado});
    }
    return out.sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
  }

  /** POST /api/subidas/<PLAN>/<NOMBRE>?ext=m4a (cuerpo binario). */
  async function subir(req, res, plan, nombre, url) {
    const ext = String(url.searchParams.get('ext') || '').toLowerCase().replace(/^\./, '');
    const bytes = Number(req.headers['content-length']);
    const v = files.validarSubida({ext, bytes: Number.isFinite(bytes) ? bytes : undefined});
    if (!v.ok) return send(res, 400, {error: v.error});
    if (!estadoMod.existeVideo(INPUT, plan, nombre)) return send(res, 404, {error: 'No encuentro ese guion.'});
    const actual = estadoMod.leerEstado(INPUT, plan, nombre);
    if (estadoMod.esSinGuion(plan)) {
      const tipo = estadoMod.CARPETAS_SIN_GUION[plan];
      if (files.tipoDeEntrada(ext) !== tipo) return send(res, 400, {error: tipo === 'video' ? 'Aquí va un video (mov, mp4 o m4v).' : 'Aquí va un audio (m4a, mp3, wav, ogg u opus).'});
      if (actual.fase === 'sin_grabar' && estadoMod.nombreOcupado(INPUT, path.join(ROOT, 'media', 'output', 'edited'), nombre)) return send(res, 409, {error: 'Ya hay un video con ese nombre. Elige otro nombre.'});
    }
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

  // ---------- tabla ----------
  // fn(req, res, params[], url): params ya decodificados (decodeURIComponent).
  const G = 'GET';
  const P = 'POST';
  const rutas = [
    // estado general
    [G, /^\/api\/estado$/, async (req, res) => send(res, 200, {...(await checkClaude()), ocupado: Boolean(gestor.activoPesado())})],
    [G, /^\/api\/requisitos$/, (req, res) => send(res, 200, revisarRequisitos())],
    [G, /^\/api\/videos$/, (req, res) => send(res, 200, listaListos())],

    // planes y guiones
    [G, /^\/api\/carpetas$/, (req, res) => send(res, 200, lib.listFolders(INPUT))],
    [G, /^\/api\/carpetas\/([^/]+)$/, (req, res, [plan]) => {
      const carpeta = carpetaConEstados(plan);
      return carpeta ? send(res, 200, carpeta) : send(res, 404, {error: 'No encontrado'});
    }],
    [P, /^\/api\/guiones$/, async (req, res) => {
      const built = lib.buildRequest(await readJson(req));
      if (!built.ok) return send(res, 400, {error: built.error});
      const activo = gestor.activoPesado();
      if (activo) return send(res, 409, {error: 'Ya hay un trabajo en curso. Espera a que termine o cancélalo.', trabajo: activo.id});
      await generarGuiones(built.request);
      return send(res, 202, {request: built.request});
    }],
    [P, /^\/api\/guiones\/([^/]+)$/, async (req, res, [plan]) => {
      if (plan === 'progreso') return send(res, 404, {error: 'No encontrado'});
      return responder(res, await trabajosGuion.masGuiones(plan, await readJson(req)));
    }],
    [P, /^\/api\/guiones\/([^/]+)\/([^/]+)\/cambios$/, async (req, res, [plan, nombre]) => responder(res, await trabajosGuion.cambiosGuion(plan, nombre, (await readJson(req)).texto))],
    [G, /^\/api\/voces$/, (req, res) => send(res, 200, voces.listarVoces(ROOT))],
    [P, /^\/api\/video-desde-guion\/([^/]+)\/([^/]+)\/empezar$/, async (req, res, [plan, nombre]) => responder(res, await flujo.empezarDesdeGuion(plan, nombre, (await readJson(req)).voz))],
    [G, /^\/api\/guiones\/progreso$/, (req, res) => {
      const job = gestor.obtener(ultimoGuiones);
      return job ? job.suscribir(req, res) : send(res, 204, '');
    }],

    // trabajos
    [G, /^\/api\/trabajos$/, (req, res) => send(res, 200, gestor.activos())],
    [G, /^\/api\/trabajos\/([A-Za-z0-9]+)\/progreso$/, (req, res, [id]) => {
      const job = gestor.obtener(id);
      return job ? job.suscribir(req, res) : send(res, 404, {error: 'No encontrado'});
    }],
    [P, /^\/api\/cancelar$/, async (req, res) => {
      const objetivo = gestor.obtener((await readJson(req)).trabajo);
      if (objetivo) objetivo.cancelar();
      else for (const t of gestor.trabajos.values()) if (t.corriendo) t.cancelar();
      return send(res, 200, {ok: true});
    }],

    // video: estado, acciones, subidas y archivos
    [G, /^\/api\/video\/([^/]+)\/([^/]+)$/, (req, res, [plan, nombre]) => {
      if (!RE_PLAN.test(plan) || !RE_NOMBRE.test(nombre) || !estadoMod.existeVideo(INPUT, plan, nombre)) return send(res, 404, {error: 'No encontrado'});
      const activo = gestor.activoDe(plan, nombre);
      // video ya editado sin estado (hecho fuera de la web): queda `listo` para poder pedirle cambios
      if (!activo) estadoMod.adoptarEditado(INPUT, ROOT, plan, nombre);
      return send(res, 200, {estado: estadoMod.leerEstado(INPUT, plan, nombre), log: estadoMod.leerLog(INPUT, plan, nombre, 200), archivos: archivosDe(plan, nombre), trabajo: activo ? activo.id : null});
    }],
    [P, new RegExp(`^\\/api\\/video\\/([^/]+)\\/([^/]+)\\/(${ACCIONES_VIDEO.join('|')})$`), async (req, res, [plan, nombre, accion]) => {
      const cuerpo = await readJson(req);
      const r = accion === 'empezar' ? await flujo.empezar(plan, nombre, cuerpo.estilo)
        : accion === 'recomendar' ? await flujo.recomendar(plan, nombre)
        : accion === 'cambios' ? await flujo.cambios(plan, nombre, cuerpo.texto)
        : accion === 'aprobar' ? await flujo.aprobar(plan, nombre)
        : await flujo.reintentar(plan, nombre);
      return responder(res, r);
    }],
    [P, /^\/api\/subidas\/([^/]+)\/([^/]+)$/, (req, res, [plan, nombre], url) => {
      if (!RE_PLAN.test(plan) || !RE_NOMBRE.test(nombre)) return send(res, 400, {error: 'Nombre no válido.'});
      return subir(req, res, plan, nombre, url);
    }],
    [G, /^\/api\/archivo\/([^/]+)\/([^/]+)\/(entrada|preview|video|caption)$/, (req, res, [plan, nombre, tipo], url) => {
      const archivo = files.resolverArchivo(ROOT, plan, nombre, tipo);
      if (!archivo) return send(res, 404, {error: 'No encontrado'});
      return files.servirArchivo(req, res, archivo, {descargar: url.searchParams.get('descargar') === '1'});
    }],
  ];

  async function manejar(req, res) {
    const host = deps.host;
    const port = deps.port();
    const url = new URL(req.url, `http://${host}:${port}`);
    const esSubida = req.method === 'POST' && url.pathname.startsWith('/api/subidas/');
    if (!allowed(req, esSubida, {host, port})) return send(res, 403, {error: 'No permitido'});
    const p = url.pathname;
    try {
      if (servirEstatico(req, res, publicDir, p)) return;
      for (const [metodo, patron, fn] of rutas) {
        if (req.method !== metodo) continue;
        const m = patron.exec(p);
        if (m) return await fn(req, res, m.slice(1).map((x) => decodeURIComponent(x)), url);
      }
      return send(res, 404, {error: 'No encontrado'});
    } catch (err) {
      if (!res.headersSent) return send(res, 400, {error: String(err && err.message)});
      res.end();
    }
  }

  return {manejar};
}

module.exports = {crearRutas, RE_PLAN, RE_NOMBRE};
