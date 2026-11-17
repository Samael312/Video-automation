// Uso: node scripts/render.js <video> [--no-music]   (o: npm run render:plan -- <video> [--no-music])
// Valida public/<nombre>.edit.json y, si es valido, renderiza la composicion Edit a media/output/edited/<nombre>/<nombre>_edited.mp4
// (una carpeta por video, junto a su _caption.txt). Copia la musica del plan (media/music) a public/music y corrige el volumen final
// (pipeline/final_loudness.py). Si sale bien, borra los temporales y la hoja de preview de ese video.
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {outputPaths, cleanResidue} = require('./outputs');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const noMusic = process.argv.includes('--no-music');
if (!arg) {
  console.error('Uso: npm run render:plan -- <video> [--no-music]');
  process.exit(2);
}
const base = path.basename(arg);
const name = base.replace(/\.[^.]+$/, '');
const publicVideo = `${name}.mp4`; // siempre el mp4 normalizado, aunque se pase X.mov
const paths = outputPaths(root, name);
const out = paths.final;
const propsFile = paths.props;
fs.mkdirSync(paths.finalDir, {recursive: true});
fs.mkdirSync(paths.work, {recursive: true});

const run = (label, cmd) => {
  console.log(`\n== ${label} ==`);
  try {
    execSync(cmd, {cwd: root, stdio: 'inherit'});
  } catch {
    console.error(`\nFALLO en el paso: ${label}`);
    process.exit(1);
  }
};

run('validar edit.json', `npx tsx scripts/validate.ts "${publicVideo}"`);
// calculateMetadata de la composicion carga transcript, cuts y plan desde public/
const planFile = path.join(root, 'public', `${name}.edit.json`);
const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
let planOverride = null;
if (plan && plan.music && noMusic) {
  const {music, ...rest} = plan;
  planOverride = rest;
  console.log(`
(--no-music: se renderiza sin ${music.file})`);
} else if (plan && plan.music) {
  const src = path.join(root, 'media', 'music', plan.music.file);
  if (!fs.existsSync(src)) {
    console.error(`FALLO: no existe media/music/${plan.music.file}`);
    process.exit(1);
  }
  fs.mkdirSync(path.join(root, 'public', 'music'), {recursive: true});
  fs.copyFileSync(src, path.join(root, 'public', 'music', plan.music.file));
}
fs.writeFileSync(propsFile, JSON.stringify({videoSrc: publicVideo, transcript: null, keeps: [], plan: planOverride}));
run('renderizar', `npx remotion render src/index.ts Edit "${out}" --props="${propsFile}"`);
run('volumen final', `"${py}" pipeline/final_loudness.py "${out}"`);
cleanResidue(root, name);
console.log(`\nListo: ${out}\n(temporales y hoja de preview de ${name} borrados)`);
