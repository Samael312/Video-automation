// Cliente del trabajador de transcripcion en memoria (pipeline/transcribe_worker.py).
// Nunca lanza: devuelve {ok:true, palabras} o {ok:false, motivo} para que edit.js use el camino normal.
const SALUD_MS = 2000;
const TRANSCRIBIR_MS = 15 * 60 * 1000;

const conTimeout = async (fetch, url, init, ms) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {...init, signal: ctl.signal});
  } finally {
    clearTimeout(t);
  }
};

async function transcribirConTrabajador({url, video, out, model, prompt, fetch = globalThis.fetch, saludMs = SALUD_MS, transcribirMs = TRANSCRIBIR_MS}) {
  if (!url) return {ok: false, motivo: 'sin TRANSCRIBIR_URL'};
  const base = url.replace(/\/+$/, '');
  try {
    const r = await conTimeout(fetch, `${base}/salud`, {}, saludMs);
    const j = await r.json();
    if (!r.ok || !j.ok) return {ok: false, motivo: 'no responde bien a /salud'};
  } catch (e) {
    return {ok: false, motivo: `no responde (${e && e.cause && e.cause.code ? e.cause.code : e && e.message ? e.message : e})`};
  }
  try {
    const r = await conTimeout(
      fetch,
      `${base}/transcribir`,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({video, out, model, prompt, diarize: false})},
      transcribirMs,
    );
    const j = await r.json();
    if (!r.ok || !j.ok) return {ok: false, motivo: `falló: ${j.error || `HTTP ${r.status}`}`};
    return {ok: true, palabras: j.palabras, bajaConfianza: j.baja_confianza};
  } catch (e) {
    return {ok: false, motivo: `falló: ${e && e.message ? e.message : e}`};
  }
}

/** Mismo aviso que imprime transcribe_core (> 25 % de palabras con baja confianza), o null. */
const avisoBajaConfianza = (ratio, out) =>
  typeof ratio === 'number' && ratio > 0.25 ? `AVISO: ${Math.round(ratio * 100)}% de palabras con baja confianza; revisa ${out} antes de renderizar` : null;

module.exports = {transcribirConTrabajador, avisoBajaConfianza};
