// Emojis 3D de Microsoft Fluent Emoji (MIT). El repo nombra carpetas por nombre CLDR, no por codigo:
// el indice codigo -> PNG se arma con el arbol del repo + emoji-test.txt de Unicode.
export const FLUENT_SHA = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc';
export const FLUENT_TREE_URL = `https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/${FLUENT_SHA}?recursive=1`;
export const EMOJI_TEST_URL = 'https://unicode.org/Public/emoji/15.1/emoji-test.txt';

const VARIATION_SELECTOR = 'fe0f';
const PNG_3D = /^assets\/([^/]+)\/(?:([^/]+)\/)?3D\/[^/]+\.png$/;

/** Nombre CLDR normalizado para comparar con carpetas: minusculas, sin dos puntos ni comillas, espacios simples. */
const norm = (s: string) => s.toLowerCase().replace(/[:’'"“”]/g, '').replace(/\s+/g, ' ').trim();

/** Indice codigo (formato de public/emoji: "1f631", "1f1ea_1f1f8") -> ruta del PNG 3D en el repo. */
export const buildFluentIndex = (treePaths: string[], emojiTest: string): Record<string, string> => {
  const byFolder = new Map<string, string>();
  for (const p of treePaths) {
    const m = PNG_3D.exec(p);
    if (!m) continue;
    const folder = norm(m[1]);
    const variant = m[2];
    if (variant && variant !== 'Default') continue;
    if (!byFolder.has(folder) || variant === 'Default') byFolder.set(folder, p);
  }
  const index: Record<string, string> = {};
  for (const line of emojiTest.split('\n')) {
    const m = /^([0-9A-F ]+?)\s*;\s*fully-qualified\s*#\s*\S+\s+E\d+\.\d+\s+(.+)$/.exec(line);
    if (!m || /skin tone/.test(m[2])) continue;
    const code = m[1].trim().toLowerCase().split(/\s+/).filter((c) => c !== VARIATION_SELECTOR).map((c) => c.replace(/^0+/, '')).join('_');
    const png = byFolder.get(norm(m[2]));
    if (png && !index[code]) index[code] = png;
  }
  return index;
};

export const fluentRawUrl = (repoPath: string): string =>
  `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${FLUENT_SHA}/${repoPath.split('/').map(encodeURIComponent).join('/')}`;
