# Voz clonada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/edit-voice media/input/NOMBRE.txt` sin audio → voz clonada de la profe (ElevenLabs PVC) → TikTok 100 % motion; más un comando que prepara las muestras de entrenamiento desde sus videos viejos.

**Architecture:** `pipeline/voice_samples.py` limpia y quita silencios de `media/voice/raw/*` → `media/voice/samples/*.mp3` y suma minutos. `src/lib/elevenlabs.ts` (puro + `fetch`) y `scripts/tts.ts` convierten `NOMBRE.txt` → `NOMBRE.ai.mp3`. `scripts/voiceInput.js` decide en `edit.js` qué audio usar (nota real > voz IA) y el resto del pipeline `voice` no cambia.

**Tech Stack:** Python 3.13 (pytest, ffmpeg, DeepFilterNet), TypeScript (tsx, vitest), Node 24 (`process.loadEnvFile`), ElevenLabs REST.

**Spec:** `docs/superpowers/specs/2026-11-18-voice-clone-design.md`

## Global Constraints

- Nunca `git commit`/`git add`: los pasos "Commit" = anotar en el ledger (`.superpowers/`) el mensaje propuesto (regla del usuario).
- `.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. Node lo lee con `process.loadEnvFile(<root>/.env)` en try (si no existe, solo variables del entorno).
- TTS: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, cabecera `xi-api-key`, `content-type: application/json`, cuerpo `{text, model_id: "eleven_multilingual_v2", voice_settings: {stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true}}`.
- Salida TTS: `media/input/NOMBRE.ai.mp3`, junto al `.txt`. El nombre del video sigue siendo `NOMBRE`.
- Muestras: entradas `.mp4 .mov .m4a .mp3 .wav .webm` en `media/voice/raw/`; salida `media/voice/samples/<stem>.mp3` 192 kbps mono 44.1 kHz; silencios > 0.7 s se dejan en 0.3 s; mínimo 30:00, ideal 60:00.
- Mensajes de error exactos del spec (`falta ELEVENLABS_API_KEY en .env`, `falta ELEVENLABS_VOICE_ID en .env (ver MANUAL: voz clonada)`, `API key inválida`, `sin créditos en ElevenLabs`, `la voz <id> no existe en tu cuenta`).
- Ningún test llama a la API real. Al final de cada tarea: `npx vitest run`, `npx tsc --noEmit`, `.venv/Scripts/python -m pytest pipeline -q` verdes.

## Review Focus

- Guion vacío o solo espacios → error `el guion está vacío` **antes** de llamar a la API. → test en Task 2.
- Guion > 10 000 caracteres (límite de `eleven_multilingual_v2`) → error `guion demasiado largo (N caracteres, máx 10000)` sin llamar. → test en Task 2.
- La API falla a mitad: no debe quedar un `NOMBRE.ai.mp3` roto que el caché reutilice después → escribir a `NOMBRE.ai.mp3.part` y renombrar. → test en Task 2.
- Nota de voz real con extensión en mayúsculas (`NOMBRE.M4A`) junto a `NOMBRE.txt` → gana la real. → test en Task 3.
- Videos viejos con espacios/tildes en el nombre (`clase día 3.mp4`) → muestra `clase día 3.mp3`, sin romper ffmpeg. → test en Task 1.

---

### Task 1: `voice-samples` (muestras para PVC)

**Files:**
- Create: `pipeline/voice_samples.py`, `pipeline/tests/test_voice_samples.py`, `media/voice/raw/.gitkeep`, `media/voice/samples/.gitkeep`
- Modify: `package.json` (script `"voice-samples": ".venv\\Scripts\\python.exe pipeline/voice_samples.py"`), `.gitignore` (`media/voice/*` + `!media/voice/raw/` `!media/voice/samples/` de forma que solo queden los `.gitkeep`)

**Interfaces:**
- Consumes: `pipeline.audio_common` (`ffmpeg`, `run`, `find_deep_filter`, `decode_audio`, `channel_advice`, `speech_noise_gap`, `two_pass_loudnorm`), `pipeline.audio_clean` (`PANS`, `POST_CHAIN`).
- Produces:
  - `INPUT_EXT = {'.mp4','.mov','.m4a','.mp3','.wav','.webm'}`, `MIN_S = 1800`, `IDEAL_S = 3600`, `MIN_GAP_DB = 20.0`
  - `pending(raw: Path, samples: Path, force: bool) -> list[Path]` — entradas con extensión válida (sin distinguir mayúsculas), ordenadas, sin `samples/<stem>.mp3` ni `samples/<stem>.descartado` (salvo `force`)
  - `strip_silence_filter() -> str` — `silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.7:stop_threshold=-45dB:stop_silence=0.3`
  - `clean_sample(src: Path, dst: Path) -> float | None` — limpia como `audio_clean.main` (canal de `channel_advice`, highpass, DeepFilterNet `-D -a 35`, `POST_CHAIN` + loudnorm) + `strip_silence_filter()` → mp3; devuelve el `speech_noise_gap` del resultado; si `< MIN_GAP_DB` borra `dst`, crea `dst.with_suffix('.descartado')` y devuelve `None`
  - `fmt(s: float) -> str` — `m:ss` (`1122.4` → `18:42`)
  - `summary(durations: list[float], discarded: list[str]) -> str` — formato del spec
  - `main(argv=None) -> int` — `--raw` (def `media/voice/raw`), `--samples` (def `media/voice/samples`), `--force`; sin DeepFilterNet → mismo error que `audio_clean` y `3`

- [ ] **Step 1: Tests** (`pipeline/tests/test_voice_samples.py`):
  - `test_pending_skips_done`: raw con `a.mp4`, `b.MOV`, `c.txt`, `clase día 3.mp4`; samples con `a.mp3` y `b.descartado` → `pending(...,False)` = `[clase día 3.mp4]`; con `force=True` = `[a.mp4, b.MOV, clase día 3.mp4]`.
  - `test_fmt`: `fmt(1122.4) == '18:42'`, `fmt(0) == '0:00'`, `fmt(3600) == '60:00'`.
  - `test_summary_missing`: `summary([600, 522.4], ['viejo_3.mp4'])` contiene `2 archivos`, `18:42 de voz`, `faltan 11:18`, `descartados: 1 (música/ruido): viejo_3.mp4`.
  - `test_summary_ready`: `summary([1900], [])` contiene `listo para subir: media/voice/samples/` y no contiene `faltan`.
  - `test_strip_silence`: con `ffmpeg` real genera `sine=440` 2 s + `anullsrc` 3 s + `sine` 2 s en `tmp_path / "con espacio.wav"`, aplica `strip_silence_filter()` → duración (ffprobe) entre 4.1 y 4.6 s.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest pipeline/tests/test_voice_samples.py -q` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** según Interfaces. `main`: crea `samples/` si falta; por cada `pending`, imprime `<nombre>: <m:ss> de voz` o `<nombre>: descartado (voz sobre fondo X dB)`; al final, `summary` con las duraciones de **todos** los `samples/*.mp3` (ffprobe) y los `.descartado` existentes. Un archivo que falla en ffmpeg: aviso `<nombre>: error, se salta` y sigue.
- [ ] **Step 4: Run** tests — PASS. Verificación manual: copiar los 4 videos de `media/input` a `media/voice/raw/`, `npm run voice-samples` → 4 muestras (ninguna descartada; si alguna lo es, bajar `MIN_GAP_DB` al valor que pase las 4 y anotarlo), `faltan` ≈ 28 min; segunda corrida no reprocesa nada. Escuchar una muestra.
- [ ] **Step 5: Commit** (ledger): `feat(voice): voice-samples prepares PVC training audio from old videos`

### Task 2: `tts` (guion → `NOMBRE.ai.mp3`)

**Files:**
- Create: `src/lib/elevenlabs.ts`, `src/lib/elevenlabs.test.ts`, `scripts/tts.ts`
- Modify: `package.json` (`"tts": "tsx scripts/tts.ts"`), `.env.example` (2 líneas del spec)

**Interfaces:**
- Produces (`src/lib/elevenlabs.ts`):
  - `MAX_CHARS = 10000`
  - `ttsText(raw: string): string` — líneas vacías fuera, párrafos (bloques separados por línea vacía) unidos con `\n\n`, líneas de un mismo párrafo con espacio; `trim`. Lanza `Error('el guion está vacío')` o `Error('guion demasiado largo (N caracteres, máx 10000)')`.
  - `ttsRequest(o: {apiKey: string; voiceId: string; text: string}): {url: string; init: RequestInit}`
  - `ttsError(status: number, body: string, voiceId: string): string` — 401 → `API key inválida`; 402 o body con `quota_exceeded` → `sin créditos en ElevenLabs`; 404 → `la voz <id> no existe en tu cuenta`; otro → `ElevenLabs <status>: <body hasta 300 chars>`
  - `synthesize(o: {apiKey; voiceId; text}, fetchImpl: typeof fetch = fetch): Promise<Buffer>` — lanza `Error(ttsError(...))` si `!res.ok`
  - `aiAudioPath(txt: string): string` — `media/input/X.txt` → `media/input/X.ai.mp3`
  - `writeAtomic(file: string, data: Buffer): void` — escribe `file + '.part'` y renombra
- Produces (`scripts/tts.ts`): `npx tsx scripts/tts.ts <NOMBRE.txt> [--force]`, exit 0 / 1.

- [ ] **Step 1: Tests** (`describe('elevenlabs')`):
  - `ttsText('Hola.\nQué tal\n\n\nPlot twist.\n')` = `'Hola. Qué tal\n\nPlot twist.'`; `ttsText('  \n ')` lanza `el guion está vacío`; `ttsText('a'.repeat(10001))` lanza `guion demasiado largo (10001 caracteres, máx 10000)`.
  - `ttsRequest({apiKey:'k', voiceId:'v1', text:'hola'})`: `url` = `https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128`; `init.method` `POST`; cabeceras `xi-api-key: k`, `content-type: application/json`; `JSON.parse(body)` igual al cuerpo de Global Constraints con `text: 'hola'`.
  - `ttsError(401,'','v')` / `(402,'','v')` / `(400,'{"detail":{"status":"quota_exceeded"}}','v')` / `(404,'','v9')` / `(500,'boom','v')` → los 5 textos.
  - `synthesize` con `fetchImpl` simulado `ok:true, arrayBuffer → [1,2,3]` → `Buffer` de largo 3; con `ok:false,status:401` → rechaza con `API key inválida`.
  - `aiAudioPath('media/input/PT_ai.txt')` = `media/input/PT_ai.ai.mp3` (con `path.join`).
  - `writeAtomic`: en un tmpdir, tras escribir existe `x.mp3` y no `x.mp3.part`.
- [ ] **Step 2: Run** `npx vitest run src/lib/elevenlabs.test.ts` — FAIL.
- [ ] **Step 3: Implement** `elevenlabs.ts` y `scripts/tts.ts`: carga `.env`; valida key y voice_id (mensajes del spec) **antes** de leer la API; si existe `aiAudioPath` y no `--force` → `audio IA ya existe` y exit 0; si no, `synthesize` → `writeAtomic` → imprime `voz IA: <m:ss>, <n> caracteres` (duración con `ffprobe`). Cualquier `Error` → `console.error(e.message)` y exit 1.
- [ ] **Step 4: Run** tests + tsc — PASS. Verificación sin key: `npm run tts -- media/input/PT_voice.txt` con `.env` sin `ELEVENLABS_API_KEY` → `falta ELEVENLABS_API_KEY en .env`, exit 1, no se crea `.ai.mp3`.
- [ ] **Step 5: Commit** (ledger): `feat(voice): tts command turns a script into the cloned voice via ElevenLabs`

### Task 3: `edit.js` acepta guion

**Files:**
- Create: `scripts/voiceInput.js`, `scripts/voiceInput.test.ts`
- Modify: `scripts/edit.js`

**Interfaces:**
- Consumes: `scripts/tts.ts` (Task 2) como comando; `aiAudioPath` mismo esquema (`X.ai.mp3`).
- Produces (`scripts/voiceInput.js`, CommonJS):
  - `AUDIO_EXT = ['.m4a','.mp3','.ogg','.opus','.wav']`
  - `resolveInput(input: string, list: (dir) => string[]): {name: string, source: string, kind: 'video'|'audio'|'script', realVoice?: string}` —
    - `.txt`: si `list(dir)` tiene `NOMBRE<audio ext>` (sin distinguir mayúsculas, excluyendo `NOMBRE.ai.mp3`) → `kind 'audio'`, `source` = esa ruta, `realVoice` = su nombre; si no → `kind 'script'`, `source` = `dir/NOMBRE.ai.mp3`.
    - audio → `kind 'audio'`; video → `kind 'video'`.
    - `name`: basename sin extensión y sin sufijo `.ai` (`PT.ai.mp3` → `PT`).

- [ ] **Step 1: Tests** (`scripts/voiceInput.test.ts`, `list` simulado):
  - `resolveInput('media/input/PT.txt', () => ['PT.txt'])` → `{kind:'script', name:'PT', source: path.join('media/input','PT.ai.mp3')}`.
  - con `['PT.txt','PT.M4A']` → `kind 'audio'`, `source` termina en `PT.M4A`, `realVoice 'PT.M4A'`.
  - con `['PT.txt','PT.ai.mp3']` → `kind 'script'` (la IA no cuenta como nota real).
  - `resolveInput('media/input/PT.ai.mp3', …)` → `name 'PT'`, `kind 'audio'`.
  - `resolveInput('media/input/X.mov', …)` → `kind 'video'`, `name 'X'`.
- [ ] **Step 2: Run** `npx vitest run scripts/voiceInput.test.ts` — FAIL.
- [ ] **Step 3: Implement** `voiceInput.js`; en `edit.js` usar `resolveInput(video, fs.readdirSync)`: `name` de ahí; si `realVoice` → `console.log('uso la nota de voz real ' + realVoice)`; si `kind 'script'` → primer paso `['voz IA', 'npx tsx scripts/tts.ts "<input.txt>"']` y **sin** `limpiar audio`; `audioOnly` = `kind !== 'video'`; `audio-to-video` recibe `source`; `scriptTxt` = `dir/NOMBRE.txt`. Actualizar el comentario de uso en la cabecera.
- [ ] **Step 4: Run** suite + tsc — PASS. Verificación: `npm run edit -- media/input/PT_voice.txt --plan-only` → imprime `uso la nota de voz real PT_voice.m4a` y termina como antes (coincidencia igual que con `.m4a`).
- [ ] **Step 5: Commit** (ledger): `feat(edit): script-only input uses the cloned voice, real voice note wins`

### Task 4: skill `edit-voice`, router, docs

**Files:**
- Modify: `.claude/skills/edit-voice/SKILL.md`, `.claude/skills/edit-router/SKILL.md`, `docs/MANUAL.md`, `README.md`

- [ ] **Step 1:** `edit-voice`: description y uso con `/edit-voice media/input/NOMBRE.txt`; Paso 1: si la entrada es `.txt`, `npm run edit -- media/input/NOMBRE.txt --plan-only` (genera la voz si no hay nota real; si falla por key/voz/créditos, para y muestra el mensaje); resumen con `Voz: IA clonada (ElevenLabs)` / `Voz: nota de voz real` y, con IA, el recordatorio de la etiqueta "contenido generado por IA" de TikTok.
- [ ] **Step 2:** Router: `.txt` → `edit-voice`. MANUAL: sección "Video solo con guion (voz clonada)" con los 5 pasos del spec (raw → `voice-samples` → web PVC + verificación → `voice_id` en `.env` → `/edit-voice …txt`) y cómo mejorar la voz. README: línea de `/edit-voice NOMBRE.txt`.
- [ ] **Step 3: Verificar** `grep -n "voice-samples\|\"tts\"" package.json` — Expected: 2 coincidencias; cada comando citado en MANUAL existe.
- [ ] **Step 4: Commit** (ledger): `docs(skills): edit-voice accepts a script with the cloned voice`

### Task 5: E2E fase 1

- [ ] **Step 1:** Pedir al usuario `ELEVENLABS_API_KEY` en `.env` y, mientras no hay PVC, un `ELEVENLABS_VOICE_ID` de la biblioteca (voz femenina en español). Sin key → parar aquí y avisar.
- [ ] **Step 2:** `cp media/input/PT_voice.txt media/input/PT_ai.txt`; `/edit-voice media/input/PT_ai.txt` completo: plan-only (Expected: paso `voz IA`, sin `limpiar audio`, `coincidencia` ≥ 98 %), draft, enriquecer, validate (0 errores), preview → **aprobación del usuario** → render (`media/output/edited/PT_ai/PT_ai_edited.mp4`), caption.
- [ ] **Step 3:** Segunda corrida de `npm run tts -- media/input/PT_ai.txt` → `audio IA ya existe` (no gasta).
- [ ] **Step 4:** Limpieza (memoria del usuario): borrar capturas de preview y temporales; dejar el video y `PT_ai.txt`/`PT_ai.ai.mp3` solo si el usuario quiere. Suite completa + tsc + pytest; ledger `Task 5: complete`. La fase 2 (voz PVC real) queda para cuando la voz esté entrenada.
