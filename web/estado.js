// Estado por video (media/input/<PLAN>/<NOMBRE>.estado.json) y su log. Sin red ni procesos: se prueba en web/estado.test.ts
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FASES = ['sin_grabar', 'subido', 'preparando', 'planificando', 'revision', 'renderizando', 'listo', 'error', 'necesita_accion', 'interrumpido'];
const EN_CURSO = ['preparando', 'planificando', 'renderizando'];
const ESTILOS = ['captions', 'motion', 'mixed', 'voice'];
const EXT_ENTRADA = ['mov', 'mp4', 'm4v', 'm4a', 'mp3', 'wav', 'ogg', 'opus'];
const EXT_AUDIO = ['m4a', 'mp3', 'wav', 'ogg', 'opus'];
const NOMBRE_SEGURO = /^[A-Za-z0-9_-]{1,120}$/;
const PLAN_SEGURO = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_LOG = 400;
const MAX_CAMBIOS = 50;
const SUFIJO = '.estado.json';

// Carpetas de media/input para videos/audios subidos sin guion (secciones Editar video y Audio a video).
const CARPETAS_SIN_GUION = {VIDEOS_PROFE: 'video', AUDIOS_PROFE: 'audio'};
const esSinGuion = (plan) => Object.prototype.hasOwnProperty.call(CARPETAS_SIN_GUION, plan);

/** Un video existe si tiene guion, o si vive en una carpeta sin guion. */
function existeVideo(inputDir, plan, nombre) {
  if (!planSeguro(plan) || !nombreSeguro(nombre)) return false;
  return esSinGuion(plan) || fs.existsSync(path.join(inputDir, plan, `${nombre}.txt`));
}

/** Para subidas nuevas sin guion: ¿ya hay otro video con ese nombre (en otro plan o ya editado)? */
function nombreOcupado(inputDir, editedDir, nombre) {
  if (fs.existsSync(path.join(editedDir, nombre))) return true;
  for (const p of planes(inputDir)) {
    const dir = path.join(inputDir, p);
    if (fs.existsSync(path.join(dir, `${nombre}.txt`)) || fs.existsSync(path.join(dir, `${nombre}${SUFIJO}`))) return true;
  }
  return false;
}

const planSeguro = (x) => typeof x === 'string' && PLAN_SEGURO.test(x);
const nombreSeguro = (x) => typeof x === 'string' && NOMBRE_SEGURO.test(x);
const esObjeto = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const texto = (x, max = 2000) => (typeof x === 'string' ? x.slice(0, max) : '');
const textoONull = (x, max = 2000) => (typeof x === 'string' && x.trim() ? x.slice(0, max) : null);

/** Ruta del archivo de estado; null si plan o nombre no son seguros. */
function estadoPath(inputDir, plan, nombre) {
  if (!planSeguro(plan) || !nombreSeguro(nombre)) return null;
  return path.join(inputDir, plan, `${nombre}${SUFIJO}`);
}

function logPath(inputDir, plan, nombre) {
  if (!planSeguro(plan) || !nombreSeguro(nombre)) return null;
  return path.join(inputDir, plan, `${nombre}.log`);
}

/** ¿Hay un archivo de entrada <nombre>.<ext permitida> en la carpeta del plan? */
function hayEntrada(inputDir, plan, nombre) {
  return EXT_ENTRADA.some((ext) => {
    try {
      return fs.statSync(path.join(inputDir, plan, `${nombre}.${ext}`)).isFile();
    } catch {
      return false;
    }
  });
}

function fechaValida(x) {
  return typeof x === 'string' && x.length <= 40 && !Number.isNaN(Date.parse(x)) ? x : '';
}

/** Limpia un estado (leído de disco o mezclado con un parche): nunca lanza, conserva lo válido. */
function sanear(raw, plan, nombre, faseDefecto) {
  const r = esObjeto(raw) ? raw : {};
  const entradaRaw = esObjeto(r.entrada) ? r.entrada : null;
  let entrada = null;
  if (entradaRaw && typeof entradaRaw.archivo === 'string' && entradaRaw.archivo) {
    entrada = {
      archivo: entradaRaw.archivo.slice(0, 200),
      tipo: entradaRaw.tipo === 'audio' ? 'audio' : 'video',
      bytes: Number.isFinite(entradaRaw.bytes) && entradaRaw.bytes >= 0 ? entradaRaw.bytes : 0,
    };
  }
  let estilo = ESTILOS.includes(r.estilo) ? r.estilo : null;
  if (entrada && entrada.tipo === 'audio' && estilo) estilo = 'voice';
  const cambios = (Array.isArray(r.cambios) ? r.cambios : [])
    .filter((c) => esObjeto(c) && typeof c.texto === 'string' && c.texto.trim())
    .map((c) => ({texto: c.texto.slice(0, 1500), en: fechaValida(c.en)}))
    .slice(-MAX_CAMBIOS);
  const trabajo = typeof r.trabajo === 'string' && r.trabajo ? r.trabajo.slice(0, 100) : null;
  return {
    version: 1,
    plan,
    nombre,
    fase: FASES.includes(r.fase) ? r.fase : faseDefecto,
    estilo,
    entrada,
    sessionId: textoONull(r.sessionId, 100),
    resumen: texto(r.resumen),
    cambios,
    mensaje: texto(r.mensaje, 500),
    accion: textoONull(r.accion),
    error: textoONull(r.error),
    trabajo,
    actualizado: fechaValida(r.actualizado),
  };
}

/** Lee el estado saneado (con valores por defecto si falta o está dañado). null si plan/nombre son inseguros. */
function leerEstado(inputDir, plan, nombre) {
  const file = estadoPath(inputDir, plan, nombre);
  if (!file) return null;
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    raw = null;
  }
  const defecto = hayEntrada(inputDir, plan, nombre) ? 'subido' : 'sin_grabar';
  return sanear(raw, plan, nombre, defecto);
}

/** Escribe un archivo de forma atómica: temporal en la misma carpeta y rename. */
function escribirAtomico(file, contenido) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, contenido);
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      fs.rmSync(tmp, {force: true});
    } catch {
      /* ya no está */
    }
    throw err;
  }
}

/** Mezcla `patch` con el estado actual, valida la fase, escribe atómicamente y devuelve el estado nuevo. */
function escribirEstado(inputDir, plan, nombre, patch) {
  const file = estadoPath(inputDir, plan, nombre);
  if (!file) throw new Error('Nombre de plan o de video no válido.');
  const p = esObjeto(patch) ? patch : {};
  if (p.fase !== undefined && !FASES.includes(p.fase)) throw new Error(`Fase no válida: ${String(p.fase).slice(0, 40)}`);
  const actual = leerEstado(inputDir, plan, nombre);
  const nuevo = sanear({...actual, ...p, actualizado: new Date().toISOString()}, plan, nombre, actual.fase);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  escribirAtomico(file, `${JSON.stringify(nuevo, null, 2)}\n`);
  return nuevo;
}

/** Plan de un video por su nombre: primero el que tiene su estado, luego el que tiene su guion; si no, null. */
function planDeVideo(inputDir, nombre) {
  if (!nombreSeguro(nombre)) return null;
  const todos = planes(inputDir);
  return todos.find((p) => fs.existsSync(path.join(inputDir, p, `${nombre}${SUFIJO}`))) || todos.find((p) => fs.existsSync(path.join(inputDir, p, `${nombre}.txt`))) || null;
}

/**
 * Video editado fuera de la web (sin archivo de estado): si existen su mp4 editado y public/<N>.edit.json,
 * se le crea un estado `listo` para poder pedirle cambios. Devuelve el estado nuevo o null si no aplica.
 */
function adoptarEditado(inputDir, root, plan, nombre) {
  const file = estadoPath(inputDir, plan, nombre);
  if (!file || fs.existsSync(file)) return null;
  const suyo = planDeVideo(inputDir, nombre); // si ya pertenece a otro plan, no se duplica
  if (suyo && suyo !== plan) return null;
  const mp4 = path.join(root, 'media', 'output', 'edited', nombre, `${nombre}_edited.mp4`);
  const plano = path.join(root, 'public', `${nombre}.edit.json`);
  if (!fs.existsSync(mp4) || !fs.existsSync(plano)) return null;
  let estilo = null;
  try {
    const s = JSON.parse(fs.readFileSync(plano, 'utf8')).strategy;
    if (['captions', 'motion', 'mixed', 'voice'].includes(s)) estilo = s;
  } catch {
    /* plan ilegible: sin estilo */
  }
  return escribirEstado(inputDir, plan, nombre, {fase: 'listo', estilo, mensaje: 'Video listo'});
}

/** Nombres de carpetas de plan seguras dentro de inputDir. */
function planes(inputDir) {
  try {
    return fs
      .readdirSync(inputDir, {withFileTypes: true})
      .filter((d) => d.isDirectory() && planSeguro(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Nombres de video con archivo de estado dentro de un plan. */
function nombresDePlan(inputDir, plan) {
  if (!planSeguro(plan)) return [];
  try {
    return fs
      .readdirSync(path.join(inputDir, plan))
      .filter((n) => n.endsWith(SUFIJO) && nombreSeguro(n.slice(0, -SUFIJO.length)))
      .map((n) => n.slice(0, -SUFIJO.length));
  } catch {
    return [];
  }
}

/** Al arrancar: las fases en curso pasan a `interrumpido`. Devuelve cuántos cambió. */
function marcarInterrumpidos(inputDir) {
  let cuantos = 0;
  for (const plan of planes(inputDir)) {
    for (const nombre of nombresDePlan(inputDir, plan)) {
      try {
        const e = leerEstado(inputDir, plan, nombre);
        if (!EN_CURSO.includes(e.fase)) continue;
        escribirEstado(inputDir, plan, nombre, {fase: 'interrumpido', trabajo: null, mensaje: 'Se interrumpió al cerrar la web.'});
        cuantos += 1;
      } catch {
        /* un estado que no se puede reescribir no debe frenar el arranque */
      }
    }
  }
  return cuantos;
}

/** `{nombre: {fase, actualizado}}` de los videos con estado en un plan. */
function estadosDePlan(inputDir, plan) {
  const out = {};
  for (const nombre of nombresDePlan(inputDir, plan)) {
    const e = leerEstado(inputDir, plan, nombre);
    out[nombre] = {fase: e.fase, actualizado: e.actualizado};
  }
  return out;
}

/** Videos en fase `listo` de todos los planes, el más reciente primero. */
function listarListos(inputDir) {
  const out = [];
  for (const plan of planes(inputDir)) {
    for (const nombre of nombresDePlan(inputDir, plan)) {
      const e = leerEstado(inputDir, plan, nombre);
      if (e.fase === 'listo') out.push({plan, nombre, actualizado: e.actualizado});
    }
  }
  return out.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

/** Lee las líneas del log (sin vacías) y devuelve como mucho las últimas MAX_LOG. */
function lineasDeLog(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l !== '').slice(-MAX_LOG);
  } catch {
    return [];
  }
}

// Cada linea se AÑADE al final (barato). El archivo se recorta a las ultimas MAX_LOG solo cada RECORTE_CADA lineas.
const RECORTE_CADA = 100;
const pendientes = new Map();

/** Añade una línea al log; de vez en cuando lo recorta a las últimas ~400. */
function agregarLog(inputDir, plan, nombre, linea) {
  const file = logPath(inputDir, plan, nombre);
  if (!file) throw new Error('Nombre de plan o de video no válido.');
  const limpia = String(linea).replace(/[\r\n]+/g, ' ').slice(0, 2000);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.appendFileSync(file, `${limpia}\n`);
  const n = (pendientes.get(file) || 0) + 1;
  if (n >= RECORTE_CADA) {
    pendientes.set(file, 0);
    escribirAtomico(file, `${lineasDeLog(file).join('\n')}\n`);
  } else pendientes.set(file, n);
}

/** Últimas `max` líneas del log ([] si no existe o el nombre no es seguro). */
function leerLog(inputDir, plan, nombre, max = 200) {
  const file = logPath(inputDir, plan, nombre);
  if (!file) return [];
  const n = Number.isInteger(max) && max > 0 ? max : 200;
  return lineasDeLog(file).slice(-n);
}

module.exports = {CARPETAS_SIN_GUION, esSinGuion, existeVideo, nombreOcupado, planDeVideo, adoptarEditado, FASES, EN_CURSO, NOMBRE_SEGURO, PLAN_SEGURO, EXT_AUDIO, estadoPath, leerEstado, escribirEstado, marcarInterrumpidos, estadosDePlan, listarListos, agregarLog, leerLog};
