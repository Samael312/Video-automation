// Uso: npm run emoji -- [--3d] <emoji o codigo...>     p. ej.: npm run emoji -- 😀 U+1F44D 1f4a1
// Sin --3d: descarga emojis de Noto Emoji (PNG 512 px, Apache 2.0) a public/emoji/<codigo>.png (overlays y plantillas).
// Con --3d: descarga el emoji 3D de Microsoft Fluent Emoji (MIT) a public/emoji3d/<codigo>.png (beats de motion).
//   Si Fluent no lo tiene, copia el de Noto. Indice cacheado en .cache/fluent3d-index.json.
// No sobrescribe los que ya existen. En el plan se usan por su codigo: {"kind": "emoji", "file": "1f600", ...}
import fs from 'node:fs';
import path from 'node:path';
import {normalizeEmoji, notoUrl} from '../src/lib/emoji';
import {buildFluentIndex, EMOJI_TEST_URL, FLUENT_TREE_URL, fluentRawUrl} from '../src/lib/fluent';
import {PUBLIC, ROOT} from './common';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const UA = {'User-Agent': 'video-automation'};
const INDEX_FILE = path.join(ROOT, '.cache', 'fluent3d-index.json');

const fluentIndex = async (): Promise<Record<string, string>> => {
  if (fs.existsSync(INDEX_FILE)) return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  console.log('  (primera vez: armando indice de Fluent Emoji...)');
  const treeRes = await fetch(FLUENT_TREE_URL, {headers: UA});
  const testRes = await fetch(EMOJI_TEST_URL, {headers: UA});
  if (!treeRes.ok || !testRes.ok) throw new Error(`no se pudo bajar el indice (GitHub ${treeRes.status}, Unicode ${testRes.status})`);
  const tree = ((await treeRes.json()) as {tree: {path: string}[]}).tree.map((t) => t.path);
  const index = buildFluentIndex(tree, await testRes.text());
  fs.mkdirSync(path.dirname(INDEX_FILE), {recursive: true});
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index));
  return index;
};

const download3d = async (arg: string, index: Record<string, string>): Promise<boolean> => {
  const code = normalizeEmoji(arg);
  if (!code) {
    console.error(`  ✗ "${arg}": no es un emoji ni un codigo valido (ej.: 😀, U+1F600, 1f600)`);
    return false;
  }
  const dest = path.join(PUBLIC, 'emoji3d', `${code}.png`);
  if (fs.existsSync(dest)) {
    console.log(`  = ${code}: ya existe en emoji3d (no se sobrescribe)`);
    return true;
  }
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const repoPath = index[code];
  if (repoPath) {
    const res = await fetch(fluentRawUrl(repoPath), {headers: UA});
    const body = Buffer.from(await res.arrayBuffer());
    if (res.ok && body.subarray(0, 8).equals(PNG_SIGNATURE)) {
      fs.writeFileSync(dest, body);
      console.log(`  + ${code}: 3D descargado (${Math.round(body.length / 1024)} KB)`);
      return true;
    }
    console.warn(`  ! ${code}: fallo la descarga 3D (HTTP ${res.status})`);
  }
  console.warn(`  ! ${code}: sin version 3D, se usa Noto`);
  if (!(await download(code))) return false;
  fs.copyFileSync(path.join(PUBLIC, 'emoji', `${code}.png`), dest);
  return true;
};

const download = async (arg: string): Promise<boolean> => {
  const code = normalizeEmoji(arg);
  if (!code) {
    console.error(`  ✗ "${arg}": no es un emoji ni un codigo valido (ej.: 😀, U+1F600, 1f600)`);
    return false;
  }
  const dest = path.join(PUBLIC, 'emoji', `${code}.png`);
  if (fs.existsSync(dest)) {
    console.log(`  = ${code}: ya existe (no se sobrescribe)`);
    return true;
  }
  const res = await fetch(notoUrl(code));
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok || !body.subarray(0, 8).equals(PNG_SIGNATURE)) {
    console.error(`  ✗ ${code}: Noto Emoji no lo tiene (HTTP ${res.status})`);
    return false;
  }
  fs.writeFileSync(dest, body);
  console.log(`  + ${code}: descargado (${Math.round(body.length / 1024)} KB)`);
  return true;
};

const main = async () => {
  const all = process.argv.slice(2);
  const is3d = all.includes('--3d');
  const args = all.filter((a) => a !== '--3d');
  if (!args.length) {
    console.error('Uso: npm run emoji -- [--3d] <emoji o codigo...>');
    process.exit(2);
  }
  let ok = true;
  const index = is3d ? await fluentIndex() : {};
  for (const a of args) ok = (is3d ? await download3d(a, index) : await download(a)) && ok;
  process.exit(ok ? 0 : 1);
};

main().catch((e) => {
  console.error(`ERROR: ${(e as Error).message}`);
  process.exit(1);
});
