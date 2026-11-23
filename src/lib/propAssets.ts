// Revisa que los emojis citados dentro de las props de fx y escenas generadas existan.
// Solo valores con forma de codigo emoji: algunas escenas aceptan palabras (p. ej. "dragon" = silueta dibujada).

// Los codigos emoji reales empiezan por cifra (1f409, 2694, 00a9…); asi "cafe" o "face" cuentan como palabras.
const EMOJI_CODE = /^[0-9][0-9a-f]{3,5}(-[0-9a-f]{4,6})*$/;
const isEmojiKey = (k: string) => /emoji|avatar/i.test(k);

export type EmojiDir = 'emoji' | 'emoji3d';

/** Carpetas de emojis que carga un componente, leidas de su codigo (staticFile(`emoji/…`) / staticFile(`emoji3d/…`)). */
export const emojiDirsOf = (source: string): EmojiDir[] =>
  (['emoji', 'emoji3d'] as const).filter((d) => new RegExp(`staticFile\\(\`${d}/`).test(source));

/** `dirs`: carpetas que usa el componente; vacio o sin dar = vale cualquiera de las dos. */
export const propAssetErrors = (props: unknown, ctx: {knownEmojis?: string[]; knownEmojis3d?: string[]}, tag: string, dirs: EmojiDir[] = []): string[] => {
  if (!ctx.knownEmojis || !ctx.knownEmojis3d) return [];
  const usar: EmojiDir[] = dirs.length ? dirs : ['emoji', 'emoji3d'];
  const known = new Set(usar.flatMap((d) => (d === 'emoji' ? ctx.knownEmojis! : ctx.knownEmojis3d!)));
  const donde = usar.map((d) => `public/${d}`).join(' ni en ');
  const out: string[] = [];
  const check = (v: unknown, ruta: string) => {
    if (typeof v === 'string' && EMOJI_CODE.test(v) && !known.has(v)) out.push(`${ruta}: emoji ${v} no existe en ${donde}`);
  };
  // emojiCtx: estamos debajo de una clave de emoji (para listas de codigos)
  const walk = (v: unknown, ruta: string, emojiCtx: boolean) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${ruta}[${i}]`, emojiCtx));
    // dentro de un objeto que cuelga de una clave de emoji (emojis: [{code}]) se sigue en contexto de emoji
    else if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) walk(x, `${ruta}.${k}`, emojiCtx || isEmojiKey(k));
    else if (emojiCtx) check(v, ruta);
  };
  walk(props, tag, false);
  return out;
};
