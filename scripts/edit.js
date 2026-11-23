// Uso: node scripts/edit.js <video|audio|guion.txt> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]
// Guion solo (.txt sin nota de voz al lado) -> voz IA clonada (scripts/tts.ts, NOMBRE.ai.mp3), sin limpiar audio.
// Normaliza (mp4/mov) o convierte la nota de voz -> limpia la voz (pipeline/audio_clean.py; --no-clean lo salta) -> transcribe el audio limpio
// -> alinea con el guion si hay <nombre>.txt junto a la entrada -> corta silencios -> valida edit.json y renderiza (scripts/render.js)
// en media/output/edited/<nombre>/<nombre>_edited.mp4
// --plan-only: se detiene tras cortar silencios (lo usan las skills: luego inspect -> edit.json -> validate -> preview)
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {outputPaths} = require('./outputs');
const {publicMp4} = require('./normalize');
const {resolveInput} = require('./voiceInput');
const {transcribirConTrabajador, avisoBajaConfianza} = require('./transcribeClient');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const args = process.argv.slice(2);
const VALUED = ['--model', '--gap'];
const video = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const planOnly = args.includes('--plan-only');
let noClean = args.includes('--no-clean');
if (!video) {
  console.error('Uso: node scripts/edit.js <video|audio|guion.txt> [--model medium] [--gap 0.7] [--plan-only] [--no-clean]');
  process.exit(1);
}
const input = resolveInput(video, (dir) => fs.readdirSync(path.resolve(root, dir)));
const {name} = input;
if (input.realVoice) console.log(`uso la nota de voz real ${input.realVoice}`);
if (input.kind === 'script') noClean = true; // la voz IA ya sale limpia: el denoiser solo la empeoraria
const publicVideo = `${name}.mp4`;
const out = outputPaths(root, name).final;
const audioOnly = input.kind !== 'video'; // nota de voz: fondo plano + audio (estrategia voice)
const scriptTxt = path.join(path.dirname(path.resolve(root, video)), `${name}.txt`); // guion junto al archivo de entrada

const steps = [
  ...(input.kind === 'script' ? [['voz IA', `npx tsx scripts/tts.ts "${video}"`]] : []),
  audioOnly
    ? ['audio a video', `npx tsx scripts/audio-to-video.ts "${input.source}" "public/${publicVideo}"`]
    : ['normalizar video (mp4/mov -> mp4 720x1280 30 fps)', `node scripts/normalize_video.js "${video}" "${publicMp4(video, root)}"`],
  ...(noClean ? [] : [['limpiar audio', `"${py}" pipeline/audio_clean.py "public/${publicVideo}"`]]),
  // se transcribe el mp4 normalizado: mismos tiempos que el render (un mov puede tener fps variable)
  ['transcribir', () => transcribir()],
  ...(fs.existsSync(scriptTxt)
    ? [
        ['alinear con guion', () => fs.rmSync(path.join(root, 'public', `${name}.transcript.whisper.json`), {force: true})],
        ['alinear con guion', `npx tsx scripts/script-align.ts "${name}" "${scriptTxt}"`],
      ]
    : []),
  ['cortar silencios', `"${py}" pipeline/cut.py "public/${name}.transcript.json" --gap ${opt('--gap', '0.7')}`],
];
if (!planOnly) steps.push(['validar y renderizar', `node scripts/render.js "${publicVideo}"${args.includes('--no-music') ? ' --no-music' : ''}`]);

// Transcribir: el trabajador en memoria de la web (TRANSCRIBIR_URL) si responde; si no, la linea de comandos de siempre.
async function transcribir() {
  const model = opt('--model', 'medium');
  const vocab = path.join(root, 'pipeline', 'vocab.txt');
  const r = await transcribirConTrabajador({
    url: process.env.TRANSCRIBIR_URL,
    video: path.join(root, 'public', publicVideo),
    out: path.join(root, 'public', `${name}.transcript.json`),
    model,
    prompt: input.noPrompt || !fs.existsSync(vocab) ? '' : fs.readFileSync(vocab, 'utf8').trim(),
  });
  if (r.ok) {
    console.log(`transcriptor en memoria (${r.palabras} palabras)`);
    const aviso = avisoBajaConfianza(r.bajaConfianza, `public/${name}.transcript.json`);
    if (aviso) console.log(aviso);
    return;
  }
  if (process.env.TRANSCRIBIR_URL) console.log(`aviso: transcriptor en memoria no disponible (${r.motivo}), uso el normal`);
  execSync(`"${py}" pipeline/transcribe_diarize.py "public/${publicVideo}" --no-diarize --model ${model}${input.noPrompt ? ' --prompt ""' : ''}`, {cwd: root, stdio: 'inherit'});
}

(async () => {
  let last = '';
  for (const [label, cmd] of steps) {
    if (label !== last) console.log(`\n== ${label} ==`);
    last = label;
    try {
      if (typeof cmd === 'function') await cmd();
      else execSync(cmd, {cwd: root, stdio: 'inherit'});
    } catch {
      console.error(`\nFALLO en el paso: ${label}`);
      process.exit(1);
    }
  }
  console.log(planOnly ? `\nListo para planificar. Siguiente: npm run inspect -- ${name}` : `\nListo: ${out}`);
})();
