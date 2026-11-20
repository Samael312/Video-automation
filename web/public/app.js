const $ = (id) => document.getElementById(id);
const form = $('form');
const generar = $('generar');
const cancelar = $('cancelar');
const progreso = $('progreso');
let nuevos = new Set();
let fuente = null;
let carpetaActual = null; // {name, guiones, ...}
let visorIdx = -1;

// ---------- utilidades (todo se construye con nodos de texto: nada de innerHTML) ----------
const el = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
};
const api = async (ruta) => {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

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

// Copia al portapapeles. writeText a veces se queda colgado (sin resolver ni rechazar): se le da 1.5 s y se prueba el plan B.
async function copiar(texto, boton) {
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
const botonCopiar = (texto, etiqueta = 'Copiar') => {
  const b = el('button', {type: 'button', className: 'secundario pequeno', textContent: etiqueta});
  b.addEventListener('click', () => copiar(texto, b));
  return b;
};
const tag = (texto, extra = '') => el('span', {className: `tag ${extra}`.trim(), textContent: texto});
const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es', {day: 'numeric', month: 'short', year: 'numeric'});
};

// contador de cantidad (1 a 10)
const cantidad = $('cantidad');
const ajustar = (delta) => (cantidad.value = String(Math.min(10, Math.max(1, Number(cantidad.value) + delta))));
$('menos').addEventListener('click', () => ajustar(-1));
$('mas').addEventListener('click', () => ajustar(1));

// ---------- markdown minimo para PLAN.md ----------
function inline(texto) {
  const frag = document.createDocumentFragment();
  for (const parte of texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (!parte) continue;
    if (parte.startsWith('**')) frag.append(el('strong', {textContent: parte.slice(2, -2)}));
    else if (parte.startsWith('`')) frag.append(el('code', {textContent: parte.slice(1, -1)}));
    else frag.append(parte);
  }
  return frag;
}
function renderMarkdown(md) {
  const root = el('div');
  const lineas = md.split('\n');
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^\s*\|/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lineas[i + 1] || '')) {
      const celdas = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const tabla = el('table');
      const cab = el('tr');
      for (const c of celdas(l)) cab.append(el('th', {}, inline(c)));
      tabla.append(el('thead', {}, cab));
      const cuerpo = el('tbody');
      i += 2;
      while (i < lineas.length && /^\s*\|/.test(lineas[i])) {
        const fila = el('tr');
        for (const c of celdas(lineas[i])) fila.append(el('td', {}, inline(c)));
        cuerpo.append(fila);
        i++;
      }
      tabla.append(cuerpo);
      root.append(tabla);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) root.append(el('h' + h[1].length, {}, inline(h[2])));
    else if (/^\s*[-*]\s+/.test(l)) {
      const ul = el('ul');
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) ul.append(el('li', {}, inline(lineas[i++].replace(/^\s*[-*]\s+/, ''))));
      root.append(ul);
      continue;
    } else if (l.trim()) root.append(el('p', {}, inline(l)));
    i++;
  }
  return root;
}

// ---------- vista: planes (carpetas) ----------
async function cargarPlanes() {
  const lista = $('planes');
  const carpetas = await api('/api/carpetas');
  lista.replaceChildren();
  if (!carpetas.length) {
    lista.append(el('p', {className: 'vacio', textContent: 'Todavía no hay planes. Genera los primeros arriba.'}));
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
async function mostrarCarpeta(nombre) {
  let datos;
  try {
    datos = await api(`/api/carpetas/${encodeURIComponent(nombre)}`);
  } catch {
    location.hash = '#/';
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
    const pie = el('div', {className: 'guion-pie'}, badgeFase(fase), NOMBRE_OK.test(g.nombre) ? el('a', {className: 'secundario pequeno enlace', href: rutaVideo(datos.name, g.nombre), textContent: 'Editar video'}) : null);
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
  editar.href = rutaVideo(carpetaActual.name, g.nombre);
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
  $('visor').hidden = false;
  document.body.classList.add('sin-scroll');
  $('visor-cerrar').focus();
}
function cerrarVisor() {
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

// ---------- rutas (#/ y #/p/NOMBRE) ----------
async function ruta() {
  cerrarVisor();
  salirVideo();
  const h = location.hash;
  let mv = /^#\/p\/([^/]+)\/v\/([^/]+)$/.exec(h);
  let m = mv ? null : /^#\/p\/([^/]+)$/.exec(h);
  const lib = h === '#/videos';
  try {
    if (mv) mv = [mv[0], decodeURIComponent(mv[1]), decodeURIComponent(mv[2])];
    if (m) m = [m[0], decodeURIComponent(m[1])];
  } catch {
    location.hash = '#/';
    return;
  }
  $('vista-inicio').hidden = Boolean(mv || m || lib);
  $('vista-carpeta').hidden = !m;
  $('vista-video').hidden = !mv;
  $('vista-videos').hidden = !lib;
  const enVideos = lib;
  const enPlanes = !lib;
  $('nav-planes').removeAttribute('aria-current');
  $('nav-videos').removeAttribute('aria-current');
  if (enPlanes) $('nav-planes').setAttribute('aria-current', 'page');
  if (enVideos) $('nav-videos').setAttribute('aria-current', 'page');
  window.scrollTo(0, 0);
  if (mv) await mostrarVideo(mv[1], mv[2]);
  else if (m) await mostrarCarpeta(m[1]);
  else if (lib) await mostrarVideos();
  else await cargarPlanes();
}
window.addEventListener('hashchange', ruta);
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

// ---------- arranque ----------
(async () => {
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
  await ruta();
})();
