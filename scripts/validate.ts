// Uso: npm run validate -- <video>
// Valida public/<nombre>.edit.json contra el transcript y los cortes. Sale con codigo 1 si hay errores.
import {defaultPlan, validatePlan} from '../src/lib/plan';
import {themes} from '../src/styles/themes';
import {GENERATED} from '../src/scenes/generated';
import {knownEmojis, loadTranscriptAndKeeps, readPublicJson, resolveVideo} from './common';

const {name, video} = resolveVideo(process.argv[2], 'npm run validate -- <video>');
const {transcript, keeps} = loadTranscriptAndKeeps(name);
const plan = readPublicJson<unknown>(`${name}.edit.json`);
if (!plan) console.log(`(sin ${name}.edit.json: se valida el plan por defecto)`);

const errors = validatePlan(plan ?? defaultPlan(video), {
  video,
  duration: transcript.duration,
  keeps,
  knownStyles: Object.keys(themes),
  knownGenerated: Object.keys(GENERATED),
  knownEmojis: knownEmojis(),
});
if (errors.length) {
  console.error(`edit.json invalido (${errors.length} error${errors.length === 1 ? '' : 'es'}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`OK: ${name}.edit.json valido`);
