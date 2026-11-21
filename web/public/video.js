/* Editar video (asistente) y biblioteca. Se carga ANTES de app.js; usa $, el, tag, copiar, fecha de app.js
   solo al ejecutarse (nunca al cargar). Todo con textContent: nada de innerHTML. */

const EXT_OK = ['mov', 'mp4', 'm4v', 'm4a', 'mp3', 'wav', 'ogg', 'opus'];
const EXT_AUDIO = ['m4a', 'mp3', 'wav', 'ogg', 'opus'];
const FASES_CURSO = ['preparando', 'planificando', 'renderizando'];
const FASE_TXT = {
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
const FASE_CLASE = {
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
const ESTILOS_UI = [
  {id: 'captions', titulo: 'Captions', texto: 'La profe siempre en cámara'},
  {id: 'motion', titulo: 'Motion', texto: 'Las escenas explican'},
  {id: 'mixed', titulo: 'Mixto', texto: 'La profe cuenta, las escenas remarcan'},
  {id: 'voice', titulo: 'Voz', texto: 'Solo voz, todo motion'},
];
const PASOS = ['Subir', 'Preparar', 'Plan', 'Revisar', 'Render', 'Listo'];
const NOMBRE_OK = /^[A-Za-z0-9_-]{1,120}$/;

const enc = encodeURIComponent;
const badgeFase = (fase) => tag(FASE_TXT[fase] || FASE_TXT.sin_grabar, FASE_CLASE[fase] === undefined ? 'gris-tag' : FASE_CLASE[fase]);
const rutaVideo = (plan, nombre) => `#/p/${enc(plan)}/v/${enc(nombre)}`;
const urlArchivo = (plan, nombre, tipo, q = '') => `/api/archivo/${enc(plan)}/${enc(nombre)}/${tipo}${q}`;
const conAttr = (n, attrs) => {
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const mb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

async function pedir(ruta, metodo = 'GET', cuerpo) {
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
const textoError = (r, defecto) => (r.datos && r.datos.error) || defecto;

// bloquea botones mientras corre una peticion
async function conBloqueo(botones, fn) {
  for (const b of botones) b.disabled = true;
  try {
    return await fn();
  } finally {
    for (const b of botones) if (b.isConnected) b.disabled = false;
  }
}

// ======================= asistente =======================
let W = null;
let tokenW = 0;

function salirVideo() {
  if (!W) return;
  cerrarFuente();
  if (W.xhr) W.xhr.abort();
  W = null;
  tokenW++;
}
function cerrarFuente() {
  if (W && W.fuente) {
    W.fuente.close();
    W.fuente = null;
  }
}

function pasoDe(fase) {
  const mapa = {sin_grabar: 0, subido: 0, preparando: 1, planificando: 2, revision: 3, renderizando: 4, listo: 5};
  if (fase in mapa) {
    W.ultimoPaso = mapa[fase];
    return mapa[fase];
  }
  if (W.ultimoPaso !== null) return W.ultimoPaso;
  const a = W.archivos || {};
  return a.video ? 5 : a.preview ? 3 : a.entrada ? 1 : 0;
}

async function mostrarVideo(plan, nombre, modo) {
  salirVideo();
  const token = ++tokenW;
  W = {plan, nombre, modo: ['editar', 'audio', 'guion'].includes(modo) ? modo : null, token, estado: null, log: [], archivos: {}, fuente: null, trabajoId: null, trabajoTipo: null, estilo: null, tipoLocal: null, req: [], recom: null, recomendando: false, mensaje: '', porcentaje: null, ultimoPaso: null, xhr: null, nodos: {}, errCount: 0, caption: null};
  const cont = $('video-cont');
  cont.replaceChildren(el('p', {className: 'vacio', textContent: 'Cargando…'}));
  const [r, rq] = await Promise.all([pedir(`/api/video/${enc(plan)}/${enc(nombre)}`), pedir('/api/requisitos')]);
  if (!W || W.token !== token) return;
  if (!r.ok || !r.datos || !r.datos.estado) {
    cont.replaceChildren(el('p', {className: 'vacio', textContent: textoError(r, 'No encontré este video.')}), el('p', {className: 'centro'}, el('a', {className: 'secundario enlace', href: `#/p/${enc(plan)}`, textContent: '← Volver al plan'})));
    return;
  }
  aplicarVideo(r.datos);
  W.req = rq.ok && Array.isArray(rq.datos) ? rq.datos : [];
  dibujar();
  // si hay un trabajo activo de este video, nos reenganchamos
  const t = await pedir('/api/trabajos');
  if (!W || W.token !== token) return;
  if (t.ok && Array.isArray(t.datos)) {
    const mio = t.datos.find((j) => j.plan === plan && j.nombre === nombre);
    if (mio) {
      W.trabajoTipo = mio.tipo;
      if (mio.tipo === 'recomendar') W.recomendando = true;
      conectar(mio.id);
      if (W.nodos.recom) pintarRecom();
    }
  }
}

function aplicarVideo(datos) {
  W.estado = datos.estado;
  W.log = Array.isArray(datos.log) ? datos.log.slice(-400) : [];
  W.archivos = datos.archivos || {};
  W.mensaje = datos.estado.mensaje || '';
  if (datos.estado.estilo && !W.estilo) W.estilo = datos.estado.estilo;
}

async function recargarVideo() {
  if (!W) return;
  const token = W.token;
  const r = await pedir(`/api/video/${enc(W.plan)}/${enc(W.nombre)}`);
  if (!W || W.token !== token) return;
  if (r.ok && r.datos && r.datos.estado) aplicarVideo(r.datos);
  W.caption = null;
  pintar();
}

function dibujar() {
  const cont = $('video-cont');
  W.nodos = {};
  const err = conAttr(el('p', {className: 'error-linea', hidden: true}), {role: 'alert'});
  W.nodos.err = err;
  W.nodos.pasos = el('ol', {className: 'pasos'});
  W.nodos.panel = el('div', {className: 'video-panel'});
  cont.replaceChildren(
    el('a', {className: 'volver', href: `#/p/${enc(W.plan)}`, textContent: `← ${W.plan}`}),
    el('header', {className: 'cab-video'}, el('span', {className: 'insignia', textContent: W.modo === 'audio' ? '🔊 Audio a video' : W.modo === 'guion' ? '🎙️ Video desde guion' : '🎬 Editar video'}), el('h1', {textContent: W.nombre})),
    W.nodos.pasos,
    err,
    W.nodos.panel,
  );
  pintar();
}

function setErr(texto) {
  if (!W || !W.nodos.err) return;
  W.nodos.err.textContent = texto || '';
  W.nodos.err.hidden = !texto;
}

function pintar() {
  if (!W || !W.estado) return;
  const fase = W.estado.fase;
  const paso = pasoDe(fase);
  const alerta = ['error', 'necesita_accion', 'interrumpido'].includes(fase);
  W.nodos.pasos.replaceChildren(
    ...PASOS.map((p, i) => {
      const li = el('li', {className: `paso${i < paso ? ' hecho' : ''}${i === paso ? ` actual${alerta ? ' alerta' : ''}` : ''}`}, el('span', {className: 'paso-num', textContent: i < paso || (i === 5 && fase === 'listo') ? '✓' : String(i + 1)}), el('span', {className: 'paso-txt', textContent: p}));
      if (i === paso) li.setAttribute('aria-current', 'step');
      return li;
    }),
  );
  W.nodos.log = null;
  W.nodos.msg = null;
  W.nodos.barra = null;
  W.nodos.recom = null;
  let panel;
  if (W.modo === 'guion' && (fase === 'sin_grabar' || fase === 'subido')) panel = panelGuionPendiente();
  else if (fase === 'sin_grabar' || fase === 'subido') panel = panelSubir();
  else if (FASES_CURSO.includes(fase)) panel = panelCurso();
  else if (fase === 'revision') panel = panelRevision();
  else if (fase === 'listo') panel = panelListo();
  else if (fase === 'necesita_accion') panel = panelAlerta('Necesito que hagas esto', W.estado.accion || 'Hay un paso que tienes que hacer tú.', 'accion');
  else if (fase === 'error') panel = panelAlerta('Algo salió mal', W.estado.error || 'Ocurrió un error. Puedes intentarlo otra vez.', 'error');
  else panel = panelAlerta('Se interrumpió', 'La edición se interrumpió (por ejemplo, porque se cerró la web). Puedes reintentar.', 'interrumpido');
  W.nodos.panel.replaceChildren(panel);
}

// ---------- SSE ----------
function conectar(id) {
  cerrarFuente();
  W.trabajoId = id;
  W.errCount = 0;
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
        pintar();
      }
    } else if (ev.type === 'recomendacion') {
      W.recom = {estilo: ev.estilo, texto: ev.texto};
      W.recomendando = false;
      if (W.nodos.recom) pintarRecom();
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
function agregarLog(linea) {
  W.log.push(linea);
  if (W.log.length > 400) W.log.shift();
  if (W.nodos.log) {
    W.nodos.log.textContent = W.log.join('\n');
    W.nodos.log.scrollTop = W.nodos.log.scrollHeight;
  }
}
function pintarProgreso() {
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
async function lanzar(ruta, cuerpo, faseOptimista, botones) {
  setErr('');
  return conBloqueo(botones, async () => {
    const r = await pedir(ruta, 'POST', cuerpo);
    if (!W) return false;
    if (!r.ok) {
      setErr(textoError(r, 'No se pudo empezar. Inténtalo otra vez.'));
      if (r.status === 409 && r.datos && r.datos.trabajo) conectar(r.datos.trabajo);
      return false;
    }
    if (faseOptimista) {
      W.estado = {...W.estado, fase: faseOptimista, error: null, accion: null};
      W.mensaje = '';
      W.porcentaje = null;
    }
    if (r.datos && r.datos.trabajo) conectar(r.datos.trabajo);
    return true;
  });
}
const rutaAccion = (a) => `/api/video/${enc(W.plan)}/${enc(W.nombre)}/${a}`;

function logDetalles() {
  const pre = el('pre', {className: 'registro', textContent: W.log.join('\n')});
  W.nodos.log = pre;
  const d = el('details', {className: 'ver-registro'}, el('summary', {textContent: 'Ver registro'}), pre);
  return d;
}

// ---------- panel: subir + estilo ----------
function esAudio() {
  return W.modo === 'audio' || W.modo === 'guion' || (W.tipoLocal || (W.estado.entrada && W.estado.entrada.tipo)) === 'audio';
}

function panelSubir() {
  const fase = W.estado.fase;
  const faltan = W.req.filter((r) => r && r.ok === false);
  const frag = el('div');

  if (faltan.length) {
    const lista = el('ul', {className: 'req-lista'});
    for (const r of faltan) {
      lista.append(el('li', {}, el('strong', {textContent: r.titulo || r.id}), r.detalle ? el('p', {textContent: r.detalle}) : null, r.arreglo ? el('p', {className: 'req-arreglo'}, el('span', {textContent: 'Cómo arreglarlo: '}), el('code', {textContent: r.arreglo})) : null));
    }
    frag.append(el('section', {className: 'caja caja-aviso'}, el('h2', {textContent: 'Faltan requisitos en este PC'}), el('p', {className: 'tenue', textContent: 'Puedes subir tu grabación, pero no podrás empezar la edición hasta arreglar esto.'}), lista));
  }

  // 1. subir
  const entrada = W.estado.entrada;
  const extPermitidas = W.modo === 'audio' ? EXT_AUDIO : W.modo === 'editar' ? EXT_OK.filter((e) => !EXT_AUDIO.includes(e)) : EXT_OK;
  const input = el('input', {type: 'file', className: 'oculto', accept: extPermitidas.map((e) => `.${e}`).join(',')});
  input.tabIndex = -1;
  const zona = conAttr(el('div', {className: 'zona', tabIndex: 0}), {role: 'button', 'aria-label': 'Elegir o arrastrar tu grabación'});
  const zonaTxt = el('p', {className: 'zona-txt', textContent: fase === 'subido' ? (W.modo === 'audio' ? 'Cambiar el audio' : 'Cambiar la grabación') : W.modo === 'audio' ? 'Arrastra el audio de la profe aquí' : 'Arrastra el video de la profe aquí'});
  zona.append(
    el('span', {className: 'zona-icono', textContent: '⬆'}),
    zonaTxt,
    el('p', {className: 'zona-sub', textContent: `o haz clic para elegir un archivo · ${extPermitidas.join(', ')}`}),
    input,
  );
  const barra = conAttr(el('div', {className: 'barra-prog', hidden: true}, el('span')), {role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': 'Progreso de la subida'});
  const subEstado = conAttr(el('p', {className: 'sub-estado', hidden: true}), {'aria-live': 'polite'});
  const cancelarSub = el('button', {type: 'button', className: 'secundario pequeno', textContent: 'Cancelar subida', hidden: true});
  W.nodos.subida = {zona, barra, subEstado, cancelarSub, zonaTxt};
  zona.addEventListener('click', () => !W.xhr && input.click());
  zona.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !W.xhr) {
      e.preventDefault();
      input.click();
    }
  });
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('encima');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('encima');
    if (W.xhr) return;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) subir(f);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) subir(input.files[0]);
    input.value = '';
  });
  cancelarSub.addEventListener('click', () => W.xhr && W.xhr.abort());

  const ya = fase === 'subido' && entrada ? el('p', {className: 'ya-subido'}, '✅ Ya subiste ', el('strong', {textContent: entrada.archivo || 'tu archivo'}), entrada.bytes ? ` (${mb(entrada.bytes)})` : '') : null;
  frag.append(el('section', {className: 'panel video-sec'}, el('h2', {textContent: W.modo === 'audio' ? '1. Sube el audio de la profe' : '1. Sube el video de la profe'}), ya, zona, barra, subEstado, cancelarSub));

  // 2. estilo
  W.nodos.estilos = el('div', {className: 'estilos'});
  W.nodos.recom = el('div', {className: 'recom'});
  const rec = el('button', {type: 'button', className: 'secundario', textContent: 'Recomiéndame'});
  W.nodos.btnRec = rec;
  rec.addEventListener('click', async () => {
    W.recom = null;
    const ok = await lanzar(rutaAccion('recomendar'), {}, null, [rec]);
    if (ok) {
      W.recomendando = true;
      W.trabajoTipo = 'recomendar';
    }
    pintarRecom();
  });
  const empezar = el('button', {type: 'button', className: 'primario', textContent: 'Empezar edición'});
  W.nodos.btnEmpezar = empezar;
  empezar.addEventListener('click', async () => {
    if (!W.estilo) return;
    const estilo = W.estilo;
    const ok = await lanzar(rutaAccion('empezar'), {estilo}, 'preparando', [empezar, rec]);
    if (ok) pintar();
    else actualizarEmpezar();
  });
  W.nodos.pistaEmpezar = el('p', {className: 'tenue pista'});
  frag.append(
    el('section', {className: 'panel video-sec'}, el('h2', {textContent: '2. Elige el estilo'}), W.nodos.estilos, el('div', {className: 'acciones'}, rec), W.nodos.recom),
    el('section', {className: 'video-sec centro-acciones'}, empezar, W.nodos.pistaEmpezar),
  );
  pintarEstilos();
  pintarRecom();
  return frag;
}

function pintarEstilos() {
  const audio = esAudio();
  const sinVoz = !audio && W.modo === 'editar';
  if (audio) W.estilo = 'voice';
  else if (sinVoz && W.estilo === 'voice') W.estilo = null;
  const grupo = conAttr(el('div', {className: 'estilo-grupo'}), {role: 'radiogroup', 'aria-label': 'Estilo del video'});
  for (const s of ESTILOS_UI) {
    const bloqueado = audio ? s.id !== 'voice' : sinVoz && s.id === 'voice';
    const radio = el('input', {type: 'radio', name: 'estilo', value: s.id, checked: W.estilo === s.id, disabled: bloqueado});
    radio.addEventListener('change', () => {
      W.estilo = s.id;
      actualizarEmpezar();
    });
    grupo.append(el('label', {className: `estilo-card${bloqueado ? ' desactivada' : ''}`}, radio, el('span', {className: 'estilo-in'}, el('strong', {textContent: s.titulo}), el('span', {textContent: s.texto}))));
  }
  const nodos = [grupo];
  if (audio) nodos.push(el('p', {className: 'tenue nota-audio', textContent: 'Con audio el estilo es "Solo voz": las escenas se crean con motion graphics. Los demás estilos necesitan video con la profe en cámara.'}));
  W.nodos.estilos.replaceChildren(...nodos);
  if (W.nodos.btnRec) W.nodos.btnRec.hidden = audio;
  actualizarEmpezar();
}

function actualizarEmpezar() {
  if (!W || !W.nodos.btnEmpezar) return;
  const faltan = W.req.some((r) => r && r.ok === false);
  const subido = W.estado.fase === 'subido';
  const ocupado = Boolean(W.xhr) || Boolean(W.trabajoId);
  W.nodos.btnEmpezar.disabled = !subido || !W.estilo || faltan || ocupado;
  W.nodos.pistaEmpezar.textContent = faltan ? 'Arregla los requisitos de arriba para poder empezar.' : !subido ? 'Primero sube tu grabación.' : !W.estilo ? 'Elige un estilo para continuar.' : '';
}

function pintarRecom() {
  const n = W.nodos.recom;
  if (!n) return;
  n.replaceChildren();
  if (W.nodos.btnRec) W.nodos.btnRec.disabled = W.recomendando;
  if (W.recomendando) {
    const cancelar = el('button', {type: 'button', className: 'secundario pequeno', textContent: 'Cancelar'});
    cancelar.addEventListener('click', () => conBloqueo([cancelar], () => pedir('/api/cancelar', 'POST', {trabajo: W.trabajoId})));
    n.append(conAttr(el('p', {className: 'progreso trabajando'}, 'Mirando tu grabación para recomendarte un estilo… ', cancelar), {role: 'status', 'aria-live': 'polite'}));
  } else if (W.recom) {
    const e = ESTILOS_UI.find((x) => x.id === W.recom.estilo);
    const usar = el('button', {type: 'button', className: 'primario pequeno', textContent: 'Usar esta'});
    usar.disabled = !e || (esAudio() && e.id !== 'voice') || (!esAudio() && W.modo === 'editar' && e.id === 'voice');
    usar.addEventListener('click', () => {
      W.estilo = W.recom.estilo;
      pintarEstilos();
    });
    n.append(el('div', {className: 'recom-caja'}, el('h3', {textContent: e ? `Te recomiendo: ${e.titulo}` : 'Mi recomendación'}), el('p', {textContent: W.recom.texto || ''}), usar));
  }
  actualizarEmpezar();
}

function subir(file) {
  setErr('');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const s = W.nodos.subida;
  const permitidas = W.modo === 'audio' ? EXT_AUDIO : W.modo === 'editar' ? EXT_OK.filter((e) => !EXT_AUDIO.includes(e)) : EXT_OK;
  if (!file.name.includes('.') || !permitidas.includes(ext)) {
    setErr(`Ese formato no sirve. Usa uno de estos: ${permitidas.join(', ')}.`);
    return;
  }
  W.tipoLocal = EXT_AUDIO.includes(ext) ? 'audio' : 'video';
  pintarEstilos();
  const xhr = new XMLHttpRequest();
  W.xhr = xhr;
  const token = W.token;
  xhr.open('POST', `/api/subidas/${enc(W.plan)}/${enc(W.nombre)}?ext=${ext}`);
  xhr.setRequestHeader('Content-Type', 'application/octet-stream');
  s.barra.hidden = false;
  s.barra.firstChild.style.width = '0%';
  s.subEstado.hidden = false;
  s.subEstado.textContent = `Subiendo ${file.name}… 0 %`;
  s.cancelarSub.hidden = false;
  s.zona.classList.add('ocupada');
  actualizarEmpezar();
  const fin = () => {
    if (!W || W.token !== token) return false;
    W.xhr = null;
    s.zona.classList.remove('ocupada');
    s.cancelarSub.hidden = true;
    return true;
  };
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable || !W || W.token !== token) return;
    const p = Math.round((e.loaded / e.total) * 100);
    s.barra.firstChild.style.width = `${p}%`;
    s.barra.setAttribute('aria-valuenow', String(p));
    s.subEstado.textContent = `Subiendo ${file.name}… ${p} % (${mb(e.loaded)} de ${mb(e.total)})`;
  };
  xhr.onload = async () => {
    if (!fin()) return;
    let datos = null;
    try {
      datos = JSON.parse(xhr.responseText);
    } catch {
      /* sin JSON */
    }
    if (xhr.status >= 200 && xhr.status < 300 && datos && datos.estado) {
      W.estado = datos.estado;
      await recargarVideo();
    } else {
      s.barra.hidden = true;
      s.subEstado.hidden = true;
      W.tipoLocal = null;
      pintarEstilos();
      setErr((datos && datos.error) || 'No se pudo subir el archivo. Inténtalo otra vez.');
    }
  };
  const falla = (texto) => {
    if (!fin()) return;
    s.barra.hidden = true;
    s.subEstado.hidden = true;
    W.tipoLocal = null;
    pintarEstilos();
    setErr(texto);
  };
  xhr.onerror = () => falla('Se cortó la subida. Revisa que la web local siga abierta e inténtalo otra vez.');
  xhr.onabort = () => falla('Subida cancelada.');
  xhr.send(file);
}

// ---------- panel: video desde guion que aun no arranco ----------
function panelGuionPendiente() {
  return el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Este video todavía no se ha empezado'}), el('p', {className: 'tenue', textContent: 'Elige el guion y la voz en la sección "Video desde guion" para empezar.'}), el('div', {className: 'acciones'}, el('a', {className: 'primario enlace', href: '#/desde-guion', textContent: 'Ir a Video desde guion'})));
}

// ---------- panel: en curso ----------
function panelCurso() {
  const fase = W.estado.fase;
  const titulos = {preparando: 'Preparando tu video', planificando: 'Planificando la edición', renderizando: 'Renderizando el video'};
  W.nodos.msg = conAttr(el('p', {className: 'curso-msg', textContent: W.mensaje || 'Empezando…'}), {role: 'status', 'aria-live': 'polite'});
  W.nodos.barra = conAttr(el('div', {className: 'barra-prog', hidden: true}, el('span')), {role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Progreso'});
  const cancelar = el('button', {type: 'button', className: 'secundario', textContent: 'Cancelar'});
  cancelar.addEventListener('click', async () => {
    setErr('');
    await conBloqueo([cancelar], async () => {
      const r = await pedir('/api/cancelar', 'POST', W.trabajoId ? {trabajo: W.trabajoId} : {});
      if (!r.ok) setErr(textoError(r, 'No se pudo cancelar.'));
    });
  });
  const caja = el('section', {className: 'panel video-sec curso'}, el('div', {className: 'curso-cab'}, el('span', {className: 'spinner', 'aria-hidden': 'true'}), el('h2', {textContent: titulos[fase]})), W.nodos.msg, W.nodos.barra, el('p', {className: 'tenue', textContent: 'Puedes dejar esta página abierta; se actualiza sola. Puede tardar varios minutos.'}), el('div', {className: 'acciones'}, cancelar), logDetalles());
  pintarProgreso();
  return caja;
}

// ---------- panel: revisar ----------
function panelRevision() {
  const e = W.estado;
  const v = Date.parse(e.actualizado) || Date.now();
  const img = el('img', {className: 'preview', src: urlArchivo(W.plan, W.nombre, 'preview', `?v=${v}`), alt: 'Vista previa de cómo quedará el video'});
  img.addEventListener('error', () => img.replaceWith(el('p', {className: 'tenue', textContent: 'No se pudo cargar la vista previa.'})));
  const aprobar = el('button', {type: 'button', className: 'primario', textContent: 'Aprobar y renderizar'});
  aprobar.addEventListener('click', async () => {
    if (await lanzar(rutaAccion('aprobar'), {}, 'renderizando', [aprobar])) pintar();
  });
  const cambios = Array.isArray(e.cambios) ? e.cambios : [];
  return el(
    'div',
    {},
    el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Revisa cómo quedaría'}), el('div', {className: 'preview-caja'}, img), e.resumen ? el('p', {className: 'resumen', textContent: e.resumen}) : null, el('div', {className: 'acciones'}, aprobar)),
    panelRetro({
      titulo: 'Pídele cambios en tus palabras',
      placeholder: 'Por ejemplo: cambia el gancho, quita la música, haz la letra más grande…',
      boton: 'Pedir cambios',
      historial: cambios,
      enviar: async (texto) => {
        if (!(await lanzar(rutaAccion('cambios'), {texto}, 'planificando', [aprobar]))) return {ok: false, error: (W && W.nodos.err && W.nodos.err.textContent) || 'No se pudo pedir los cambios.'};
        pintar();
        return {ok: true};
      },
    }),
  );
}

// ---------- panel: listo ----------
function panelListo() {
  const video = el('video', {className: 'reproductor', controls: true, preload: 'metadata', src: urlArchivo(W.plan, W.nombre, 'video')});
  const cap = el('pre', {className: 'caption-caja', textContent: 'Cargando caption…'});
  const copiarBtn = el('button', {type: 'button', className: 'secundario', textContent: 'Copiar caption', disabled: true});
  const token = W.token;
  fetch(urlArchivo(W.plan, W.nombre, 'caption'))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((t) => {
      if (!W || W.token !== token) return;
      W.caption = t;
      cap.textContent = t.trim() || 'El caption está vacío.';
      copiarBtn.disabled = !t.trim();
      copiarBtn.onclick = () => copiar(t, copiarBtn);
    })
    .catch(() => {
      cap.textContent = 'Todavía no hay caption para este video.';
    });
  return el(
    'div',
    {},
    el('section', {className: 'panel video-sec'}, el('h2', {textContent: '¡Tu video está listo! 🎉'}), el('div', {className: 'reproductor-caja'}, video), el('div', {className: 'acciones'}, el('a', {className: 'primario enlace', href: urlArchivo(W.plan, W.nombre, 'video', '?descargar=1'), download: `${W.nombre}.mp4`, textContent: 'Descargar video'}))),
    el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Caption para TikTok'}), cap, el('div', {className: 'acciones'}, copiarBtn)),
  );
}

// ---------- panel: necesita accion / error / interrumpido ----------
function panelAlerta(titulo, texto, tipo) {
  const reintentar = el('button', {type: 'button', className: 'primario', textContent: 'Reintentar'});
  reintentar.addEventListener('click', async () => {
    if (await lanzar(rutaAccion('reintentar'), {}, 'preparando', [reintentar])) pintar();
  });
  const caja = el('section', {className: `caja caja-${tipo === 'accion' ? 'accion' : 'error'} video-sec`}, el('h2', {textContent: titulo}), el('p', {className: 'caja-texto', textContent: texto}), el('div', {className: 'acciones'}, reintentar));
  const frag = el('div', {}, caja);
  if (tipo !== 'interrumpido' || W.log.length) frag.append(logDetalles());
  return frag;
}

// ======================= biblioteca =======================
async function mostrarVideos() {
  const lista = $('videos-lista');
  lista.replaceChildren(el('p', {className: 'vacio', textContent: 'Cargando…'}));
  const r = await pedir('/api/videos');
  if (!r.ok || !Array.isArray(r.datos)) {
    lista.replaceChildren(el('p', {className: 'vacio', textContent: textoError(r, 'No se pudo cargar la biblioteca.')}));
    return;
  }
  if (!r.datos.length) {
    lista.replaceChildren(el('p', {className: 'vacio', textContent: 'Todavía no hay videos terminados. Cuando termines uno, aparecerá aquí.'}));
    return;
  }
  lista.replaceChildren();
  const orden = [...r.datos].sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
  for (const v of orden) {
    const msg = conAttr(el('p', {className: 'error-linea', hidden: true}), {role: 'alert'});
    const cop = el('button', {type: 'button', className: 'secundario pequeno', textContent: 'Copiar caption'});
    cop.addEventListener('click', async () => {
      msg.hidden = true;
      await conBloqueo([cop], async () => {
        try {
          const rr = await fetch(urlArchivo(v.plan, v.nombre, 'caption'));
          if (!rr.ok) throw new Error(String(rr.status));
          await copiar(await rr.text(), cop);
        } catch {
          msg.hidden = false;
          msg.textContent = 'No se pudo leer el caption de este video.';
        }
      });
    });
    lista.append(
      el(
        'article',
        {className: 'video-card'},
        el('video', {className: 'mini-video', controls: true, preload: 'metadata', src: urlArchivo(v.plan, v.nombre, 'video')}),
        el('div', {className: 'video-card-cuerpo'}, el('h3', {textContent: v.nombre}), el('div', {className: 'tags'}, tag(v.plan, 'plan-tag'), v.actualizado ? el('span', {className: 'fecha-chica', textContent: fecha(v.actualizado)}) : null), el('div', {className: 'acciones'}, el('a', {className: 'secundario pequeno enlace', href: urlArchivo(v.plan, v.nombre, 'video', '?descargar=1'), download: `${v.nombre}.mp4`, textContent: 'Descargar'}), cop, NOMBRE_OK.test(v.nombre) ? el('a', {className: 'secundario pequeno enlace', href: rutaVideo(v.plan, v.nombre), textContent: 'Abrir'}) : null), msg),
      ),
    );
  }
}
