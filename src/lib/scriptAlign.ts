import type {Word} from './types';

/** Alinea el guion (lo que la profe lee) con las palabras de WhisperX: texto del guion, tiempos de WhisperX. */
export type AlignReport = {match: number; replaced: {from: string[]; to: string[]}[]; added: string[]; dropped: string[]};

export const MIN_MATCH = 0.7;
export const MIN_INSERT = 0.08;
/** Un reemplazo cuenta como coincidencia si sus letras se parecen al menos esto (2·LCS / suma de largos). */
const SIMILAR = 0.6;

/** Minusculas, sin tildes, solo letras y numeros. */
export const normWord = (w: string): string => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Palabras del guion (separadas por espacios; "page-turner" es un token). */
export const scriptTokens = (script: string): string[] => script.split(/\s+/).filter((t) => normWord(t).length > 0);

const r3 = (x: number) => Math.round(x * 1000) / 1000;

const lcsPairs = (a: string[], b: string[]): [number, number][] => {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({length: n + 1}, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) out.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
};

const charSim = (x: string, y: string): number => {
  if (!x.length || !y.length) return 0;
  const lcs = lcsPairs([...x], [...y]).length;
  return (2 * lcs) / (x.length + y.length);
};

/** Lanza Error si el guion esta vacio, no hay palabras o la coincidencia es < MIN_MATCH. */
export const alignScript = (script: string, words: Word[]): {words: Word[]; report: AlignReport} => {
  const toks = scriptTokens(script);
  if (!toks.length) throw new Error('guion vacio');
  if (!words.length) throw new Error('transcript sin palabras');
  const sn = toks.map(normWord);
  const wn = words.map((w) => normWord(w.word));
  const out: (Word | null)[] = toks.map(() => null);
  const report: AlignReport = {match: 0, replaced: [], added: [], dropped: []};
  let matched = 0;

  const anchors = [...lcsPairs(sn, wn), [toks.length, words.length] as [number, number]];
  let i0 = 0;
  let j0 = 0;
  for (const [ia, ja] of anchors) {
    const ns = ia - i0;
    const nw = ja - j0;
    if (ns && nw) {
      const span = words.slice(j0, ja);
      const a = span[0].start;
      const len = span[span.length - 1].end - a;
      const letters = sn.slice(i0, ia).map((s) => Math.max(1, s.length));
      const total = letters.reduce((s, x) => s + x, 0);
      let acc = 0;
      for (let k = 0; k < ns; k++) {
        const st = a + (len * acc) / total;
        acc += letters[k];
        out[i0 + k] = {...span[0], word: toks[i0 + k], start: r3(st), end: r3(a + (len * acc) / total)};
      }
      if (charSim(sn.slice(i0, ia).join(''), wn.slice(j0, ja).join('')) >= SIMILAR) matched += ns;
      report.replaced.push({from: span.map((w) => w.word.trim()), to: toks.slice(i0, ia)});
    } else if (nw) {
      report.dropped.push(...words.slice(j0, ja).map((w) => w.word.trim()));
    } else if (ns) {
      report.added.push(...toks.slice(i0, ia));
    }
    if (ia < toks.length) {
      out[ia] = {...words[ja], word: toks[ia]};
      matched++;
    }
    i0 = ia + 1;
    j0 = ja + 1;
  }

  // inserciones: repartir el hueco entre las vecinas ya alineadas
  for (let i = 0; i < out.length; ) {
    if (out[i]) {
      i++;
      continue;
    }
    let k = i;
    while (k < out.length && !out[k]) k++;
    const n = k - i;
    const prev = i > 0 ? out[i - 1] : null;
    const next = k < out.length ? out[k] : null;
    const lo = prev ? prev.end : Math.max(0, next!.start - MIN_INSERT * n);
    let hi = next ? next.start : lo + MIN_INSERT * n;
    if (hi - lo < MIN_INSERT * n) hi = lo + MIN_INSERT * n;
    const step = (hi - lo) / n;
    const speaker = (prev ?? next)!.speaker;
    for (let q = 0; q < n; q++) out[i + q] = {word: toks[i + q], start: r3(lo + step * q), end: r3(lo + step * (q + 1)), speaker};
    i = k;
  }

  report.match = matched / toks.length;
  if (report.match < MIN_MATCH) {
    const diffs = report.replaced.slice(0, 5).map((r) => `"${r.from.join(' ')}" vs "${r.to.join(' ')}"`).join('; ');
    throw new Error(`el audio no parece leer este guion (coincidencia ${Math.round(report.match * 100)} %)${diffs ? `: ${diffs}` : ''}`);
  }
  return {words: out as Word[], report};
};

/** Rehace `text` de cada segmento con las palabras que empiezan en [start, end). Segmento sin palabras: queda igual. */
export const rebuildSegments = <S extends {start: number; end: number; text: string}>(segments: S[], words: Word[]): S[] =>
  segments.map((s) => {
    const ws = words.filter((w) => w.start >= s.start && w.start < s.end);
    return ws.length ? {...s, text: ws.map((w) => w.word.trim()).join(' ')} : s;
  });
