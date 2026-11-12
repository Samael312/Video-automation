// Uso: node scripts/edit.js <video.mp4|video.mov> [--model medium] [--gap 0.7] [--plan-only]
// Normaliza -> transcribe -> corta silencios -> valida edit.json y renderiza (scripts/render.js) en media/output/edited/<nombre>_edited.mp4
// --plan-only: se detiene tras cortar silencios (lo usan las skills: luego inspect -> edit.json -> validate -> preview)
const {execSync} = require('child_process');
const path = require('path');
const {outputPaths} = require('./outputs');
const {publicMp4} = require('./normalize');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const args = process.argv.slice(2);
const VALUED = ['--model', '--gap'];
const video = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const planOnly = args.includes('--plan-only');
if (!video) {
  console.error('Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7] [--plan-only]');
  process.exit(1);
}
const name = path.basename(video).replace(/\.[^.]+$/, '');
const publicVideo = `${name}.mp4`;
const out = outputPaths(root, name).final;

const steps = [
  ['normalizar video (mp4/mov -> mp4 720x1280 30 fps)', `node scripts/normalize_video.js "${video}" "${publicMp4(video, root)}"`],
  // se transcribe el mp4 normalizado: mismos tiempos que el render (un mov puede tener fps variable)
  ['transcribir', `"${py}" pipeline/transcribe_diarize.py "public/${publicVideo}" --model ${opt('--model', 'medium')}`],
  ['cortar silencios', `"${py}" pipeline/cut.py "public/${name}.transcript.json" --gap ${opt('--gap', '0.7')}`],
];
if (!planOnly) steps.push(['validar y renderizar', `node scripts/render.js "${publicVideo}"`]);

for (const [label, cmd] of steps) {
  console.log(`\n== ${label} ==`);
  try {
    execSync(cmd, {cwd: root, stdio: 'inherit'});
  } catch {
    console.error(`\nFALLO en el paso: ${label}`);
    process.exit(1);
  }
}
console.log(planOnly ? `\nListo para planificar. Siguiente: npm run inspect -- ${name}` : `\nListo: ${out}`);
