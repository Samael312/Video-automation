// Estado del asistente de un video (W) + progreso en vivo (SSE) + acciones.
// pintar/pintarRecom viven en video.js/paneles.js y se registran en `ganchos` (asi no hay ciclos de import).
import {el, enc, pedir, textoError, conBloqueo} from './comun.js';
import {etapasDeEvento} from './etapas.js';

export const EXT_OK = ['mov', 'mp4', 'm4v', 'm4a', 'mp3', 'wav', 'ogg', 'opus'];
export const EXT_AUDIO = ['m4a', 'mp3', 'wav', 'ogg', 'opus'];
export const FASES_CURSO = ['preparando', 'planificando', 'renderizando'];
export const ESTILOS_UI = [
  {id: 'captions', titulo: 'Captions', texto: 'La profe siempre en cámara'},
  {id: 'motion', titulo: 'Motion', texto: 'Las escenas explican'},
  {id: 'mixed', titulo: 'Mixto', texto: 'La profe cuenta, las escenas remarcan'},
  {id: 'voice', titulo: 'Voz', texto: 'Solo voz, todo motion'},
];
export const PASOS = ['Subir', 'Preparar', 'Plan', 'Revisar', 'Render', 'Listo'];

// W: el video abierto (null si no hay); los demas modulos lo leen (vinculo vivo) y mutan sus campos.
export let W = null;
let tokenW = 0;
export const ganchos = {pintar: () => {}, pintarRecom: () => {}, pintarEtapa: () => {}};

/** Abre un video nuevo en el asistente; devuelve su token (para descartar respuestas viejas). */
export function iniciarW(datos) {
  salirVideo();
  const token = ++tokenW;
  W = {...datos, token};
  return token;
}

export function salirVideo() {
  if (!W) return;
  cerrarFuente();
  if (W.xhr) W.xhr.abort();
  W = null;
  tokenW++;
}
export function cerrarFuente() {
  if (W && W.fuente) {
    W.fuente.close();
    W.fuente = null;
  }
}

/** Paso de la barra (0-5): por la fase; si no es una fase del camino, el ultimo paso visto o lo que haya en disco. */
const PASO_DE_FASE = {sin_grabar: 0, subido: 0, preparando: 1, planificando: 2, revision: 3, renderizando: 4, listo: 5};
export function pasoDeFase(fase, ultimoPaso, archivos) {
  if (fase in PASO_DE_FASE) return PASO_DE_FASE[fase];
  if (ultimoPaso !== null && ultimoPaso !== undefined) return ultimoPaso;
  const a = archivos || {};
  return a.video ? 5 : a.preview ? 3 : a.entrada ? 1 : 0;
}
export function pasoDe(fase) {
  const p = pasoDeFase(fase, W.ultimoPaso, W.archivos);
  if (fase in PASO_DE_FASE) W.ultimoPaso = p;
  return p;
}

const FRASES = [
  'Sube la grabación y elige un estilo.',
  'Limpio el audio y transcribo. No tienes que hacer nada.',
  'Claude está planificando las escenas.',
  'Mira la vista previa: apruébala o pide cambios.',
  'Generando el video final.',
  'Descárgalo y copia el caption.',
];
/** Frase corta que dice que pasa en el paso actual y si la profe tiene que hacer algo. */
export function fraseDePaso(paso, fase, modo) {
  if (['error', 'necesita_accion', 'interrumpido'].includes(fase)) return 'Algo necesita tu atención: mira el aviso de abajo.';
  if (paso === 0 && modo === 'guion') return 'Elige el guion y la voz para empezar.';
  if (paso === 0 && modo === 'audio') return 'Sube el audio de la profe.';
  if (paso === 1 && modo === 'guion') return 'Creo la voz y preparo el video. No tienes que hacer nada.';
  return FRASES[paso] || '';
}

/**
 * Estado tras lanzar una accion: si el servidor ya devolvio el estado nuevo sin trabajo (reintentar con vista previa
 * vuelve directo a revision) gana ese; si no, la fase optimista mientras llega el trabajo.
 */
export function estadoTrasLanzar(estado, datos, faseOptimista) {
  if (datos && datos.estado && !datos.trabajo) return datos.estado;
  if (faseOptimista) return {...estado, fase: faseOptimista, error: null, accion: null};
  return estado;
}

export function aplicarVideo(datos) {
  W.estado = datos.estado;
  W.log = Array.isArray(datos.log) ? datos.log.slice(-400) : [];
  W.archivos = datos.archivos || {};
  W.mensaje = datos.estado.mensaje || '';
  if (datos.estado.estilo && !W.estilo) W.estilo = datos.estado.estilo;
}

export async function recargarVideo() {
  if (!W) return;
  const token = W.token;
  const r = await pedir(`/api/video/${enc(W.plan)}/${enc(W.nombre)}`);
  if (!W || W.token !== token) return;
  if (r.ok && r.datos && r.datos.estado) aplicarVideo(r.datos);
  W.caption = null;
  ganchos.pintar();
}

export function setErr(texto) {
  if (!W || !W.nodos.err) return;
  W.nodos.err.textContent = texto || '';
  W.nodos.err.hidden = !texto;
}

// ---------- SSE ----------
export function conectar(id) {
  cerrarFuente();
  W.trabajoId = id;
  W.errCount = 0;
  W.etapas = null; // el servidor reenvia todo el registro: el historial se rehace con las horas reales
  const token = W.token;
  const f = new EventSource(`/api/trabajos/${enc(id)}/progreso`);
  W.fuente = f;
  f.onmessage = (e) => {
    if (!W || W.token !== token) return f.close();
    let ev;
    try {
      ev = JSON.parse(e.data);
    } catch {
      return;
    }
    W.errCount = 0;
    const etapas = etapasDeEvento(W.etapas, ev, Date.now());
    if (etapas !== W.etapas) {
      W.etapas = etapas;
      ganchos.pintarEtapa();
    }
    if (ev.type === 'progreso') {
      W.mensaje = ev.mensaje || '';
      W.porcentaje = typeof ev.porcentaje === 'number' ? ev.porcentaje : null;
      if (ev.mensaje) agregarLog(ev.mensaje);
      pintarProgreso();
    } else if (ev.type === 'estado' && ev.estado) {
      const cambio = ev.estado.fase !== W.estado.fase;
      W.estado = ev.estado;
      if (ev.estado.mensaje && !W.mensaje) W.mensaje = ev.estado.mensaje;
      if (cambio) {
        W.porcentaje = null;
        ganchos.pintar();
      }
    } else if (ev.type === 'recomendacion') {
      W.recom = {estilo: ev.estilo, texto: ev.texto};
      W.recomendando = false;
      if (W.nodos.recom) ganchos.pintarRecom();
    } else if (ev.type === 'accion') {
      W.estado = {...W.estado, accion: ev.texto};
    } else if (ev.type === 'fin') {
      f.close();
      W.fuente = null;
      W.trabajoId = null;
      W.trabajoTipo = null;
      W.recomendando = false;
      if (ev.cancelado) setErr('Se canceló.');
      else if (ev.ok === false && ev.error) setErr(ev.error);
      recargarVideo();
    }
  };
  f.onerror = () => {
    if (!W || W.token !== token) return f.close();
    W.errCount++;
    if (W.errCount > 3) {
      f.close();
      W.fuente = null;
      W.trabajoId = null;
      W.recomendando = false;
      recargarVideo();
    }
  };
}
export function agregarLog(linea) {
  W.log.push(linea);
  if (W.log.length > 400) W.log.shift();
  if (W.nodos.log) {
    W.nodos.log.textContent = W.log.join('\n');
    W.nodos.log.scrollTop = W.nodos.log.scrollHeight;
  }
}
export function pintarProgreso() {
  if (W.nodos.msg) W.nodos.msg.textContent = W.mensaje || 'Trabajando…';
  if (W.nodos.barra) {
    const b = W.nodos.barra;
    b.hidden = W.porcentaje === null;
    if (W.porcentaje !== null) {
      const p = Math.max(0, Math.min(100, Math.round(W.porcentaje)));
      b.firstChild.style.width = `${p}%`;
      b.setAttribute('aria-valuenow', String(p));
      b.dataset.pct = `${p}%`;
    }
  }
}

// ---------- acciones ----------
export async function lanzar(ruta, cuerpo, faseOptimista, botones) {
  setErr('');
  return conBloqueo(botones, async () => {
    const r = await pedir(ruta, 'POST', cuerpo);
    if (!W) return false;
    if (!r.ok) {
      setErr(textoError(r, 'No se pudo empezar. Inténtalo otra vez.'));
      if (r.status === 409 && r.datos && r.datos.trabajo) conectar(r.datos.trabajo);
      return false;
    }
    const nuevo = estadoTrasLanzar(W.estado, r.datos, faseOptimista);
    if (nuevo !== W.estado) {
      W.estado = nuevo;
      W.etapas = null;
      W.mensaje = '';
      W.porcentaje = null;
    }
    if (r.datos && r.datos.trabajo) conectar(r.datos.trabajo);
    return true;
  });
}
export const rutaAccion = (a) => `/api/video/${enc(W.plan)}/${enc(W.nombre)}/${a}`;

export function logDetalles() {
  const pre = el('pre', {className: 'registro', textContent: W.log.join('\n')});
  W.nodos.log = pre;
  return el('details', {className: 'ver-registro'}, el('summary', {textContent: 'Ver registro'}), pre);
}
