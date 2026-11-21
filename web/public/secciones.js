/* Secciones del menú lateral (Video desde guion, Editar video, Audio a video), selector de guion
   y panel reutilizable de retroalimentación. Se carga después de video.js y antes de app.js.
   Usa $, el, tag, pedir, enc, textoError, conAttr, conBloqueo, rutaVideo solo al ejecutarse.
   Todo con textContent: nada de innerHTML. */

const MAX_RETRO = 1500;
const NO_DISPONIBLE = 'Esta función todavía no está disponible en el servidor.';

// ---------- panel reutilizable de retroalimentación ----------
// opciones: {titulo, etiqueta, placeholder, boton, enviar: async (texto) => ({ok, error?, mensaje?}), historial: [{texto, en}]}
function panelRetro(op) {
  const id = `retro-${Math.random().toString(36).slice(2, 8)}`;
  const ta = el('textarea', {id, className: 'cambios-texto', maxLength: MAX_RETRO, rows: 4, placeholder: op.placeholder || 'Por ejemplo: hazlo más corto, cambia el gancho…'});
  const cont = el('span', {className: 'contador-txt', textContent: `0 / ${MAX_RETRO}`});
  const boton = el('button', {type: 'button', className: 'secundario', textContent: op.boton || 'Pedir cambios', disabled: true});
  const estado = conAttr(el('p', {className: 'sub-estado', hidden: true}), {role: 'status', 'aria-live': 'polite'});
  ta.addEventListener('input', () => {
    cont.textContent = `${ta.value.length} / ${MAX_RETRO}`;
    boton.disabled = !ta.value.trim();
  });
  boton.addEventListener('click', async () => {
    const texto = ta.value.trim();
    if (!texto) return;
    estado.hidden = true;
    await conBloqueo([boton, ta], async () => {
      const r = await op.enviar(texto);
      estado.hidden = false;
      estado.className = `sub-estado${r && r.ok ? '' : ' error-linea'}`;
      if (r && r.ok) {
        ta.value = '';
        cont.textContent = `0 / ${MAX_RETRO}`;
        estado.textContent = r.mensaje || 'Listo, pedido enviado.';
      } else estado.textContent = (r && r.error) || 'No se pudo enviar. Inténtalo otra vez.';
    });
    boton.disabled = !ta.value.trim();
  });
  const hist = Array.isArray(op.historial) ? op.historial : [];
  return el(
    'section',
    {className: 'panel video-sec'},
    el('h2', {textContent: op.titulo || 'Pídele cambios en tus palabras'}),
    el('label', {className: 'etiqueta', htmlFor: id, textContent: op.etiqueta || '¿Qué quieres cambiar?'}),
    ta,
    el('div', {className: 'cambios-pie'}, cont, boton),
    estado,
    hist.length ? el('div', {className: 'cambios-prev'}, el('h3', {textContent: 'Cambios que ya pediste'}), el('ul', {}, ...hist.map((c) => el('li', {}, el('span', {textContent: c.texto}), c.en ? el('small', {textContent: ` · ${fecha(c.en)}`}) : null)))) : null,
  );
}

// respuesta de un POST a una ruta de guiones que quizá aún no exista en el backend
function respuestaGuion(r, mensajeOk) {
  if (r.ok) return {ok: true, mensaje: mensajeOk};
  if (r.status === 404 || r.status === 405) return {ok: false, error: NO_DISPONIBLE};
  return {ok: false, error: textoError(r, 'No se pudo completar. Inténtalo otra vez.')};
}

// retroalimentación sobre un guion
// TODO(backend): POST /api/guiones/<PLAN>/<NOMBRE>/cambios {texto} (≤ 1500 caracteres)
function panelRetroGuion(plan, nombre) {
  return panelRetro({
    titulo: 'Pídele cambios al guion',
    placeholder: 'Por ejemplo: más corto, otro gancho, tono más divertido…',
    enviar: async (texto) => respuestaGuion(await pedir(`/api/guiones/${enc(plan)}/${enc(nombre)}/cambios`, 'POST', {texto}), 'Listo, se pidieron los cambios al guion.'),
  });
}

// generar más guiones dentro de un plan
// TODO(backend): POST /api/guiones/<PLAN> {tema, cantidad}
function panelGenerarEnPlan(plan, alTerminar) {
  const tema = el('input', {type: 'text', maxLength: 300, placeholder: 'Tema de los guiones nuevos (vacío = variados)', autocomplete: 'off'});
  const num = el('input', {type: 'number', min: 1, max: 10, value: 3, className: 'num-chico'});
  const boton = el('button', {type: 'button', className: 'secundario', textContent: 'Generar guiones en este plan'});
  const estado = conAttr(el('p', {className: 'sub-estado', hidden: true}), {role: 'status', 'aria-live': 'polite'});
  boton.addEventListener('click', async () => {
    estado.hidden = true;
    await conBloqueo([boton], async () => {
      const cantidad = Math.min(10, Math.max(1, Number(num.value) || 1));
      const r = respuestaGuion(await pedir(`/api/guiones/${enc(plan)}`, 'POST', {tema: tema.value.trim(), cantidad}), 'Listo, se están generando los guiones.');
      estado.hidden = false;
      estado.className = `sub-estado${r.ok ? '' : ' error-linea'}`;
      estado.textContent = r.ok ? r.mensaje : r.error;
      if (r.ok && alTerminar) alTerminar();
    });
  });
  return el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Más guiones para este plan'}), el('div', {className: 'fila-form'}, tema, num, boton), estado);
}

// ---------- selector de guion (plan + guion) ----------
// devuelve {nodo, actual(): {plan, nombre} | null}; alCambiar() se llama al cambiar la elección
function selectorGuion(alCambiar) {
  const selPlan = el('select', {className: 'seleccion', id: `sel-plan-${Math.random().toString(36).slice(2, 6)}`});
  const selGuion = el('select', {className: 'seleccion', id: `sel-guion-${Math.random().toString(36).slice(2, 6)}`});
  const msg = el('p', {className: 'tenue', textContent: 'Cargando planes…'});
  const nodo = el('div', {className: 'selector'}, el('div', {className: 'campo'}, el('label', {className: 'etiqueta', htmlFor: selPlan.id, textContent: 'Plan'}), selPlan), el('div', {className: 'campo'}, el('label', {className: 'etiqueta', htmlFor: selGuion.id, textContent: 'Guion'}), selGuion), msg);
  let guiones = [];
  const opcion = (valor, texto, extra = {}) => Object.assign(el('option', {value: valor, textContent: texto}), extra);
  const actual = () => {
    const nombre = selGuion.value;
    return selPlan.value && NOMBRE_OK.test(nombre) && NOMBRE_OK.test(selPlan.value) ? {plan: selPlan.value, nombre} : null;
  };
  async function cargarGuiones() {
    selGuion.replaceChildren();
    guiones = [];
    if (!selPlan.value) return;
    const plan = selPlan.value;
    const r = await pedir(`/api/carpetas/${enc(plan)}`);
    if (selPlan.value !== plan) return;
    guiones = r.ok && r.datos && Array.isArray(r.datos.guiones) ? r.datos.guiones : [];
    if (!guiones.length) selGuion.append(opcion('', 'Este plan no tiene guiones'));
    for (const g of guiones) selGuion.append(opcion(g.nombre, g.nombre));
    msg.textContent = '';
    alCambiar();
  }
  selPlan.addEventListener('change', cargarGuiones);
  selGuion.addEventListener('change', alCambiar);
  (async () => {
    const r = await pedir('/api/carpetas');
    if (!r.ok || !Array.isArray(r.datos)) {
      msg.textContent = textoError(r, 'No se pudieron cargar los planes.');
      return;
    }
    if (!r.datos.length) {
      msg.textContent = 'Todavía no hay guiones. Crea uno primero en la sección Guiones.';
      selPlan.append(opcion('', 'Sin planes'));
      alCambiar();
      return;
    }
    msg.textContent = '';
    for (const c of r.datos) selPlan.append(opcion(c.name, c.titulo || c.name));
    await cargarGuiones();
  })();
  return {nodo, actual, guionActual: () => guiones.find((g) => g.nombre === selGuion.value) || null};
}

const cabeceraSec = (insignia, titulo, grad, texto) => el('header', {className: 'hero'}, el('span', {className: 'insignia', textContent: insignia}), el('h1', {}, `${titulo} `, el('span', {className: 'grad', textContent: grad})), el('p', {textContent: texto}));

// ---------- sección 2: video desde guion ----------
const VOCES_BASE = [
  {id: 'laura', nombre: 'Laura (ElevenLabs)', disponible: true},
  {id: 'profe', nombre: 'Voz de la profe (próximamente)', disponible: false},
];

async function cargarVoces() {
  // TODO(backend): GET /api/voces -> [{id, nombre, disponible}]
  const r = await pedir('/api/voces');
  let voces = r.ok && Array.isArray(r.datos) ? r.datos.filter((v) => v && typeof v.id === 'string' && typeof v.nombre === 'string') : [];
  if (!voces.length) voces = VOCES_BASE;
  if (!voces.some((v) => v.id === 'profe')) voces = [...voces, VOCES_BASE[1]];
  return voces;
}

async function mostrarDesdeGuion() {
  const cont = $('vista-desde');
  cont.replaceChildren(cabeceraSec('🎙️ Video desde guion', 'Video desde', 'guion', 'Elige un guion ya creado y una voz: te armo el video solo con motion graphics.'));
  const err = conAttr(el('p', {className: 'error-linea', hidden: true}), {role: 'alert'});
  const selVoz = el('select', {className: 'seleccion', id: 'sel-voz'});
  const boton = el('button', {type: 'button', className: 'primario', textContent: 'Crear video', disabled: true});
  const retro = el('div');
  let sel = null;
  const refrescar = () => {
    const a = sel && sel.actual();
    boton.disabled = !a || !selVoz.value;
    retro.replaceChildren(a ? panelRetroGuion(a.plan, a.nombre) : '');
  };
  sel = selectorGuion(refrescar);
  boton.addEventListener('click', async () => {
    const a = sel.actual();
    if (!a || !selVoz.value) return;
    err.hidden = true;
    await conBloqueo([boton], async () => {
      // TODO(backend): POST /api/video-desde-guion/<PLAN>/<NOMBRE>/empezar {voz} -> 202 {trabajo}
      const r = await pedir(`/api/video-desde-guion/${enc(a.plan)}/${enc(a.nombre)}/empezar`, 'POST', {voz: selVoz.value});
      if (r.ok) {
        location.hash = `${rutaVideo(a.plan, a.nombre)}?m=guion`;
        return;
      }
      err.hidden = false;
      err.textContent = r.status === 404 || r.status === 405 ? NO_DISPONIBLE : textoError(r, 'No se pudo empezar el video. Inténtalo otra vez.');
    });
  });
  const vocesCaja = el('div', {className: 'campo'}, el('label', {className: 'etiqueta', htmlFor: 'sel-voz', textContent: 'Voz'}), selVoz);
  cont.append(el('section', {className: 'panel video-sec'}, el('h2', {textContent: '1. Elige el guion'}), sel.nodo), el('section', {className: 'panel video-sec'}, el('h2', {textContent: '2. Elige la voz'}), vocesCaja), el('section', {className: 'video-sec centro-acciones'}, boton), err, retro);
  selVoz.addEventListener('change', refrescar);
  const voces = await cargarVoces();
  for (const v of voces) selVoz.append(Object.assign(el('option', {value: v.id, textContent: v.nombre}), {disabled: v.disponible === false}));
  const primera = voces.find((v) => v.disponible !== false);
  if (primera) selVoz.value = primera.id;
  refrescar();
}

// ---------- secciones 3 y 4: elegir guion y abrir el asistente ----------
const MODOS = {
  editar: {insignia: '🎬 Editar video', titulo: 'Editar', grad: 'video', texto: 'Sube el video de la profe y elige el estilo (captions, motion o mixto), o pide una recomendación.', boton: 'Continuar con el video'},
  audio: {insignia: '🔊 Audio a video', titulo: 'Audio a', grad: 'video', texto: 'Sube el audio de la profe (.mp3 o .m4a) con su guion: el video se hace solo con motion graphics.', boton: 'Continuar con el audio'},
};

function mostrarElegir(modo) {
  const m = MODOS[modo];
  const cont = $('vista-elegir');
  cont.replaceChildren(cabeceraSec(m.insignia, m.titulo, m.grad, m.texto));
  const boton = el('button', {type: 'button', className: 'primario', textContent: m.boton, disabled: true});
  const guionTxt = el('div');
  const sel = selectorGuion(() => {
    const a = sel.actual();
    boton.disabled = !a;
    const g = sel.guionActual();
    guionTxt.replaceChildren(g && g.texto ? el('details', {className: 'ver-registro'}, el('summary', {textContent: 'Ver el guion'}), el('p', {className: 'guion-previo', textContent: g.texto})) : '');
  });
  boton.addEventListener('click', () => {
    const a = sel.actual();
    if (a) location.hash = `${rutaVideo(a.plan, a.nombre)}?m=${modo}`;
  });
  cont.append(el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Elige el guion de este video'}), sel.nodo, guionTxt), el('section', {className: 'video-sec centro-acciones'}, boton));
}
