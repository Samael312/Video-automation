// Normalizacion de la entrada (mp4, mov, m4v...) al formato que usa todo el pipeline:
// public/<nombre>.mp4, H.264 yuv420p SDR bt709, 720x1280, 30 fps constantes, AAC 48 kHz.
const {execFileSync} = require('child_process');
const path = require('path');

const W = 720;
const H = 1280;
const FPS = 30;
const HDR_TRANSFERS = ['arib-std-b67', 'smpte2084']; // HLG (iPhone) y PQ

/** Cualquier entrada -> public/<nombre>.mp4 (la salida siempre es mp4). */
const publicMp4 = (input, root) => path.join(root, 'public', `${path.parse(input.replace(/\\/g, '/')).name}.mp4`);

const isHdr = (stream) => HDR_TRANSFERS.includes(stream.color_transfer);

/** Cadena -vf. ffmpeg ya aplica la rotacion del movil (autorotate) antes de estos filtros. */
const normalizeFilter = (stream) => [
  ...(isHdr(stream)
    ? ['zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv']
    : []),
  `fps=${FPS}`,
  `scale=${W}:${H}:force_original_aspect_ratio=increase`,
  `crop=${W}:${H}`,
  'setsar=1',
  'format=yuv420p',
].join(',');

const probeVideo = (input) =>
  JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,color_transfer', '-of', 'json', input]).toString()).streams[0] || {};

const normalize = (input, dest) => {
  const stream = probeVideo(input);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', normalizeFilter(stream), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart', '-metadata:s:v', 'rotate=0', dest], {stdio: 'inherit'});
  return {hdr: isHdr(stream), from: `${stream.width}x${stream.height} ${stream.codec_name}`};
};

module.exports = {publicMp4, isHdr, normalizeFilter, normalize, W, H, FPS};
