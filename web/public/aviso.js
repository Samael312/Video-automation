// Avisos breves abajo a la derecha ("¡Tu video está listo!", "Copiado"). Sin imports: comun.js lo usa sin ciclos.
const MAX = 3;
const DURA_MS = 4000;

/** Muestra un aviso que se va solo; tipo 'ok' | 'info'. */
export function mostrarAviso(texto, tipo = 'ok') {
  let cont = document.getElementById('avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'avisos';
    cont.className = 'avisos';
    cont.setAttribute('aria-live', 'polite');
    document.body.append(cont);
  }
  while (cont.children.length >= MAX) cont.firstElementChild.remove();
  const a = document.createElement('div');
  a.className = `toast toast-${tipo}`;
  a.textContent = texto;
  cont.append(a);
  setTimeout(() => {
    a.classList.add('saliendo');
    setTimeout(() => a.remove(), 250);
  }, DURA_MS);
}
