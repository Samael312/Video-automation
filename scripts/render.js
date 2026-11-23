// Uso: node scripts/render.js <video> [--no-music]   (o: npm run render:plan -- <video> [--no-music])
// Envoltorio de scripts/render.ts (render final robusto): valida public/<nombre>.edit.json, hace un render de prueba,
// renderiza a media/output/edited/<nombre>/<nombre>_edited.mp4 (via .tmp, con 1 reintento si falla el compositor),
// corrige el volumen final y borra los temporales y la hoja de preview. Si algo falla, el video anterior queda intacto.
const {spawnSync} = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const r = spawnSync(process.execPath, [require.resolve('tsx/cli'), path.join('scripts', 'render.ts'), ...process.argv.slice(2)], {cwd: root, stdio: 'inherit'});
process.exit(r.status === null ? 1 : r.status);
