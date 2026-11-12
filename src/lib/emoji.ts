// Emojis de Noto Emoji (Apache 2.0), el mismo estilo que los de public/emoji.
export const NOTO_TAG = 'v2.047';

const HEX_SEQUENCE = /^(u\+)?[0-9a-f]{4,6}([-_ ](u\+)?[0-9a-f]{4,6})*$/i;
const VARIATION_SELECTOR = 'fe0f'; // Noto no lo incluye en los nombres de archivo

/**
 * Nombre de archivo (sin .png) para un emoji: "😀", "U+1F600", "1F600" -> "1f600";
 * secuencias "👍🏻" / "1f44d-1f3fb" -> "1f44d_1f3fb". null si no es un emoji/codigo valido.
 */
export const normalizeEmoji = (input: string): string | null => {
  const s = input.trim();
  if (!s) return null;
  let codes: string[];
  if (HEX_SEQUENCE.test(s)) {
    codes = s.split(/[-_ ]/).map((c) => c.replace(/^u\+/i, '').toLowerCase());
  } else {
    const chars = Array.from(s);
    if (chars.some((c) => c.codePointAt(0)! < 0x80)) return null; // texto normal, no un emoji
    codes = chars.map((c) => c.codePointAt(0)!.toString(16));
  }
  codes = codes.filter((c) => c !== VARIATION_SELECTOR).map((c) => c.replace(/^0+/, ''));
  return codes.length ? codes.join('_') : null;
};

// Un emoji: pictograma + selector de variacion / tono de piel opcionales, unidos con ZWJ (👩‍💻)
const ONE = '\\p{Extended_Pictographic}\\uFE0F?\\p{Emoji_Modifier}?';
const EMOJI_RE = new RegExp(`${ONE}(?:\\u200D${ONE})*`, 'gu');

export type TextPart = {text: string} | {emoji: string; raw: string};

/** "Hi 😀" -> [{text:'Hi '}, {emoji:'1f600', raw:'😀'}]: para dibujar los emojis como PNG de public/emoji. */
export const splitEmoji = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const code = normalizeEmoji(m[0]);
    if (!code) continue;
    if (m.index! > last) parts.push({text: text.slice(last, m.index)});
    parts.push({emoji: code, raw: m[0]});
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({text: text.slice(last)});
  return parts;
};

/** Codigos de los emojis que aparecen en un texto (en orden, con repeticiones). */
export const emojisIn = (text: string): string[] => splitEmoji(text).flatMap((p) => ('emoji' in p ? [p.emoji] : []));

export const notoUrl =(code: string): string => `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@${NOTO_TAG}/png/512/emoji_u${code}.png`;
