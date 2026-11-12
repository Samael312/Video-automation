// Uso: npm run clean -- <video>   borra temporales y hoja de preview de ese video
//      npm run clean -- --all     deja media/output solo con edited/ (los videos finales)
const path = require('path');
const {cleanResidue, cleanAll} = require('./outputs');

const root = path.join(__dirname, '..');
const arg = process.argv[2];
if (!arg) {
  console.error('Uso: npm run clean -- <video> | --all');
  process.exit(2);
}
if (arg === '--all') {
  const removed = cleanAll(root);
  console.log(removed.length ? `Borrado de media/output: ${removed.join(', ')}` : 'Nada que borrar.');
} else {
  const name = path.basename(arg).replace(/\.[^.]+$/, '');
  cleanResidue(root, name);
  console.log(`Limpio: temporales de ${name}`);
}
