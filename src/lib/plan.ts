import type {Keep} from './cuts';
import {behindSpans, matteCovers, type MatteInfo} from './matte';
import {emojisIn} from './emoji';

export const SCENE_TYPES = ['translate', 'false-friend', 'pronounce', 'mistake', 'example', 'quiz', 'generated'] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export type LabelOverlay = {kind: 'label'; text: string; start: number; end: number; x: number; y: number; dir: 'left' | 'right'};
export type EmojiOverlay = {kind: 'emoji'; file: string; start: number; end: number; x: number; y: number; size: number};
/** Item de lista numerada: cuadrito 1..10 + texto que se escribe (estilo Ela). `behind`: la persona queda delante. */
export type ItemOverlay = {kind: 'item'; n: number; text: string; start: number; end: number; y?: number; behind?: boolean};
export type ChatMessage = {text: string; side: 'left' | 'right'; at?: number};
/** Burbujas de chat que aparecen una a una (`at`: segundo del video original; por defecto escalonadas). */
export type ChatOverlay = {kind: 'chat'; messages: ChatMessage[]; start: number; end: number; y?: number};
export type Overlay = LabelOverlay | EmojiOverlay | ItemOverlay | ChatOverlay;
export const OVERLAY_KINDS = ['label', 'emoji', 'item', 'chat'] as const;
export const MAX_CHAT_MESSAGES = 4;

export type Scene = {type: SceneType; start: number; end: number; data: Record<string, unknown>};
export type SfxName = 'pop' | 'swoosh' | 'tick' | 'ding';

/** Plan de edicion v1. Todos los tiempos son segundos del video ORIGINAL. */
export type EditPlan = {
  version: 1;
  video: string;
  style: string;
  strategy: 'captions' | 'motion' | 'mixed';
  title?: {line1: string; line2: string; start: number; end: number; y?: number; behind?: boolean};
  end?: {start: number; line1: string; line2: string};
  captions: {maxWords: number; from?: number; until?: number; emphasis?: string[]};
  zoom: {peak: number; duration: number; keywords: string[]};
  overlays: Overlay[];
  scenes: Scene[];
  sfx: {at: number; name: SfxName}[];
};

/** `knownEmojis` (nombres de public/emoji/*.png sin extension): si se da, se comprueba que los emojis existan.
 *  `matte`: si se da (null = no existe), `behind: true` exige un matte que cubra esos tramos. */
export type ValidateCtx = {video: string; duration: number; keeps: Keep[]; knownStyles: string[]; knownGenerated: string[]; knownEmojis?: string[]; matte?: MatteInfo | null};

/** Archivo con la persona recortada (fondo transparente) que usa `behind`. */
export const matteFile = (video: string) => video.replace(/\.[^.]+$/, '') + '.matte.webm';
export const usesBehind = (plan: Pick<EditPlan, 'title' | 'overlays'>): boolean =>
  Boolean(plan.title?.behind) || plan.overlays.some((o) => o.kind === 'item' && o.behind);

export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 8;
const SFX_NAMES: SfxName[] = ['pop', 'swoosh', 'tick', 'ding'];
const STRATEGIES = ['captions', 'motion', 'mixed'];

export const defaultPlan = (video: string): EditPlan => ({
  version: 1,
  video,
  style: 'referencia',
  strategy: 'captions',
  captions: {maxWords: 5},
  zoom: {peak: 1.08, duration: 0.35, keywords: []},
  overlays: [],
  scenes: [],
  sfx: [],
});

// ---------- helpers de validacion (todo tolera entradas basura) ----------
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const keepIndex = (t: number, keeps: Keep[]): number => keeps.findIndex((k) => t >= k.start && t <= k.end);
const missingEmoji = (file: unknown, ctx: ValidateCtx): string | null =>
  ctx.knownEmojis && isStr(file) && !ctx.knownEmojis.includes(file)
    ? `emoji "${file}" no existe en public/emoji (disponibles: ${ctx.knownEmojis.join(', ') || 'ninguno'})`
    : null;

/** Campos obligatorios de `data` por tipo; devuelve los problemas encontrados. */
const validateSceneData = (type: SceneType, data: unknown, ctx: ValidateCtx): string[] => {
  if (!isObj(data)) return ['data debe ser un objeto'];
  const out: string[] = [];
  const needStr = (...keys: string[]) => keys.forEach((k) => !isStr(data[k]) && out.push(`falta data.${k}`));
  switch (type) {
    case 'translate': {
      needStr('word', 'translation');
      const m = missingEmoji(data.emoji, ctx);
      if (m) out.push(m);
      break;
    }
    case 'false-friend':
      needStr('a', 'b');
      break;
    case 'pronounce':
      needStr('word', 'phonetic');
      if (!Array.isArray(data.syllables) || data.syllables.length === 0 || !data.syllables.every(isStr)) out.push('falta data.syllables (lista de texto)');
      break;
    case 'mistake':
      needStr('wrong', 'right');
      break;
    case 'example':
      needStr('sentence', 'highlight');
      break;
    case 'quiz': {
      needStr('question');
      const opts = data.options;
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 3 || !opts.every(isStr)) {
        out.push('data.options debe tener 2 o 3 textos');
      } else if (!Number.isInteger(data.answer) || (data.answer as number) < 0 || (data.answer as number) >= opts.length) {
        out.push('data.answer debe ser un indice valido de options');
      }
      if (data.countdown !== undefined && (!Number.isInteger(data.countdown) || (data.countdown as number) < 1 || (data.countdown as number) > 10)) {
        out.push('data.countdown debe ser un entero entre 1 y 10');
      }
      break;
    }
    case 'generated':
      if (!isStr(data.component)) out.push('falta data.component');
      else if (!ctx.knownGenerated.includes(data.component)) {
        out.push(`data.component "${data.component}" no esta registrado (conocidos: ${ctx.knownGenerated.join(', ') || 'ninguno'})`);
      }
      break;
  }
  return out;
};

/** [] si el plan es valido. Nunca lanza. */
export const validatePlan = (plan: unknown, ctx: ValidateCtx): string[] => {
  const e: string[] = [];
  if (!isObj(plan)) return ['el plan debe ser un objeto JSON'];

  if (plan.version !== 1) e.push(`version debe ser 1 (recibido: ${JSON.stringify(plan.version)})`);
  if (plan.video !== ctx.video) e.push(`video "${String(plan.video)}" no coincide con el video a renderizar "${ctx.video}"`);
  if (!isStr(plan.style) || !ctx.knownStyles.includes(plan.style)) e.push(`estilo desconocido "${String(plan.style)}" (conocidos: ${ctx.knownStyles.join(', ')})`);
  if (!STRATEGIES.includes(plan.strategy as string)) e.push(`strategy debe ser una de: ${STRATEGIES.join(', ')}`);
  if (!isObj(plan.captions) || !isNum(plan.captions.maxWords)) e.push('captions.maxWords debe ser un numero');
  if (!isObj(plan.zoom) || !isNum(plan.zoom.peak) || !isNum(plan.zoom.duration) || !Array.isArray(plan.zoom.keywords)) {
    e.push('zoom debe tener peak, duration (numeros) y keywords (lista)');
  }

  // ----- title y end (opcionales) -----
  if (plan.title !== undefined) {
    const t = plan.title;
    if (!isObj(t) || !isStr(t.line1) || !isStr(t.line2) || !isNum(t.start) || !isNum(t.end)) e.push('title debe tener line1, line2 (texto) y start, end (numeros)');
    else if (t.y !== undefined && !isNum(t.y)) e.push('title.y debe ser un numero (px desde arriba)');
  }
  if (plan.end !== undefined) {
    const t = plan.end;
    if (!isObj(t) || !isStr(t.line1) || !isStr(t.line2) || !isNum(t.start)) e.push('end debe tener line1, line2 (texto) y start (numero)');
    else if (keepIndex(t.start, ctx.keeps) < 0) e.push(`end.start cae en zona cortada (${t.start}); muevelo a un tramo conservado`);
  }

  // ----- escenas -----
  const ranges: {i: number; start: number; end: number}[] = [];
  if (!Array.isArray(plan.scenes)) e.push('scenes debe ser una lista');
  else {
    plan.scenes.forEach((s: unknown, i: number) => {
      const tag = `escena[${i}]`;
      if (!isObj(s)) return void e.push(`${tag}: debe ser un objeto`);
      if (!(SCENE_TYPES as readonly string[]).includes(s.type as string)) e.push(`${tag}: tipo desconocido "${String(s.type)}"`);
      else validateSceneData(s.type as SceneType, s.data, ctx).forEach((m) => e.push(`${tag} (${String(s.type)}): ${m}`));
      if (!isNum(s.start) || !isNum(s.end)) return void e.push(`${tag}: start y end deben ser numeros`);
      if (s.start >= s.end) return void e.push(`${tag}: start (${s.start}) debe ser menor que end (${s.end})`);
      if (s.start < 0 || s.end > ctx.duration) e.push(`${tag}: queda fuera del video (0..${ctx.duration})`);
      const len = s.end - s.start;
      if (len < MIN_SCENE_SECONDS || len > MAX_SCENE_SECONDS) e.push(`${tag}: dura ${len.toFixed(2)} s; debe durar entre ${MIN_SCENE_SECONDS} y ${MAX_SCENE_SECONDS} s`);
      const a = keepIndex(s.start, ctx.keeps);
      const b = keepIndex(s.end, ctx.keeps);
      if (a < 0 || b < 0 || a !== b) e.push(`${tag}: cruza un corte o cae en zona cortada (${s.start}..${s.end}); debe quedar dentro de un solo tramo conservado`);
      ranges.push({i, start: s.start, end: s.end});
    });
    const sorted = [...ranges].sort((x, y) => x.start - y.start);
    sorted.slice(1).forEach((r, k) => {
      if (r.start < sorted[k].end) e.push(`escena[${r.i}] se solapa con escena[${sorted[k].i}]`);
    });
  }

  // ----- overlays y sfx -----
  if (!Array.isArray(plan.overlays)) e.push('overlays debe ser una lista');
  else {
    plan.overlays.forEach((o: unknown, i: number) => {
      const tag = `overlay[${i}]`;
      if (!isObj(o) || !(OVERLAY_KINDS as readonly string[]).includes(o.kind as string)) {
        return void e.push(`${tag}: kind debe ser uno de: ${OVERLAY_KINDS.join(', ')}`);
      }
      if (!isNum(o.start) || !isNum(o.end) || o.start >= o.end) return void e.push(`${tag}: start y end deben ser numeros con start < end`);
      if ((o.kind === 'label' || o.kind === 'emoji') && (!isNum(o.x) || !isNum(o.y))) return void e.push(`${tag}: ${o.kind} necesita x, y (numeros)`);
      if (o.y !== undefined && !isNum(o.y)) e.push(`${tag}: y debe ser un numero`);
      if (keepIndex(o.start, ctx.keeps) < 0) e.push(`${tag}: empieza en zona cortada (${o.start}); muevelo a un tramo conservado`);
      if (o.kind === 'emoji') {
        const m = missingEmoji(o.file, ctx);
        if (m) e.push(`${tag}: ${m}`);
      }
      if (o.kind === 'item') {
        if (!Number.isInteger(o.n) || (o.n as number) < 1 || (o.n as number) > 10) e.push(`${tag}: n debe ser un entero entre 1 y 10`);
        if (!isStr(o.text)) e.push(`${tag}: falta text`);
      }
      if (o.kind === 'chat') {
        const ms = o.messages;
        if (!Array.isArray(ms) || ms.length < 1 || ms.length > MAX_CHAT_MESSAGES) e.push(`${tag}: messages debe tener entre 1 y ${MAX_CHAT_MESSAGES} mensajes`);
        else ms.forEach((m: unknown, j: number) => {
          if (!isObj(m) || !isStr(m.text)) return void e.push(`${tag}.messages[${j}]: falta text`);
          if (m.side !== 'left' && m.side !== 'right') e.push(`${tag}.messages[${j}]: side debe ser "left" (recibido) o "right" (enviado)`);
          if (m.at !== undefined && (!isNum(m.at) || m.at < (o.start as number) || m.at >= (o.end as number))) {
            e.push(`${tag}.messages[${j}]: at (${String(m.at)}) debe estar entre start y end del overlay`);
          }
          for (const code of new Set(emojisIn(m.text))) {
            if (ctx.knownEmojis && !ctx.knownEmojis.includes(code)) e.push(`${tag}.messages[${j}]: emoji ${code} no esta en public/emoji; bajalo con: npm run emoji -- ${code}`);
          }
        });
      }
    });
  }

  // ----- behind: la persona delante del texto -----
  if (ctx.matte !== undefined && Array.isArray(plan.overlays)) {
    // forma ya revisada arriba; aqui solo importan start/end/behind
    const spans = behindSpans({title: isObj(plan.title) ? (plan.title as EditPlan['title']) : undefined, overlays: plan.overlays.filter(isObj) as Overlay[]});
    const run = `npm run matte -- ${ctx.video.replace(/\.[^.]+$/, '')}`;
    if (spans.length && !ctx.matte) e.push(`"behind" necesita la persona recortada: falta public/${matteFile(ctx.video)}; corre: ${run}`);
    else if (spans.length && !matteCovers(ctx.matte, spans)) {
      e.push(`"behind" cae fuera de lo recortado en public/${matteFile(ctx.video)} (cambiaste tiempos); vuelve a correr: ${run}`);
    }
  }
  if (!Array.isArray(plan.sfx)) e.push('sfx debe ser una lista');
  else {
    plan.sfx.forEach((s: unknown, i: number) => {
      if (!isObj(s) || !isNum(s.at) || !SFX_NAMES.includes(s.name as SfxName)) {
        return void e.push(`sfx[${i}]: forma invalida (at numero, name: ${SFX_NAMES.join('|')})`);
      }
      if (keepIndex(s.at, ctx.keeps) < 0) e.push(`sfx[${i}]: cae en zona cortada (${s.at}); muevelo a un tramo conservado`);
    });
  }
  return e;
};
