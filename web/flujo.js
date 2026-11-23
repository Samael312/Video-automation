// Orquestador del flujo de video: une el estado por video, los trabajos, los prompts de Claude y el pipeline.
// Cada operacion valida, crea un trabajo y devuelve {ok, trabajo} (o {ok:false, status, error}); el trabajo corre en segundo plano
// y deja todo en <NOMBRE>.estado.json + SSE. Los procesos reales se pueden sustituir (opciones) para probarlo.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const estadoMod = require('./estado');
const files = require('./files');
const prompts = require('./prompts');
const lib = require('./lib');
const jobs = require('./jobs');

const MIN = 60 * 1000;
const REQ_PIPELINE = ['claude', 'venv', 'ffmpeg', 'ffprobe', 'deepfilter', 'node_modules']; // sin hf_token: la edicion ya no separa voces
const REQ_RENDER = ['claude', 'venv', 'ffmpeg', 'node_modules'];
const REQ_CLAUDE = ['claude'];

// Archivos intermedios de un video que dejan de valer si cambia el audio/video de entrada (solo estos nombres, nunca comodines).
const SUFIJOS_PREPARACION = ['.mp4', '.raw.wav', '.transcript.json', '.transcript.whisper.json', '.cuts.json', '.edit.json', '.matte.json', '.matte.webm'];
const EXT_ENTRADA = ['mov', 'mp4', 'm4v', 'm4a', 'mp3', 'wav', 'ogg', 'opus'];

const err = (status, error, extra = {}) => ({ok: false, status, error, ...extra});

/** Linea de registro para eventos de Claude que interesan al "Ver registro" (herramientas y errores de herramienta). */
function lineaDeEvento(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
    for (const p of ev.message.content) {
      if (p.type === 'tool_use') {
        const i = p.input || {};
        const detalle = String(i.command || i.file_path || i.path || i.pattern || '').replace(/\s+/g, ' ').slice(0, 160);
        return `> ${p.name}${detalle ? ` ${detalle}` : ''}`;
      }
    }
  }
  if (ev.type === 'user' && ev.message && Array.isArray(ev.message.content)) {
    for (const p of ev.message.content) {
      if (p.type === 'tool_result' && p.is_error) {
        const t = typeof p.content === 'string' ? p.content : Array.isArray(p.content) ? p.content.map((c) => c.text || '').join(' ') : '';
        return `! ${String(t).replace(/\s+/g, ' ').slice(0, 220)}`;
      }
    }
  }
  return null;
}

function crearFlujo(opts) {
  const {
    root,
    inputDir,
    gestor,
    env = () => process.env,
    transcriptorUrl = () => null, // url del transcriptor en memoria (web/transcriptor.js) o null
    claudeEnv = () => lib.claudeEnv(),
    resolveClaude = () => lib.resolveClaude(),
    correrComando = jobs.correrComando,
    correrClaude = jobs.correrClaude,
    faltantes = async () => [], // (ids) => [{id, titulo, arreglo}] de los requisitos que fallan
    uuid = () => crypto.randomUUID(),
    npm = 'npm',
    voces = require('./voces'), // {listarVoces(root, env), generarVoz({...})}
  } = opts;

  const pub = (f) => path.join(root, 'public', f);
  const preparado = (nombre) => fs.existsSync(pub(`${nombre}.cuts.json`)) && fs.existsSync(pub(`${nombre}.transcript.json`));
  const hayPreview = (plan, nombre) => Boolean(files.resolverArchivo(root, plan, nombre, 'preview'));
  const leer = (plan, nombre) => estadoMod.leerEstado(inputDir, plan, nombre);

  // ----- utilidades por trabajo -----
  function ctx(job, plan, nombre) {
    let ultimo = 0;
    let ultimoPorc = -1;
    return {
      estado(patch) {
        const e = estadoMod.escribirEstado(inputDir, plan, nombre, patch);
        job.emitir({type: 'estado', estado: e});
        return e;
      },
      log(linea) {
        estadoMod.agregarLog(inputDir, plan, nombre, linea);
      },
      progreso(mensaje, extra = {}) {
        job.emitir({type: 'progreso', mensaje, ...extra});
        const ahora = Date.now();
        if (ahora - ultimo > 1000) {
          ultimo = ahora;
          try {
            estadoMod.escribirEstado(inputDir, plan, nombre, {mensaje});
          } catch {
            /* un fallo al guardar el mensaje no debe tumbar el trabajo */
          }
        }
      },
      linea(l) {
        const p = prompts.parseLineaPipeline(l);
        if (!p) {
          if (l.trim()) this.log(l.trim().slice(0, 300));
          return;
        }
        if (p.tipo === 'render') {
          if (p.porcentaje === ultimoPorc) return;
          ultimoPorc = p.porcentaje;
          this.progreso(p.texto, {porcentaje: p.porcentaje});
          if (p.porcentaje % 25 === 0) this.log(p.texto);
          return;
        }
        this.log(p.texto);
        this.progreso(p.texto, p.tipo === 'paso' ? {paso: p.texto} : {});
      },
      fin(ok, extra = {}) {
        job.emitir({type: 'fin', ok, ...extra});
      },
    };
  }

  /** Lanza `claude` headless. Devuelve {run, salida} o {falta: texto} si no esta instalado. */
  async function ejecutarClaude(job, c, args, prompt) {
    const r = resolveClaude();
    if (!r) return {falta: 'Claude Code no está instalado en este PC (no encuentro claude).'};
    const run = await correrClaude(job, [...r.prefijo, ...args], prompt, {
      cwd: root,
      env: claudeEnv(),
      comando: r.cmd,
      shell: false,
      timeoutMs: 30 * MIN,
      onEvento: (ev) => {
        const m = lib.progressMessage(ev);
        if (m) c.progreso(m);
        const l = lineaDeEvento(ev);
        if (l) c.log(l);
      },
    });
    return {run, salida: prompts.parseSalidaClaude(run.result)};
  }

  /** Traduce el resultado de claude a un parche de estado: {ok:true} | {ok:false, patch}. */
  function evaluar(run, salida, c) {
    for (const d of salida.denegaciones) c.log(`Permiso denegado: ${d.herramienta} ${d.detalle}`.trim());
    if (!run.result) return {ok: false, patch: {fase: 'error', error: prompts.traducirError(run.stderr || 'Claude no respondió.'), accion: null}};
    if (run.result.is_error) return {ok: false, patch: {fase: 'error', error: prompts.traducirError(run.result.result || run.stderr), accion: null}};
    if (salida.accion) return {ok: false, patch: {fase: 'necesita_accion', accion: salida.accion, error: null}};
    return {ok: true};
  }

  async function revisar(plan, nombre, c, run, salida, sessionId, extra = {}) {
    const ev = evaluar(run, salida, c);
    if (!ev.ok) return c.estado({...ev.patch, trabajo: null});
    if (!hayPreview(plan, nombre)) {
      const den = salida.denegaciones.length ? ` Claude no tuvo permiso para: ${salida.denegaciones.map((d) => `${d.herramienta} ${d.detalle}`.trim()).join('; ')}.` : '';
      return c.estado({fase: 'error', error: `Claude terminó sin generar el preview.${den} Revisa el registro y reintenta.`, accion: null, trabajo: null});
    }
    return c.estado({fase: 'revision', resumen: salida.resumen || salida.texto.slice(0, 1500), sessionId: (run.result && run.result.session_id) || sessionId, accion: null, error: null, mensaje: 'Listo para revisar', trabajo: null, ...extra});
  }

  // ----- validaciones comunes -----
  async function previo(plan, nombre, {pesado = true, req = REQ_CLAUDE, fases = null, validar = null} = {}) {
    if (!estadoMod.PLAN_SEGURO.test(plan) || !estadoMod.NOMBRE_SEGURO.test(nombre)) return err(400, 'Nombre no válido.');
    if (!estadoMod.existeVideo(inputDir, plan, nombre)) return err(404, 'No encuentro ese guion.');
    const e = leer(plan, nombre);
    if (estadoMod.EN_CURSO.includes(e.fase) && gestor.activoDe(plan, nombre)) return err(409, 'Este video ya se está editando.', {trabajo: gestor.activoDe(plan, nombre).id});
    if (pesado) {
      const activo = gestor.activoPesado();
      if (activo) return err(409, 'Ya hay un trabajo en curso. Espera a que termine o cancélalo.', {trabajo: activo.id});
    }
    if (fases && !fases.includes(e.fase)) return err(400, `Ahora mismo este video está en "${e.fase}"; no se puede hacer eso.`);
    const mal = validar ? validar(e) : null;
    if (mal) return mal;
    const f = await faltantes(req);
    if (f.length) return err(400, `Faltan requisitos en este PC: ${f.map((x) => x.titulo).join(', ')}.`, {faltantes: f});
    return {ok: true, estado: e};
  }

  function lanzar(tipo, plan, nombre, pesado, fn, faseSiCancela) {
    const faseCancela = () => (typeof faseSiCancela === 'function' ? faseSiCancela() : faseSiCancela);
    const job = gestor.crear({tipo, plan, nombre, pesado});
    const c = ctx(job, plan, nombre);
    (async () => {
      try {
        await fn(job, c);
      } catch (e) {
        c.log(`Error interno: ${String(e && e.message)}`);
        try {
          c.estado({fase: 'error', error: prompts.traducirError(String(e && e.message)), trabajo: null});
        } catch {
          /* sin estado que guardar */
        }
      }
      if (job.cancelado) {
        try {
          c.estado({fase: faseCancela(), mensaje: 'Cancelado', trabajo: null});
        } catch {
          /* ignorado */
        }
        c.fin(false, {cancelado: true});
      } else {
        const e = leer(plan, nombre);
        c.fin(!['error', 'necesita_accion'].includes(e.fase), e.fase === 'error' ? {error: e.error} : {});
      }
      job.terminar();
    })();
    return {ok: true, trabajo: job.id};
  }

  const comandoNpm = (job, args, c, ms, extraEnv = {}) =>
    correrComando(job, npm, args, {cwd: root, env: {...env(), ...extraEnv}, timeoutMs: ms, onLine: (l) => c.linea(l)});

  /** Paso 1 determinista: normaliza, limpia voz, transcribe y corta. Devuelve true si salio bien. */
  async function preparar(job, c, plan, nombre, estado) {
    if (preparado(nombre)) {
      c.log('Preparación ya hecha: se reutiliza.');
      return true;
    }
    c.estado({fase: 'preparando', mensaje: 'Preparando el audio…', trabajo: job.id, error: null, accion: null});
    c.progreso('Preparando el audio y transcribiendo (puede tardar varios minutos)…');
    const rel = `media/input/${plan}/${estado.entrada.archivo}`;
    const tUrl = transcriptorUrl();
    const r = await comandoNpm(job, ['run', 'edit', '--', rel, '--plan-only'], c, 90 * MIN, tUrl ? {TRANSCRIBIR_URL: tUrl} : {});
    if (job.cancelado) return false;
    if (r.code !== 0 || !preparado(nombre)) {
      c.estado({fase: 'error', error: prompts.traducirError(r.cola.join('\n')), trabajo: null});
      return false;
    }
    return true;
  }

  // ----- operaciones -----
  async function empezar(plan, nombre, estilo) {
    const validar = (e) => {
      if (!e.entrada) return err(400, 'Primero sube el audio o el video.');
      if (!prompts.estiloParaEntrada(e.entrada.tipo).includes(estilo)) return err(400, e.entrada.tipo === 'audio' ? 'Una nota de voz solo se edita con el estilo "voz".' : 'Ese estilo no sirve para un video con cámara.');
      return null;
    };
    const p = await previo(plan, nombre, {req: REQ_PIPELINE, fases: ['subido', 'error', 'necesita_accion', 'interrumpido', 'revision', 'listo'], validar});
    if (!p.ok) return p;
    const e = p.estado;
    return lanzar('empezar', plan, nombre, true, (job, c) => cuerpoEmpezar(job, c, plan, nombre, e, estilo), 'subido');
  }

  /** Cuerpo comun de "empezar": prepara el audio/video y deja a Claude armar el plan hasta el preview. */
  async function cuerpoEmpezar(job, c, plan, nombre, e, estilo) {
    c.estado({estilo, error: null, accion: null, resumen: '', trabajo: job.id});
    if (!(await preparar(job, c, plan, nombre, e))) return;
    c.estado({fase: 'planificando', mensaje: 'Claude está armando el plan de edición…', trabajo: job.id});
    c.progreso('Claude está armando el plan de edición…');
    const sessionId = uuid();
    const prompt = prompts.promptPlanificar({plan, nombre, archivo: e.entrada.archivo, estilo});
    const r = await ejecutarClaude(job, c, prompts.argsClaude({sessionId}), prompt);
    if (job.cancelado) return;
    if (r.falta) return c.estado({fase: 'error', error: r.falta, trabajo: null});
    await revisar(plan, nombre, c, r.run, r.salida, sessionId);
  }

  /** Video desde un guion: genera la voz (ElevenLabs), la guarda como entrada de audio y sigue como "empezar" con estilo voice. */
  async function empezarDesdeGuion(plan, nombre, voz) {
    if (voz === 'profe') return err(409, 'La voz de la profe todavía no está lista.');
    if (voz !== 'laura') return err(400, 'Voz no válida.');
    const p = await previo(plan, nombre, {req: REQ_PIPELINE, fases: ['sin_grabar', 'subido', 'error', 'necesita_accion', 'interrumpido', 'revision', 'listo']});
    if (!p.ok) return p;
    const disp = voces.listarVoces(root, env()).find((v) => v.id === voz);
    if (!disp || !disp.disponible) return err(400, (disp && disp.motivo) || 'Esa voz no está disponible.');
    let texto;
    try {
      texto = fs.readFileSync(path.join(inputDir, plan, `${nombre}.txt`), 'utf8').trim();
    } catch {
      return err(404, 'No encuentro ese guion.');
    }
    if (!texto) return err(400, 'El guion está vacío.');
    if (texto.length > voces.MAX_CHARS) return err(400, `El guion es demasiado largo para la voz (máximo ${voces.MAX_CHARS} caracteres).`);
    const e = p.estado;
    const dir = path.join(inputDir, plan);
    let tocado = false; // true cuando ya se reemplazo la entrada anterior
    return lanzar('empezar', plan, nombre, true, async (job, c) => {
      c.estado({fase: 'preparando', mensaje: 'Generando la voz…', trabajo: job.id, error: null, accion: null, estilo: 'voice', resumen: ''});
      c.progreso('Generando la voz con ElevenLabs…');
      const tmp = path.join(dir, `${nombre}.voz-nueva.mp3`);
      let g;
      try {
        g = await voces.generarVoz({root, voz, texto, destino: tmp, env: env()});
      } catch (x) {
        fs.rmSync(tmp, {force: true});
        c.log(`Voz: ${String(x && x.message).slice(0, 300)}`);
        return c.estado({fase: 'error', error: `No se pudo generar la voz. ${String(x && x.message).slice(0, 250)}`, trabajo: null});
      }
      if (job.cancelado) {
        fs.rmSync(tmp, {force: true});
        return;
      }
      // el audio nuevo reemplaza la entrada anterior y lo intermedio del video viejo
      for (const ext of EXT_ENTRADA) fs.rmSync(path.join(dir, `${nombre}.${ext}`), {force: true});
      fs.renameSync(tmp, path.join(dir, `${nombre}.mp3`));
      for (const suf of SUFIJOS_PREPARACION) fs.rmSync(pub(`${nombre}${suf}`), {force: true});
      tocado = true;
      const nuevo = c.estado({entrada: {archivo: `${nombre}.mp3`, tipo: 'audio', bytes: g.bytes}, estilo: 'voice', sessionId: null, cambios: [], resumen: ''});
      c.log('Voz generada y guardada como entrada de audio.');
      await cuerpoEmpezar(job, c, plan, nombre, nuevo, 'voice');
    }, () => (tocado ? 'subido' : e.fase));
  }

  async function cambios(plan, nombre, texto) {
    let limpio;
    try {
      limpio = String(texto == null ? '' : texto).trim();
      if (!limpio) return err(400, 'Escribe qué quieres cambiar.');
      if (limpio.length > prompts.MAX_CAMBIOS) return err(400, `Los cambios son muy largos (máximo ${prompts.MAX_CAMBIOS} caracteres).`);
    } catch {
      return err(400, 'Texto no válido.');
    }
    const p = await previo(plan, nombre, {req: REQ_CLAUDE, fases: ['revision', 'listo', 'error', 'necesita_accion']});
    if (!p.ok) return p;
    if (!fs.existsSync(pub(`${nombre}.edit.json`))) return err(400, 'Todavía no hay un plan de edición: usa "Empezar edición".');
    const e = p.estado;
    return lanzar('cambios', plan, nombre, true, async (job, c) => {
      c.estado({fase: 'planificando', mensaje: 'Aplicando tus cambios…', trabajo: job.id, error: null, accion: null, cambios: [...e.cambios, {texto: limpio, en: new Date().toISOString()}]});
      c.progreso('Aplicando tus cambios…');
      let sessionId = e.sessionId;
      let r = sessionId
        ? await ejecutarClaude(job, c, prompts.argsClaude({resume: sessionId}), prompts.promptCambios({nombre, texto: limpio}))
        : null;
      // si no se pudo retomar la sesion anterior, se empieza una nueva con el plan guardado en disco
      const sinSesion = !r || (r.run && (!r.run.result || r.run.result.is_error) && /conversation|session/i.test(String((r.run.result && r.run.result.result) || r.run.stderr)));
      if (sinSesion && !job.cancelado) {
        if (r) c.log('No se pudo retomar la sesión anterior: se continúa con el plan guardado.');
        sessionId = uuid();
        r = await ejecutarClaude(job, c, prompts.argsClaude({sessionId}), prompts.promptCambiosSinSesion({nombre, texto: limpio}));
      }
      if (job.cancelado) return;
      if (r.falta) return c.estado({fase: 'error', error: r.falta, trabajo: null});
      await revisar(plan, nombre, c, r.run, r.salida, sessionId);
    }, 'revision');
  }

  async function aprobar(plan, nombre) {
    const p = await previo(plan, nombre, {req: REQ_RENDER, fases: ['revision', 'error', 'interrumpido']});
    if (!p.ok) return p;
    if (!fs.existsSync(pub(`${nombre}.edit.json`))) return err(400, 'Todavía no hay un plan de edición para renderizar.');
    return lanzar('render', plan, nombre, true, async (job, c) => {
      c.estado({fase: 'renderizando', mensaje: 'Renderizando el video…', trabajo: job.id, error: null, accion: null});
      c.progreso('Renderizando el video (puede tardar varios minutos)…');
      const r = await comandoNpm(job, ['run', 'render:plan', '--', nombre], c, 90 * MIN);
      if (job.cancelado) return;
      if (r.code !== 0 || !files.resolverArchivo(root, plan, nombre, 'video')) {
        return c.estado({fase: 'error', error: prompts.traducirError(r.cola.join('\n')) || 'El render no produjo el video.', trabajo: null});
      }
      c.estado({mensaje: 'Escribiendo el caption…', trabajo: job.id});
      c.progreso('Escribiendo el caption…');
      const sessionId = uuid();
      const k = await ejecutarClaude(job, c, prompts.argsClaude({sessionId}), prompts.promptCaption({plan, nombre}));
      if (job.cancelado) return;
      const hayCaption = Boolean(files.resolverArchivo(root, plan, nombre, 'caption'));
      if (k.falta || !hayCaption) {
        c.log(k.falta || 'No se escribió el caption.');
        return c.estado({fase: 'listo', mensaje: 'Video listo, pero no se pudo escribir el caption.', accion: null, error: null, trabajo: null});
      }
      c.estado({fase: 'listo', mensaje: 'Video listo', accion: null, error: null, trabajo: null});
    }, 'revision');
  }

  async function recomendar(plan, nombre) {
    const validar = (e) => (e.entrada ? null : err(400, 'Primero sube el audio o el video.'));
    const prev = await previo(plan, nombre, {pesado: false, req: REQ_PIPELINE, fases: ['subido', 'error', 'necesita_accion', 'interrumpido', 'revision', 'listo'], validar});
    if (!prev.ok) return prev;
    const e = prev.estado;
    // si hay que preparar (pesado) se respeta el candado
    const necesitaPrep = !preparado(nombre);
    if (necesitaPrep && gestor.activoPesado()) return err(409, 'Ya hay un trabajo en curso. Espera a que termine o cancélalo.', {trabajo: gestor.activoPesado().id});
    return lanzar('recomendar', plan, nombre, necesitaPrep, async (job, c) => {
      if (necesitaPrep && !(await preparar(job, c, plan, nombre, e))) return;
      c.estado({fase: e.fase === 'error' || e.fase === 'interrumpido' ? 'subido' : e.fase, mensaje: 'Claude está mirando el video…', trabajo: job.id, error: null});
      c.progreso('Claude está mirando el video para recomendar un estilo…');
      const r = await ejecutarClaude(job, c, prompts.argsClaude({sessionId: uuid(), solo_lectura: true}), prompts.promptRecomendar({plan, nombre, archivo: e.entrada.archivo}));
      if (job.cancelado) return;
      if (r.falta) return c.estado({fase: 'error', error: r.falta, trabajo: null});
      const ev = evaluar(r.run, r.salida, c);
      if (!ev.ok) return c.estado({...ev.patch, trabajo: null});
      const m = /^\s*(captions|motion|mixed|voice)\s*\|?\s*(.*)$/i.exec(r.salida.recomendacion || '');
      const permitidos = prompts.estiloParaEntrada(e.entrada.tipo);
      if (!m || !permitidos.includes(m[1].toLowerCase())) return c.estado({fase: 'subido', error: 'Claude no pudo recomendar un estilo. Elígelo tú.', trabajo: null});
      c.estado({fase: 'subido', mensaje: 'Recomendación lista', trabajo: null, error: null});
      job.emitir({type: 'recomendacion', estilo: m[1].toLowerCase(), texto: m[2].trim()});
    }, 'subido');
  }

  /** Vuelve a intentar: tras una interrupcion con preview vuelve a revision; si no, rehace el plan con el estilo guardado. */
  async function reintentar(plan, nombre) {
    if (!estadoMod.PLAN_SEGURO.test(plan) || !estadoMod.NOMBRE_SEGURO.test(nombre)) return err(400, 'Nombre no válido.');
    const e = leer(plan, nombre);
    if (!['error', 'necesita_accion', 'interrumpido'].includes(e.fase)) return err(400, 'No hay nada que reintentar.');
    if (hayPreview(plan, nombre) && fs.existsSync(pub(`${nombre}.edit.json`))) {
      const nuevo = estadoMod.escribirEstado(inputDir, plan, nombre, {fase: 'revision', error: null, accion: null, mensaje: 'Listo para revisar', trabajo: null});
      return {ok: true, estado: nuevo};
    }
    if (!e.entrada) return err(400, 'Primero sube el audio o el video.');
    if (!e.estilo) return err(400, 'Elige un estilo de edición primero.');
    return empezar(plan, nombre, e.estilo);
  }

  return {empezar, empezarDesdeGuion, cambios, aprobar, recomendar, reintentar, preparado};
}

module.exports = {crearFlujo, SUFIJOS_PREPARACION, EXT_ENTRADA, lineaDeEvento, REQ_PIPELINE, REQ_RENDER, REQ_CLAUDE};
