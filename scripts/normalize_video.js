// Uso: node scripts/normalize_video.js entrada.(mp4|mov|m4v) [salida=public/<nombre>.mp4]
// Aplica la rotacion del movil, HDR -> SDR, 720x1280, 30 fps y yuv420p. La salida siempre es mp4.
const path = require('path');
const {normalize, publicMp4} = require('./normalize');

const [,, input, out] = process.argv;
if (!input) {
  console.error('Uso: node scripts/normalize_video.js entrada.(mp4|mov) [salida.mp4]');
  process.exit(2);
}
const dest = out || publicMp4(input, path.join(__dirname, '..'));
const r = normalize(input, dest);
console.log(`OK -> ${dest}  (desde ${r.from}${r.hdr ? ', HDR convertido a SDR' : ''})`);
