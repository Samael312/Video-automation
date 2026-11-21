# Voz clonada: guion → voz IA de la profe → TikTok 100 % motion

Fecha: 2026-11-18 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Hacer videos de la profe **sin que grabe audio**: de un guion `NOMBRE.txt` sale su voz clonada (ElevenLabs, Professional Voice Clone) y luego corre el flujo `edit-voice` que ya existe (alinear, motion, render).

Éxito = `/edit-voice media/input/NOMBRE.txt` produce `media/output/edited/NOMBRE/NOMBRE_edited.mp4` con una voz que suena como ella.

## Decisiones del usuario

- Motor: **ElevenLabs**, **Professional Voice Clone (PVC)**. Nada de Instant Clone ni motores locales.
- Audio de entrenamiento: **sus videos viejos** (TikToks, etc.) juntados hasta pasar **30 min** de voz limpia (ideal 1 h+).
- El repo **prepara las muestras**; subirlas, la verificación de voz (ella lee una frase) y el entrenamiento se hacen en la web de ElevenLabs. El `voice_id` resultante se pega en `.env`.
- **Se extiende `/edit-voice`**: si la entrada es un guion sin audio, genera la voz IA. No hay skill nueva.
- Iterativo: probar, y si hace falta, más videos y reentrenar.
- Se asume que la profe autoriza clonar su voz (la verificación de ElevenLabs la hace ella).

## Configuración

`.env` (ya ignorado por git); `.env.example` gana dos líneas:

```
ELEVENLABS_API_KEY=tu_api_key_de_elevenlabs
ELEVENLABS_VOICE_ID=pega_aqui_el_voice_id_de_la_voz_profesional
```

Mientras la voz profesional entrena, `ELEVENLABS_VOICE_ID` puede ser cualquier voz de la biblioteca para probar el flujo.

`.gitignore` gana `media/voice/*` (con `!media/**/.gitkeep` ya cubierto).

## 1. Preparar muestras: `npm run voice-samples`

Carpetas:
- `media/voice/raw/` — aquí se tiran los videos/audios viejos (`.mp4 .mov .m4a .mp3 .wav .webm`), con cualquier nombre.
- `media/voice/samples/` — salida, lista para subir.

Uso: `npm run voice-samples` (procesa todo `raw/`; los que ya tienen muestra se saltan, así se pueden ir añadiendo videos de a poco). `--force` rehace todo.

Por cada archivo, `pipeline/voice_samples.py`:
1. Extrae el audio a mono 44.1 kHz.
2. Limpia con la misma cadena de `audio_clean.py` (DeepFilterNet + EQ + loudnorm, funciones de `audio_common.py`).
3. Quita silencios > 0.7 s (deja 0.3 s) con `silencedetect`, para que los minutos cuenten solo voz.
4. Guarda `samples/<nombre>.mp3` (192 kbps).
5. Si el ruido o música de fondo sigue alto tras limpiar (`speech_noise_gap` bajo el umbral de `audio_common`), **no** lo guarda y lo lista como `descartado: música/ruido de fondo` (la música mete artefactos en el entrenamiento).

Al final imprime:

```
muestras: 14 archivos, 18:42 de voz (mínimo 30:00, ideal 60:00+) — faltan 11:18
descartados: 2 (música/ruido): viejo_3.mp4, viejo_9.mov
```

Cuando pasa de 30:00: `listo para subir: media/voice/samples/` + los pasos de la web (MANUAL).

## 2. Guion → audio: `npm run tts`

Uso: `npm run tts -- media/input/NOMBRE.txt [--force]`

- Lee el guion: líneas vacías fuera, párrafos unidos con `\n\n`.
- `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, cabecera `xi-api-key`, cuerpo `{text, model_id: "eleven_multilingual_v2", voice_settings: {stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true}}`.
- Escribe `media/input/NOMBRE.ai.mp3` (el sufijo `.ai` deja claro que no es su voz real y nunca pisa una nota de voz). Si ya existe y no hay `--force`: no llama a la API (no gasta créditos) e imprime `audio IA ya existe`.
- Imprime `voz IA: <m:ss>, <n> caracteres`.
- Errores (todos `process.exit(1)`, mensaje en español):
  - falta `ELEVENLABS_API_KEY` → `falta ELEVENLABS_API_KEY en .env`
  - falta `ELEVENLABS_VOICE_ID` → `falta ELEVENLABS_VOICE_ID en .env (ver MANUAL: voz clonada)`
  - 401 → `API key inválida`; 402/`quota_exceeded` → `sin créditos en ElevenLabs`; 404 → `la voz <id> no existe en tu cuenta`; otro → código + cuerpo.

El código HTTP vive en `src/lib/elevenlabs.ts` (función pura que arma la petición + `synthesize` con `fetch`), para probarlo con `fetch` simulado.

## 3. `/edit-voice` con guion

- `npm run edit -- media/input/NOMBRE.txt --plan-only`:
  - `edit.js` ve entrada `.txt`. Si hay nota de voz real `NOMBRE.{m4a,mp3,ogg,opus,wav}` en la misma carpeta, **gana la real** (imprime `uso la nota de voz real NOMBRE.m4a`) y sigue como hoy.
  - Si no: paso nuevo `voz IA` = `npx tsx scripts/tts.ts media/input/NOMBRE.txt`, y la entrada pasa a ser `NOMBRE.ai.mp3`.
  - El nombre del video sigue siendo `NOMBRE` (no `NOMBRE.ai`): `public/NOMBRE.mp4`, `NOMBRE.edit.json`, salida en `media/output/edited/NOMBRE/`.
  - Con voz IA se **salta `limpiar audio`** (ya sale limpia; el denoiser solo la empeoraría).
  - La alineación con el guion se mantiene (esperado ≥ 98 %).
- Skill `edit-voice`:
  - Uso nuevo: `/edit-voice media/input/NOMBRE.txt` (solo guion) además de `/edit-voice media/input/NOMBRE.m4a`.
  - Resumen: línea `Voz: IA clonada (ElevenLabs)` o `Voz: nota de voz real`.
  - Con voz IA, el resumen recuerda: **al publicar, activar en TikTok la etiqueta "contenido generado por IA"** (TikTok lo exige para voces realistas de una persona real).
- Docs: MANUAL, sección "Video solo con guion (voz clonada)":
  - juntar videos en `media/voice/raw/` → `npm run voice-samples` hasta 30 min+;
  - en elevenlabs.io (plan Creator+): Voices → Professional Voice Clone → subir `media/voice/samples/` → verificación (la profe lee la frase) → entrenar (horas);
  - copiar el `voice_id` a `.env`;
  - `/edit-voice media/input/NOMBRE.txt`;
  - para mejorar: más videos en `raw/`, `voice-samples`, subir los nuevos y reentrenar.
  - README: una línea. Router: `.txt` → `edit-voice`.

## Pruebas

- `src/lib/elevenlabs.test.ts` con `fetch` simulado: URL, cabeceras y cuerpo de TTS; mapeo de errores 401/402/404.
- `pipeline/tests/test_voice_samples.py`: suma de duraciones y mensaje "faltan"; salto de archivos ya procesados; quitar silencios en audio sintético (tono + silencio).
- `edit.js`: test de la elección de entrada (`.txt` con/sin nota real al lado).
- Ningún test llama a la API real.
- E2E en dos fases:
  1. Ya: `voice-samples` con los 4 videos de `media/input` copiados a `raw/` (esperado ~1:40, mensaje "faltan"). `tts` + `/edit-voice media/input/PT_ai.txt` (copia de `PT_voice.txt`) con una voz de la biblioteca → valida todo el flujo.
  2. Cuando la voz profesional esté entrenada: mismo `PT_ai` con su `voice_id`; comparar con `media/output/edited/PT_voice/` (voz real). El usuario decide si hace falta más audio.

## Riesgos y afinado después

- **Videos viejos con música de fondo**: se descartan solos; si se descartan demasiados, hará falta grabar algo limpio.
- **Inglés con acento español** ("plot twist", "cliffhanger"): se ve en el E2E. Si pasa, probar `eleven_v3` o ajustar `stability`; fuera de este alcance.
- **Otras voces en los videos viejos** (dúos, entrevistas): no se filtran en esta versión; no poner esos videos en `raw/`.
- Coste: plan Creator (~22 $/mes) para PVC; ~1 crédito por carácter de TTS (un guion de TikTok ≈ 500).

## Fuera de alcance

- Subir muestras, verificar y entrenar por API.
- Filtrar por hablante (diarización) en las muestras.
- Motores locales o alternativos; elegir modelo/ajustes por video; música.
