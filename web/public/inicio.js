// Inicio: "¿Que quieres hacer hoy?" (tarjetas fijas en index.html) + los ultimos videos terminados.
import {$, el, tag, fecha, pedir, urlArchivo, rutaVideo, NOMBRE_OK} from './comun.js';

export async function mostrarInicio() {
  const lista = $('ultimos-lista');
  lista.replaceChildren(el('p', {className: 'vacio', textContent: 'Cargando…'}));
  const r = await pedir('/api/videos');
  const videos = r.ok && Array.isArray(r.datos) ? r.datos : [];
  if (!videos.length) {
    lista.replaceChildren(el('p', {className: 'vacio', textContent: r.ok ? 'Cuando termines tu primer video aparecerá aquí.' : 'No se pudieron cargar los videos.'}));
    return;
  }
  const ultimos = [...videos].sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))).slice(0, 3);
  lista.replaceChildren(
    ...ultimos.map((v) =>
      el(
        'article',
        {className: 'video-card'},
        el('video', {className: 'mini-video', controls: true, preload: 'metadata', src: urlArchivo(v.plan || '_', v.nombre, 'video')}),
        el(
          'div',
          {className: 'video-card-cuerpo'},
          el('h3', {textContent: v.nombre}),
          el('div', {className: 'tags'}, v.plan ? tag(v.plan, 'plan-tag') : null, v.actualizado ? el('span', {className: 'fecha-chica', textContent: fecha(v.actualizado)}) : null),
          v.plan && NOMBRE_OK.test(v.nombre) ? el('div', {className: 'acciones'}, el('a', {className: 'secundario pequeno enlace', href: rutaVideo(v.plan, v.nombre), textContent: 'Abrir'})) : null,
        ),
      ),
    ),
  );
}
