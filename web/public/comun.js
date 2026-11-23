// Utilidades comunes del navegador. Todo se construye con nodos de texto: nada de innerHTML.

export const $ = (id) => document.getElementById(id);
export const enc = encodeURIComponent;
export const NOMBRE_OK = /^[A-Za-z0-9_-]{1,120}$/;

export const el = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
};
export const conAttr = (n, attrs) => {
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
export const tag = (texto, extra = '') => el('span', {className: `tag ${extra}`.trim(), textContent: texto});
export const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es', {day: 'numeric', month: 'short', year: 'numeric'});
};
export const mb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// ---------- fases de un video ----------
export const FASE_TXT = {
  sin_grabar: 'Sin grabar',
  subido: 'Subido',
  preparando: 'Editando',
  planificando: 'Editando',
  revision: 'Para revisar',
  renderizando: 'Renderizando',
  listo: 'Listo',
  error: 'Error',
  necesita_accion: 'Necesita tu acción',
  interrumpido: 'Interrumpido',
};
export const FASE_CLASE = {
  sin_grabar: 'gris-tag',
  subido: '',
  preparando: 'plan-tag',
  planificando: 'plan-tag',
  revision: '',
  renderizando: 'plan-tag',
  listo: 'nuevo-tag',
  error: 'alerta-tag',
  necesita_accion: 'alerta-tag',
  interrumpido: 'alerta-tag',
};
export const badgeFase = (fase) => tag(FASE_TXT[fase] || FASE_TXT.sin_grabar, FASE_CLASE[fase] === undefined ? 'gris-tag' : FASE_CLASE[fase]);
export const rutaVideo = (plan, nombre) => `#/p/${enc(plan)}/v/${enc(nombre)}`;
export const urlArchivo = (plan, nombre, tipo, q = '') => `/api/archivo/${enc(plan)}/${enc(nombre)}/${tipo}${q}`;

// ---------- peticiones ----------
export const api = async (ruta) => {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

export async function pedir(ruta, metodo = 'GET', cuerpo) {
  try {
    const opts = {method: metodo};
    if (metodo !== 'GET') {
      opts.headers = {'Content-Type': 'application/json'};
      opts.body = JSON.stringify(cuerpo || {});
    }
    const r = await fetch(ruta, opts);
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      /* sin cuerpo JSON */
    }
    return {ok: r.ok, status: r.status, datos};
  } catch {
    return {ok: false, status: 0, datos: {error: 'No se pudo conectar con la web local. ¿Sigue abierta la ventana negra?'}};
  }
}
export const textoError = (r, defecto) => (r.datos && r.datos.error) || defecto;

// bloquea botones mientras corre una peticion
export async function conBloqueo(botones, fn) {
  for (const b of botones) b.disabled = true;
  try {
    return await fn();
  } finally {
    for (const b of botones) if (b.isConnected) b.disabled = false;
  }
}

// ---------- portapapeles ----------
// writeText a veces se queda colgado (sin resolver ni rechazar): se le da 1.5 s y se prueba el plan B.
export async function copiar(texto, boton) {
  let ok = false;
  try {
    await Promise.race([navigator.clipboard.writeText(texto), new Promise((_, rechaza) => setTimeout(() => rechaza(new Error('tiempo agotado')), 1500))]);
    ok = true;
  } catch {
    const ta = el('textarea', {value: texto});
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(ta);
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
  }
  const original = boton.dataset.original || boton.textContent;
  boton.dataset.original = original;
  boton.textContent = ok ? '¡Copiado!' : 'No se pudo copiar: selecciónalo y copia a mano';
  setTimeout(() => (boton.textContent = original), ok ? 1500 : 3500);
}
export const botonCopiar = (texto, etiqueta = 'Copiar') => {
  const b = el('button', {type: 'button', className: 'secundario pequeno', textContent: etiqueta});
  b.addEventListener('click', () => copiar(texto, b));
  return b;
};
