// Uso: npm run preview -- <video>
// Valida el plan y genera media/output/<nombre>_preview.png: una captura por escena, label, titulo y cierre.
// Es la hoja que la skill muestra al usuario antes del render final.
import {execFileSync, execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {getServeUrl} from './bundleCache';
import {renderStill, selectComposition} from '@remotion/renderer';
import {defaultPlan, type EditPlan} from '../src/lib/plan';
import {previewFrames} from '../src/lib/preview';
import {quantizeKeeps} from '../src/lib/cuts';
import {loadTranscriptAndKeeps, readPublicJson, resolveVideo, ROOT} from './common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {outputPaths} = require('./outputs.js') as {outputPaths: (root: string, name: string) => {stills: string; sheet: string}};

const COLS = 4;
const THUMB_WIDTH = 360;

const main = async () => {
  const {name, video} = resolveVideo(process.argv[2], 'npm run preview -- <video>');
  try {
    execSync(`npx tsx scripts/validate.ts "${video}"`, {cwd: ROOT, stdio: 'inherit'});
  } catch {
    console.error('\nCorrige edit.json y vuelve a correr el preview.');
    process.exit(1);
  }
  const {keeps: rawKeeps} = loadTranscriptAndKeeps(name);
  const plan = readPublicJson<EditPlan>(`${name}.edit.json`) ?? defaultPlan(video);

  console.log('\n== preparando Remotion ==');
  const serveUrl = await getServeUrl();
  const inputProps = {videoSrc: video, transcript: null, keeps: [], plan: null};
  const composition = await selectComposition({serveUrl, id: 'Edit', inputProps});
  const keeps = quantizeKeeps(rawKeeps, composition.fps);
  const frames = previewFrames(plan, keeps, composition.fps, composition.durationInFrames);

  const {stills: dir, sheet} = outputPaths(ROOT, name);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  console.log(`== ${frames.length} capturas ==`);
  for (const [i, f] of frames.entries()) {
    const file = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    await renderStill({composition, serveUrl, output: file, frame: f.frame, inputProps, imageFormat: 'png'});
    console.log(`  #${i + 1}  ${(f.frame / composition.fps).toFixed(2)} s  ${f.label}`);
  }

  const rows = Math.ceil(frames.length / COLS);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%02d.png'),
    '-vf', `scale=${THUMB_WIDTH}:-1,tile=${COLS}x${rows}:padding=6:margin=6`, '-frames:v', '1', sheet]);
  fs.rmSync(dir, {recursive: true, force: true}); // las capturas sueltas ya estan en la hoja
  console.log(`\nHoja de preview: ${sheet}\n(capturas en orden de lectura: izquierda a derecha, arriba a abajo)`);
};

main().catch((e) => {
  console.error(`ERROR en el preview: ${(e as Error).message}`);
  process.exit(1);
});
