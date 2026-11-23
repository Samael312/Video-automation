// Paneles del asistente segun la fase: subir + estilo, en curso, revisar, listo y alertas.
import {el, mb, pedir, textoError, conAttr, conBloqueo, copiar, urlArchivo, enc} from './comun.js';
import {panelRetro} from './secciones.js';
import {W, EXT_OK, EXT_AUDIO, ESTILOS_UI, ganchos, setErr, lanzar, rutaAccion, logDetalles, pintarProgreso, recargarVideo} from './asistente.js';

const pintar = () => ganchos.pintar();

// ---------- panel: subir + estilo ----------
export function esAudio() {
  return W.modo === 'audio' || W.modo === 'guion' || (W.tipoLocal || (W.estado.entrada && W.estado.entrada.tipo)) === 'audio';
}

export function panelSubir() {
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

export function pintarEstilos() {
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

export function actualizarEmpezar() {
  if (!W || !W.nodos.btnEmpezar) return;
  const faltan = W.req.some((r) => r && r.ok === false);
  const subido = W.estado.fase === 'subido';
  const ocupado = Boolean(W.xhr) || Boolean(W.trabajoId);
  W.nodos.btnEmpezar.disabled = !subido || !W.estilo || faltan || ocupado;
  W.nodos.pistaEmpezar.textContent = faltan ? 'Arregla los requisitos de arriba para poder empezar.' : !subido ? 'Primero sube tu grabación.' : !W.estilo ? 'Elige un estilo para continuar.' : '';
}

export function pintarRecom() {
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

export function subir(file) {
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
export function panelGuionPendiente() {
  return el('section', {className: 'panel video-sec'}, el('h2', {textContent: 'Este video todavía no se ha empezado'}), el('p', {className: 'tenue', textContent: 'Elige el guion y la voz en la sección "Video desde guion" para empezar.'}), el('div', {className: 'acciones'}, el('a', {className: 'primario enlace', href: '#/desde-guion', textContent: 'Ir a Video desde guion'})));
}

// ---------- panel: en curso ----------
export function panelCurso() {
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
export function panelRevision() {
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
export function panelListo() {
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
    panelRetro({
      titulo: '¿Quieres cambiar algo de este video?',
      placeholder: 'Por ejemplo: quita la música, cambia el gancho, otra escena en el segundo 10…',
      boton: 'Pedir cambios',
      historial: Array.isArray(W.estado.cambios) ? W.estado.cambios : [],
      enviar: async (texto) => {
        // mismo flujo que en revisión: nuevo preview -> apruebas -> se vuelve a renderizar (reemplaza este video)
        if (!(await lanzar(rutaAccion('cambios'), {texto}, 'planificando', []))) return {ok: false, error: (W && W.nodos.err && W.nodos.err.textContent) || 'No se pudo pedir los cambios.'};
        pintar();
        return {ok: true};
      },
    }),
  );
}

// ---------- panel: necesita accion / error / interrumpido ----------
export function panelAlerta(titulo, texto, tipo) {
  const reintentar = el('button', {type: 'button', className: 'primario', textContent: 'Reintentar'});
  reintentar.addEventListener('click', async () => {
    if (await lanzar(rutaAccion('reintentar'), {}, 'preparando', [reintentar])) pintar();
  });
  const caja = el('section', {className: `caja caja-${tipo === 'accion' ? 'accion' : 'error'} video-sec`}, el('h2', {textContent: titulo}), el('p', {className: 'caja-texto', textContent: texto}), el('div', {className: 'acciones'}, reintentar));
  const frag = el('div', {}, caja);
  if (tipo !== 'interrumpido' || W.log.length) frag.append(logDetalles());
  return frag;
}
