# Voice motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guion (`media/input/NOMBRE.txt`) + nota de voz (`media/input/NOMBRE.m4a`) → TikTok 100 % motion con la nueva estrategia `voice`.

**Architecture:** El audio se envuelve en un mp4 de fondo plano (`audio-to-video.ts`) y entra al pipeline existente. Tras WhisperX, `script-align` reemplaza el texto de las palabras por el del guion conservando tiempos. La estrategia `voice` reutiliza `motion.blocks` exigiendo cobertura total; `draftMotion({full: true})` arma bloques contiguos.

**Tech Stack:** TypeScript (tsx, vitest), Node (edit.js), ffmpeg, Remotion 4.

**Spec:** `docs/superpowers/specs/2026-11-13-voice-motion-design.md`

## Global Constraints

- Nunca `git commit`/`git add`: al terminar cada tarea, dejar archivos listos y anotar en el ledger (regla del usuario). Los pasos "Commit" de este plan = anotar en el ledger el mensaje propuesto.
- Video 720×1280, 30 fps, yuv420p; fondo = `palette('light').bg` (`src/motion/palette.ts`).
- Extensiones de audio: `.m4a .mp3 .ogg .opus .wav`.
- Alineación: comparar en minúsculas, sin tildes (NFD sin `\p{M}`), sin puntuación; inserción mínima 0.08 s; error si `match < 0.7`.
- `voice`: hueco > 0.1 s en tiempo final = error con texto `hueco A–B s sin bloque`.
- Textos de usuario en español sin tildes en código de scripts (estilo actual), mensajes cortos.
- Tests: `npx vitest run`, `npx tsc --noEmit`, `.venv/Scripts/python -m pytest pipeline -q` verdes al final de cada tarea.

## Review Focus

- Guion con números/símbolos ("3", "%", "&") o guiones ("page-turner") frente a WhisperX ("three", "page turner"): debe caer en reemplazo, no bajar la coincidencia por debajo de 70 % en un texto fiel. → test en Task 1 (`page-turner` ↔ `page turner`).
- Palabra insertada al principio o al final (sin vecina a un lado): no debe dar NaN ni tiempos negativos. → test en Task 1.
- Tramos conservados más cortos que un beat (< `MIN_BEAT` = 0.4 s): un bloque no puede cruzar el corte para cubrirlos, así que `voiceGaps` los ignora (se ven < 0.4 s de fondo plano, aceptable) y el borrador no crea beats inválidos para ellos. → tests en Task 4 (`voiceGaps ignora tramos cortos`) y Task 5.
- `script-align` corrido dos veces o tras re-transcribir: siempre desde `.transcript.whisper.json`; si el usuario re-transcribe, `edit.js` borra el `.whisper.json` viejo antes de alinear. → Task 2.
- Nota de voz estéreo/mono y de 44.1 kHz: `audio-to-video` debe producir AAC 48 kHz que `audio_clean` acepte. → verificación en Task 3.

---

### Task 1: `alignScript` (pura)

**Files:**
- Create: `src/lib/scriptAlign.ts`
- Test: `src/lib/scriptAlign.test.ts`

**Interfaces:**
- Consumes: `Word` de `src/lib/types.ts` (`{word, start, end, speaker, score?}`).
- Produces:
  ```ts
  export type AlignReport = {match: number; replaced: {from: string[]; to: string[]}[]; added: string[]; dropped: string[]};
  export const normWord = (w: string): string;          // minúsculas, sin tildes, sin puntuación
  export const scriptTokens = (script: string): string[]; // split por espacios; el guion interno se conserva (page-turner = 1 token)
  export const alignScript = (script: string, words: Word[]): {words: Word[]; report: AlignReport}; // lanza Error si guion vacío, words vacío o match < 0.7
  export const MIN_MATCH = 0.7; export const MIN_INSERT = 0.08;
  ```

- [ ] **Step 1: Tests** (`describe('alignScript')`), con helper `w(word, start, end)` → `{word, start, end, speaker: 'SPEAKER_00'}`:
  - `iguales conservan tiempos`: guion `"Hola, plot twist."`, words `hola 0–0.3, plot 0.4–0.6, twist 0.6–0.9` → `words.map(x=>x.word)` = `['Hola,', 'plot', 'twist.']`, tiempos idénticos, `report.match` = 1.
  - `reemplazo 1↔2 reparte por letras`: guion `"a cliffhanger b"`, words `a 0–0.2, clif 1–1.2, hanger 1.2–2, b 2.1–2.3` → palabra `cliffhanger` con start 1, end 2.
  - `reemplazo 2↔1`: guion `"a plot twist b"`, words `a, plotwist 1–2, b` → `plot` 1–(1+4/9), `twist` (1+4/9)–2 (tolerancia 1e-3).
  - `insercion interpolada`: guion `"a b c"`, words `a 0–0.5, c 1.0–1.5` → `b` start 0.5, end 1.0; con words `a 0–0.5, c 0.5–1` → `b` dura ≥ 0.08 y no solapa a `c` hacia atrás (start ≥ a.start).
  - `insercion al inicio y al final`: guion `"x a y"`, words `a 1–2` → `x` end ≤ 1 y start ≥ 0; `y` start ≥ 2; ningún NaN.
  - `sobrante descartado`: guion `"a b"`, words `a, eh, b` → 2 palabras, `report.dropped` = `['eh']`.
  - `tildes y puntuacion`: guion `"¿Qué significa?"`, words `que 0–0.2, significa 0.2–0.8` → match 1, salida `['¿Qué', 'significa?']`.
  - `guion con guion`: guion `"a page-turner b"`, words `a, page, turner, b` → match ≥ 0.7 y la salida contiene `page-turner` con start de `page` y end de `turner`.
  - `match bajo lanza`: guion `"uno dos tres cuatro"`, words `a b c d` → `toThrow(/no parece leer este guion/)`.
  - `guion vacio lanza` y `words vacio lanza`.
  - `idempotente`: aplicar `alignScript` a su propia salida da las mismas palabras y tiempos.
- [ ] **Step 2: Run** `npx vitest run src/lib/scriptAlign.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement.** `scriptTokens`: split por `\s+`, descartar vacíos (los guiones quedan dentro del token). Comparación: un token del guion con guion (`page-turner`) se compara como `normWord` sin guiones ni espacios (`pageturner`) y del lado whisper se intenta unir hasta 3 palabras consecutivas en la etapa de reemplazo — implementación: diff LCS sobre `normWord` (tabla DP O(n·m), guiones de 30–200 palabras), luego cada tramo no-igual entre dos anclas iguales es un reemplazo (n guion ↔ m whisper, n,m ≥ 1), inserción (m = 0) o borrado (n = 0). Para `match` cuentan como iguales también los reemplazos cuya concatenación normalizada coincide (`pageturner` = `page`+`turner`). Reparto por letras: largo de `normWord` (mínimo 1). Inserción: tramo `[prev.end, next.start]` (prev/next = vecinas ya alineadas; sin prev → `next.start - MIN_INSERT*n`, clamp 0; sin next → `prev.end`), repartido en partes iguales; si el tramo < `MIN_INSERT*n`, tomar `MIN_INSERT*n` empezando en `prev.end` y recortar `next.start` no (se permite solape mínimo, nunca start > end). `speaker` = el de la vecina. Redondear a 3 decimales.
- [ ] **Step 4: Run** `npx vitest run src/lib/scriptAlign.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** (ledger): `feat(script): align script words to WhisperX timings`

### Task 2: `script-align` CLI + paso en `edit.js`

**Files:**
- Create: `scripts/script-align.ts`
- Modify: `package.json` (script `"script-align": "tsx scripts/script-align.ts"`), `scripts/edit.js`
- Test: `src/lib/scriptAlign.test.ts` (añadir `rebuildSegments`)

**Interfaces:**
- Consumes: `alignScript`, `AlignReport` (Task 1); `resolveVideo`, `PUBLIC`, `readPublicJson` de `scripts/common.ts`.
- Produces: `export const rebuildSegments = (segments: {start: number; end: number; text: string}[], words: Word[]) => typeof segments` (texto = palabras con `start` dentro de `[seg.start, seg.end)` unidas por espacio; segmento sin palabras conserva su texto). CLI `npm run script-align -- NOMBRE [guion.txt]` (por defecto `media/input/NOMBRE.txt`).

- [ ] **Step 1: Test** `rebuildSegments`: 2 segmentos `0–1`, `1–2` y palabras `Hola,` 0.1, `plot` 1.1, `twist.` 1.5 → textos `'Hola,'` y `'plot twist.'`.
- [ ] **Step 2: Run** — Expected: FAIL (`rebuildSegments` no exportado).
- [ ] **Step 3: Implement** `rebuildSegments` y el CLI: lee guion (error `falta el guion <ruta>` si no existe); si no existe `public/NOMBRE.transcript.whisper.json`, copia ahí `NOMBRE.transcript.json`; alinea desde el `.whisper.json`; escribe `NOMBRE.transcript.json` con `words` y `segments` nuevos; imprime `coincidencia X % — n reemplazos, n añadidas, n descartadas` y hasta 15 líneas `  "clif hanger" -> "cliffhanger"`. Error de `alignScript` → mensaje y `process.exit(1)`.
  `edit.js`: tras `transcribir`, si existe `media/input/${name}.txt`: primero borrar `public/${name}.transcript.whisper.json` si existe (transcript recién hecho = nuevo original), luego paso `['alinear con guion', 'npx tsx scripts/script-align.ts "${name}"']`. Actualizar comentario de cabecera.
- [ ] **Step 4: Run** `npx vitest run src/lib/scriptAlign.test.ts` — PASS. Verificación manual: crear `media/input/Plot_Twist_motion.txt` con el texto de los `segments` del transcript actual, corregir a mano 2 palabras del `.txt` para que difieran de WhisperX, correr `npm run script-align -- Plot_Twist_motion` dos veces (misma salida, las 2 palabras listadas como reemplazos); después restaurar `Plot_Twist_motion.transcript.json` desde el `.whisper.json` y borrar el `.txt` y el `.whisper.json`. Expected: `coincidencia` ≥ 95 %.
- [ ] **Step 5: Commit** (ledger): `feat(script): script-align command and edit step`

### Task 3: `audio-to-video` + entrada de solo audio en `edit.js`

**Files:**
- Create: `scripts/audio-to-video.ts`, `src/lib/audioInput.ts`, `src/lib/audioInput.test.ts`
- Modify: `scripts/edit.js`, `package.json` (`"audio-to-video": "tsx scripts/audio-to-video.ts"`)

**Interfaces:**
- Produces: `export const AUDIO_EXTS = ['.m4a', '.mp3', '.ogg', '.opus', '.wav']; export const isAudioInput = (file: string): boolean` (case-insensitive); `export const audioToVideoArgs = (input: string, out: string, color: string): string[]` (args de ffmpeg).
- CLI: `npx tsx scripts/audio-to-video.ts <audio> <salida.mp4>`.

- [ ] **Step 1: Tests**: `isAudioInput('media/input/X.M4A')` true, `('X.mov')` false; `audioToVideoArgs('a.m4a','o.mp4','#F4F1EA')` contiene `-f lavfi`, `color=c=#F4F1EA:s=720x1280:r=30`, `-shortest`, `-pix_fmt yuv420p`, `-c:a aac`, `-ar 48000`, y termina en `o.mp4`.
- [ ] **Step 2: Run** `npx vitest run src/lib/audioInput.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Args: `['-y','-f','lavfi','-i',`color=c=${color}:s=720x1280:r=30`,'-i',input,'-map','0:v','-map','1:a:0','-c:v','libx264','-tune','stillimage','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-shortest','-movflags','+faststart',out]`. El CLI usa `palette('light').bg` y `execFileSync('ffmpeg', …, {stdio:'inherit'})`; si falla, `process.exit(1)`. `edit.js`: `const audioOnly = /\.(m4a|mp3|ogg|opus|wav)$/i.test(video)`; paso 1 = `['audio a video', 'npx tsx scripts/audio-to-video.ts "${video}" "public/${publicVideo}"']` si `audioOnly`, si no `normalizar video`. El guion se busca en `path.dirname(video)/${name}.txt` (cambia Task 2 de `media/input/` fijo a la carpeta del archivo de entrada).
- [ ] **Step 4: Run** tests — PASS. Verificación: `ffmpeg -i media/input/PLOT_TWIST.mov -vn -c:a aac <scratch>/PT.m4a`; `npx tsx scripts/audio-to-video.ts <scratch>/PT.m4a <scratch>/PT.mp4`; `ffprobe` → video 720×1280 30 fps + audio aac 48000, duraciones ±0.05 s.
- [ ] **Step 5: Commit** (ledger): `feat(edit): audio-only input wrapped in a plain 720x1280 video`

### Task 4: estrategia `voice` (validación y avisos)

**Files:**
- Modify: `src/lib/plan.ts`, `src/lib/motion.ts`, `scripts/validate.ts`
- Test: `src/lib/motion.test.ts`, `src/lib/plan.test.ts`

**Interfaces:**
- Consumes: `mapTimeNext`, `keptDuration`, `keepIndexOf` (`src/lib/cuts.ts`).
- Produces:
  ```ts
  // plan.ts
  strategy: 'captions' | 'motion' | 'mixed' | 'voice';
  // motion.ts
  export const MAX_GAP = 0.1;
  export const voiceGaps = (blocks: Block[], keeps: Keep[]): {start: number; end: number}[]; // tiempo FINAL; ignora tramos conservados < MIN_BEAT
  export const voiceWarnings = (plan: EditPlan, ctx: ValidateCtx): string[];
  ```
  `validatePlan`: si `strategy === 'voice'`: sin `motion` o sin bloques → error `voice necesita motion.blocks`; cada hueco → error `hueco A–B s sin bloque` (1 decimal). `motionWarnings` en `voice` delega en `voiceWarnings`.

- [ ] **Step 1: Tests.** keeps `[{0,5},{6,10}]` (final 0–5, 5–9):
  - `voice valida con cobertura total`: bloques `0–5` y `6–10` con beats válidos → `validatePlan` sin errores.
  - `voice con hueco`: bloques `0–4` y `6–10` → error que contiene `hueco 4.0–5.0 s sin bloque`.
  - `voice sin motion` → error `voice necesita motion.blocks`.
  - `voiceGaps ignora tramos cortos`: keeps `[{0,5},{5.5,5.8},{6,10}]`, bloques en el 1.º y 3.º → `[]`.
  - `voiceWarnings`: no contiene `gancho`, `profe`, `motion cubre`; con primer bloque en 0.5 → aviso `no empieza en 0`; último `light` → aviso `ultimo bloque deberia ser dark`; 3 bloques `light` seguidos → aviso `3 bloques seguidos con fondo light`; `title` presente → aviso `title no se ve en voice`; beat largo sigue avisando.
  - `strategy motion` sin cambios (tests existentes siguen verdes).
- [ ] **Step 2: Run** `npx vitest run src/lib/motion.test.ts src/lib/plan.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `voiceGaps`: tramos finales cubiertos = `[mapTimeNext(b.start), mapTimeNext(b.end)]` ordenados; recorrer `[0, total]` restando tramos cubiertos y los tramos finales de keeps con duración < `MIN_BEAT`; devolver huecos > `MAX_GAP`. `voiceWarnings`: reutilizar el bucle de beats largos y layouts repetidos de `motionWarnings` (extraer helper `beatWarnings(blocks)` común) + avisos nuevos. `validate.ts`: el % de motion solo se imprime si `strategy !== 'voice'`.
- [ ] **Step 4: Run** — PASS; `npx tsc --noEmit` limpio.
- [ ] **Step 5: Commit** (ledger): `feat(plan): voice strategy with full motion coverage check`

### Task 5: borrador con cobertura total

**Files:**
- Modify: `src/lib/draftMotion.ts`, `scripts/draft-motion.ts`
- Test: `src/lib/draftMotion.test.ts`

**Interfaces:**
- Consumes: `voiceGaps` (Task 4).
- Produces: `DraftOpts = {from: number; until: number; target?: number; full?: boolean}`; con `full` devuelve bloques contiguos que cubren cada tramo conservado ≥ `MIN_BEAT` entero.

- [ ] **Step 1: Tests** (palabras sintéticas de 0.3 s cada 0.35 s, con punto cada 6 palabras):
  - `full cubre todo`: keeps `[{0,12},{13,20}]` → `voiceGaps(blocks, keeps)` = `[]`; primer bloque `start` = 0; último `end` = 20.
  - `full: bloques de 3–8 s salvo tramos cortos`: todo bloque dentro de un tramo ≥ 3 s dura entre 3 y 8 s.
  - `full: tramo corto da un bloque corto`: keeps `[{0,10},{11,12.5}]` → hay un bloque `11–12.5`.
  - `full: fondos alternan y ultimo dark`: ningún par consecutivo con el mismo `bg` salvo forzado del último; último `bg` = `dark`.
  - `full: beats validos`: `validateMotion` sin errores con ctx de esos keeps.
  - `sin full` igual que antes (tests existentes).
- [ ] **Step 2: Run** `npx vitest run src/lib/draftMotion.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Rama `full`: por cada tramo (≥ `MIN_BEAT`), cursor = `r.start`; mientras `r.end - cursor > MAX_BLOCK`: fin candidato = fin de la última palabra con `endsClause` cuyo `end` esté en `[cursor+MIN_BLOCK, cursor+MAX_BLOCK]` (+ `PAD_OUT` acotado), si no hay, la última palabra que termine antes de `cursor+MAX_BLOCK`, si no hay, `cursor+MAX_BLOCK`; si lo que queda tras el corte < `MIN_BLOCK`, partir el resto en dos mitades. Último bloque = `[cursor, r.end]`. Beats con `buildBeats(s, e, chunkWords(palabras del bloque))`; bloque sin palabras → un beat `word` con `key` = `'…'`. `bg` alterna por índice global; último forzado `dark`. `draft-motion.ts`: si `plan.strategy === 'voice'` → `full: true`, `from` = primer keep, `until` = último keep end, y conserva `strategy: 'voice'`; imprime `cobertura 100 %` en vez del %.
- [ ] **Step 4: Run** — PASS; suite y tsc.
- [ ] **Step 5: Commit** (ledger): `feat(motion): full-coverage draft for the voice strategy`

### Task 6: skill `edit-voice`, router, docs

**Files:**
- Create: `.claude/skills/edit-voice/SKILL.md`
- Modify: `.claude/skills/edit-router/SKILL.md`, `.claude/skills/video-base/SKILL.md` (estrategias y esquema `strategy`), `.claude/skills/video-base/templates.md` (nota `voice` en Motion), `docs/MANUAL.md`, `README.md` (una línea)

- [ ] **Step 1:** Escribir `edit-voice/SKILL.md` según el spec: frontmatter (`name: edit-voice`, description con "guion + nota de voz", uso `/edit-voice media/input/NOMBRE.m4a`); carga `video-base`; paso 1 (exigir `NOMBRE.txt`, `npm run edit -- … --plan-only`, leer la línea `coincidencia`); paso 3 (`strategy: "voice"`, sin title/end, `npm run draft-motion`, enriquecer con la tabla de `edit-motion` enlazada, gancho en el primer beat, CTA en último bloque dark, alternar fondos); validate/preview/render/caption; resumen con `Guion: coincidencia X %`; qué evitar.
- [ ] **Step 2:** Router: entrada `.m4a/.mp3/.ogg/.opus/.wav` → `edit-voice`. video-base: `voice` en la lista de estrategias. MANUAL: sección "Video desde guion + nota de voz" (archivos, comando, qué hace cada paso, error de coincidencia). README: línea de `/edit-voice`.
- [ ] **Step 3: Verificar** que cada comando citado existe: `grep -n "script-align\|audio-to-video\|draft-motion" package.json`. Expected: 3 coincidencias.
- [ ] **Step 4: Commit** (ledger): `docs(skills): edit-voice skill for script + voice note videos`

### Task 7: E2E

- [ ] **Step 1:** Si el usuario no dio nota de voz: `ffmpeg -i media/input/PLOT_TWIST.mov -vn -c:a aac media/input/PT_voice.m4a`; guion `media/input/PT_voice.txt` = texto de los `segments` de `public/Plot_Twist_motion.transcript.json`, con el inglés bien escrito (plot twist, cliffhanger, page turner).
- [ ] **Step 2:** Seguir `/edit-voice media/input/PT_voice.m4a` completo: plan-only (Expected: `coincidencia` ≥ 90 %), draft, enriquecer, `npm run validate -- PT_voice` (Expected: 0 errores), preview (revisar capturas), render (Expected: `media/output/edited/PT_voice/PT_voice_edited.mp4`, sin frames de fondo vacío salvo tramos < 0.4 s), caption.
- [ ] **Step 3:** Mostrar al usuario el preview y pedir aprobación antes del render final (regla de video-base).
- [ ] **Step 4:** Suite completa + tsc + pytest; ledger `Task 7: complete`.
