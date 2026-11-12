# Pipeline Core (Plan 1 de 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `npm run edit -- media/input/video.mp4` convierta un video hablado en un TikTok con transcripción `medium`, silencios cortados, subtítulos por palabra sincronizados, zoom y sfx en los cortes.

**Architecture:** Python (`pipeline/`) produce `public/<nombre>.transcript.json` y `public/<nombre>.cuts.json`. Remotion lee ambos, recorta el video con `Series` y reasigna todos los tiempos (subtítulos, labels, emojis, sfx) con un mapa original→nuevo definido en `src/lib/cuts.ts`. La lógica pura vive en módulos pequeños con tests (pytest y vitest).

**Tech Stack:** Remotion 4.0.543, `@remotion/captions`, `@remotion/transitions`, WhisperX (CPU int8), ffmpeg, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-11-12-tiktok-auto-editor-design.md`

**Alcance:** este plan cubre pasos 1–3 del "Orden de construcción" de la spec (transcripción + cortes, subtítulos, transiciones/zoom/sfx). El **Plan 2** (plantillas, corte a animación, plan automático, escenas IA, skill por estilo) se escribe cuando este funcione, porque depende de `cuts.json` y del mapa de tiempos.

## Global Constraints

- Todo local y gratuito; sin APIs de pago.
- Formato 9:16; la composición `Styled` mide 720x1280 a 30 fps.
- Transcripción: modelo `medium` por defecto, configurable (`large-v3` opcional), CPU `int8`, con `initial_prompt` de vocabulario.
- Cortes: colchón de ~0.1 s por lado; el umbral de pausa es configurable.
- Subtítulos: `createTikTokStyleCaptions` de `@remotion/captions`, palabra activa resaltada, entrada con `spring`, sin el `+0.25 s` fijo (la frase termina cuando empieza la siguiente).
- El render falla si audio y video se desincronizan más de 1 frame.
- Formato de `transcript.json` existente: `{video, language, model, duration, speakers, segments, words[{word,start,end,speaker,score}]}`. No romperlo.

## Review Focus

1. **Video sin voz o transcript vacío:** `words=[]` debe dar un solo tramo completo, sin crash.
2. **Video sin silencios largos:** un único tramo; el render sale igual que el original.
3. **Palabras sin tiempos alineados** (números, símbolos): se descartan, no rompen cortes ni subtítulos.
4. **Palabra que cae dentro de un tramo cortado:** se descarta del subtítulo, no aparece fuera de sincronía.
5. **Pausa al inicio o al final del video:** se recorta al borde, sin tramos de duración negativa.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `pipeline/vocab.txt` | Vocabulario inglés de la profe para `initial_prompt` |
| `pipeline/quality.py` | `low_confidence_ratio` |
| `pipeline/cut.py` | `compute_keep_segments` + CLI que escribe `cuts.json` |
| `pipeline/tests/` | pytest de `quality` y `cut` |
| `pipeline/transcribe_diarize.py` | Modificar: `medium`, `--prompt`, salida a `public/`, aviso de confianza |
| `src/lib/cuts.ts` | `Keep`, `mapTime`, `remapWords`, `keptDuration` |
| `src/lib/captions.ts` | `buildPages` (TikTok pages con fin exacto) |
| `src/lib/dynamics.ts` | `zoomScale` |
| `src/lib/*.test.ts` | vitest |
| `src/lib/CutVideo.tsx` | Video recortado con `Series` + sfx en cortes |
| `src/styles/referencia/Styled.tsx` | Modificar: usa `CutVideo`, `buildPages`, `zoomScale`, remapeo |
| `scripts/edit.js` | Orquesta normalizar → transcribir → cortar → render |

---

### Task 1: Infraestructura de pruebas

**Files:**
- Modify: `package.json` (script `test`, devDependency `vitest`)
- Create: `vitest.config.ts`, `pipeline/tests/__init__.py`, `pipeline/pytest.ini`

**Interfaces:** Produces: `npm test` (vitest) y `.venv\Scripts\python -m pytest pipeline/tests` funcionando.

- [ ] **Step 1:** `npm install -D vitest` y `.venv\Scripts\python -m pip install pytest`. Agregar `"test": "vitest run"` a `package.json`. `vitest.config.ts` incluye solo `src/**/*.test.ts`.
- [ ] **Step 2:** Crear `src/lib/smoke.test.ts` con `expect(1+1).toBe(2)`; `npm test` → PASS. Borrar el archivo.
- [ ] **Step 3:** Crear `pipeline/tests/test_smoke.py` con `assert True`; correr pytest → PASS. Borrar el archivo.
- [ ] **Step 4:** Commit `chore: add vitest and pytest`.

---

### Task 2: Transcripción `medium` con vocabulario y control de calidad

**Files:**
- Create: `pipeline/vocab.txt`, `pipeline/quality.py`, `pipeline/tests/test_quality.py`
- Modify: `pipeline/transcribe_diarize.py`

**Interfaces:**
- Produces: `low_confidence_ratio(words: list[dict], threshold: float = 0.5) -> float` en `pipeline/quality.py` (fracción de palabras con `score < threshold`; `0.0` si la lista está vacía).
- Produces: `transcribe_diarize.py` acepta `--model {tiny,base,small,medium,large-v3}` (default `medium`) y `--prompt ruta` (default `pipeline/vocab.txt`); escribe por defecto en `public/<stem>.transcript.json`.

- [ ] **Step 1: Tests** en `test_quality.py`: `low_confidence_ratio([])==0.0`; con scores `[0.9,0.2,0.4,0.8]` y umbral 0.5 → `0.5`; palabra sin clave `score` cuenta como baja.
- [ ] **Step 2:** pytest → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `quality.py`.
- [ ] **Step 4:** pytest → PASS.
- [ ] **Step 5:** `vocab.txt`: una línea de texto con el vocabulario (ej. `actually, library, embarrassed, ...`). En `transcribe_diarize.py` pasar `asr_options={"initial_prompt": <contenido>}` a `whisperx.load_model`; cambiar `choices`/default del modelo; default de `--out` a `ROOT/"public"/f"{video.stem}.transcript.json"`; al final imprimir aviso si `low_confidence_ratio(words) > 0.25` ("revisa public/<x>.transcript.json antes de renderizar").
- [ ] **Step 6:** Correr sobre `media/input/ACTUALLY.mp4` con `--model medium`. Esperado: termina sin error, el JSON tiene `"model": "medium"` y "library" aparece bien escrito. (Tarda varios minutos; la primera vez descarga ~1.5 GB.)
- [ ] **Step 7:** Commit `feat(pipeline): medium model, vocabulary prompt, confidence warning`.

---

### Task 3: Detección de silencios → `cuts.json`

**Files:**
- Create: `pipeline/cut.py`, `pipeline/tests/test_cut.py`

**Interfaces:**
- Produces: `compute_keep_segments(words: list[dict], duration: float, gap_threshold: float = 0.7, pad: float = 0.1) -> list[dict]` — lista de `{"start": float, "end": float}` en tiempo **original**, ordenada, sin solapes, dentro de `[0, duration]`. Una pausa (entre palabras consecutivas, antes de la primera, o después de la última) mayor a `gap_threshold` se corta dejando `pad` a cada lado; pausas menores se conservan. `words=[]` → `[{"start":0,"end":duration}]`.
- Produces: CLI `python pipeline/cut.py <transcript.json> [--gap 0.7] [--pad 0.1]` que escribe `public/<stem>.cuts.json` = `{"video","duration","keeps":[...]}`.

- [ ] **Step 1: Tests** en `test_cut.py`:
  - sin palabras → un tramo `[0, duration]` (Review Focus 1).
  - palabras sin pausas largas → un solo tramo (Review Focus 2).
  - palabras `(1.0–2.0)` y `(4.0–5.0)`, duración 6, gap 0.7, pad 0.1 → `[{0.9,2.1},{3.9,5.1}]` — nótese que el inicio `0.9` ya es el colchón de la primera palabra y la pausa inicial (1.0 s) se recorta; el final `5.1` recorta la pausa final.
  - pausa inicial de 0.5 s (≤ umbral) se conserva (`start == 0`).
  - tramos nunca tienen `end <= start` ni salen de `[0, duration]` (Review Focus 5).
  - gap de exactamente `gap_threshold` se conserva.
- [ ] **Step 2:** pytest → FAIL.
- [ ] **Step 3:** Implementar `compute_keep_segments` y el CLI.
- [ ] **Step 4:** pytest → PASS.
- [ ] **Step 5:** Correr el CLI sobre el transcript de `ACTUALLY` y revisar `public/ACTUALLY.cuts.json` a mano: las pausas de ~1 s entre frases deben quedar acortadas, con tramos coherentes.
- [ ] **Step 6:** Commit `feat(pipeline): silence detection and cuts.json`.

---

### Task 4: Mapa de tiempos en TypeScript

**Files:**
- Create: `src/lib/cuts.ts`, `src/lib/cuts.test.ts`

**Interfaces:**
- Consumes: `Word` de `src/lib/types.ts`.
- Produces:
  - `type Keep = {start: number; end: number}`
  - `keptDuration(keeps: Keep[]): number` — suma de `end-start`.
  - `mapTime(t: number, keeps: Keep[]): number | null` — tiempo nuevo; `null` si `t` cae en zona cortada. `t === end` de un tramo cuenta como dentro de ese tramo.
  - `remapWords(words: Word[], keeps: Keep[]): Word[]` — descarta palabras cuyo `start` o `end` no mapea (Review Focus 3 y 4), conserva el resto con tiempos nuevos.
  - `cutPoints(keeps: Keep[]): number[]` — tiempos **nuevos** donde empieza cada tramo salvo el primero (para sfx/zoom en cortes).

- [ ] **Step 1: Tests** en `cuts.test.ts` con `keeps=[{0.9,2.1},{3.9,5.1}]`: `keptDuration → 2.4`; `mapTime(1.0)→0.1`; `mapTime(3.9)→1.2`; `mapTime(3.0)→null`; `cutPoints → [1.2]`; `remapWords` descarta una palabra `(2.5–3.0)` y mantiene `(4.0–5.0)` como `(1.3–2.3)`; `keeps` de un solo tramo `[0,d]` deja las palabras idénticas; `remapWords([], keeps)` → `[]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `cuts.ts` (acumulando el offset de los tramos previos).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(lib): cut time mapping`.

---

### Task 5: Video recortado y composición con duración nueva

**Files:**
- Create: `src/lib/CutVideo.tsx`
- Modify: `src/Root.tsx` (calculateMetadata de `Styled` y `Captions`), `src/lib/types.ts` (agregar `CutsFile`)

**Interfaces:**
- Consumes: `Keep`, `keptDuration` de `src/lib/cuts.ts`.
- Produces: `type CutsFile = {video: string; duration: number; keeps: Keep[]}` en `types.ts`.
- Produces: `<CutVideo src: string; keeps: Keep[]; fps: number; cutSfx?: string; sfxVolume?: number />` — renderiza cada tramo con `Series.Sequence` + `OffthreadVideo` (`startFrom` en frames del tiempo original); reproduce `cutSfx` (default `sfx/swoosh.wav`) al inicio de cada tramo salvo el primero.
- `StyledProps` gana `keeps: Keep[]`. `calculateMetadata` carga `<nombre>.cuts.json` (si no existe, `keeps = [{0, duration}]`) y fija `durationInFrames = ceil(keptDuration(keeps)*fps)`.

- [ ] **Step 1:** Implementar `CutVideo` y el cambio de `Root.tsx` + `Styled.tsx` (reemplazar `<OffthreadVideo>` por `<CutVideo>`; por ahora subtítulos/labels siguen en tiempo original, se arreglan en Task 6).
- [ ] **Step 2:** `npx tsc --noEmit` → sin errores.
- [ ] **Step 3:** `npx remotion still src/index.ts Styled media/output/cut_check.png --frame=40` → se genera la imagen. Comprobar con `npx remotion compositions src/index.ts` que la duración de `Styled` es menor que la original (20.13 s) cuando hay cortes.
- [ ] **Step 4:** Commit `feat: render trimmed video from cuts.json`.

---

### Task 6: Subtítulos TikTok por palabra con resaltado

**Files:**
- Create: `src/lib/captions.ts`, `src/lib/captions.test.ts`, `src/lib/TikTokCaptions.tsx`
- Modify: `src/styles/referencia/Styled.tsx` (reemplaza `makeChunks`/`Subtitle`; remapea labels, emojis y sfx con `mapTime`), `src/styles/referencia/config.ts` (`subtitles`: agregar `highlight: string` = color de palabra activa)

**Interfaces:**
- Consumes: `remapWords`, `mapTime` de `cuts.ts`; `Word`.
- Produces: `type CaptionPage = {start: number; end: number; tokens: {text: string; start: number; end: number}[]}` (segundos, **tiempo nuevo**).
- Produces: `buildPages(words: Word[], maxWords: number): CaptionPage[]` — usa `createTikTokStyleCaptions` y fija `end` de cada página al `start` de la siguiente (sin huecos ni solapes); la última termina en el `end` de su última palabra + 0.3 s. `words=[]` → `[]`.
- Produces: `<TikTokCaptions pages: CaptionPage[]; highlight: string />` — página activa por tiempo, palabra activa resaltada, entrada con `spring`.

- [ ] **Step 1: Tests** en `captions.test.ts`: con 6 palabras y `maxWords=3` → 2 páginas; `pages[0].end === pages[1].start`; cada token conserva el `start/end` de su palabra; `buildPages([],3)` → `[]`; ningún `end < start`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `captions.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Implementar `TikTokCaptions.tsx` y conectarlo en `Styled.tsx`. Remapear con `mapTime` los tiempos de `labels`, `emojis`, `sfx.popAt`, `sfx.swooshAt`, `title`, `end.start`, descartando los que den `null`.
- [ ] **Step 6:** Renderizar stills en 3 tiempos (inicio, medio, justo después de un corte) y verificar a ojo: palabra activa resaltada, sin subtítulo cuando el hablante calla.
- [ ] **Step 7:** Commit `feat: TikTok word-highlight captions with remapped timings`.

---

### Task 7: Dinamismo: zoom en cortes y palabras clave

**Files:**
- Create: `src/lib/dynamics.ts`, `src/lib/dynamics.test.ts`
- Modify: `src/styles/referencia/Styled.tsx` (envolver el video en un contenedor con `transform: scale(zoomScale(...))`), `src/styles/referencia/config.ts` (`dynamics: {zoom: 1.08, duration: 0.35, keywords: string[]}`)

**Interfaces:**
- Consumes: `cutPoints`, `Word`.
- Produces: `zoomScale(t: number, events: number[], peak: number, duration: number): number` — `1` fuera de cualquier evento; sube a `peak` y vuelve a `1` en `duration` segundos desde cada evento (suavizado), si dos eventos solapan, toma el mayor.
- Produces: `keywordEvents(words: Word[], keywords: string[]): number[]` — `start` (tiempo nuevo) de cada palabra cuyo texto normalizado (minúsculas, sin puntuación) esté en `keywords`.

- [ ] **Step 1: Tests**: `zoomScale(0, [], 1.08, 0.35)===1`; en `t=evento` es `1`, en `t=evento+duration/2` es `1.08` (pico), en `t=evento+duration` vuelve a `1`; eventos solapados no suman; `keywordEvents` ignora mayúsculas y signos (`"Actually,"` coincide con `"actually"`) y devuelve `[]` sin coincidencias.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `dynamics.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Integrar en `Styled.tsx`: eventos = `cutPoints(keeps)` ∪ `keywordEvents(remappedWords, config.dynamics.keywords)`.
- [ ] **Step 6:** Still en pico de zoom vs. fuera de zoom; confirmar que el recuadro cambia de escala y no se corta el borde del video (el escalado se centra).
- [ ] **Step 7:** Commit `feat: punch-in zoom on cuts and keywords`.

---

### Task 8: Comando único `npm run edit` y verificación final

**Files:**
- Create: `scripts/edit.js`
- Modify: `package.json` (script `edit`), `README.md` (uso)

**Interfaces:**
- Produces: `node scripts/edit.js <video> [--model medium] [--gap 0.7]` que ejecuta en orden: `normalize_video.js` → `pipeline/transcribe_diarize.py` → `pipeline/cut.py` → `remotion render Styled media/output/<stem>_edited.mp4 --props` (con `videoSrc=<stem>.mp4`). Se detiene y muestra el paso que falló.

- [ ] **Step 1:** Implementar `edit.js` con `execFileSync` por paso; usar `.venv\Scripts\python.exe` para los de Python (igual que `verify.js`).
- [ ] **Step 2:** Correr `npm run edit -- media/input/ACTUALLY.mp4` de punta a punta.
- [ ] **Step 3:** Verificar con `ffprobe` que la duración del resultado ≈ `keptDuration` de `cuts.json` (±1 frame) y que el video tiene pista de audio (spec: falla si se desincroniza >1 frame). Extraer frames con `scripts/extract_frames.js` y revisar a ojo subtítulos, zoom y cortes contra `media/reference/Referencia.mp4`.
- [ ] **Step 4:** `npm test` y pytest completos → PASS; `npx tsc --noEmit` → sin errores.
- [ ] **Step 5:** Commit `feat: one-command edit pipeline`.
