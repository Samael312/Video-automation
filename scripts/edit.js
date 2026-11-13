// Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]
// Normaliza -> limpia la voz (pipeline/audio_clean.py; --no-clean lo salta) -> transcribe el audio limpio -> corta silencios -> valida edit.json y renderiza (scripts/render.js) en media/output/edited/<nombre>/<nombre>_edited.mp4
// --plan-only: se detiene tras cortar silencios (lo usan las skills: luego inspect -> edit.json -> validate -> preview)
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const args = process.argv.slice(2);
const VALUED = ['--model', '--gap'];
const video = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const planOnly = args.includes('--plan-only');
const noClean = args.includes('--no-clean');
if (!video) {
  console.error('Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]');
  process.exit(1);
}
const name = path.basename(video).replace(/\.[^.]+$/, '');
const publicVideo = `${name}.mp4`;
const outDir = path.join(root, 'media', 'output');
const out = path.join(outDir, 'edited', name, `${name}_edited.mp4`);
fs.mkdirSync(path.dirname(out), {recursive: true});

const steps = [
  ['normalizar video', `node scripts/normalize_video.js "${video}" "public/${publicVideo}"`],
  ...(noClean ? [] : [['limpiar audio', `"${py}" pipeline/audio_clean.py "public/${publicVideo}"`]]),
  ['transcribir', `"${py}" pipeline/transcribe_diarize.py "public/${publicVideo}" --model ${opt('--model', 'medium')}`],
  ['cortar silencios', `"${py}" pipeline/cut.py "public/${name}.transcript.json" --gap ${opt('--gap', '0.7')}`],
];
if (!planOnly) steps.push(['validar y renderizar', `node scripts/render.js "${publicVideo}"${args.includes('--no-music') ? ' --no-music' : ''}`]);

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
