// Uso: node scripts/verify.js [--full]   (--full: genera video, extrae frames, transcribe con whisper tiny y renderiza un frame Remotion)
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const full = process.argv.includes('--full');
let fail = 0;
const run = (name, cmd) => {
  try {
    const out = execSync(cmd, {cwd: root, stdio: ['ignore', 'pipe', 'pipe']}).toString().trim().split('\n').pop();
    console.log(`OK   ${name}: ${out}`);
  } catch (e) { fail++; console.log(`FAIL ${name}: ${(e.stderr || e.message).toString().trim().split('\n').pop()}`); }
};
run('node', 'node -v');
run('ffmpeg', 'ffmpeg -version');
run('python venv', `"${py}" --version`);
run('torch', `"${py}" -c "import torch;print(torch.__version__, 'cuda=' + str(torch.cuda.is_available()))"`);
run('whisperx', `"${py}" -c "import whisperx;print('import ok')"`);
run('faster-whisper', `"${py}" -c "import faster_whisper;print(faster_whisper.__version__)"`);
run('remotion', 'npx remotion versions');
run('deep-filter (limpieza de voz)', `"${py}" scripts/setup_audio.py --check`);
if (full) {
  const tmp = 'media/output/work/verify';
  fs.mkdirSync(path.join(root, tmp), {recursive: true});
  run('test video', `ffmpeg -y -f lavfi -i testsrc=d=3:s=320x240:r=10 -f lavfi -i sine=f=440:d=3 -shortest ${tmp}/test.mp4`);
  run('frames', `node scripts/extract_frames.js ${tmp}/test.mp4 1 ${tmp}/frames`);
  run('whisperx transcribe', `"${py}" pipeline/transcribe.py ${tmp}/test.mp4 tiny`);
  run('remotion still', `npx remotion still src/index.ts Hello ${tmp}/hello.png --frame=30`);
  require('./outputs').cleanResidue(root, 'verify');
}
console.log(fail ? `\n${fail} fallo(s)` : '\nTodo OK');
process.exit(fail ? 1 : 0);
