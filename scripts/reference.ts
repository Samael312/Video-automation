// Uso: npm run reference -- <video en media/reference | --all> [--no-transcribe]
// Por cada video: hojas de fotogramas (1/s), cortes de camara, transcript y report.md
// en media/output/work/reference/<nombre>/. Lo usa la skill analyze-reference.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {formatReport, parseSceneTimes, referenceStats, type RefWord} from '../src/lib/reference';
import {ROOT} from './common';

const REF_DIR = path.join(ROOT, 'media', 'reference');
const OUT_ROOT = path.join(ROOT, 'media', 'output', 'work', 'reference');
const PY = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
const SCENE_THRESHOLD = 0.12; // los jump cuts de talking head son sutiles; 0.3 no los ve

const args = process.argv.slice(2);
const transcribe = !args.includes('--no-transcribe');
const target = args.find((a) => !a.startsWith('--') || a === '--all');
if (!target) {
  console.error('Uso: npm run reference -- <video | --all> [--no-transcribe]');
  process.exit(2);
}

const resolve = (a: string): string => {
  for (const p of [a, path.join(REF_DIR, a), path.join(REF_DIR, `${a}.mp4`)]) if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
  console.error(`ERROR: no existe ${a} (ni en media/reference)`);
  process.exit(1);
};

const videos = target === '--all'
  ? fs.readdirSync(REF_DIR).filter((f) => VIDEO_EXT.test(f)).map((f) => path.join(REF_DIR, f))
  : [resolve(target)];
if (!videos.length) {
  console.error('No hay videos en media/reference.');
  process.exit(1);
}

const probeDuration = (v: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v]).toString().trim());

const analyze = (video: string) => {
  const name = path.basename(video).replace(/\.[^.]+$/, '');
  const out = path.join(OUT_ROOT, name);
  fs.mkdirSync(out, {recursive: true});
  console.log(`\n== ${name} ==`);

  const duration = probeDuration(video);
  const scene = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-vf', `select='gt(scene,${SCENE_THRESHOLD})',showinfo`, '-an', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const sceneTimes = parseSceneTimes(scene.stderr ?? '');
  console.log(`  ${duration.toFixed(1)} s, ${sceneTimes.length} cortes de camara`);

  for (const f of fs.readdirSync(out)) if (f.startsWith('sheet_')) fs.rmSync(path.join(out, f));
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'fps=1,scale=240:-1,tile=6x5:padding=4:margin=4', path.join(out, 'sheet_%02d.png')]);
  const sheets = fs.readdirSync(out).filter((f) => f.startsWith('sheet_')).sort().map((f) => path.join(out, f));
  console.log(`  ${sheets.length} hoja(s) de fotogramas`);

  const transcriptFile = path.join(out, 'transcript.json');
  if (transcribe && !fs.existsSync(transcriptFile)) {
    console.log('  transcribiendo (WhisperX medium, tarda unos minutos)...');
    // sin vocab.txt: el prompt de la profe hace que Whisper alucine palabras en ingles en videos ajenos
    execFileSync(PY, [path.join(ROOT, 'pipeline', 'transcribe_diarize.py'), video, '--prompt', '', '--out', transcriptFile], {cwd: ROOT, stdio: 'inherit'});
  }
  const words: RefWord[] = fs.existsSync(transcriptFile) ? JSON.parse(fs.readFileSync(transcriptFile, 'utf8')).words : [];

  const stats = referenceStats({duration, sceneTimes, words});
  const report = path.join(out, 'report.md');
  fs.writeFileSync(report, formatReport({name, stats, sceneTimes, sheets, words}));
  console.log(`  report: ${report}`);
};

for (const v of videos) analyze(v);
console.log(`\nListo. Al terminar de aplicar cambios: npm run clean -- reference`);
