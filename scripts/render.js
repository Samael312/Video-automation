// Uso: node scripts/render.js <video>   (o: npm run render:plan -- <video>)
// Valida public/<nombre>.edit.json y, si es valido, renderiza la composicion Edit a media/output/edited/<nombre>_edited.mp4
// Si sale bien, borra los temporales y la hoja de preview de ese video.
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {outputPaths, cleanResidue} = require('./outputs');

const root = path.join(__dirname, '..');
const arg = process.argv[2];
if (!arg) {
  console.error('Uso: npm run render:plan -- <video>');
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
fs.writeFileSync(propsFile, JSON.stringify({videoSrc: publicVideo, transcript: null, keeps: [], plan: null}));
run('renderizar', `npx remotion render src/index.ts Edit "${out}" --props="${propsFile}"`);
cleanResidue(root, name);
console.log(`\nListo: ${out}\n(temporales y hoja de preview de ${name} borrados)`);
