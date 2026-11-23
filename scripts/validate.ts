// Uso: npm run validate -- <video>
// Valida public/<nombre>.edit.json contra el transcript y los cortes. Sale con codigo 1 si hay errores.
import fs from 'node:fs';
import path from 'node:path';
import {defaultPlan, matteFile, validatePlan, type EditPlan} from '../src/lib/plan';
import {matteInfoFile, type MatteInfo} from '../src/lib/matte';
import {motionShare, motionWarnings} from '../src/lib/motion';
import {themes} from '../src/styles/themes';
import {GENERATED} from '../src/scenes/generated';
import {emojiDirsOf} from '../src/lib/propAssets';
import {knownEmojis, knownEmojis3d, knownMusic, knownSfx, loadTranscriptAndKeeps, PUBLIC, readPublicJson, resolveVideo} from './common';

const {name, video} = resolveVideo(process.argv[2], 'npm run validate -- <video>');
const {transcript, keeps} = loadTranscriptAndKeeps(name);
const plan = readPublicJson<unknown>(`${name}.edit.json`);
if (!plan) console.log(`(sin ${name}.edit.json: se valida el plan por defecto)`);

const ctx = {
  video,
  duration: transcript.duration,
  keeps,
  knownStyles: Object.keys(themes),
  knownGenerated: Object.keys(GENERATED),
  knownEmojis: knownEmojis(),
  knownEmojis3d: knownEmojis3d(),
  knownMusic: knownMusic(),
  knownSfx: knownSfx(),
  // carpeta de emojis de cada componente generado, leida de su codigo (src/scenes/generated/<nombre>.tsx)
  generatedEmojiDirs: Object.fromEntries(
    Object.keys(GENERATED).map((c) => {
      const f = path.join(__dirname, '..', 'src', 'scenes', 'generated', `${c}.tsx`);
      return [c, fs.existsSync(f) ? emojiDirsOf(fs.readFileSync(f, 'utf8')) : []];
    }),
  ),
  matte: fs.existsSync(path.join(PUBLIC, matteFile(video))) ? readPublicJson<MatteInfo>(matteInfoFile(video)) : null,
};
const errors = validatePlan(plan ?? defaultPlan(video), ctx);
if (errors.length) {
  console.error(`edit.json invalido (${errors.length} error${errors.length === 1 ? '' : 'es'}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
const motionPlan = plan as EditPlan | null;
if (motionPlan?.motion) {
  const warnings = motionWarnings(motionPlan, ctx);
  if (warnings.length) {
    console.warn(`AVISOS (${warnings.length}):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
  console.log(motionPlan.strategy === 'voice' ? 'voice: motion cubre todo el video' : `motion: ${Math.round(motionShare(motionPlan, keeps) * 100)} % de la duracion final`);
}
console.log(`OK: ${name}.edit.json valido`);
