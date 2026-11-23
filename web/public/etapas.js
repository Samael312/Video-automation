// Etapas del trabajo en curso: icono + texto bonito, reloj m:ss e historial (puro, sin DOM).
const ETAPAS = [
  ['normalizar', '🎬', 'Preparando el video'],
  ['audio a video', '🎬', 'Preparando el audio'],
  ['voz ia', '🗣️', 'Creando la voz'],
  ['limpiar audio', '🎧', 'Limpiando el audio'],
  ['transcribir', '🎙️', 'Transcribiendo'],
  ['alinear con guion', '📝', 'Alineando con el guion'],
  ['cortar silencios', '✂️', 'Cortando silencios'],
  ['planificar', '🧠', 'Planificando las escenas'],
  ['validar y renderizar', '🎞️', 'Validando y renderizando'],
  ['validar', '✅', 'Revisando el plan'],
  ['preparar', '⚙️', 'Preparando el render'],
  ['prueba', '🔍', 'Render de prueba'],
  ['renderizar', '🎞️', 'Renderizando'],
  ['volumen final', '🔊', 'Ajustando el volumen'],
  ['terminar', '📦', 'Guardando el video'],
  ['caption', '✍️', 'Escribiendo el caption'],
];

/** Nombre de etapa del pipeline ("== transcribir ==") -> {icono, texto}. Gana el primer prefijo que coincide. */
export function etapa(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  const e = ETAPAS.find(([p]) => n.startsWith(p));
  if (e) return {icono: e[1], texto: e[2]};
  const t = String(nombre || '').trim();
  return {icono: '⏳', texto: t ? t[0].toUpperCase() + t.slice(1) : 'Trabajando'};
}

/** ms -> "m:ss" (negativo o no numerico = 0:00). */
export function reloj(ms) {
  const s = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Historial {actual: {paso, desde} | null, hechas: [{paso, ms}]}: un paso nuevo cierra el anterior. */
export function avanzar(hist, paso, ahora) {
  const h = hist || {actual: null, hechas: []};
  if (h.actual && h.actual.paso === paso) return h;
  const hechas = h.actual ? [...h.hechas, {paso: h.actual.paso, ms: ahora - h.actual.desde}] : h.hechas;
  return {actual: {paso, desde: ahora}, hechas};
}

/**
 * Aplica un evento SSE al historial. Usa la hora del evento (`en`, la pone el servidor) para que, al reconectar
 * y recibir el registro repetido, los tiempos sean los reales. planificar no emite "== paso ==": sale de la fase.
 */
export function etapasDeEvento(hist, ev, ahora) {
  const t = ev && typeof ev.en === 'number' ? ev.en : ahora;
  if (ev && ev.type === 'progreso' && ev.paso) return avanzar(hist, ev.paso, t);
  // el caption tampoco emite "== paso ==": se reconoce por su mensaje
  if (ev && ev.type === 'progreso' && /^Escribiendo el caption/.test(String(ev.mensaje || ''))) return avanzar(hist, 'caption', t);
  if (ev && ev.type === 'estado' && ev.estado && ev.estado.fase === 'planificando') return avanzar(hist, 'planificar', t);
  return hist;
}
