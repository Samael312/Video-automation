// Mis videos: todo lo editado (estado listo o en media/output/edited).
import {$, el, tag, fecha, pedir, textoError, conAttr, conBloqueo, copiar, urlArchivo, rutaVideo, NOMBRE_OK} from './comun.js';

export async function mostrarVideos() {
  const lista = $('videos-lista');
  lista.replaceChildren(el('p', {className: 'vacio', textContent: 'Cargando…'}));
  const r = await pedir('/api/videos');
  if (!r.ok || !Array.isArray(r.datos)) {
    lista.replaceChildren(el('p', {className: 'vacio', textContent: textoError(r, 'No se pudo cargar la biblioteca.')}));
    return;
  }
  if (!r.datos.length) {
    lista.replaceChildren(el('div', {className: 'vacio'}, el('p', {textContent: 'Todavía no hay videos terminados. Cuando termines uno, aparecerá aquí.'}), el('a', {className: 'primario enlace', href: '#/editar', textContent: 'Editar un video'})));
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
          const rr = await fetch(urlArchivo(v.plan || '_', v.nombre, 'caption'));
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
        el('video', {className: 'mini-video', controls: true, preload: 'metadata', src: urlArchivo(v.plan || '_', v.nombre, 'video')}),
        el('div', {className: 'video-card-cuerpo'}, el('h3', {textContent: v.nombre}), el('div', {className: 'tags'}, v.plan ? tag(v.plan, 'plan-tag') : null, v.actualizado ? el('span', {className: 'fecha-chica', textContent: fecha(v.actualizado)}) : null), el('div', {className: 'acciones'}, el('a', {className: 'secundario pequeno enlace', href: urlArchivo(v.plan || '_', v.nombre, 'video', '?descargar=1'), download: `${v.nombre}.mp4`, textContent: 'Descargar'}), cop, v.plan && NOMBRE_OK.test(v.nombre) ? el('a', {className: 'secundario pequeno enlace', href: rutaVideo(v.plan, v.nombre), textContent: 'Abrir · pedir cambios'}) : null), msg),
      ),
    );
  }
}
