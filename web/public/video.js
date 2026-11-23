// Asistente de un video: carga, cabecera, barra de pasos y el panel de cada fase (paneles.js).
import {$, el, enc, pedir, textoError, conAttr} from './comun.js';
import {mostrarAviso} from './aviso.js';
import {tomarPendiente} from './pendiente.js';
import {W, PASOS, FASES_CURSO, ganchos, iniciarW, aplicarVideo, pasoDe, conectar, fraseDePaso} from './asistente.js';
import {panelSubir, panelGuionPendiente, panelCurso, panelRevision, panelListo, panelAlerta, pintarRecom, pintarEtapa, subir} from './paneles.js';

ganchos.pintar = () => pintar();
ganchos.pintarRecom = () => pintarRecom();
ganchos.pintarEtapa = () => pintarEtapa();

export async function mostrarVideo(plan, nombre, modo) {
  const token = iniciarW({plan, nombre, modo: ['editar', 'audio', 'guion'].includes(modo) ? modo : null, estado: null, log: [], archivos: {}, fuente: null, trabajoId: null, trabajoTipo: null, estilo: null, tipoLocal: null, req: [], recom: null, recomendando: false, mensaje: '', porcentaje: null, ultimoPaso: null, xhr: null, nodos: {}, errCount: 0, caption: null});
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
  // archivo elegido en Editar video / Audio a video: se sube al abrir el asistente
  const pend = tomarPendiente(plan, nombre);
  if (pend && W.nodos.subida && !W.xhr) subir(pend);
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

function dibujar() {
  const cont = $('video-cont');
  W.nodos = {};
  const err = conAttr(el('p', {className: 'error-linea', hidden: true}), {role: 'alert'});
  W.nodos.err = err;
  W.nodos.pasos = el('ol', {className: 'pasos'});
  W.nodos.frase = conAttr(el('p', {className: 'paso-frase'}), {'aria-live': 'polite'});
  W.nodos.panel = el('div', {className: 'video-panel'});
  cont.replaceChildren(
    W.plan === 'VIDEOS_PROFE' || W.plan === 'AUDIOS_PROFE'
      ? el('a', {className: 'volver', href: W.plan === 'VIDEOS_PROFE' ? '#/editar' : '#/audio', textContent: W.plan === 'VIDEOS_PROFE' ? '← Editar video' : '← Audio a video'})
      : el('a', {className: 'volver', href: `#/p/${enc(W.plan)}`, textContent: `← ${W.plan}`}),
    el('header', {className: 'cab-video'}, el('span', {className: 'insignia', textContent: W.modo === 'audio' ? '🔊 Audio a video' : W.modo === 'guion' ? '🎙️ Video desde guion' : '🎬 Editar video'}), el('h1', {textContent: W.nombre})),
    W.nodos.pasos,
    W.nodos.frase,
    err,
    W.nodos.panel,
  );
  pintar();
}

function pintar() {
  if (!W || !W.estado) return;
  const fase = W.estado.fase;
  // aviso solo si la fase cambia en vivo (no al abrir un video que ya estaba asi)
  const antes = W.fasePintada;
  W.fasePintada = fase;
  if (antes && antes !== fase && fase === 'listo') mostrarAviso('¡Tu video está listo!');
  else if (antes && antes !== fase && fase === 'revision') mostrarAviso('La vista previa está lista.');
  const paso = pasoDe(fase);
  const alerta = ['error', 'necesita_accion', 'interrumpido'].includes(fase);
  W.nodos.pasos.replaceChildren(
    ...PASOS.map((p, i) => {
      const li = el('li', {className: `paso${i < paso ? ' hecho' : ''}${i === paso ? ` actual${alerta ? ' alerta' : ''}` : ''}`}, el('span', {className: 'paso-num', textContent: i < paso || (i === 5 && fase === 'listo') ? '✓' : String(i + 1)}), el('span', {className: 'paso-txt', textContent: p}));
      if (i === paso) li.setAttribute('aria-current', 'step');
      return li;
    }),
  );
  // solo si cambia: es aria-live y no debe repetirse en cada repintado
  const frase = fraseDePaso(paso, fase, W.modo);
  if (W.nodos.frase.textContent !== frase) W.nodos.frase.textContent = frase;
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
