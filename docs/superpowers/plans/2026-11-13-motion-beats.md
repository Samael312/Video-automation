# Motion por beats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `strategy: "motion"` renderice bloques de motion graphics a pantalla completa (beats de 0.5–2 s, tipografía cinética, emojis 3D, fondo claro) intercalados con la profe en cámara, al estilo de `media/reference/motion/m_1.mp4`.

**Architecture:** Campo nuevo `plan.motion.blocks[].beats[]` validado en `src/lib/motion.ts` (lógica pura). Un `MotionLayer` pinta cada bloque encima del video (fondo + cámara + wipe + beats con 8 layouts). Un borrador automático (`draft-motion`) arma bloques/beats desde el transcript; la skill `edit-motion` los enriquece. Emojis 3D de Microsoft Fluent en `public/emoji3d/`.

**Tech Stack:** TypeScript, React 19, Remotion 4.0.543 (`@remotion/motion-blur`, `@remotion/google-fonts`), Vitest, tsx, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-13-motion-beats-design.md`

## Global Constraints

- **Nunca `git commit`/merge/push** (regla del usuario). El paso "Cerrar" de cada tarea = dejar archivos sin `git add`, listar archivos cambiados y proponer mensaje de commit en bloque de código.
- Plan sigue `version: 1`; `motion` es opcional. Planes viejos (sin `motion`) siguen válidos e iguales al renderizar.
- Tiempos del plan en segundos del video **original**.
- Composición `Edit` = 720×1280, 30 fps. Contenido de beats entre y≈200 y y≈1000.
- Paleta: `light` fondo `#EEEDF0`, texto `#111`; `dark` fondo `#111`, texto `#F4F2EE`; resaltador `theme.cream` (`#FCF4B0`). Fuentes: `theme.fonts.serifItalic` (key) y `theme.fonts.sans` (lead).
- Layouts (lista cerrada): `word`, `prop`, `ring`, `list`, `strike`, `swap`, `card`, `big`.
- Beat: error < 0.4 s; aviso > 2.5 s. Bloque dentro de un solo tramo; sin solapes con bloques ni escenas.
- Emojis 3D: Fluent commit `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc`, Unicode `emoji-test.txt` 15.1, índice en `.cache/fluent3d-index.json`; fallback = copiar Noto a `public/emoji3d/`.
- Recursos (emojis, textos) salen del contenido del video, nunca de la referencia.
- Mensajes al usuario en CLIs y validador: español, sin tildes en código (estilo actual de `plan.ts`).

## Review Focus

1. **Bloque cuyo tramo tiene pocas palabras** (tramo corto o silencioso): el borrador no debe crear bloques < 3 s ni beats < 0.4 s → test en Task 3 `no crea bloques de menos de 3 s`.
2. **`lead` que no coincide con el transcript** (la skill reescribe texto): las palabras deben aparecer todas al entrar, sin crash → test en Task 5 `leadDelays sin coincidencia devuelve ceros`.
3. **Plan viejo sin `motion`** (ACTUALLY.edit.json): validación y render iguales → test en Task 1 `plan sin motion sigue valido` + render de ACTUALLY en Task 7.
4. **Emoji sin versión Fluent**: no debe romper el render → test en Task 4 `resolve devuelve null para codigo sin carpeta` + fallback Noto en CLI.
5. **Bloque que empieza justo en un corte** (`block.start` = `keep.start`): `mapTimeNext` debe dar el mismo frame que el video → test en Task 6 `blockFrames en borde de tramo`.

---

### Task 1: Tipos y validación de motion

**Files:**
- Create: `src/lib/motion.ts`, `src/lib/motion.test.ts`
- Modify: `src/lib/plan.ts` (tipo `EditPlan`, `ValidateCtx`, `validatePlan`)

**Interfaces:**
- Produces:
  ```ts
  export const LAYOUTS = ['word','prop','ring','list','strike','swap','card','big'] as const;
  export type Layout = (typeof LAYOUTS)[number];
  export type Beat = {at: number; layout: Layout; lead?: string; key?: string; emoji?: string; pos?: 'top'|'bottom';
    items?: string[]; active?: number; title?: string; from?: string; to?: string; frame?: 'player'|'phone'};
  export type Block = {start: number; end: number; bg: 'light'|'dark'; beats: Beat[]};
  export type MotionPlan = {blocks: Block[]};
  export const MIN_BEAT = 0.4; export const MAX_BEAT_WARN = 2.5;
  export const beatSpans: (b: Block) => {beat: Beat; start: number; end: number}[];   // tiempos originales
  export const validateMotion: (motion: unknown, ctx: ValidateCtx, scenes: {start: number; end: number}[]) => string[];
  ```
  En `plan.ts`: `EditPlan.motion?: MotionPlan`; `ValidateCtx.knownEmojis3d?: string[]`; `validatePlan` añade `validateMotion(plan.motion, ctx, scenes)` si `plan.motion !== undefined`.

- [ ] **Step 1: Tests que fallan** en `src/lib/motion.test.ts` (ctx como en `plan.test.ts`: keeps `[{1,8},{9,19}]`, `knownEmojis3d: ['1f4da']`). Helper `block(over)` = `{start: 2, end: 6, bg: 'light', beats: [{at: 2, layout: 'word', key: 'a'}, {at: 3, layout: 'word', key: 'b'}]}`.
  - `plan sin motion sigue valido`: `validatePlan(defaultPlan('v.mp4'), ctx)` → `[]`.
  - `bloque valido` → `[]`.
  - `beatSpans`: para el bloque base → `[{start:2,end:3},{start:3,end:6}]`.
  - errores (cada uno `toContain`): bloque que cruza corte (`start 7, end 8.5` → `'corte'`); bloques solapados (`'solapa'`); bloque solapado con escena (`'escena'`); `bg: 'neon'` (`'bg'`); primer `at` ≠ start (`at: 2.2` → `'primer beat'`); `at` decreciente (`'orden'`); beat de 0.3 s (`'0.4'`); beat fuera del bloque (`at: 6.5` → `'fuera'`); layout `'karaoke'` (`'layout'`); `word` sin key (`'key'`); `prop` sin emoji (`'emoji'`); emoji `'1f999'` no en emoji3d (`'emoji3d'`); `list` con 1 item y con 6 (`'items'`); `list` con `active: 4` sobre 3 items (`'active'`); `strike` con 5 items (`'items'`); `swap` sin `to` (`'to'`); `card` sin `frame` o `frame: 'tv'` (`'frame'`); `prop` con `pos: 'left'` (`'pos'`); `blocks` no lista (`'blocks'`).

- [ ] **Step 2:** `npx vitest run src/lib/motion.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar** `src/lib/motion.ts` y conectar en `plan.ts`. Tolerancia primer `at` = 0.05 s. Reusar `keepIndex` (exportarlo desde `plan.ts` o moverlo a `cuts.ts` como `keepIndexOf`). Campos por layout: `word` key; `prop`/`ring` emoji; `list` items 2–5, active entero en rango; `strike` items 2–4; `swap` from+to; `card` key+frame; `big` key. Emoji se valida contra `knownEmojis3d` solo si `ctx.knownEmojis3d` existe. Mensajes con prefijo `bloque[i]` / `bloque[i].beat[j]`.

- [ ] **Step 4:** `npx vitest run` → todo PASS (incluye `plan.test.ts` sin cambios).

- [ ] **Step 5: Cerrar.** Mensaje: `feat(motion): plan.motion types and validation`.

### Task 2: Avisos de motion y CLI validate

**Files:**
- Modify: `src/lib/motion.ts`, `src/lib/motion.test.ts`, `src/lib/cuts.ts` (+ test en `cuts.test.ts`), `scripts/common.ts`, `scripts/validate.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  ```ts
  // cuts.ts
  export const originalAt: (newT: number, keeps: Keep[]) => number;   // inverso de mapTimeNext (en tramo conservado)
  // motion.ts
  export const motionShare: (plan: EditPlan, keeps: Keep[]) => number;  // 0..1 de la duracion final
  export const motionWarnings: (plan: EditPlan, ctx: ValidateCtx) => string[];
  // common.ts
  export const knownEmojis3d: () => string[];   // public/emoji3d/*.png ([] si no existe la carpeta)
  ```

- [ ] **Step 1: Tests que fallan.**
  - `originalAt(0, keeps) === 1`, `originalAt(7.5, keeps) === 9.5` (keeps `[{1,8},{9,19}]`), `originalAt(999, keeps) === 19`.
  - `motionShare` con un bloque 2–6 sobre keeps (total 17 s) → `4/17`.
  - avisos (`toContain`): beat de 3 s (`'divide'`); 3 `word` seguidos (`'iguales'`); dos bloques con 0.5 s de profe entre ellos en tiempo final (`'profe'`); share < 0.5 (`'50'`) y > 0.8 (`'80'`); bloque que empieza antes de 2.5 s finales (`'gancho'`); bloque después de `end.start` (`'cierre'`). Plan con share 0.65 y sin problemas → `[]`.

- [ ] **Step 2:** `npx vitest run src/lib` → FAIL.

- [ ] **Step 3: Implementar.** Distancias y share en tiempo final (`mapTimeNext`). `validate.ts`: pasar `knownEmojis3d: knownEmojis3d()` al ctx; tras errores, si hay `plan.motion`, imprimir `AVISOS (n):` + líneas y la línea `motion: XX % de la duracion final`; los avisos no cambian el código de salida.

- [ ] **Step 4:** `npx vitest run` PASS; `npm run validate -- ACTUALLY` → `OK` (sin motion, sin avisos).

- [ ] **Step 5: Cerrar.** Mensaje: `feat(motion): warnings, motion share and validate output`.

### Task 3: Borrador automático `draft-motion`

**Files:**
- Create: `src/lib/draftMotion.ts`, `src/lib/draftMotion.test.ts`, `scripts/draft-motion.ts`
- Modify: `package.json` (script `"draft-motion": "tsx scripts/draft-motion.ts"`)

**Interfaces:**
- Consumes: `Word`, `Keep`, `originalAt`, `validateMotion`, `MotionPlan`.
- Produces:
  ```ts
  export type DraftOpts = {from: number; until: number; target?: number /* 0.65 */};
  export const chunkWords: (words: Word[]) => Word[][];          // 2–4 palabras; corta en puntuacion o pausa > 0.25 s
  export const draftMotion: (words: Word[], keeps: Keep[], opts: DraftOpts) => MotionPlan;
  ```

- [ ] **Step 1: Tests que fallan** con un transcript sintético (palabras de 0.3 s separadas 0.05 s, con una coma cada 5 palabras, keeps `[{0,12},{12.5,30}]`, `from: 2.5`, `until: 27`):
  - `chunkWords` nunca da grupos de 1 salvo que el tramo tenga 1 palabra, ni de > 4; corta tras la coma.
  - `cada bloque cae en un solo tramo y entre from y until`.
  - `no crea bloques de menos de 3 s ni de mas de 8 s`.
  - `hay al menos 1 s de profe entre bloques` (tiempo final).
  - `primer beat en block.start y at crecientes`; `ningun beat < 0.4 s`.
  - `todos los beats son word con key = ultima palabra sin puntuacion y lead = resto`.
  - `el resultado pasa validateMotion` (ctx sin emojis).
  - `share final entre 0.5 y target + 0.15`.

- [ ] **Step 2:** `npx vitest run src/lib/draftMotion.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** Algoritmo por tramo: palabras con `start >= max(k.start, from)` y `end <= min(k.end, until)` → `chunkWords` → acumular chunks en un bloque mientras `fin - inicio <= 8`; cerrar bloque y saltar chunks hasta dejar ≥ 1 s; descartar bloques < 3 s; parar al llegar a `target`. `block.start = max(rango.start, primera.start - 0.1)`, `block.end = min(rango.end, ultima.end + 0.2)`. Beats: `at` = start del primer word del chunk (el primero = `block.start`); fusionar con el anterior un chunk que daría beat < 0.4 s. `bg: 'light'`. CLI: `npm run draft-motion -- <video>`: lee transcript + keeps (`loadTranscriptAndKeeps`, `quantizeKeeps` a 30 fps) y el plan (o `defaultPlan`); `from = plan.title?.end ?? originalAt(2.5, keeps)`; `until = plan.end?.start ?? keeps.at(-1).end`; escribe `motion` y `strategy: 'motion'` en `public/<video>.edit.json` sin tocar lo demás; imprime nº bloques, beats y `%`.

- [ ] **Step 4:** `npx vitest run` PASS. `npm run draft-motion -- Plot_Twist_motion` (hacer backup de su `.edit.json` antes si existe, y restaurarlo después) y `npm run validate -- Plot_Twist_motion` → sin errores.

- [ ] **Step 5: Cerrar.** Mensaje: `feat(motion): draft-motion CLI builds blocks and beats from transcript`.

### Task 4: Emojis 3D Fluent (`npm run emoji -- --3d`)

**Files:**
- Create: `src/lib/fluent.ts`, `src/lib/fluent.test.ts`, `public/emoji3d/.gitkeep`
- Modify: `scripts/emoji.ts`

**Interfaces:**
- Consumes: `normalizeEmoji` (`src/lib/emoji.ts`).
- Produces:
  ```ts
  export const FLUENT_SHA = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc';
  export const buildFluentIndex: (treePaths: string[], emojiTest: string) => Record<string, string>; // codigo -> ruta en repo
  export const fluentRawUrl: (repoPath: string) => string; // raw.githubusercontent.com/microsoft/fluentui-emoji/<sha>/<path codificado>
  ```

- [ ] **Step 1: Tests que fallan** (`fluent.test.ts`, datos en línea, sin red):
  - tree `['assets/Face screaming in fear/3D/face_screaming_in_fear_3d.png', 'assets/Thumbs up/Default/3D/thumbs_up_3d_default.png', 'assets/Thumbs up/Dark/3D/thumbs_up_3d_dark.png']` + líneas de emoji-test para 1F631 y 1F44D → `{'1f631': 'assets/Face…png', '1f44d': 'assets/Thumbs up/Default/…default.png'}`.
  - `ignora skin tones y no fully-qualified`.
  - `quita fe0f del codigo` (línea `2764 FE0F ; fully-qualified # ❤️ E0.6 red heart` + carpeta `Red heart`) → clave `'2764'`.
  - `nombre con dos puntos` (`flag: Spain` → carpeta `Flag Spain`).
  - `resolve devuelve null para codigo sin carpeta` (índice sin la clave → `undefined`).
  - `fluentRawUrl` codifica espacios como `%20`.

- [ ] **Step 2:** `npx vitest run src/lib/fluent.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** Nombre CLDR = texto tras `E<ver> ` en emoji-test, en minúsculas, sin `:’"“”`, espacios colapsados; carpeta = segundo segmento del path en minúsculas; preferir `/Default/3D/` si hay variantes. `scripts/emoji.ts`: flag `--3d` → cargar o crear `.cache/fluent3d-index.json` (GitHub API `git/trees/<sha>?recursive=1` + `https://unicode.org/Public/emoji/15.1/emoji-test.txt`, User-Agent genérico `video-automation`), bajar a `public/emoji3d/<codigo>.png` validando firma PNG; si no está en el índice: avisar `sin version 3D, se usa Noto`, descargar Noto a `public/emoji/` si falta y copiarlo a `emoji3d/`. No sobrescribir existentes. Sin `--3d`: comportamiento actual intacto.

- [ ] **Step 4:** `npx vitest run` PASS. `npm run emoji -- --3d 😱 📚 📖 🧗 1f9e0` → 5 PNG en `public/emoji3d/`; abrir uno con Read para ver que es el 3D.

- [ ] **Step 5: Cerrar.** Mensaje: `feat(emoji): --3d downloads Microsoft Fluent 3D emojis`.

### Task 5: Primitivas, fondo y los 8 layouts + galería

**Files:**
- Create: `src/motion/primitives.tsx`, `src/motion/Background.tsx`, `src/motion/palette.ts`, `src/motion/leadTiming.ts`, `src/motion/leadTiming.test.ts`, `src/motion/layouts/{word,prop,ring,list,strike,swap,card,big}.tsx`, `src/motion/layouts/index.ts`, `src/compositions/MotionGallery.tsx`
- Modify: `src/Root.tsx` (composición `MotionGallery` 720×1280, 30 fps, 16 × 45 frames)

**Interfaces:**
- Consumes: `Beat`, `Layout`, `Theme`, `Word`.
- Produces:
  ```ts
  // palette.ts
  export type Palette = {bg: string; fg: string; dim: string; dot: string};
  export const palette: (bg: 'light'|'dark') => Palette;     // light #EEEDF0/#111, dark #111/#F4F2EE
  // leadTiming.ts (puro)
  export const leadDelays: (lead: string, words: Word[], start: number, end: number) => number[]; // seg desde start, por palabra de lead
  // layouts/index.ts
  export type LayoutProps = {beat: Beat; theme: Theme; pal: Palette; durationInFrames: number; leadDelays: number[]};
  export const LAYOUT_UI: Record<Layout, React.FC<LayoutProps>>;
  // primitives.tsx
  export const Enter: React.FC<{children: React.ReactNode; delay?: number}>;   // blur 12→0, scale .92→1, y +20→0 en 7 frames
  export const Highlight: React.FC<{children: React.ReactNode; color: string; delay?: number}>; // barre izq→der en 8 frames
  export const Lead: React.FC<{text: string; delays: number[]; font: string; color: string; size: number}>; // palabras por tiempo
  export const Emoji3d: React.FC<{code: string; size: number; float?: boolean}>; // Img staticFile(`emoji3d/${code}.png`) + sombra
  // Background.tsx
  export const Background: React.FC<{bg: 'light'|'dark'; props: string[] /* emojis de profundidad, 0–2 */; durationInFrames: number}>;
  ```

- [ ] **Step 1: Tests que fallan** `leadTiming.test.ts`: words `[{word:'te',start:4.0},{word:'deja',start:4.2},{word:'en,',start:4.5}]`:
  - `leadDelays('te deja en', words, 4.0, 5.0)` → `[0, 0.2, 0.5]` (ignora puntuación y mayúsculas).
  - `leadDelays sin coincidencia devuelve ceros`: `leadDelays('otra cosa', words, 4, 5)` → `[0, 0]`.
  - palabras fuera de `[start,end)` no cuentan; coincidencia parcial: las no encontradas toman el delay de la anterior encontrada (o 0).

- [ ] **Step 2:** `npx vitest run src/motion` → FAIL.

- [ ] **Step 3: Implementar** `leadTiming.ts`, `palette.ts`, `primitives.tsx`, `Background.tsx` (puntos: 18 círculos fijos por semilla `random()` de Remotion, radios 6–40 px, blur 2–10 px, deriva lenta; viñeta radial; props: emoji a 520 px, blur 18 px, opacidad 0.5, entrando desde esquina superior derecha e inferior izquierda) y los 8 layouts según la tabla del spec (tamaños: key 96 px con `fitText` de `@remotion/layout-utils` a 620 px de ancho; lead 40 px; emoji prop 360 px, ring 260 px dentro de círculo 340 px borde `6px dashed` girando 40°/s; pastillas list/strike 64 px alto, radio 32; card 600×380 oscura `#1a1a1a` con barra de progreso (player) o 380×700 con notch (phone); big 220 px sobre `#000` con blur de entrada 30→0). `MotionGallery`: 8 layouts × light/dark, 45 frames cada uno, datos de ejemplo del contenido Plot_Twist (emojis `1f631`, `1f4da`).

- [ ] **Step 4:** `npx vitest run` PASS. Render: `npx remotion render src/index.ts MotionGallery media/output/motion_gallery.mp4` → luego `ffmpeg -i media/output/motion_gallery.mp4 -vf "select='not(mod(n\,45)-30)',scale=180:-1,tile=8x2" -frames:v 1 -vsync vfr media/output/motion_gallery.png`. Abrir la hoja con Read y comparar con m_1: texto legible, nada fuera de 720 px, resaltador detrás de la key, emoji 3D visible.

- [ ] **Step 5: Cerrar.** Mensaje: `feat(motion): beat layouts, background and MotionGallery`.

### Task 6: `MotionLayer` y conexión en `Edit`

**Files:**
- Create: `src/motion/MotionLayer.tsx`, `src/motion/timing.ts`, `src/motion/timing.test.ts`
- Modify: `src/Edit.tsx`

**Interfaces:**
- Consumes: Tasks 1, 5; `mapTimeNext`, `sceneFrames`.
- Produces:
  ```ts
  // timing.ts (puro)
  export const blockFrames: (b: Block, keeps: Keep[], fps: number) => {from: number; duration: number} | null; // = sceneFrames
  export const beatFrames: (b: Block, keeps: Keep[], fps: number) => {beat: Beat; from: number; duration: number}[]; // relativos al bloque
  export const tickFrames: (beatFroms: number[], fps: number, minGap?: number /* 0.5 */) => number[]; // sin el primero
  export const cameraScale: (frame: number, duration: number, beatFroms: number[]) => number; // 1→1.06 lineal + golpe 1.04 que decae en 6 frames
  export const insideBlocks: (t: number /* tiempo final */, motion: MotionPlan | undefined, keeps: Keep[]) => boolean;
  // MotionLayer.tsx
  export const MotionLayer: React.FC<{motion: MotionPlan; keeps: Keep[]; words: Word[] /* originales */; theme: Theme; fps: number}>;
  ```

- [ ] **Step 1: Tests que fallan** `timing.test.ts`:
  - `blockFrames en borde de tramo`: bloque `start = 9` con keeps `[{1,8},{9,19}]` → `from = 7*30`.
  - `beatFrames` suma de duraciones = duración del bloque; primer `from = 0`.
  - `tickFrames([0,10,20,40], 30)` → `[20, 40]` (10 está a < 15 frames del 0 → se omite; 20 a 20 frames del último emitido, 0, queda).
  - `cameraScale(0, 300, [0])` ≈ 1.04 (golpe); `cameraScale(299, 300, [0])` ≈ 1.06; nunca > 1.10.
  - `insideBlocks` true en mitad de un bloque, false fuera y con `motion` undefined.

- [ ] **Step 2:** `npx vitest run src/motion` → FAIL.

- [ ] **Step 3: Implementar.** `MotionLayer`: por bloque una `<Sequence>`; dentro `AbsoluteFill` con `clipPath: circle(r% at 50% 50%)` r de 0→75 en 8 frames; `Background` (props = primeros 2 emojis distintos de los beats); wrapper con `transform: scale(cameraScale)`; cada beat en su `<Sequence>` con `LAYOUT_UI[layout]` envuelto en `CameraMotionBlur` (`samples: 6`, `shutterAngle: 120`) solo durante los primeros 8 frames; `leadDelays` con `words` originales. Audio: `swoosh` al inicio del bloque, `tick` en `tickFrames` a `theme.sfxVolume * 0.4`. `Edit.tsx`: si `plan.motion`, render `<MotionLayer>` tras `SceneLayer`; `visiblePages` excluye páginas cuyo `start` cae `insideBlocks`.

- [ ] **Step 4:** `npx vitest run` PASS; `npx tsc --noEmit` sin errores.

- [ ] **Step 5: Cerrar.** Mensaje: `feat(motion): MotionLayer renders blocks over the edit`.

### Task 7: Preview por beat y no-regresión

**Files:**
- Modify: `src/lib/preview.ts`, `src/lib/preview.test.ts`

**Interfaces:**
- Consumes: `beatFrames`, `blockFrames` (Task 6).
- Produces: `previewFrames` añade una captura por beat al 60 % de su duración, label `bloque i beat j: <layout> <key ?? items[0] ?? from>`.

- [ ] **Step 1: Test que falla:** plan con un bloque de 2 beats → 2 frames con label que empieza por `bloque 0 beat 0: word` y `bloque 0 beat 1:`; plan sin motion → mismos frames que hoy (test existente intacto).
- [ ] **Step 2:** `npx vitest run src/lib/preview.test.ts` → FAIL.
- [ ] **Step 3: Implementar** en `previewFrames`.
- [ ] **Step 4:** `npx vitest run` PASS. No-regresión: `npm run render:plan -- ACTUALLY` y comparar 4 frames (`ffmpeg -ss 2,5,9,13`) contra el `ACTUALLY_edited.mp4` previo (si existe en `media/output/edited/`): deben verse iguales.
- [ ] **Step 5: Cerrar.** Mensaje: `feat(preview): one capture per motion beat`.

### Task 8: Skill `edit-motion` y docs

**Files:**
- Modify: `.claude/skills/edit-motion/SKILL.md` (reescritura), `.claude/skills/video-base/templates.md` (sección "Motion (beats)"), `.claude/skills/video-base/SKILL.md` (mencionar `draft-motion` y `emoji --3d` en el flujo si lista comandos), `README.md`/manual si lista comandos (`grep -n "npm run" README.md docs/*.md`).

- [ ] **Step 1:** Reescribir `edit-motion/SKILL.md` con el flujo del spec ("Skill `edit-motion`"): draft → enriquecer beats (tabla qué-dice-la-profe → layout) → `emoji --3d` → validate (avisos revisados) → preview → aprobación → render; regla explícita: **emojis y textos salen de lo que dice la profe en ese beat; nunca de la referencia**; resumen final con % motion, bloques, beats y layouts.
- [ ] **Step 2:** `templates.md`: tabla de los 8 layouts con JSON exacto de un beat por layout (mismos campos que Task 1) + reglas de bloque/beat (tiempos, 0.4/2.5 s, 3 iguales seguidos).
- [ ] **Step 3: Verificar** que cada campo y layout de la doc existe en `src/lib/motion.ts` (`grep` de cada nombre) y que los comandos citados existen en `package.json`.
- [ ] **Step 4: Cerrar.** Mensaje: `docs(skills): edit-motion v2 uses motion beats`.

### Task 9: E2E Plot_Twist con la skill nueva

**Files:**
- Modify: `public/Plot_Twist_motion.edit.json` (generado; está en public, no ignorado → listar en cierre)

- [ ] **Step 1:** Seguir `/edit-motion media/input/PLOT_TWIST.mov` con salida `Plot_Twist_motion` (mismos transcript/cuts ya existentes): draft → enriquecer → emojis 3D → validate → preview.
- [ ] **Step 2:** Hoja de contactos 1 fps del render (`ffmpeg -vf "fps=1,scale=160:-1,tile=8x6"`) junto a la de `Plot_Twist_edited.mp4` (mixed) y la de m_1; abrir las tres con Read.
- [ ] **Step 3: Verificar** criterio de éxito: en las hojas, motion se distingue de mixed a simple vista; plano nuevo ~cada 1 s dentro de bloques; motion 60–75 %; emojis relacionados con lo que dice la profe (libros, shock, acantilado, páginas). Si falla, anotar qué y volver a la tarea dueña.
- [ ] **Step 4: Cerrar.** Mostrar al usuario las tres hojas y el video. Mensaje: `chore: re-edit Plot_Twist with motion beats`.
