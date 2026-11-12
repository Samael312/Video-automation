// Uso: npm run emoji -- <emoji o codigo...>     p. ej.: npm run emoji -- 😀 U+1F44D 1f4a1
// Descarga emojis de Noto Emoji (PNG 512 px, Apache 2.0) a public/emoji/<codigo>.png.
// No sobrescribe los que ya existen. En el plan se usan por su codigo: {"kind": "emoji", "file": "1f600", ...}
import fs from 'node:fs';
import path from 'node:path';
import {normalizeEmoji, notoUrl} from '../src/lib/emoji';
import {PUBLIC} from './common';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Uso: npm run emoji -- <emoji o codigo...>');
    process.exit(2);
  }
  let ok = true;
  for (const a of args) ok = (await download(a)) && ok;
  process.exit(ok ? 0 : 1);
};

main().catch((e) => {
  console.error(`ERROR: ${(e as Error).message}`);
  process.exit(1);
});
