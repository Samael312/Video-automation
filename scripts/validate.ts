// Uso: npx tsx scripts/validate.ts <video>   (o: npm run validate -- <video>)
// Valida public/<nombre>.edit.json contra el transcript y los cortes. Sale con codigo 1 si hay errores.
import fs from 'node:fs';
import path from 'node:path';
import {defaultPlan, validatePlan} from '../src/lib/plan';
import {themes} from '../src/styles/themes';
import {GENERATED} from '../src/scenes/generated';
import type {CutsFile, Transcript} from '../src/lib/types';

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: npm run validate -- <video>');
  process.exit(2);
}
const base = path.basename(arg);
const name = base.replace(/\.[^.]+$/, '');
const video = /\.[^.]+$/.test(base) ? base : `${base}.mp4`;
const pub = path.join(__dirname, '..', 'public');
const readJson = <T>(file: string): T | null => {
  const p = path.join(pub, file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch (e) {
    console.error(`ERROR: ${file} no es JSON valido: ${(e as Error).message}`);
    process.exit(1);
  }
};

const transcript = readJson<Transcript>(`${name}.transcript.json`);
if (!transcript) {
  console.error(`ERROR: falta public/${name}.transcript.json (corre la transcripcion primero)`);
  process.exit(1);
}
const cuts = readJson<CutsFile>(`${name}.cuts.json`);
const keeps = cuts ? cuts.keeps : [{start: 0, end: transcript.duration}];
const plan = readJson<unknown>(`${name}.edit.json`);
if (!plan) console.log(`(sin ${name}.edit.json: se valida el plan por defecto)`);

const errors = validatePlan(plan ?? defaultPlan(video), {
  video,
  duration: transcript.duration,
  keeps,
  knownStyles: Object.keys(themes),
  knownGenerated: Object.keys(GENERATED),
});
if (errors.length) {
  console.error(`edit.json invalido (${errors.length} error${errors.length === 1 ? '' : 'es'}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`OK: ${name}.edit.json valido`);
