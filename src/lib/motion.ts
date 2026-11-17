import {keepIndexOf, keptDuration, mapTimeNext, type Keep} from './cuts';
import type {EditPlan, ValidateCtx} from './plan';

/** Layouts de beat (lista cerrada; si nada encaja se usa `word`). */
export const LAYOUTS = ['word', 'prop', 'ring', 'list', 'strike', 'swap', 'card', 'big'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Un plano dentro de un bloque. Empieza en `at` (segundos del video ORIGINAL) y dura hasta el siguiente beat. */
export type Beat = {
  at: number;
  layout: Layout;
  lead?: string;
  key?: string;
  emoji?: string;
  pos?: 'top' | 'bottom';
  items?: string[];
  active?: number;
  title?: string;
  from?: string;
  to?: string;
  frame?: 'player' | 'phone';
};
/** Tramo en que la profe no se ve: motion a pantalla completa. */
export type Block = {start: number; end: number; bg: 'light' | 'dark'; beats: Beat[]};
export type MotionPlan = {blocks: Block[]};

export const MIN_BEAT = 0.4;
export const MAX_BEAT_WARN = 2.5;
const FIRST_AT_TOLERANCE = 0.05;
const BGS = ['light', 'dark'];

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const isStrList = (x: unknown, min: number, max: number): boolean => Array.isArray(x) && x.length >= min && x.length <= max && x.every(isStr);

/** Inicio y fin (tiempos originales) de cada beat de un bloque. */
export const beatSpans = (b: Block): {beat: Beat; start: number; end: number}[] =>
  b.beats.map((beat, i) => ({beat, start: i === 0 ? b.start : beat.at, end: i + 1 < b.beats.length ? b.beats[i + 1].at : b.end}));

/** Campos obligatorios por layout. */
const validateBeatFields = (beat: Record<string, unknown>, ctx: ValidateCtx): string[] => {
  const out: string[] = [];
  const needStr = (...keys: string[]) => keys.forEach((k) => !isStr(beat[k]) && out.push(`falta ${k}`));
  const needEmoji = () => {
    if (!isStr(beat.emoji)) return void out.push('falta emoji');
    if (ctx.knownEmojis3d && !ctx.knownEmojis3d.includes(beat.emoji)) {
      out.push(`emoji "${beat.emoji}" no existe en public/emoji3d; bajalo con: npm run emoji -- --3d ${beat.emoji}`);
    }
  };
  switch (beat.layout as Layout) {
    case 'word':
    case 'big':
      needStr('key');
      break;
    case 'prop':
      needEmoji();
      if (beat.pos !== undefined && beat.pos !== 'top' && beat.pos !== 'bottom') out.push('pos debe ser top o bottom');
      break;
    case 'ring':
      needEmoji();
      break;
    case 'list':
      if (!isStrList(beat.items, 2, 5)) out.push('items debe tener 2 a 5 textos');
      else if (beat.active !== undefined && (!Number.isInteger(beat.active) || (beat.active as number) < 0 || (beat.active as number) >= (beat.items as string[]).length)) {
        out.push('active debe ser un indice valido de items');
      }
      break;
    case 'strike':
      if (!isStrList(beat.items, 2, 4)) out.push('items debe tener 2 a 4 textos');
      break;
    case 'swap':
      needStr('from', 'to');
      break;
    case 'card':
      needStr('key');
      if (beat.frame !== 'player' && beat.frame !== 'phone') out.push('frame debe ser player o phone');
      break;
  }
  return out;
};

/** Errores de `plan.motion`. `scenes` = escenas del plan (los bloques no pueden solaparse con ellas). Nunca lanza. */
export const validateMotion = (motion: unknown, ctx: ValidateCtx, scenes: {start: number; end: number}[]): string[] => {
  const e: string[] = [];
  if (!isObj(motion) || !Array.isArray(motion.blocks)) return ['motion.blocks debe ser una lista'];
  const ranges: {i: number; start: number; end: number}[] = [];

  motion.blocks.forEach((b: unknown, i: number) => {
    const tag = `bloque[${i}]`;
    if (!isObj(b)) return void e.push(`${tag}: debe ser un objeto`);
    if (!isNum(b.start) || !isNum(b.end) || b.start >= b.end) return void e.push(`${tag}: start y end deben ser numeros con start < end`);
    if (!BGS.includes(b.bg as string)) e.push(`${tag}: bg debe ser light o dark`);
    const a = keepIndexOf(b.start, ctx.keeps);
    const z = keepIndexOf(b.end, ctx.keeps);
    if (a < 0 || z < 0 || a !== z) e.push(`${tag}: cruza un corte o cae en zona cortada (${b.start}..${b.end}); debe quedar dentro de un solo tramo conservado`);
    scenes.forEach((s, k) => {
      if (isNum(s.start) && isNum(s.end) && s.start < (b.end as number) && (b.start as number) < s.end) e.push(`${tag}: se solapa con la escena[${k}]`);
    });
    ranges.push({i, start: b.start, end: b.end});

    if (!Array.isArray(b.beats) || b.beats.length === 0) return void e.push(`${tag}: beats debe ser una lista no vacia`);
    let prev = -Infinity;
    b.beats.forEach((beat: unknown, j: number) => {
      const btag = `${tag}.beat[${j}]`;
      if (!isObj(beat) || !isNum(beat.at)) return void e.push(`${btag}: debe ser un objeto con at (numero)`);
      if (j === 0 && Math.abs(beat.at - (b.start as number)) > FIRST_AT_TOLERANCE) e.push(`${btag}: el primer beat debe empezar en el inicio del bloque (${b.start})`);
      if (beat.at <= prev) e.push(`${btag}: at (${beat.at}) fuera de orden; los at deben crecer`);
      if (beat.at < (b.start as number) - FIRST_AT_TOLERANCE || beat.at >= (b.end as number)) e.push(`${btag}: at (${beat.at}) queda fuera del bloque`);
      prev = beat.at;
      if (!(LAYOUTS as readonly string[]).includes(beat.layout as string)) e.push(`${btag}: layout desconocido "${String(beat.layout)}" (conocidos: ${LAYOUTS.join(', ')})`);
      else validateBeatFields(beat, ctx).forEach((m) => e.push(`${btag} (${String(beat.layout)}): ${m}`));
    });
    if (!e.some((m) => m.startsWith(tag))) {
      beatSpans(b as Block).forEach(({start, end}, j) => {
        if (end - start < MIN_BEAT) e.push(`${tag}.beat[${j}]: dura ${(end - start).toFixed(2)} s; minimo ${MIN_BEAT} s`);
      });
    }
  });

  const sorted = [...ranges].sort((x, y) => x.start - y.start);
  sorted.slice(1).forEach((r, k) => {
    if (r.start < sorted[k].end) e.push(`bloque[${r.i}] se solapa con bloque[${sorted[k].i}]`);
  });
  return e;
};

// ---------- avisos (no bloquean el render) ----------
export const HOOK_SECONDS = 2.5;
export const MIN_PROFE_GAP = 1;
export const SHARE_MIN = 0.5;
export const SHARE_MAX = 0.8;

const blocksOf = (plan: EditPlan): Block[] => plan.motion?.blocks ?? [];

/** Fraccion (0..1) de la duracion final cubierta por bloques de motion. */
export const motionShare = (plan: EditPlan, keeps: Keep[]): number => {
  const total = keptDuration(keeps);
  if (total <= 0) return 0;
  const covered = blocksOf(plan).reduce((s, b) => s + Math.max(0, mapTimeNext(b.end, keeps) - mapTimeNext(b.start, keeps)), 0);
  return covered / total;
};

/** Avisos por beat comunes a motion y voice: beats largos y 3 layouts iguales seguidos. */
const beatWarnings = (blocks: Block[]): string[] => {
  const w: string[] = [];
  blocks.forEach((b, i) => {
    const tag = `bloque[${i}]`;
    beatSpans(b).forEach(({start, end}, j) => {
      if (end - start > MAX_BEAT_WARN) w.push(`${tag}.beat[${j}]: dura ${(end - start).toFixed(2)} s; divide en dos beats (max recomendado ${MAX_BEAT_WARN} s)`);
    });
    b.beats.forEach((beat, j) => {
      if (j >= 2 && b.beats[j - 1].layout === beat.layout && b.beats[j - 2].layout === beat.layout) w.push(`${tag}.beat[${j}]: 3 layouts iguales seguidos (${beat.layout}); alterna`);
    });
  });
  return w;
};

// ---------- strategy voice (100 % motion) ----------
export const MAX_GAP = 0.1;

/** Huecos (tiempo FINAL, > MAX_GAP) sin bloque. Ignora tramos conservados mas cortos que un beat: ahi no cabe un bloque. */
export const voiceGaps = (blocks: Block[], keeps: Keep[]): {start: number; end: number}[] => {
  const at = (t: number) => mapTimeNext(t, keeps);
  let f = 0;
  const covered = keeps.map((k) => {
    const r = {start: f, end: f + (k.end - k.start), short: k.end - k.start < MIN_BEAT};
    f = r.end;
    return r;
  }).filter((r) => r.short).map(({start, end}) => ({start, end}));
  blocks.forEach((b) => covered.push({start: at(b.start), end: at(b.end)}));
  covered.sort((x, y) => x.start - y.start);
  const gaps: {start: number; end: number}[] = [];
  let cur = 0;
  covered.forEach((c) => {
    if (c.start - cur > MAX_GAP) gaps.push({start: cur, end: c.start});
    cur = Math.max(cur, c.end);
  });
  if (f - cur > MAX_GAP) gaps.push({start: cur, end: f});
  return gaps;
};

/** Avisos de voice: los de beat + inicio en 0, ultimo oscuro, fondos alternos, title/end tapados. */
export const voiceWarnings = (plan: EditPlan, ctx: ValidateCtx): string[] => {
  const blocks = [...blocksOf(plan)].sort((x, y) => x.start - y.start);
  const w = beatWarnings(blocks);
  if (plan.title) w.push('title no se ve en voice (todo es motion); pon el gancho en el primer beat');
  if (plan.end) w.push('end no se ve en voice (todo es motion); pon el CTA en el ultimo bloque');
  if (!blocks.length) return w;
  if (mapTimeNext(blocks[0].start, ctx.keeps) > MAX_GAP) w.push(`el primer bloque no empieza en 0 (${blocks[0].start}); el gancho va en el primer beat`);
  if (blocks[blocks.length - 1].bg !== 'dark') w.push('el ultimo bloque deberia ser dark (CTA)');
  blocks.forEach((b, i) => {
    if (i >= 2 && blocks[i - 1].bg === b.bg && blocks[i - 2].bg === b.bg) w.push(`3 bloques seguidos con fondo ${b.bg} (bloques en ${blocks[i - 2].start}, ${blocks[i - 1].start}, ${b.start}); alterna`);
  });
  return w;
};

/** Avisos de ritmo y proporcion del plan motion (en voice delega en voiceWarnings). Supone un plan ya valido. */
export const motionWarnings = (plan: EditPlan, ctx: ValidateCtx): string[] => {
  if (plan.strategy === 'voice') return voiceWarnings(plan, ctx);
  const blocks = blocksOf(plan);
  if (!blocks.length) return [];
  const w = beatWarnings(blocks);
  const at = (t: number) => mapTimeNext(t, ctx.keeps);

  blocks.forEach((b, i) => {
    const tag = `bloque[${i}]`;
    if (at(b.start) < HOOK_SECONDS) w.push(`${tag}: empieza en el gancho (antes de ${HOOK_SECONDS} s finales); deja a la profe con el titulo`);
    if (plan.end && b.end > plan.end.start + 0.05) w.push(`${tag}: termina despues del cierre (end.start ${plan.end.start}); deja a la profe en el CTA`);
  });

  const sorted = [...blocks].sort((x, y) => x.start - y.start);
  sorted.slice(1).forEach((b, k) => {
    const gap = at(b.start) - at(sorted[k].end);
    if (gap < MIN_PROFE_GAP) w.push(`solo ${gap.toFixed(2)} s de profe entre bloques (${sorted[k].end} y ${b.start}); deja al menos ${MIN_PROFE_GAP} s o une los bloques`);
  });

  const share = motionShare(plan, ctx.keeps);
  if (share < SHARE_MIN) w.push(`motion cubre ${Math.round(share * 100)} % (menos del ${SHARE_MIN * 100} %); agrega bloques`);
  if (share > SHARE_MAX) w.push(`motion cubre ${Math.round(share * 100)} % (mas del ${SHARE_MAX * 100} %); deja mas profe en camara`);
  return w;
};
