// ElevenLabs text-to-speech: guion -> voz clonada de la profe (mp3).
import fs from 'node:fs';
import path from 'node:path';

export const MAX_CHARS = 10000; // limite de eleven_multilingual_v2 por peticion
const API = 'https://api.elevenlabs.io/v1';

type Tts = {apiKey: string; voiceId: string; text: string};

/** Guion -> texto para la voz: lineas de un parrafo unidas, parrafos separados por linea vacia. */
export const ttsText = (raw: string): string => {
  const text = raw
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  if (!text) throw new Error('el guion está vacío');
  if (text.length > MAX_CHARS) throw new Error(`guion demasiado largo (${text.length} caracteres, máx ${MAX_CHARS})`);
  return text;
};

export const ttsRequest = ({apiKey, voiceId, text}: Tts): {url: string; init: RequestInit} => ({
  url: `${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
  init: {
    method: 'POST',
    headers: {'xi-api-key': apiKey, 'content-type': 'application/json'},
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true},
    }),
  },
});

export const ttsError = (status: number, body: string, voiceId: string): string => {
  if (status === 401) return 'API key inválida';
  if (status === 402 || body.includes('quota_exceeded')) return 'sin créditos en ElevenLabs';
  if (status === 404) return `la voz ${voiceId} no existe en tu cuenta`;
  return `ElevenLabs ${status}: ${body.slice(0, 300)}`;
};

export const synthesize = async (o: Tts, fetchImpl: typeof fetch = fetch): Promise<Buffer> => {
  const {url, init} = ttsRequest(o);
  const res = await fetchImpl(url, init);
  if (!res.ok) throw new Error(ttsError(res.status, await res.text(), o.voiceId));
  return Buffer.from(await res.arrayBuffer());
};

/** media/input/X.txt -> media/input/X.ai.mp3 (el sufijo .ai nunca pisa una nota de voz real). */
export const aiAudioPath = (txt: string): string => {
  const p = path.parse(txt);
  return path.join(p.dir, `${p.name}.ai.mp3`);
};

/** Genera si no hay audio IA, si se pide --force o si el guion se edito despues del audio (si no, se oiria el texto viejo). */
export const needsTts = (o: {force: boolean; txtMtimeMs: number; mp3MtimeMs: number | null}): boolean =>
  o.force || o.mp3MtimeMs === null || o.txtMtimeMs > o.mp3MtimeMs;

/** Escribe a .part y renombra: un fallo a mitad no deja un mp3 roto que el cache reutilice. */
export const writeAtomic = (file: string, data: Buffer): void => {
  fs.writeFileSync(file + '.part', data);
  fs.renameSync(file + '.part', file);
};
