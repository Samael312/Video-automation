# Render robusto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `npm run render:plan -- <N>` falle en segundos con mensajes claros cuando el plan está roto, reintente solo los fallos puntuales del compositor y nunca dañe el video anterior.

**Architecture:** la lista de sonidos se saca de `Edit.tsx` a un módulo puro que también usa el validador. `validatePlan` revisa además los emojis dentro de las props. Un orquestador puro (`renderFlow.ts`, con la E/S inyectada) ordena los pasos validar → preparar → prueba → renderizar → volumen final → terminar. `render.ts` lo conecta con la API de Node de Remotion, y `render.js` queda como envoltorio.

**Tech Stack:** TypeScript (tsx), Remotion 4.0.543 (`@remotion/bundler`, `@remotion/renderer`), vitest, Python (`pipeline/final_loudness.py`).

**Spec:** `docs/superpowers/specs/2026-11-23-render-robusto-design.md`

## Global Constraints
- **NUNCA hacer `git commit`/`merge`/`push` ni `git add`** (regla del usuario). Al final de cada tarea: listar los archivos cambiados y proponer un mensaje de commit en un bloque de código.
- La interfaz externa no cambia: `npm run render:plan -- <video> [--no-music]`, salida en `media/output/edited/<N>/<N>_edited.mp4`, código 0/1.
- Líneas de salida: `== <paso> ==` con los pasos `validar edit.json`, `preparar`, `prueba`, `renderizar`, `volumen final` y `terminar`; progreso `Rendered x/y`; al fallar, una línea de causa en español y luego `FALLO en el paso: <paso>`. Sin colores ANSI en stdout.
- Regex del error del compositor: `/No frame found at position|Could not extract frame from compositor/i`. Un solo reintento, con concurrencia `max(1, floor(c/2))`.
- Temporal: `<finalDir>/<N>_edited.tmp.mp4`. Se borra si falla cualquier paso.
- Prueba: `everyNthFrame = max(1, round(fps/2))`.
- Regex de código emoji en props: `/^[0-9a-f]{4,6}(-[0-9a-f]{4,6})*$/`. Claves revisadas: las que contienen `emoji` o `avatar` (sin distinguir mayúsculas).
- Textos en español; el código sigue el estilo del repo (CommonJS en `scripts/*.js` y `web/`, TS en `src/` y `scripts/*.ts`).

## Review Focus
1. **Render cancelado desde la web** (se mata el árbol de procesos a mitad del render): el `.tmp.mp4` puede quedar suelto, pero el video final no debe cambiar. El siguiente render debe sobrescribir el `.tmp` sin fallar. → test en la tarea 3 ("tmp previo existente se sobrescribe").
2. **`--no-music`** debe seguir quitando la música del plan (props `plan` sin `music`). → lo cubre la tarea 4 al construir `inputProps`.
3. **Video sin `edit.json`** (se renderiza el plan por defecto) debe seguir funcionando. → tarea 2: `sfxNamesUsed(defaultPlan(...))` no falla; tarea 4: el orden de pasos no exige `edit.json`.
4. **Props con valores no texto** (números, null u objetos dentro de `emoji`) no deben romper el validador. → test en la tarea 2.
5. **Falla la limpieza (`cleanResidue`) después de renombrar**: el video ya es válido, así que solo se avisa y se sale con 0. → test en la tarea 3.

---

### Task 1: lista de sonidos pura (`sfxPlan.ts`)

**Files:**
- Create: `src/lib/sfxPlan.ts`
- Create: `src/lib/sfxPlan.test.ts`
- Modify: `src/Edit.tsx:121-137` (reemplazar el cálculo de `autoEvents`)

**Interfaces:**
- Consumes: `overlaySfx`, `thinEvents`, `TITLE_SFX`, `KEYWORD_SFX`, `AutoSfxEvent` (`src/lib/autoSfx.ts`); `chatTimes` (`src/lib/overlayTiming.ts`); `keywordEvents` (`src/lib/dynamics.ts`); `insideBlocks` (`src/motion/timing.ts`).
- Produces:
  - `autoSfxEvents(i: {plan: EditPlan; overlays: Overlay[]; cuts: number[]; hookEnd: number; title: {start: number} | null; words: Word[]; keeps: Keep[]; manualAt: number[]}): AutoSfxEvent[]`, con exactamente la lógica actual de `Edit.tsx` (los `overlays` y tiempos ya vienen remapeados).
  - `BASE_SFX: SfxName[] = ['swoosh', 'tick', 'ding']` (los que suenan fijos en Edit/SceneLayer/MotionLayer/CutVideo).
  - `sfxNamesUsed(plan: EditPlan): SfxName[]`: el conjunto (sin repetir y ordenado) de todos los sonidos que el plan puede tocar: `BASE_SFX` + manuales + `overlaySfx(kind)` no nulos de sus overlays + `'glitch'` si `cutFx==='glitch'` + `'hit'` si `cutFx==='shake'` o si hay `hook`/`title` + `KEYWORD_SFX.name` si `zoom.keywords` no está vacío. Si `autoSfx === false`, solo `BASE_SFX` + manuales.

- [ ] **Step 1: tests que fallan** en `src/lib/sfxPlan.test.ts`:
  - `autoSfxEvents`: un overlay `emoji` en 1 s → `[{at: 1, name: 'pop2', volume: 0.7}]`; un overlay `fx` → `[]`; con `plan.autoSfx = false` → `[]`; un evento a 0.05 s de `manualAt` se descarta.
  - `sfxNamesUsed`: plan con overlays `label` + `fx`, `cutFx: 'glitch'` y `sfx: [{at: 1, name: 'riser'}]` → contiene `pop`, `glitch`, `riser`, `swoosh`, `tick` y `ding`, y no contiene `undefined`; `sfxNamesUsed(defaultPlan('X.mp4'))` no lanza error e incluye `BASE_SFX`.
  - Todos los `SfxName` de `SFX_NAMES` (exportarlo desde `plan.ts`) tienen `public/sfx/<name>.wav` (`fs.existsSync`).
- [ ] **Step 2:** `npx vitest run src/lib/sfxPlan.test.ts` → FALLA (el módulo no existe).
- [ ] **Step 3:** crear `sfxPlan.ts` moviendo la lógica de `Edit.tsx`. En `Edit.tsx`, `autoEvents = autoSfxEvents({plan, overlays, cuts, hookEnd, title, words: newWords, keeps, manualAt: plan.sfx.map((s) => mapAt(s.at))})`. Exportar `SFX_NAMES` en `plan.ts`.
- [ ] **Step 4:** `npx vitest run` → todo pasa; `npx tsc --noEmit -p .` → sin errores nuevos en estos archivos.
- [ ] **Step 5:** listar los archivos y proponer el commit `Refactor: lista de sonidos pura (sfxPlan) compartida por Edit y validador`.

### Task 2: validar assets en props y sonidos

**Files:**
- Create: `src/lib/propAssets.ts`, `src/lib/propAssets.test.ts`
- Modify: `src/lib/plan.ts` (`ValidateCtx` + `validatePlan`), `scripts/common.ts` (`knownSfx`), `scripts/validate.ts` (pasar `knownSfx`)
- Test: `src/lib/plan.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `sfxNamesUsed` (tarea 1).
- Produces:
  - `propAssetErrors(props: unknown, ctx: {knownEmojis?: string[]; knownEmojis3d?: string[]}, tag: string): string[]`: recorre objetos y listas; para cada texto bajo una clave con `emoji`/`avatar` (o dentro de una lista bajo esa clave) que cumpla el regex de código y no esté en ninguna de las dos listas, devuelve `${tag}.<ruta>: emoji <code> no existe en public/emoji ni en public/emoji3d` (ruta con `.clave` y `[i]`). Si falta alguna de las dos listas en `ctx`, devuelve `[]`.
  - `ValidateCtx.knownSfx?: string[]`; `validatePlan` añade `falta public/sfx/<name>.wav (sonido que usa el plan)` por cada `sfxNamesUsed(plan)` que no esté en `knownSfx` (solo si `knownSfx` viene definido).
  - `validatePlan` llama a `propAssetErrors(o.props, ctx, 'overlays[i].props')` en los overlays `fx` y a `propAssetErrors(s.data.props, ctx, 'scenes[i].data.props')` en las escenas `generated`.
  - `knownSfx(): string[]` en `scripts/common.ts` (los nombres de `public/sfx/*.wav` sin extensión).

- [ ] **Step 1: tests que fallan** en `propAssets.test.ts` (ctx `{knownEmojis: ['1f409'], knownEmojis3d: ['2694']}`):
  - `{emoji: '1f999'}` → 1 error que contiene `x.emoji: emoji 1f999`.
  - `{comments: [{avatar: '1f409'}, {avatar: '1f998'}]}` → 1 error con `x.comments[1].avatar`.
  - `{emojis: ['dragon', '2694']}` → `[]` (la palabra se ignora y el 3D existe).
  - `{title: '1f999'}` → `[]` (no es clave de emoji).
  - `{emoji: 5, avatar: null, emojis: [{}]}` → `[]` y no lanza error (Review Focus 4).
  - ctx sin `knownEmojis3d` → `[]`.
  - En `plan.test.ts`: un plan válido con un overlay `fx` con `props: {emoji: '1f999'}` → un error `overlays[0].props.emoji`; con `knownSfx: ['pop']` y un overlay `label` → errores `falta public/sfx/swoosh.wav` (entre otros); con `knownSfx` sin definir → sin errores de sfx.
- [ ] **Step 2:** `npx vitest run src/lib/propAssets.test.ts src/lib/plan.test.ts` → FALLA.
- [ ] **Step 3:** implementar `propAssets.ts`, integrarlo en `validatePlan`, crear `knownSfx()` y pasar `knownSfx: knownSfx()` en el `ctx` de `scripts/validate.ts`.
- [ ] **Step 4:** `npx vitest run` → todo pasa. `npm run validate -- <N>` para **cada** `public/*.edit.json` (solo lectura) → los que daban `OK` antes siguen en `OK` (sin falsos positivos en los planes reales). Si alguno da un error nuevo, revisar si es un asset que de verdad falta (avisar al usuario) o un falso positivo (corregir la regla).
- [ ] **Step 5:** listar los archivos y proponer el commit `Validate: emojis en props de fx/escenas y sonidos en public/sfx`.

### Task 3: orquestador puro (`renderFlow.ts`)

**Files:**
- Create: `scripts/renderFlow.ts`, `scripts/renderFlow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const COMPOSITOR_ERROR: RegExp; // regex de Global Constraints
  export type RenderIO = {
    validate(): Promise<void>;                 // lanza Error(causa en español)
    prepare(): Promise<void>;                  // copia música, bundle, selectComposition
    probe(): Promise<void>;                    // render de prueba
    render(tmp: string, concurrency: number): Promise<void>;
    loudness(file: string): Promise<void>;
    rename(from: string, to: string): void;
    remove(file: string): void;                // sin error si no existe
    cleanResidue(): void;
    log(line: string): void;                   // stdout
    detail(text: string): void;                // stderr, detalle técnico
  };
  export const runRender = (o: {final: string; tmp: string; concurrency: number}, io: RenderIO): Promise<boolean>;
  export const cleanDetail = (text: string, maxLines?: number): string; // quita ANSI y deja como mucho 20 líneas
  ```
  Orden: `log('== validar edit.json ==')` → `validate`; `== preparar ==` → `prepare`; `== prueba ==` → `probe`; `== renderizar ==` → `remove(tmp)` y luego `render(tmp, c)`; `== volumen final ==` → `loudness(tmp)`; `== terminar ==` → `rename(tmp, final)` y luego `cleanResidue`. Cada paso registra su duración (`(12.3 s)`). Si un paso falla: `detail(cleanDetail(err.stack ?? msg))`, `log(<causa>)`, `remove(tmp)`, `log('FALLO en el paso: <paso>')` y devuelve `false`. La causa es la primera línea de `err.message` sin ANSI y recortada a 200 caracteres; en la prueba se antepone `el render de prueba falló: `.

- [ ] **Step 1: tests que fallan** (io falso que registra las llamadas en una lista):
  - Éxito → las llamadas en orden `validate, prepare, probe, remove(tmp), render(tmp,8), loudness(tmp), rename(tmp,final), cleanResidue` y devuelve `true`.
  - `render` lanza `Error('Compositor error: No frame found at position 18432')` una vez → segunda llamada `render(tmp, 4)`, un log que contiene `reintento`, devuelve `true`.
  - El compositor falla dos veces → `false`, `remove(tmp)` llamado después, `rename` nunca, la última línea de log es `FALLO en el paso: renderizar`.
  - `render` lanza `Error('otra cosa')` → una sola llamada a render, `false`.
  - Con concurrencia 1 → el reintento usa 1.
  - `probe` lanza error → `render` nunca se llama; el log contiene `el render de prueba falló:` y `FALLO en el paso: prueba`.
  - `loudness` lanza error → `remove(tmp)`, `rename` nunca, `FALLO en el paso: volumen final`.
  - `validate` lanza error → nada más se llama.
  - `cleanResidue` lanza error → devuelve `true`, con un log de aviso y sin `FALLO` (Review Focus 5).
  - Hay un tmp previo: siempre se llama `remove(tmp)` antes del primer `render` (Review Focus 1).
  - `cleanDetail('\u001b[31mx\u001b[39m\n'.repeat(30))` → 20 líneas sin `\u001b`.
- [ ] **Step 2:** `npx vitest run scripts/renderFlow.test.ts` → FALLA.
- [ ] **Step 3:** implementar `renderFlow.ts`.
- [ ] **Step 4:** `npx vitest run` → todo pasa.
- [ ] **Step 5:** listar los archivos y proponer el commit `Render: orquestador con reintento del compositor y escritura segura`.

### Task 4: `render.ts` con la API de Node de Remotion

**Files:**
- Create: `scripts/render.ts`
- Modify: `scripts/render.js` (envoltorio: `spawnSync('npx', ['tsx', 'scripts/render.ts', ...process.argv.slice(2)], {stdio: 'inherit', shell: true})` y salir con su `status`; actualizar el comentario de cabecera)

**Interfaces:**
- Consumes: `runRender`, `RenderIO`, `COMPOSITOR_ERROR` (tarea 3); `outputPaths`, `cleanResidue` (`scripts/outputs.js`); `ROOT` (`scripts/common.ts`).
- Produces: el mismo contrato CLI de hoy.

Cableado de `RenderIO` (lo demás lo decide el implementador):
- `validate`: `execFileSync` de `npx tsx scripts/validate.ts <N>.mp4`, con salida heredada; si falla, `Error('edit.json invalido')` (las líneas del validador ya salieron por consola).
- `prepare`: la lógica de música de hoy (`--no-music` quita `music` → `inputProps.plan = planSinMusica`; si no, copia `media/music/<file>` a `public/music`; si falta, `Error('no existe media/music/<file>')`), luego `bundle({entryPoint: src/index.ts})` y `selectComposition({serveUrl, id: 'Edit', inputProps})`, con `inputProps = {videoSrc: '<N>.mp4', transcript: null, keeps: [], plan: planOverride}` (igual que hoy).
- `probe`: `renderFrames({composition, serveUrl, inputProps, imageFormat: 'jpeg', outputDir: null, onFrameBuffer: () => {}, everyNthFrame, onStart: () => {}, onFrameUpdate: null, concurrency})`. Si lanza error, se vuelve a lanzar con el segundo aproximado si se puede deducir (último `frameIndex / fps`).
- `render`: `renderMedia({composition, serveUrl, inputProps, codec: 'h264', outputLocation: tmp, overwrite: true, concurrency, onProgress: ({renderedFrames}) => log cada ~5 %: 'Rendered x/y'})`.
- `loudness`: `execFileSync(.venv/Scripts/python.exe, ['pipeline/final_loudness.py', file])`.
- La concurrencia inicial es la que usa Remotion por defecto (`os.cpus().length / 2`, mínimo 1).

- [ ] **Step 1:** implementar `render.ts` y el envoltorio `render.js`.
- [ ] **Step 2:** `npx tsc --noEmit -p .` sin errores nuevos; `npx vitest run` → todo pasa.
- [ ] **Step 3: verificación real con una copia de prueba (no tocar los videos de la profe):** crear `PRUEBA_RENDER` copiando de un video existente que tenga fx y escenas generadas (p. ej. RUN o TOP5_PALABRAS): `public/<X>.mp4`, `.cuts.json`, `.transcript.json` y `.edit.json` → `public/PRUEBA_RENDER.*`, con `"video": "PRUEBA_RENDER.mp4"` en el plan. Luego `npm run render:plan -- PRUEBA_RENDER` → código 0, con las líneas `== validar edit.json ==` … `== terminar ==`, `Rendered` y las duraciones. Anotar el tiempo de cada paso.
- [ ] **Step 4: fallos reales sobre PRUEBA_RENDER:**
  - Anotar la fecha y el tamaño de `media/output/edited/PRUEBA_RENDER/PRUEBA_RENDER_edited.mp4`.
  - Meter en un fx del plan de prueba `props.<lista>[0].avatar = "1f999"` (o `props.emoji`) → falla en `validar edit.json` en menos de 15 s.
  - Restaurar el plan de prueba y luego mover `public/sfx/pop.wav` a la carpeta temporal → falla en `validar edit.json` por `falta public/sfx/pop.wav`. Devolver el archivo a su sitio.
  - Forzar un fallo en `prueba` (un `component` registrado con `props` que lo rompan, o un `throw` temporal en una escena de prueba) → falla en `prueba` antes de empezar `renderizar`.
  - En todos los casos: el video de prueba tiene la misma fecha y tamaño que antes y no hay ningún `*.tmp.mp4`.
- [ ] **Step 5:** borrar todo lo de prueba: `public/PRUEBA_RENDER.*`, `media/output/edited/PRUEBA_RENDER/`, `media/output/work/PRUEBA_RENDER/` y cualquier cambio temporal en el código. Comprobar con `git status` que solo quedan los cambios de la tarea. Listar los archivos y proponer el commit `Render: render.ts con API de Remotion (prueba + reintento + tmp)`.

### Task 5: mensajes de la web

**Files:**
- Modify: `web/prompts.js` (`ERRORES`)
- Test: `web/prompts.test.ts`

**Interfaces:**
- Consumes: los textos de causa de las tareas 2 a 4.

- [ ] **Step 1: tests que fallan** en `traducirError`:
  - `'overlays[2].props.avatar: emoji 1f999 no existe en public/emoji ni en public/emoji3d'` → contiene `Falta el emoji 1f999` y `Pide los cambios de nuevo`.
  - `'falta public/sfx/pop.wav (sonido que usa el plan)'` → contiene `efecto de sonido`.
  - `'el render de prueba falló: Cannot read properties of undefined'` → contiene `escena` y `Pide los cambios de nuevo`.
- [ ] **Step 2:** `npx vitest run web/prompts.test.ts` → FALLA.
- [ ] **Step 3:** añadir las entradas a `ERRORES` antes de `/edit\.json invalido/`, con estos mensajes:
  - `Falta el emoji <code> que usa una escena del plan. Pide los cambios de nuevo (o bájalo con npm run emoji -- <code>).`
  - el de sfx que ya existe.
  - `Una escena del plan se rompe al dibujarse. Pide los cambios de nuevo describiendo qué escena quitar o cambiar.`
- [ ] **Step 4:** `npx vitest run` → todo pasa.
- [ ] **Step 5:** listar los archivos y proponer el commit `Web: mensajes claros para fallos de validación y prueba de render`.

### Task 6: verificación desde la web

- [ ] **Step 1:** con `PORT=3999 node web/server.js`, preparar `VIDEOS_PROFE/PRUEBA_RENDER` en fase `revision` (copia de prueba como en la tarea 4, más su `estado.json` y su preview) y pulsar Aprobar → se ven los pasos y el progreso, y termina en `listo` con caption. No usar videos reales de la profe.
- [ ] **Step 2:** apagar el servidor y borrar todo lo de `PRUEBA_RENDER` (input, public, output/edited, work y preview).
- [ ] **Step 3:** actualizar `docs/WEB_API.md` (sección "Render", con los pasos y la garantía de que el video anterior no se daña). Resumen final: archivos y mensaje de commit.
