// Uso: npm run validate -- <video>
// Valida public/<nombre>.edit.json contra el transcript y los cortes. Sale con codigo 1 si hay errores.
import {defaultPlan, validatePlan, type EditPlan} from '../src/lib/plan';
import {motionShare, motionWarnings} from '../src/lib/motion';
import {themes} from '../src/styles/themes';
import {GENERATED} from '../src/scenes/generated';
import {knownEmojis, knownEmojis3d, loadTranscriptAndKeeps, readPublicJson, resolveVideo} from './common';

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
  console.log(`motion: ${Math.round(motionShare(motionPlan, keeps) * 100)} % de la duracion final`);
}
console.log(`OK: ${name}.edit.json valido`);
