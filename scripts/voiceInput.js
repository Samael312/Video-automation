// Que audio usa edit.js: video, nota de voz, o guion solo (voz IA clonada en NOMBRE.ai.mp3).
// Con guion, una nota de voz real NOMBRE.<audio> en la misma carpeta gana a la voz IA.
const path = require('path');

const AUDIO_EXT = ['.m4a', '.mp3', '.ogg', '.opus', '.wav'];

/** @param list (dir) => nombres de archivo de esa carpeta (fs.readdirSync) */
const resolveInput = (input, list) => {
  const dir = path.dirname(input);
  const ext = path.extname(input).toLowerCase();
  const name = path.basename(input, path.extname(input)).replace(/\.ai$/i, '');
  if (ext === '.txt') {
    const real = list(dir).find((f) => {
      const e = path.extname(f).toLowerCase();
      // sin distinguir mayusculas (Windows: pt.m4a = PT.m4a); NOMBRE.ai.mp3 tiene base NOMBRE.ai y no cuenta
      return AUDIO_EXT.includes(e) && path.basename(f, path.extname(f)).toLowerCase() === name.toLowerCase();
    });
    if (real) return {kind: 'audio', name, source: path.join(dir, real), realVoice: real};
    // noPrompt: el prompt de vocabulario (todo en ingles) + voz IA hace que Whisper escriba en ingles; el guion ya corrige la ortografia
    return {kind: 'script', name, source: path.join(dir, `${name}.ai.mp3`), noPrompt: true};
  }
  return {kind: AUDIO_EXT.includes(ext) ? 'audio' : 'video', name, source: input};
};

module.exports = {AUDIO_EXT, resolveInput};
