// Uso: npm run script-align -- <video> [guion.txt]
// Pone el texto del guion (media/input/<nombre>.txt por defecto) sobre los tiempos de WhisperX en public/<nombre>.transcript.json.
// El transcript original queda en public/<nombre>.transcript.whisper.json y siempre se alinea desde ahi (correrlo dos veces da lo mismo).
import fs from 'node:fs';
import path from 'node:path';
import {alignScript, rebuildSegments} from '../src/lib/scriptAlign';
import type {Word} from '../src/lib/types';
import {PUBLIC, ROOT, resolveVideo} from './common';

type TranscriptFile = {words: Word[]; segments?: {start: number; end: number; text: string}[]} & Record<string, unknown>;

const {name} = resolveVideo(process.argv[2], 'npm run script-align -- <video> [guion.txt]');
const scriptPath = process.argv[3] ?? path.join(ROOT, 'media', 'input', `${name}.txt`);
if (!fs.existsSync(scriptPath)) {
  console.error(`falta el guion ${scriptPath}`);
  process.exit(1);
}
const current = path.join(PUBLIC, `${name}.transcript.json`);
const original = path.join(PUBLIC, `${name}.transcript.whisper.json`);
if (!fs.existsSync(original)) {
  if (!fs.existsSync(current)) {
    console.error(`falta public/${name}.transcript.json (transcribe primero)`);
    process.exit(1);
  }
  fs.copyFileSync(current, original);
}
const t = JSON.parse(fs.readFileSync(original, 'utf8')) as TranscriptFile;

try {
  const {words, report} = alignScript(fs.readFileSync(scriptPath, 'utf8'), t.words ?? []);
  const out: TranscriptFile = {...t, words, ...(t.segments ? {segments: rebuildSegments(t.segments, words)} : {})};
  fs.writeFileSync(current, JSON.stringify(out, null, 2) + '\n');
  console.log(`coincidencia ${Math.round(report.match * 100)} % — ${report.replaced.length} reemplazos, ${report.added.length} añadidas, ${report.dropped.length} descartadas`);
  report.replaced.slice(0, 15).forEach((r) => console.log(`  "${r.from.join(' ')}" -> "${r.to.join(' ')}"`));
  if (report.added.length) console.log(`  añadidas: ${report.added.slice(0, 15).join(', ')}`);
  if (report.dropped.length) console.log(`  descartadas: ${report.dropped.slice(0, 15).join(', ')}`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
