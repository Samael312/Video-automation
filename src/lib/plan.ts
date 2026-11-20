import {keepIndexOf, type Keep} from './cuts';
import {behindSpans, matteCovers, type MatteInfo} from './matte';
import {emojisIn} from './emoji';
import {validateMotion, voiceGaps, type Block, type MotionPlan} from './motion';

export const SCENE_TYPES = ['translate', 'false-friend', 'pronounce', 'mistake', 'example', 'quiz', 'before-after', 'versus', 'listen', 'countdown', 'generated'] as const;
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

export const SCENE_TRANSITIONS = ['fade-slide', 'slide-left', 'slide-right', 'wipe', 'zoom', 'flip'] as const;
export type SceneTransition = (typeof SCENE_TRANSITIONS)[number];
export const CUT_FX = ['none', 'flash', 'shake', 'glitch'] as const;
export type CutFx = (typeof CUT_FX)[number];

/** `transition`: como entra y sale la escena (defecto fade-slide). */
export type Scene = {type: SceneType; start: number; end: number; data: Record<string, unknown>; transition?: SceneTransition};
export type SfxName = 'pop' | 'swoosh' | 'tick' | 'ding' | 'pop2' | 'whoosh2' | 'hit' | 'riser' | 'glitch' | 'message' | 'success';

/** Plan de edicion v1. Todos los tiempos son segundos del video ORIGINAL. */
export type EditPlan = {
  version: 1;
  video: string;
  style: string;
  strategy: 'captions' | 'motion' | 'mixed' | 'voice';
  title?: {line1: string; line2: string; start: number; end: number; y?: number; behind?: boolean};
  end?: {start: number; line1: string; line2: string};
  captions: {maxWords: number; from?: number; until?: number; emphasis?: string[]};
  /** mode 'pulse' (defecto): pulso en cada corte y palabra clave. 'punch': jump-cut, alterna 1 y `punch` (def. 1.12) en cada corte y se queda; las palabras clave siguen pulsando. */
  zoom: {peak: number; duration: number; keywords: string[]; mode?: 'pulse' | 'punch'; punch?: number};
  /** Gancho de los primeros segundos: frase grande sobre el video oscurecido, desde el segundo 0 hasta `end` (original). Max HOOK_MAX_SECONDS. */
  hook?: {text: string; end: number};
  overlays: Overlay[];
  scenes: Scene[];
  sfx: {at: number; name: SfxName}[];
  /** Efecto en cada corte del video: flash (destello blanco), shake (temblor) o glitch (temblor + color). Defecto none. */
  cutFx?: CutFx;
  /** Sonidos automaticos al aparecer overlays, titulo y palabras clave. Por defecto activo; `false` lo apaga. */
  autoSfx?: boolean;
  /** Solo strategy motion: bloques de motion graphics por beats (ver src/lib/motion.ts). */
  motion?: MotionPlan;
  /** Musica de fondo (archivo en media/music/), con ducking bajo la voz. volume 0.02-0.4 (def. 0.12), duck 0-volume (def. 0.04). */
  music?: {file: string; volume?: number; duck?: number};
};

/** `knownEmojis` (nombres de public/emoji/*.png sin extension): si se da, se comprueba que los emojis existan.
 *  `matte`: si se da (null = no existe), `behind: true` exige un matte que cubra esos tramos. */
export type ValidateCtx = {
  video: string;
  duration: number;
  keeps: Keep[];
  knownStyles: string[];
  knownGenerated: string[];
  knownEmojis?: string[];
  knownEmojis3d?: string[];
  knownMusic?: string[];
  matte?: MatteInfo | null;
};

/** Archivo con la persona recortada (fondo transparente) que usa `behind`. */
export const matteFile = (video: string) => video.replace(/\.[^.]+$/, '') + '.matte.webm';
export const usesBehind = (plan: Pick<EditPlan, 'title' | 'overlays'>): boolean =>
  Boolean(plan.title?.behind) || plan.overlays.some((o) => o.kind === 'item' && o.behind);

export const HOOK_MAX_SECONDS = 2.5;
export const HOOK_MAX_CHARS = 40;
export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 8;
const SFX_NAMES: SfxName[] = ['pop', 'swoosh', 'tick', 'ding', 'pop2', 'whoosh2', 'hit', 'riser', 'glitch', 'message', 'success'];
const STRATEGIES = ['captions', 'motion', 'mixed', 'voice'];

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
const keepIndex = keepIndexOf;
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
    case 'before-after':
      needStr('before', 'after');
      break;
    case 'versus':
      needStr('left', 'right');
      break;
    case 'listen':
      needStr('phrase');
      break;
    case 'countdown':
      if (!Array.isArray(data.items) || data.items.length < 2 || data.items.length > 5 || !data.items.every(isStr)) out.push('data.items debe tener de 2 a 5 textos');
      break;
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
  } else {
    if (plan.zoom.mode !== undefined && plan.zoom.mode !== 'pulse' && plan.zoom.mode !== 'punch') e.push('zoom.mode debe ser "pulse" o "punch"');
    if (plan.zoom.punch !== undefined && (!isNum(plan.zoom.punch) || plan.zoom.punch < 1 || plan.zoom.punch > 1.3)) e.push('zoom.punch debe ser un numero entre 1 y 1.3');
  }

  if (plan.cutFx !== undefined && !(CUT_FX as readonly string[]).includes(plan.cutFx as string)) e.push(`cutFx debe ser uno de: ${CUT_FX.join(', ')}`);

  // ----- hook (opcional) -----
  if (plan.hook !== undefined) {
    const h = plan.hook;
    if (!isObj(h) || !isStr(h.text) || !isNum(h.end)) e.push('hook debe tener text (texto) y end (numero, segundos)');
    else {
      if (h.text.length > HOOK_MAX_CHARS) e.push(`hook.text tiene ${h.text.length} caracteres; maximo ${HOOK_MAX_CHARS}`);
      if (h.end <= 0 || h.end > HOOK_MAX_SECONDS) e.push(`hook.end debe estar entre 0 y ${HOOK_MAX_SECONDS} s`);
      else if (keepIndex(h.end - 0.01, ctx.keeps) < 0) e.push(`hook.end cae en zona cortada (${h.end}); muevelo a un tramo conservado`);
      if (isObj(plan.title) && isNum(plan.title.start) && plan.title.start < h.end - 0.05) e.push(`title.start (${plan.title.start}) se solapa con el hook (termina en ${h.end}); empieza el titulo al terminar el hook`);
    }
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
      if (s.transition !== undefined && !(SCENE_TRANSITIONS as readonly string[]).includes(s.transition as string)) e.push(`${tag}: transition debe ser una de: ${SCENE_TRANSITIONS.join(', ')}`);
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

  // ----- musica (opcional) -----
  if (plan.music !== undefined) {
    const m = plan.music;
    if (!isObj(m) || !isStr(m.file)) e.push('music.file debe ser el nombre de una pista de media/music');
    else {
      if (ctx.knownMusic && !ctx.knownMusic.includes(m.file)) {
        e.push(`music.file "${m.file}" no existe en media/music (disponibles: ${ctx.knownMusic.join(', ') || 'ninguna'})`);
      }
      const vol = m.volume === undefined ? 0.12 : m.volume;
      if (!isNum(vol) || vol < 0.02 || vol > 0.4) e.push('music.volume debe estar entre 0.02 y 0.4');
      else if (m.duck !== undefined && (!isNum(m.duck) || m.duck < 0 || m.duck > vol)) e.push(`music.duck debe estar entre 0 y volume (${vol})`);
    }
  }

  // ----- motion (opcional) -----
  if (plan.motion !== undefined) {
    const scenes = Array.isArray(plan.scenes) ? (plan.scenes.filter(isObj) as {start: number; end: number}[]) : [];
    validateMotion(plan.motion, ctx, scenes).forEach((m) => e.push(m));
  }

  // ----- voice: 100 % motion, sin huecos -----
  if (plan.strategy === 'voice') {
    const blocks = isObj(plan.motion) && Array.isArray(plan.motion.blocks) ? plan.motion.blocks : [];
    if (!blocks.length) e.push('voice necesita motion.blocks (npm run draft-motion)');
    else if (!e.length) voiceGaps(blocks as Block[], ctx.keeps).forEach((g) => e.push(`hueco ${g.start.toFixed(1)}–${g.end.toFixed(1)} s sin bloque (tiempo final); en voice todo es motion`));
  }
  return e;
};
