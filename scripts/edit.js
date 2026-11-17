// Uso: node scripts/edit.js <video|audio> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]
// Normaliza (mp4/mov) o convierte la nota de voz -> limpia la voz (pipeline/audio_clean.py; --no-clean lo salta) -> transcribe el audio limpio
// -> alinea con el guion si hay <nombre>.txt junto a la entrada -> corta silencios -> valida edit.json y renderiza (scripts/render.js)
// en media/output/edited/<nombre>/<nombre>_edited.mp4
// --plan-only: se detiene tras cortar silencios (lo usan las skills: luego inspect -> edit.json -> validate -> preview)
const {execSync} = require('child_process');
const fs = require('fs');
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
const noClean = args.includes('--no-clean');
if (!video) {
  console.error('Uso: node scripts/edit.js <video> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]');
  process.exit(1);
}
const name = path.basename(video).replace(/\.[^.]+$/, '');
const publicVideo = `${name}.mp4`;
const out = outputPaths(root, name).final;
const audioOnly = /\.(m4a|mp3|ogg|opus|wav)$/i.test(video); // nota de voz: fondo plano + audio (estrategia voice)
const scriptTxt = path.join(path.dirname(path.resolve(root, video)), `${name}.txt`); // guion junto al archivo de entrada

const steps = [
  audioOnly
    ? ['audio a video', `npx tsx scripts/audio-to-video.ts "${video}" "public/${publicVideo}"`]
    : ['normalizar video (mp4/mov -> mp4 720x1280 30 fps)', `node scripts/normalize_video.js "${video}" "${publicMp4(video, root)}"`],
  ...(noClean ? [] : [['limpiar audio', `"${py}" pipeline/audio_clean.py "public/${publicVideo}"`]]),
  // se transcribe el mp4 normalizado: mismos tiempos que el render (un mov puede tener fps variable)
  ['transcribir', `"${py}" pipeline/transcribe_diarize.py "public/${publicVideo}" --model ${opt('--model', 'medium')}`],
  ...(fs.existsSync(scriptTxt)
    ? [
        ['alinear con guion', () => fs.rmSync(path.join(root, 'public', `${name}.transcript.whisper.json`), {force: true})],
        ['alinear con guion', `npx tsx scripts/script-align.ts "${name}" "${scriptTxt}"`],
      ]
    : []),
  ['cortar silencios', `"${py}" pipeline/cut.py "public/${name}.transcript.json" --gap ${opt('--gap', '0.7')}`],
];
if (!planOnly) steps.push(['validar y renderizar', `node scripts/render.js "${publicVideo}"${args.includes('--no-music') ? ' --no-music' : ''}`]);

let last = '';
for (const [label, cmd] of steps) {
  if (label !== last) console.log(`\n== ${label} ==`);
  last = label;
  try {
    if (typeof cmd === 'function') cmd();
    else execSync(cmd, {cwd: root, stdio: 'inherit'});
  } catch {
    console.error(`\nFALLO en el paso: ${label}`);
    process.exit(1);
  }
}
console.log(planOnly ? `\nListo para planificar. Siguiente: npm run inspect -- ${name}` : `\nListo: ${out}`);
