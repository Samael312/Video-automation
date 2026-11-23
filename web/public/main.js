// Arranque y rutas de la web (#/...). Cada seccion vive en su modulo.
import {$} from './comun.js';
import {cargarPlanes, mostrarCarpeta, cerrarVisor, revisarEstado} from './guiones.js';
import {mostrarDesdeGuion, mostrarElegir} from './secciones.js';
import {salirVideo} from './asistente.js';
import {mostrarVideo} from './video.js';
import {mostrarVideos} from './mis-videos.js';

// ---------- rutas ----------
// #/ y #/p/PLAN = Guiones · #/desde-guion · #/editar · #/audio · #/p/PLAN/v/NOMBRE[?m=editar|audio|guion] · #/videos
async function ruta() {
  cerrarVisor();
  salirVideo();
  const [camino, query = ''] = location.hash.split('?');
  const modoQ = new URLSearchParams(query).get('m');
  let mv = /^#\/p\/([^/]+)\/v\/([^/]+)$/.exec(camino);
  let m = mv ? null : /^#\/p\/([^/]+)$/.exec(camino);
  try {
    if (mv) mv = [mv[0], decodeURIComponent(mv[1]), decodeURIComponent(mv[2])];
    if (m) m = [m[0], decodeURIComponent(m[1])];
  } catch {
    location.hash = '#/';
    return;
  }
  const modoVideo = ['editar', 'audio', 'guion'].includes(modoQ) ? modoQ : null;
  let seccion = 'guiones';
  if (camino === '#/videos') seccion = 'videos';
  else if (camino === '#/desde-guion') seccion = 'desde';
  else if (camino === '#/editar') seccion = 'editar';
  else if (camino === '#/audio') seccion = 'audio';
  else if (mv) seccion = modoVideo === 'audio' ? 'audio' : modoVideo === 'guion' ? 'desde' : 'editar';
  $('vista-inicio').hidden = Boolean(mv || m || seccion !== 'guiones');
  $('vista-carpeta').hidden = !m;
  $('vista-video').hidden = !mv;
  $('vista-videos').hidden = seccion !== 'videos';
  $('vista-desde').hidden = camino !== '#/desde-guion';
  $('vista-elegir').hidden = !(camino === '#/editar' || camino === '#/audio');
  for (const s of ['guiones', 'desde', 'editar', 'audio', 'videos']) {
    const n = $(`nav-${s}`);
    if (s === seccion) n.setAttribute('aria-current', 'page');
    else n.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
  if (mv) await mostrarVideo(mv[1], mv[2], modoVideo);
  else if (m) await mostrarCarpeta(m[1]);
  else if (seccion === 'videos') await mostrarVideos();
  else if (seccion === 'desde') await mostrarDesdeGuion();
  else if (seccion === 'editar' || seccion === 'audio') mostrarElegir(seccion);
  else await cargarPlanes();
}
window.addEventListener('hashchange', ruta);

(async () => {
  await revisarEstado();
  await ruta();
})();
