// Utilidades compartidas por los CLIs en TypeScript (validate, inspect, preview).
import fs from 'node:fs';
import path from 'node:path';
import type {CutsFile, Transcript} from '../src/lib/types';
import type {Keep} from '../src/lib/cuts';

export const ROOT = path.join(__dirname, '..');
export const PUBLIC = path.join(ROOT, 'public');

/** "ACTUALLY", "ACTUALLY.mp4" o "media/input/ACTUALLY.mp4" -> {name: "ACTUALLY", video: "ACTUALLY.mp4"} */
export const resolveVideo = (arg: string | undefined, usage: string): {name: string; video: string} => {
  if (!arg) {
    console.error(`Uso: ${usage}`);
    process.exit(2);
  }
  const base = path.basename(arg);
  const name = base.replace(/\.[^.]+$/, '');
  return {name, video: /\.[^.]+$/.test(base) ? `${name}.mp4` : `${base}.mp4`};
};

/** JSON de public/, o null si no existe. Sale con codigo 1 si existe pero esta roto. */
export const readPublicJson = <T>(file: string): T | null => {
  const p = path.join(PUBLIC, file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch (e) {
    console.error(`ERROR: public/${file} no es JSON valido: ${(e as Error).message}`);
    process.exit(1);
  }
};

/** Transcript obligatorio (con mensaje que dice que correr) y cortes (aviso si faltan). */
export const loadTranscriptAndKeeps = (name: string): {transcript: Transcript; keeps: Keep[]} => {
  const transcript = readPublicJson<Transcript>(`${name}.transcript.json`);
  if (!transcript) {
    console.error(`ERROR: falta public/${name}.transcript.json; corre primero: npm run edit -- media/input/${name}.mp4 --plan-only`);
    process.exit(1);
  }
  const cuts = readPublicJson<CutsFile>(`${name}.cuts.json`);
  if (!cuts) console.warn(`AVISO: falta public/${name}.cuts.json; el video se renderizara SIN cortes de silencio (genera los cortes con pipeline/cut.py)`);
  return {transcript, keeps: cuts ? cuts.keeps : [{start: 0, end: transcript.duration}]};
};

export const knownEmojis = (): string[] =>
  fs.readdirSync(path.join(PUBLIC, 'emoji')).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''));

/** Emojis 3D disponibles (public/emoji3d/*.png); [] si la carpeta no existe. */
export const MUSIC_DIR = path.join(ROOT, 'media', 'music');

/** Pistas de musica disponibles (media/music/*.mp3|wav|m4a); [] si la carpeta no existe. */
export const knownMusic = (): string[] =>
  fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)) : [];

export const knownEmojis3d = (): string[] => {
  const dir = path.join(PUBLIC, 'emoji3d');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')) : [];
};

/** Nombres de public/sfx/*.wav (sin extension). */
export const knownSfx = (): string[] => {
  const dir = path.join(PUBLIC, 'sfx');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.wav')).map((f) => f.replace(/\.wav$/, '')) : [];
};
