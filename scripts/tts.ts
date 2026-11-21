// Uso: npm run tts -- media/input/NOMBRE.txt [--force]
// Guion -> media/input/NOMBRE.ai.mp3 con la voz clonada de la profe (ElevenLabs). Si ya existe y el guion no cambio, no gasta creditos (--force la rehace).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {aiAudioPath, needsTts, synthesize, ttsText, writeAtomic} from '../src/lib/elevenlabs';

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const txt = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const main = async () => {
  if (!txt) fail('Uso: npm run tts -- media/input/NOMBRE.txt [--force]');
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // sin .env: solo variables del entorno
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey) fail('falta ELEVENLABS_API_KEY en .env');
  if (!voiceId) fail('falta ELEVENLABS_VOICE_ID en .env (ver MANUAL: voz clonada)');
  const input = path.resolve(root, txt!);
  if (!fs.existsSync(input)) fail(`falta el guion ${txt}`);
  const out = aiAudioPath(input);
  const mp3MtimeMs = fs.existsSync(out) ? fs.statSync(out).mtimeMs : null;
  if (!needsTts({force, txtMtimeMs: fs.statSync(input).mtimeMs, mp3MtimeMs})) {
    console.log(`audio IA ya existe: ${path.relative(root, out)} (--force para rehacerlo)`);
    return;
  }
  if (mp3MtimeMs !== null && !force) console.log('el guion cambio despues del audio IA: se genera de nuevo');
  const text = ttsText(fs.readFileSync(input, 'utf8'));
  writeAtomic(out, await synthesize({apiKey: apiKey!, voiceId: voiceId!, text}));
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], {encoding: 'utf8'}).trim());
  console.log(`voz IA: ${mmss(dur)}, ${text.length} caracteres -> ${path.relative(root, out)}`);
};

main().catch((e: Error) => fail(e.message));
