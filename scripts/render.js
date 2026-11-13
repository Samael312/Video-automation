// Uso: node scripts/render.js <video>   (o: npm run render:plan -- <video>)
// Valida public/<nombre>.edit.json y, si es valido, renderiza la composicion Edit a media/output/edited/<nombre>/<nombre>_edited.mp4 (una carpeta por video, junto a su _caption.txt)
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const arg = process.argv[2];
if (!arg) {
  console.error('Uso: npm run render:plan -- <video>');
  process.exit(2);
}
const base = path.basename(arg);
const name = base.replace(/\.[^.]+$/, '');
const publicVideo = /\.[^.]+$/.test(base) ? base : `${base}.mp4`;
const outDir = path.join(root, 'media', 'output');
const out = path.join(outDir, 'edited', name, `${name}_edited.mp4`);
const propsFile = path.join(outDir, `${name}.props.json`);
fs.mkdirSync(path.dirname(out), {recursive: true});

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
console.log(`\nListo: ${out}`);
