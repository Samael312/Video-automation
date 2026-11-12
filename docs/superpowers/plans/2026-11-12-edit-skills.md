# Skills de edición (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario invoque una sola skill (`/edit-router`, `/edit-captions`, `/edit-motion`, `/edit-mixed`) sobre un video y Claude Code produzca un `edit.json` válido, muestre un preview para aprobación y renderice.

**Architecture:** Cuatro herramientas CLI con su lógica pura en `src/lib/` (testeada con vitest) dan a las skills lo que necesitan: pipeline sin render, transcripción legible con cortes, hoja de capturas y descarga de emojis. Las skills son `SKILL.md` en `.claude/skills/`; `video-base` define flujo y reglas comunes y las estrategias solo describen su diferencia.

**Tech Stack:** Remotion 4.0.543 (`@remotion/bundler` y `@remotion/renderer` ya presentes como dependencias de la CLI; se declaran explícitamente con la misma versión), `tsx`, ffmpeg, Noto Emoji vía jsDelivr (tag `v2.047`, verificado: devuelve 200).

**Spec:** `docs/superpowers/specs/2026-11-12-edit-skills-design.md`

## Global Constraints

- Sin APIs de pago; descarga de emojis solo desde `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/png/512/emoji_u<codigo>.png`.
- Las skills nunca renderizan el video final sin aprobación explícita del usuario sobre el preview.
- Toda escena/overlay de un plan debe pasar `npm run validate` antes del preview.
- Tiempos del plan en segundos del video original; los tramos se alinean a frames (`quantizeKeeps`) en todo cálculo de frames.
- Español en los textos de skills y CLIs (el usuario habla español); identificadores en inglés.

## Review Focus

1. **Video sin `cuts.json` o sin `transcript.json`** al correr `inspect`/`preview`: mensaje claro que diga qué paso correr, sin stack trace. → Task 1 y 2.
2. **Plan sin escenas ni labels** (estrategia `captions` mínima): `preview` igual produce una hoja (frames de muestra repartidos), no falla por lista vacía. → Task 2.
3. **Código de emoji inválido o inexistente en Noto** (`U+ZZZ`, `1f9ff9`): error claro, no se crea archivo vacío ni corrupto. → Task 3.
4. **Emoji ya presente**: no se sobrescribe (los 4 actuales vienen de otra versión de Noto). → Task 3.
5. **Escena o label en el borde de un corte**: el frame de preview cae dentro de la escena reubicada, no en la persona. → Task 2 (`previewFrames` usa el centro del tramo reubicado).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/inspect.ts` + test | `formatInspect(transcript, keeps): string` |
| `scripts/inspect.ts` | CLI `npm run inspect -- <video>` |
| `src/lib/preview.ts` + test | `previewFrames(plan, keeps, fps, totalFrames): PreviewFrame[]` |
| `scripts/preview.ts` | CLI `npm run preview -- <video>`: valida, renderiza stills con un solo bundle, une en hoja |
| `src/lib/emoji.ts` + test | `normalizeEmoji(input): string \| null`, `notoUrl(code): string` |
| `scripts/emoji.ts` | CLI `npm run emoji -- <codigo...>` |
| `scripts/edit.js` | `--plan-only` |
| `.claude/skills/video-base/SKILL.md`, `brand.md`, `templates.md` | Flujo, reglas, marca, guía de plantillas |
| `.claude/skills/edit-{captions,motion,mixed,router}/SKILL.md` | Estrategias y router |

---

### Task 1: `--plan-only` e `inspect`

**Files:** Create `src/lib/inspect.ts`, `src/lib/inspect.test.ts`, `scripts/inspect.ts`; Modify `scripts/edit.js`, `package.json` (`inspect`).

**Interfaces:**
- Consumes: `Transcript`, `Keep`, `keptDuration`.
- Produces: `formatInspect(transcript: Transcript, keeps: Keep[]): string` — por cada tramo, una cabecera `== TRAMO i (a–b s) ==` y luego las palabras del tramo `[t] palabra` (t original, 2 decimales); entre tramos `--- CORTE (b–a' s, x.xx s) ---`; palabras que caen en zona cortada se listan bajo `--- CORTE ...` con prefijo `(cortada)`; al final `Duración final: X s de Y s`.
- `edit.js --plan-only`: corre normalizar, transcribir y cortar, y termina con `Siguiente: npm run inspect -- <nombre>`.

- [ ] **Step 1: Tests** en `inspect.test.ts` con keeps `[{1,3},{4,6}]` y palabras `a(1.2)`, `b(2.5)`, `c(3.4)` (cortada), `d(4.5)`: la salida contiene `== TRAMO 1 (1.00–3.00 s) ==`, `[1.20] a`, `--- CORTE (3.00–4.00 s, 1.00 s) ---`, `(cortada) [3.40] c`, `== TRAMO 2`, `[4.50] d`, `Duración final: 4.00 s`; con `words: []` no lanza e incluye `Duración final`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementar. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `scripts/inspect.ts` (lee `public/<n>.transcript.json` y `.cuts.json`; si falta el transcript: `ERROR: falta public/<n>.transcript.json; corre: npm run edit -- <video> --plan-only` y código 1; si faltan cortes, aviso y un tramo completo). `--plan-only` en `edit.js`. `npm run inspect -- ACTUALLY` muestra 3 tramos.
- [ ] **Step 6:** Commit.

### Task 2: `preview`

**Files:** Create `src/lib/preview.ts`, `src/lib/preview.test.ts`, `scripts/preview.ts`; Modify `package.json` (`preview`; declarar `@remotion/bundler` y `@remotion/renderer` 4.0.543).

**Interfaces:**
- Consumes: `EditPlan`, `sceneFrames`, `mapTimeNext`, `quantizeKeeps`, `totalFrames`.
- Produces: `type PreviewFrame = {frame: number; label: string}`; `previewFrames(plan: EditPlan, keeps: Keep[], fps: number, total: number): PreviewFrame[]` — un frame en el centro de cada escena reubicada (`label = "escena i: <tipo>"`), de cada overlay `label` (`"label: <texto>"`), del título y del cierre (60 % de su visibilidad, para que el texto ya esté animado); si la lista queda con menos de 4 frames, completa con frames repartidos uniformemente (`"muestra"`); ordenados y sin duplicados; todos en `[0, total-1]`.
- CLI: valida (sale con 1 si no pasa), hace `bundle()` una vez, `selectComposition('Edit', inputProps)`, `renderStill` por frame a `media/output/preview/<n>_<i>.png`, y une con ffmpeg (`xstack`/`tile`, 4 columnas, ancho 360 por captura) en `media/output/<n>_preview.png`; imprime la leyenda `#i frame label`.

- [ ] **Step 1: Tests**: plan con 1 escena `{2,4}` y keeps `[{1,8},{9,19}]` → incluye frame `Math.round(((2-1)+(4-1))/2*30) = 60` con label `escena 0: translate`; escena tras el corte `{10,12}` → frame 270; `defaultPlan` → 4 frames de `muestra` dentro del rango; ningún frame `>= total`; sin duplicados.
- [ ] **Step 2–4:** RED → implementar → GREEN.
- [ ] **Step 5:** CLI; `npm run preview -- ACTUALLY` genera la hoja; revisarla a ojo (cada captura en la escena correcta).
- [ ] **Step 6:** Commit.

### Task 3: `emoji`

**Files:** Create `src/lib/emoji.ts`, `src/lib/emoji.test.ts`, `scripts/emoji.ts`; Modify `package.json` (`emoji`).

**Interfaces:**
- `normalizeEmoji(input: string): string | null` — `'😀'`, `'U+1F600'`, `'1F600'`, `'1f600'` → `'1f600'`; secuencias `'👍🏻'` / `'1f44d-1f3fb'` / `'1F44D_1F3FB'` → `'1f44d_1f3fb'`; descarta `fe0f`; entrada no válida (`'U+ZZZ'`, `''`, `'hola'`) → `null`.
- `notoUrl(code: string): string` con el tag `v2.047`.
- CLI: por cada argumento normaliza; inválido → error y sigue; si `public/emoji/<code>.png` existe → `ya existe` sin descargar; descarga con `fetch`; si no es 200 o el cuerpo no empieza con la firma PNG → error, no escribe archivo. Código de salida 1 si algún argumento falló.

- [ ] **Step 1: Tests** de `normalizeEmoji` (todos los casos de arriba) y `notoUrl('1f600')` exacta.
- [ ] **Step 2–4:** RED → implementar → GREEN.
- [ ] **Step 5:** `npm run emoji -- 😀 U+ZZZ 1f9ff9 1f92b` → descarga `1f600.png` (512x512 con ffprobe), error para los dos inválidos, `ya existe` para `1f92b` (sin cambiar su contenido: hash igual). Borrar `1f600.png` si no se usa.
- [ ] **Step 6:** Commit.

### Task 4: `video-base`

**Files:** Create `.claude/skills/video-base/SKILL.md`, `brand.md`, `templates.md`.

- [ ] **Step 1:** `SKILL.md` con frontmatter (`name`, `description` que diga que la cargan las skills `edit-*` y no se usa sola), el flujo de 6 pasos con los comandos exactos, las reglas comunes de la spec y una checklist previa al preview (validate OK, gancho < 2 s, cada ≤ 3 s algo nuevo, sin overlays duplicando escenas, CTA, textos en inglés correctos). Cómo responder a pedidos de cambio (editar el plan, revalidar, nuevo preview).
- [ ] **Step 2:** `templates.md`: tabla de los 6 tipos + `generated` con `data` exacto, cuándo usar cada uno, duración recomendada, y un ejemplo JSON por tipo; overlays (`label`, `emoji`) con posiciones que no chocan con subtítulos (y ≥ 380) y sfx disponibles.
- [ ] **Step 3:** `brand.md`: tono, público (hispanohablantes aprendiendo inglés), ganchos y cierres del video de referencia; marcado como editable por el usuario.
- [ ] **Step 4:** Revisión: cada comando citado existe en `package.json`; cada campo citado existe en `plan.ts`.
- [ ] **Step 5:** Commit.

### Task 5: Estrategias `edit-captions`, `edit-motion`, `edit-mixed`

**Files:** Create `.claude/skills/edit-{captions,motion,mixed}/SKILL.md`.

- [ ] **Step 1:** Cada una: frontmatter con `description` disparable ("editar video para TikTok con …"), primera instrucción "carga la skill `video-base` y sigue su flujo", y luego solo su política: para qué formatos, qué usa (con cantidades), qué evita, `strategy` a escribir en el plan, y una mini-guía de decisión para elegir tiempos de escenas a partir de `inspect`.
- [ ] **Step 2:** Revisión cruzada: ninguna repite reglas de `video-base`; los límites coinciden con la spec (motion ≤ ~60 % seguido en escenas; mixed 1–3 escenas, sin escena en el gancho).
- [ ] **Step 3:** Commit.

### Task 6: `edit-router`

**Files:** Create `.claude/skills/edit-router/SKILL.md`.

- [ ] **Step 1:** Flujo: correr `edit --plan-only` + `inspect`; clasificar el formato entre los 9 de la spec con la evidencia (frases del transcript); recomendar estrategia según el mapeo; mostrar razón y **esperar confirmación**; luego cargar la skill elegida y continuar desde su paso 3 (sin repetir el pipeline).
- [ ] **Step 2:** Commit.

### Task 7: Prueba de punta a punta y manual

**Files:** Create `docs/MANUAL.md`; Modify `README.md` (enlace al manual), `.gitignore` (`media/output/preview/` ya cubierto por `media/output/*`).

- [ ] **Step 1:** Seguir `edit-router` sobre `ACTUALLY.mp4` leyendo el `SKILL.md` (las skills nuevas del proyecto se cargan en la próxima sesión de Claude Code): debe recomendar `mixed`. Escribir el plan con `edit-captions` en una copia (`public/ACTUALLY.edit.json` reemplazado temporalmente), validar, preview, y lo mismo con `edit-motion`. Verificar hojas de preview a ojo y renderizar al menos una estrategia distinta de la de ejemplo; `ffprobe` duración = tramos ±1 frame.
- [ ] **Step 2:** Restaurar el plan de ejemplo `mixed`. `npm test`, pytest y `tsc` → PASS.
- [ ] **Step 3:** `docs/MANUAL.md`: instalación, flujo diario (pasar un video → elegir skill → revisar preview → render), qué hace cada skill, cómo pedir cambios, comandos, `brand.md`, emojis, escenas generadas, problemas comunes (falta HF_TOKEN, falta cuts.json, emoji inexistente, transcripción con palabras mal escritas). Enlazarlo desde el README.
- [ ] **Step 4:** Commit.
