// Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7]
// Normaliza -> transcribe -> corta silencios -> valida edit.json y renderiza (scripts/render.js) en media/output/<nombre>_edited.mp4
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--model' && args[args.indexOf(a) - 1] !== '--gap');
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
if (!video) {
  console.error('Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7]');
  process.exit(1);
}
const name = path.basename(video).replace(/\.[^.]+$/, '');
const publicVideo = `${name}.mp4`;
const outDir = path.join(root, 'media', 'output');
const out = path.join(outDir, `${name}_edited.mp4`);
fs.mkdirSync(outDir, {recursive: true});

const steps = [
  ['normalizar video', `node scripts/normalize_video.js "${video}" "public/${publicVideo}"`],
  ['transcribir', `"${py}" pipeline/transcribe_diarize.py "${video}" --model ${opt('--model', 'medium')}`],
  ['cortar silencios', `"${py}" pipeline/cut.py "public/${name}.transcript.json" --gap ${opt('--gap', '0.7')}`],
  ['validar y renderizar', `node scripts/render.js "${publicVideo}"`],
];
for (const [label, cmd] of steps) {
  console.log(`\n== ${label} ==`);
  try {
    execSync(cmd, {cwd: root, stdio: 'inherit'});
  } catch {
    console.error(`\nFALLO en el paso: ${label}`);
    process.exit(1);
  }
}
console.log(`\nListo: ${out}`);
