// Uso: node scripts/normalize_video.js entrada.mp4 [salida=public/<nombre>.mp4]
// Aplica la rotacion del movil a los pixeles, fps constante 30 y yuv420p. Remotion ignora la metadata de rotacion.
const {execFileSync} = require('child_process');
const path = require('path');
const [,, input, out] = process.argv;
const dest = out || path.join('public', path.basename(input));
execFileSync('ffmpeg', ['-y', '-i', input, '-vf', 'fps=30', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-metadata:s:v', 'rotate=0', dest], {stdio: 'inherit'});
