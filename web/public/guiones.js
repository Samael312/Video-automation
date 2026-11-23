// Seccion Guiones: generar planes, lista de planes, una carpeta y el visor grande de un guion.
import {$, el, api, tag, fecha, copiar, botonCopiar, badgeFase, rutaVideo, NOMBRE_OK} from './comun.js';
import {renderMarkdown} from './markdown.js';
import {panelGenerarEnPlan, panelRetroGuion} from './secciones.js';

const form = $('form');
const generar = $('generar');
const cancelar = $('cancelar');
const progreso = $('progreso');
let nuevos = new Set();
let fuente = null;
let carpetaActual = null; // {name, guiones, ...}
let visorIdx = -1;

function setProgreso(texto, clase = '') {
  progreso.hidden = !texto;
  progreso.textContent = texto;
  progreso.className = `progreso ${clase}`.trim();
}
function setOcupado(ocupado) {
  generar.disabled = ocupado;
  cancelar.hidden = !ocupado;
  if (ocupado) progreso.classList.add('trabajando');
}

// contador de cantidad (1 a 10)
const cantidad = $('cantidad');
const ajustar = (delta) => (cantidad.value = String(Math.min(10, Math.max(1, Number(cantidad.value) + delta))));
$('menos').addEventListener('click', () => ajustar(-1));
$('mas').addEventListener('click', () => ajustar(1));

// ---------- vista: planes (carpetas) ----------
export async function cargarPlanes() {
  const lista = $('planes');
  const carpetas = await api('/api/carpetas');
  lista.replaceChildren();
  if (!carpetas.length) {
    const crear = el('button', {type: 'button', className: 'primario', textContent: 'Crear el primero'});
    crear.addEventListener('click', () => {
      form.scrollIntoView({behavior: 'smooth', block: 'start'});
      $('tema').focus({preventScroll: true});
    });
    lista.append(el('div', {className: 'vacio'}, el('p', {textContent: 'Todavía no hay guiones.'}), crear));
    return;
  }
  carpetas.sort((a, b) => Number(nuevos.has(b.name)) - Number(nuevos.has(a.name)));
  for (const c of carpetas) {
    const esNuevo = nuevos.has(c.name);
    lista.append(
      el(
        'a',
        {className: `carpeta${esNuevo ? ' nuevo' : ''}`, href: `#/p/${encodeURIComponent(c.name)}`},
        el('span', {className: 'carpeta-icono', textContent: '📁'}),
        el('h3', {}, c.titulo, esNuevo ? tag('nuevo', 'nuevo-tag') : null),
        el('p', {className: 'carpeta-tema', textContent: c.tema || c.name}),
        el('div', {className: 'carpeta-pie'}, tag(`${c.count} guion${c.count === 1 ? '' : 'es'}`), el('span', {textContent: fecha(c.creado) || fecha(c.mtime)})),
      ),
    );
  }
}

// ---------- vista: una carpeta ----------
export async function mostrarCarpeta(nombre) {
  let datos;
  try {
    datos = await api(`/api/carpetas/${encodeURIComponent(nombre)}`);
  } catch {
    location.hash = '#/guiones';
    return;
  }
  carpetaActual = datos;
  $('carpeta-titulo').textContent = datos.titulo;
  $('carpeta-tema').textContent = datos.tema;
  $('carpeta-meta').textContent = `📁 ${datos.name} · ${datos.guiones.length} guion${datos.guiones.length === 1 ? '' : 'es'}${datos.creado ? ` · ${fecha(datos.creado)}` : ''} · ${datos.guiones.filter((g) => g.estado && g.estado.fase === 'listo').length} de ${datos.guiones.length} listos`;

  // plan completo (PLAN.md) plegable
  const verPlan = $('ver-plan');
  const planMd = $('plan-md');
  planMd.hidden = true;
  planMd.replaceChildren();
  verPlan.hidden = !datos.planMd;
  verPlan.textContent = 'Ver plan completo';
  if (datos.planMd) planMd.append(renderMarkdown(datos.planMd));

  // orden sugerido de publicacion
  const orden = $('carpeta-orden');
  orden.replaceChildren();
  const publicables = datos.guiones.filter((g) => g.info);
  orden.hidden = !publicables.length || !datos.hayPlan;
  if (!orden.hidden) orden.append(el('span', {className: 'orden-t', textContent: 'Orden sugerido para publicar'}));

  const lista = $('guiones');
  lista.replaceChildren();
  const extra = $('carpeta-extra');
  extra.replaceChildren(panelGenerarEnPlan(datos.name, () => mostrarCarpeta(datos.name)));
  datos.guiones.forEach((g, i) => {
    const info = g.info;
    const fase = (g.estado && g.estado.fase) || 'sin_grabar';
    const abrir = el(
      'button',
      {type: 'button', className: 'guion-abrir'},
      el('span', {className: 'num', textContent: String(i + 1)}),
      el('div', {className: 'guion-tarjeta-cuerpo'},
        el('h3', {textContent: g.nombre}),
        el('div', {className: 'tags'}, info && info.formato ? tag(info.formato) : null, info && info.largo ? tag(info.largo, 'plan-tag') : null, info && info.duracion ? tag(info.duracion, 'gris-tag') : null),
        el('p', {className: 'gancho', textContent: (info && info.gancho) || g.texto.split('\n')[0]}),
        el('p', {className: 'extracto', textContent: g.texto.split('\n').slice(1, 3).join(' ')}),
        el('span', {className: 'ver', textContent: 'Ver en grande →'}),
      ),
    );
    abrir.addEventListener('click', () => abrirVisor(i));
    const pie = el('div', {className: 'guion-pie'}, badgeFase(fase), NOMBRE_OK.test(g.nombre) ? el('a', {className: 'secundario pequeno enlace', href: `${rutaVideo(datos.name, g.nombre)}?m=editar`, textContent: 'Editar video'}) : null);
    lista.append(el('article', {className: 'guion-tarjeta'}, abrir, pie));
    if (!orden.hidden) orden.append(el('button', {type: 'button', className: 'chip-orden', textContent: `${i + 1}. ${g.nombre}`, onclick: () => abrirVisor(i)}));
  });
}
$('ver-plan').addEventListener('click', () => {
  const planMd = $('plan-md');
  planMd.hidden = !planMd.hidden;
  $('ver-plan').textContent = planMd.hidden ? 'Ver plan completo' : 'Ocultar plan';
});

// ---------- visor grande ----------
function bloque(titulo, ...contenido) {
  return el('section', {className: 'info-bloque'}, el('h3', {textContent: titulo}), ...contenido);
}
function abrirVisor(i) {
  if (!carpetaActual || i < 0 || i >= carpetaActual.guiones.length) return;
  visorIdx = i;
  const g = carpetaActual.guiones[i];
  const info = g.info;
  $('visor-titulo').textContent = g.nombre;
  const tags = $('visor-tags');
  tags.replaceChildren();
  if (info) {
    if (info.formato) tags.append(tag(info.formato));
    if (info.largo) tags.append(tag(info.largo, 'plan-tag'));
  }
  const faseV = (g.estado && g.estado.fase) || 'sin_grabar';
  $('visor-estado').replaceChildren(badgeFase(faseV));
  const editar = $('visor-editar');
  editar.hidden = !NOMBRE_OK.test(g.nombre);
  editar.href = `${rutaVideo(carpetaActual.name, g.nombre)}?m=editar`;
  $('visor-pos').textContent = `${i + 1} / ${carpetaActual.guiones.length}`;
  $('visor-prev').disabled = i === 0;
  $('visor-next').disabled = i === carpetaActual.guiones.length - 1;
  // la primera linea (el gancho) va en un bloque propio, destacada; el resto debajo
  const [primera, ...resto] = g.texto.split('\n');
  $('visor-texto').replaceChildren(el('span', {className: 'g-gancho', textContent: primera}), resto.join('\n'));
  const copiarBtn = $('visor-copiar');
  copiarBtn.onclick = () => copiar(g.texto, copiarBtn);

  const lateral = $('visor-info');
  lateral.replaceChildren();
  if (!info) {
    lateral.append(bloque('Plan', el('p', {className: 'tenue', textContent: 'Este guion no tiene datos de plan (formato, ganchos, caption).'})));
  } else {
    const datos = [['Formato', info.formato], ['Largo', info.largo], ['Estrategia de edición', info.estrategia], ['Duración', info.duracion]].filter(([, v]) => v);
    if (datos.length) {
      const dl = el('dl');
      for (const [k, v] of datos) dl.append(el('dt', {textContent: k}), el('dd', {textContent: v}));
      lateral.append(bloque('Resumen', dl));
    }
    const ganchos = info.ganchos.length ? info.ganchos : info.gancho ? [info.gancho] : [];
    if (ganchos.length) {
      const ul = el('ul', {className: 'ganchos'});
      ganchos.forEach((gancho, k) => ul.append(el('li', {}, el('span', {className: 'letra', textContent: 'ABCDEF'[k]}), el('span', {className: 'texto', textContent: gancho}), botonCopiar(gancho))));
      lateral.append(bloque('Ganchos (A es el elegido)', ul));
    }
    if (info.caption) {
      const completo = [info.caption, info.hashtags.join(' ')].filter(Boolean).join('\n\n');
      lateral.append(
        bloque('Caption para TikTok', el('p', {className: 'caption', textContent: info.caption}), info.hashtags.length ? el('p', {className: 'hashtags', textContent: info.hashtags.join(' ')}) : null, botonCopiar(completo, 'Copiar caption con hashtags')),
      );
    }
    if (info.notas) lateral.append(bloque('Notas', el('p', {textContent: info.notas})));
  }
  if (NOMBRE_OK.test(carpetaActual.name) && NOMBRE_OK.test(g.nombre)) lateral.append(panelRetroGuion(carpetaActual.name, g.nombre));
  $('visor').hidden = false;
  document.body.classList.add('sin-scroll');
  $('visor-cerrar').focus();
}
export function cerrarVisor() {
  $('visor').hidden = true;
  document.body.classList.remove('sin-scroll');
  visorIdx = -1;
}
$('visor-cerrar').addEventListener('click', cerrarVisor);
$('visor-prev').addEventListener('click', () => abrirVisor(visorIdx - 1));
$('visor-next').addEventListener('click', () => abrirVisor(visorIdx + 1));
$('visor').addEventListener('click', (e) => {
  if (e.target === $('visor')) cerrarVisor();
});
document.addEventListener('keydown', (e) => {
  if ($('visor').hidden) return;
  if (e.key === 'Escape') cerrarVisor();
  else if (e.key === 'ArrowLeft') abrirVisor(visorIdx - 1);
  else if (e.key === 'ArrowRight') abrirVisor(visorIdx + 1);
});
$('recargar').addEventListener('click', cargarPlanes);

// ---------- generar y progreso en vivo ----------
function escuchar() {
  if (fuente) fuente.close();
  fuente = new EventSource('/api/guiones/progreso');
  fuente.onmessage = async (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === 'progreso') {
      setProgreso(ev.mensaje, 'trabajando');
      setOcupado(true);
    } else if (ev.type === 'fin') {
      fuente.close();
      setOcupado(false);
      if (ev.ok) {
        nuevos = new Set(ev.carpetas);
        setProgreso(ev.carpetas.length === 1 ? 'Listo: se creó tu plan.' : `Listo: ${ev.carpetas.length} planes nuevos.`, 'ok');
        // un plan nuevo: se abre su carpeta directamente
        if (ev.carpetas.length === 1) location.hash = `#/p/${encodeURIComponent(ev.carpetas[0])}`;
        else await cargarPlanes();
      } else if (ev.cancelado) setProgreso('Cancelado.');
      else setProgreso(ev.error || 'Algo falló. Vuelve a intentar.', 'error');
    }
  };
  fuente.onerror = () => {
    /* el navegador reintenta solo; si el servidor se apagó, el siguiente clic mostrará el error */
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setProgreso('');
  setOcupado(true);
  const cuerpo = {tema: $('tema').value, cantidad: cantidad.value, largo: form.elements.largo.value};
  try {
    const r = await fetch('/api/guiones', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cuerpo)});
    const datos = await r.json();
    if (!r.ok) {
      setOcupado(r.status === 409);
      setProgreso(datos.error || 'No se pudo empezar.', 'error');
      if (r.status === 409) escuchar();
      return;
    }
    setProgreso('Empezando… esto puede tardar uno o dos minutos.', 'trabajando');
    escuchar();
  } catch {
    setOcupado(false);
    setProgreso('No se pudo conectar con la web local. ¿Sigue abierta la ventana negra?', 'error');
  }
});
cancelar.addEventListener('click', () => fetch('/api/cancelar', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}));

/** Al abrir la web: avisos de Claude y, si ya hay guiones generandose, engancha su progreso. */
export async function revisarEstado() {
  try {
    const estado = await api('/api/estado');
    const aviso = $('aviso');
    if (!estado.claude) {
      aviso.hidden = false;
      aviso.textContent = 'No encuentro Claude Code en este PC. Instálalo, inicia sesión una vez y vuelve a abrir esta web.';
      generar.disabled = true;
    } else if (!estado.sesion) {
      aviso.hidden = false;
      aviso.textContent = 'No encuentro una sesión de Claude Code iniciada en este PC. Abre Claude Code una vez, inicia sesión y recarga esta página.';
    } else if (estado.ocupado) {
      setOcupado(true);
      escuchar();
    }
  } catch {
    /* sin estado: se verá al generar */
  }
}
