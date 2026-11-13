/** Entrada de solo audio (nota de voz): se envuelve en un mp4 de fondo plano para reutilizar el pipeline de video. */
export const AUDIO_EXTS = ['.m4a', '.mp3', '.ogg', '.opus', '.wav'];

export const isAudioInput = (file: string): boolean => AUDIO_EXTS.some((e) => file.toLowerCase().endsWith(e));

/** Args de ffmpeg: video 720x1280 30 fps de color `color` + el audio, AAC 48 kHz, de `duration` s (la del audio; -shortest no corta lavfi). */
export const audioToVideoArgs = (input: string, out: string, color: string, duration: number): string[] => [
  '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=720x1280:r=30`, '-i', input,
  '-map', '0:v', '-map', '1:a:0', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', duration.toFixed(3), '-movflags', '+faststart', out,
];
