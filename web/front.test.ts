// Funciones puras del navegador (web/public/*.js, modulos ES). Sin DOM real: un document minimo falso.
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mb, rutaVideo, urlArchivo, NOMBRE_OK, velocidadSubida, textoSubida, porcentaje} from './public/comun.js';
import {etapa, reloj, avanzar, etapasDeEvento} from './public/etapas.js';
import {renderMarkdown} from './public/markdown.js';
import {ponerPendiente, tomarPendiente} from './public/pendiente.js';
import {pasoDeFase, fraseDePaso, estadoTrasLanzar} from './public/asistente.js';
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

describe('etapas (pieza 4)', () => {
  it('icono y texto por etapa', () => {
    expect(etapa('transcribir')).toEqual({icono: '🎙️', texto: 'Transcribiendo'});
    expect(etapa('normalizar video (mp4/mov -> mp4 720x1280 30 fps)').icono).toBe('🎬');
    expect(etapa('validar y renderizar').texto).not.toBe(etapa('validar edit.json').texto);
    expect(etapa('renderizar')).toEqual({icono: '🎞️', texto: 'Renderizando'});
    expect(etapa('algo raro')).toEqual({icono: '⏳', texto: 'Algo raro'});
  });
  it('reloj m:ss', () => {
    expect(reloj(0)).toBe('0:00');
    expect(reloj(78_400)).toBe('1:18');
    expect(reloj(-5)).toBe('0:00');
    expect(reloj(NaN)).toBe('0:00');
  });
  it('avanzar: mismo paso no cambia; uno nuevo cierra el anterior', () => {
    const h1 = avanzar(null, 'transcribir', 1000);
    expect(h1).toEqual({actual: {paso: 'transcribir', desde: 1000}, hechas: []});
    expect(avanzar(h1, 'transcribir', 5000)).toBe(h1);
    const h2 = avanzar(h1, 'cortar silencios', 19_000);
    expect(h2).toEqual({actual: {paso: 'cortar silencios', desde: 19_000}, hechas: [{paso: 'transcribir', ms: 18_000}]});
  });
});

describe('etapas desde eventos SSE (reconexión)', () => {
  const ev = (o: object) => o as {type: string};
  it('usa la hora del evento: un registro repetido da los tiempos reales', () => {
    const eventos = [
      ev({type: 'estado', estado: {fase: 'preparando'}, en: 1000}),
      ev({type: 'progreso', paso: 'normalizar video', en: 1000}),
      ev({type: 'progreso', mensaje: 'algo', en: 5000}),
      ev({type: 'progreso', paso: 'transcribir', en: 19_000}),
      ev({type: 'estado', estado: {fase: 'planificando'}, en: 40_000}),
    ];
    const h = eventos.reduce((acc, e) => etapasDeEvento(acc, e, 99_999), null as ReturnType<typeof avanzar> | null);
    expect(h).toEqual({actual: {paso: 'planificar', desde: 40_000}, hechas: [{paso: 'normalizar video', ms: 18_000}, {paso: 'transcribir', ms: 21_000}]});
  });
  it('el caption es una etapa (no emite == paso ==)', () => {
    const h = etapasDeEvento(etapasDeEvento(null, ev({type: 'progreso', paso: 'terminar', en: 0}), 0), ev({type: 'progreso', mensaje: 'Escribiendo el caption…', en: 3000}), 9);
    expect(h).toEqual({actual: {paso: 'caption', desde: 3000}, hechas: [{paso: 'terminar', ms: 3000}]});
    expect(etapa('caption')).toEqual({icono: '✍️', texto: 'Escribiendo el caption'});
  });
  it('sin hora usa ahora; eventos sin etapa no cambian nada', () => {
    expect(etapasDeEvento(null, ev({type: 'progreso', paso: 'prueba'}), 7)).toEqual({actual: {paso: 'prueba', desde: 7}, hechas: []});
    expect(etapasDeEvento(null, ev({type: 'estado', estado: {fase: 'revision'}}), 7)).toBe(null);
    expect(etapasDeEvento(null, ev({type: 'fin'}), 7)).toBe(null);
  });
});

describe('subida (pieza 4)', () => {
  it('velocidad con media movil', () => {
    expect(velocidadSubida([])).toBe(null);
    expect(velocidadSubida([{t: 0, b: 0}])).toBe(null);
    expect(velocidadSubida([{t: 0, b: 0}, {t: 1000, b: 2 * 1048576}])).toBe(2 * 1048576);
    // fuera de la ventana de 3 s no cuenta
    expect(velocidadSubida([{t: 0, b: 0}, {t: 5000, b: 1048576}, {t: 6000, b: 2 * 1048576}])).toBe(1048576);
    expect(velocidadSubida([{t: 0, b: 0}, {t: 100, b: 10}])).toBe(null); // muy juntas
  });
  it('porcentaje sin NaN (archivo vacío o total 0)', () => {
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(5, 0)).toBe(0);
    expect(porcentaje(50, 200)).toBe(25);
    expect(porcentaje(300, 200)).toBe(100);
  });
  it('texto de subida', () => {
    expect(textoSubida('a.mov', 45 * 1048576, 100 * 1048576, 3.2 * 1048576)).toBe('Subiendo a.mov… 45 % · 3.2 MB/s · quedan 0:17');
    expect(textoSubida('a.mov', 0, 100, null)).toBe('Subiendo a.mov… 0 %');
    expect(textoSubida('a.mov', 0, 100, 0)).toBe('Subiendo a.mov… 0 %');
    expect(textoSubida('a.mov', 5, 0, 10)).toBe('Subiendo a.mov…');
  });
});

describe('frase del paso (pieza 4)', () => {
  it('una frase por paso y otra en alerta', () => {
    expect(fraseDePaso(0, 'subido', 'editar')).toBe('Sube la grabación y elige un estilo.');
    expect(fraseDePaso(0, 'sin_grabar', 'guion')).toBe('Elige el guion y la voz para empezar.');
    expect(fraseDePaso(1, 'preparando', null)).toBe('Limpio el audio y transcribo. No tienes que hacer nada.');
    expect(fraseDePaso(2, 'planificando', null)).toBe('Claude está planificando las escenas.');
    expect(fraseDePaso(3, 'revision', null)).toBe('Mira la vista previa: apruébala o pide cambios.');
    expect(fraseDePaso(4, 'renderizando', null)).toBe('Generando el video final.');
    expect(fraseDePaso(5, 'listo', null)).toBe('Descárgalo y copia el caption.');
    expect(fraseDePaso(2, 'error', null)).toBe('Algo necesita tu atención: mira el aviso de abajo.');
    expect(fraseDePaso(1, 'preparando', 'guion')).toBe('Creo la voz y preparo el video. No tienes que hacer nada.');
  });
  it('tras lanzar: si el servidor ya devuelve el estado (sin trabajo) gana ese, no el optimista', () => {
    const antes = {fase: 'error', error: 'x', accion: null};
    expect(estadoTrasLanzar(antes, {ok: true, estado: {fase: 'revision', error: null}}, 'preparando')).toEqual({fase: 'revision', error: null});
    expect(estadoTrasLanzar(antes, {trabajo: 'T1'}, 'preparando')).toEqual({fase: 'preparando', error: null, accion: null});
    expect(estadoTrasLanzar(antes, {trabajo: 'T1'}, null)).toBe(antes);
    expect(estadoTrasLanzar(antes, null, 'preparando')).toEqual({fase: 'preparando', error: null, accion: null});
  });
});
