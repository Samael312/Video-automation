// Funciones puras del navegador (web/public/*.js, modulos ES). Sin DOM real: un document minimo falso.
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mb, rutaVideo, urlArchivo, NOMBRE_OK} from './public/comun.js';
import {renderMarkdown} from './public/markdown.js';
import {ponerPendiente, tomarPendiente} from './public/pendiente.js';
import {pasoDeFase} from './public/asistente.js';
import {nombreDesdeArchivo} from './public/secciones.js';

type Nodo = {tag: string; children: (Nodo | string)[]; textContent?: string; append: (...c: (Nodo | string)[]) => void};
const nodo = (tag: string): Nodo => {
  const n: Nodo = {tag, children: [], append: (...c) => {
    for (const x of c) if (x && typeof x === 'object' && x.tag === '#frag') n.children.push(...x.children);
    else n.children.push(x);
  }};
  return n;
};
const texto = (n: Nodo | string): string => (typeof n === 'string' ? n : (n.textContent ?? '') + n.children.map(texto).join(''));
const forma = (n: Nodo | string): unknown => (typeof n === 'string' ? n : n.textContent !== undefined && !n.children.length ? `${n.tag}:${n.textContent}` : [n.tag, ...n.children.map(forma)]);

beforeEach(() => {
  (globalThis as unknown as {document: unknown}).document = {createElement: nodo, createDocumentFragment: () => nodo('#frag')};
});
afterEach(() => {
  delete (globalThis as unknown as {document?: unknown}).document;
});

describe('comun', () => {
  it('mb', () => {
    expect(mb(500)).toBe('1 KB');
    expect(mb(2048)).toBe('2 KB');
    expect(mb(3 * 1048576)).toBe('3.0 MB');
  });
  it('rutas y urls codificadas', () => {
    expect(rutaVideo('PLAN A', 'N/1')).toBe('#/p/PLAN%20A/v/N%2F1');
    expect(urlArchivo('P', 'N', 'video', '?descargar=1')).toBe('/api/archivo/P/N/video?descargar=1');
    expect(NOMBRE_OK.test('Hola_1-x')).toBe(true);
    expect(NOMBRE_OK.test('a b')).toBe(false);
  });
});

describe('renderMarkdown', () => {
  it('titulos, negrita, codigo, listas y parrafos; el texto nunca se interpreta como HTML', () => {
    const r = renderMarkdown('# Plan\nUno **dos** `tres`\n- a\n- <b>b</b>');
    expect(forma(r)).toEqual(['div', ['h1', 'Plan'], ['p', 'Uno ', 'strong:dos', ' ', 'code:tres'], ['ul', ['li', 'a'], ['li', '<b>b</b>']]]);
  });
  it('tablas', () => {
    const r = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(texto(r)).toBe('AB12');
    expect((r.children[0] as Nodo).tag).toBe('table');
  });
});

describe('pendiente', () => {
  it('se entrega una sola vez y solo al video que toca', () => {
    ponerPendiente({plan: 'P', nombre: 'N', file: 'f'});
    expect(tomarPendiente('P', 'OTRO')).toBeNull();
    expect(tomarPendiente('P', 'N')).toBe('f');
    expect(tomarPendiente('P', 'N')).toBeNull();
  });
});

describe('pasoDeFase', () => {
  it('fases conocidas, y si no, el ultimo paso o lo que haya en disco', () => {
    expect(pasoDeFase('subido', null, {})).toBe(0);
    expect(pasoDeFase('revision', null, {})).toBe(3);
    expect(pasoDeFase('listo', null, {})).toBe(5);
    expect(pasoDeFase('error', 2, {})).toBe(2);
    expect(pasoDeFase('error', null, {preview: true})).toBe(3);
    expect(pasoDeFase('error', null, {video: true})).toBe(5);
    expect(pasoDeFase('error', null, {})).toBe(0);
  });
});

describe('nombreDesdeArchivo', () => {
  it('limpia acentos y simbolos y quita la extension', () => {
    expect(nombreDesdeArchivo('Canción de prueba (1).MOV')).toBe('Cancion_de_prueba_1');
    expect(nombreDesdeArchivo('...mp4')).toMatch(/^VIDEO_\d{8}$/);
  });
});
