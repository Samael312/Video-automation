// Uso: node scripts/extract_frames.js video.mp4 [fps=1] [outDir=media/output/work/frames]
const {execFileSync} = require('child_process');
const fs = require('fs');
const [,, video, fps = '1', out = 'media/output/work/frames'] = process.argv;
fs.mkdirSync(out, {recursive: true});
execFileSync('ffmpeg', ['-y', '-i', video, '-vf', `fps=${fps}`, `${out}/frame_%04d.jpg`], {stdio: 'inherit'});
