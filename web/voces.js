'use strict';
// Voz ElevenLabs para la web. Sin dependencias nuevas.
const fs = require('node:fs');
const path = require('node:path');

const MAX_CHARS = 5000;
const MODELO = 'eleven_multilingual_v2';

function parseEnvFile(file) {
  const out = {};
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const linea of txt.split(/\r?\n/)) {
    if (linea.trim().startsWith('#')) continue;
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function leerConfig(root, env = process.env) {
  const fileEnv = root ? parseEnvFile(path.join(root, '.env')) : {};
  const pick = (k) => String((env && env[k]) || fileEnv[k] || '').trim();
  return {apiKey: pick('ELEVENLABS_API_KEY'), voiceIdLaura: pick('ELEVENLABS_VOICE_ID_LAURA')};
}

function motivoNoDisponible(voz, cfg) {
  if (voz === 'profe') return 'La voz de la profe todavia no esta disponible.';
  if (voz !== 'laura') return 'Voz desconocida.';
  if (!cfg.apiKey) return 'Falta ELEVENLABS_API_KEY en .env.';
  if (!cfg.voiceIdLaura) return 'Falta ELEVENLABS_VOICE_ID_LAURA en .env.';
  return null;
}

const BASE = [
  {id: 'laura', nombre: 'Laura (ElevenLabs)'},
  {id: 'profe', nombre: 'Voz de la profe (proximamente)'},
];

// Lista estatica de referencia; para disponibilidad real usar listarVoces(root, env).
const VOCES = BASE.map((v) => ({...v, disponible: false}));

function listarVoces(root, env) {
  const cfg = leerConfig(root, env);
  return BASE.map((v) => {
    const motivo = motivoNoDisponible(v.id, cfg);
    return motivo ? {...v, disponible: false, motivo} : {...v, disponible: true};
  });
}

function limpiar(msg, apiKey) {
  let s = String(msg == null ? '' : msg);
  if (apiKey) s = s.split(apiKey).join('***');
  return s;
}

async function generarVoz({root, voz, texto, destino, fetchImpl, env}) {
  const cfg = leerConfig(root, env);
  const motivo = motivoNoDisponible(voz, cfg);
  if (motivo) throw new Error(motivo);
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t) throw new Error('El texto esta vacio.');
  if (t.length > MAX_CHARS) throw new Error(`El texto es demasiado largo (maximo ${MAX_CHARS} caracteres).`);
  if (!destino) throw new Error('Falta la ruta de destino.');
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('No hay fetch disponible en este Node.');

  let res;
  try {
    res = await f(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voiceIdLaura)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {'xi-api-key': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg'},
        body: JSON.stringify({text: t, model_id: MODELO}),
      },
    );
  } catch (e) {
    throw new Error(`No se pudo conectar con ElevenLabs: ${limpiar(e && e.message, cfg.apiKey)}`);
  }
  if (!res.ok) {
    let detalle = '';
    try {
      detalle = limpiar((await res.text()) || '', cfg.apiKey).slice(0, 200);
    } catch {
      /* nada */
    }
    throw new Error(`ElevenLabs devolvio error ${res.status}${detalle ? `: ${detalle}` : ''}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('ElevenLabs devolvio un audio vacio.');
  fs.mkdirSync(path.dirname(destino), {recursive: true});
  const tmp = `${destino}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, destino);
  } catch (e) {
    try {
      fs.rmSync(tmp, {force: true});
    } catch {
      /* nada */
    }
    throw new Error(`No se pudo guardar el audio: ${e.message}`);
  }
  return {destino, bytes: buf.length};
}

module.exports = {VOCES, listarVoces, leerConfig, generarVoz, MAX_CHARS};
