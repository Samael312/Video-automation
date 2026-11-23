// Markdown minimo para PLAN.md (titulos, negrita, codigo, listas, tablas). Solo nodos de texto: nada de innerHTML.
import {el} from './comun.js';

export function inline(texto) {
  const frag = document.createDocumentFragment();
  for (const parte of texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (!parte) continue;
    if (parte.startsWith('**')) frag.append(el('strong', {textContent: parte.slice(2, -2)}));
    else if (parte.startsWith('`')) frag.append(el('code', {textContent: parte.slice(1, -1)}));
    else frag.append(parte);
  }
  return frag;
}

export function renderMarkdown(md) {
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
