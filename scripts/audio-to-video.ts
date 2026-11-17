// Uso: npm run audio-to-video -- <audio> <salida.mp4>
// Nota de voz -> mp4 720x1280 30 fps con el fondo claro de motion, para que entre al pipeline como un video (estrategia voice).
import {execFileSync} from 'node:child_process';
import {audioToVideoArgs} from '../src/lib/audioInput';
import {palette} from '../src/motion/palette';

const [input, out] = process.argv.slice(2);
if (!input || !out) {
  console.error('Uso: npm run audio-to-video -- <audio> <salida.mp4>');
  process.exit(2);
}
try {
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input], {encoding: 'utf8'}).trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('sin duracion');
  execFileSync('ffmpeg', ['-v', 'error', ...audioToVideoArgs(input, out, palette('light').bg, duration)], {stdio: 'inherit'});
} catch {
  console.error(`ffmpeg no pudo convertir ${input}`);
  process.exit(1);
}
console.log(`audio a video: ${out}`);
