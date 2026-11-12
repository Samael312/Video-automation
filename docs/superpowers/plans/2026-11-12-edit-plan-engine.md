# Motor de edición por plan (Plan 2 de 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un archivo `public/<video>.edit.json` describa la edición (título, subtítulos, overlays, escenas de motion graphics, sfx) y un motor Remotion lo valide y renderice de forma determinista, incluyendo el corte a animación con la voz de fondo.

**Architecture:** `src/lib/plan.ts` define `EditPlan` y `validatePlan` (puro, testeable). La composición `Edit` (reemplaza a `Styled`) lee `{transcript, keeps, plan}`. Las escenas son capas opacas sobre el video recortado, que nunca se desmonta (la voz sigue sonando). Las plantillas son componentes registrados por tipo; las escenas IA se registran en `src/scenes/generated/index.ts`.

**Tech Stack:** Remotion 4.0.543, `@remotion/captions`, TypeScript, vitest, `tsx` (nuevo, devDependency, gratis).

**Spec:** `docs/superpowers/specs/2026-11-12-edit-plan-engine-design.md` (continúa `2026-11-12-tiktok-auto-editor-design.md`; Plan 1 ya implementado).

## Global Constraints

- Frame 720x1280 a 30 fps; todo local y gratis, sin APIs de pago.
- `EditPlan.version === 1`; tiempos en segundos del video **original**, reubicados con `mapTimeNext` de `src/lib/cuts.ts`.
- Escenas: duración 1–8 s, sin solaparse, inicio y fin en tramos conservados.
- `quiz`: 2 a 3 opciones, `answer` índice válido. Tipos de escena: `translate`, `false-friend`, `pronounce`, `mistake`, `example`, `quiz`, `generated`.
- Los subtítulos TikTok se dibujan **encima** de las escenas (arriba, `top: 285`); las plantillas colocan su contenido entre y=380 y y=1100.
- Sin `edit.json`, el motor usa `defaultPlan` (solo subtítulos + zoom) y `npm run edit` sigue funcionando.
- El resultado visual del estilo `referencia` con el plan migrado debe ser el mismo que el de hoy (verificado con PSNR).

## Review Focus

1. **Escena que cruza un corte** (inicio en tramo conservado, fin en zona cortada): el validador da error claro, no se renderiza una escena fantasma. → Task 1.
2. **`edit.json` mal formado** (`null`, números como texto, campos faltantes, `scenes` que no es lista): `validatePlan` devuelve errores y nunca lanza excepción. → Task 1.
3. **Texto muy largo** en plantillas (traducción de 40 caracteres, oración de 20 palabras): se achica la letra y no se sale del cuadro. → Task 4/5 (`fitFontSize`).
4. **Escena de 1 s** (más corta que sus animaciones de entrada y salida): el contenido sigue visible, la envolvente queda en [0,1]. → Task 3.
5. **Sin `edit.json`, o `plan.video` distinto del video renderizado**: sin archivo usa `defaultPlan`; si el nombre no coincide, error del validador. → Task 1 y 2.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/plan.ts` + `plan.test.ts` | Tipos `EditPlan`/`Scene`/`Overlay`, `validatePlan`, `defaultPlan` |
| `src/lib/scenes.ts` + test | `sceneFrames`, `sceneEnvelope` |
| `src/styles/referencia/theme.ts` | `Theme`, tema `referencia`, `themes`, `getTheme` |
| `src/overlays/index.tsx` | `Title`, `Label`, `Emoji`, `EndCard` (movidos de `Styled.tsx`, ahora reciben `theme`) |
| `src/Edit.tsx` | Composición genérica data-driven (reemplaza `styles/referencia/Styled.tsx`) |
| `src/lib/SceneLayer.tsx` | Capa de escenas con transición y sfx |
| `src/templates/timing.ts` + test | `wordsVisible`, `quizPhase`, `fitFontSize` |
| `src/templates/*.tsx`, `index.ts` | Una plantilla por tipo + `TEMPLATES` |
| `src/scenes/generated/index.ts` | `GENERATED` (registro de escenas IA) + una escena demo |
| `scripts/validate.ts`, `scripts/render.js` | CLI `validate` y `render` |
| `public/ACTUALLY.edit.json` | Plan de ejemplo (estrategia `mixed`) |

---

### Task 1: `EditPlan` y `validatePlan`

**Files:**
- Create: `src/lib/plan.ts`, `src/lib/plan.test.ts`

**Interfaces:**
- Consumes: `Keep`, `mapTime` de `src/lib/cuts.ts`.
- Produces (en `plan.ts`):
  - `SCENE_TYPES = ['translate','false-friend','pronounce','mistake','example','quiz','generated'] as const`; `type SceneType`.
  - `type LabelOverlay = {kind:'label'; text:string; start:number; end:number; x:number; y:number; dir:'left'|'right'}`; `type EmojiOverlay = {kind:'emoji'; file:string; start:number; end:number; x:number; y:number; size:number}`; `type Overlay = LabelOverlay | EmojiOverlay`.
  - `type Scene = {type: SceneType; start:number; end:number; data: Record<string, unknown>}`.
  - `type EditPlan = {version:1; video:string; style:string; strategy:'captions'|'motion'|'mixed'; title?:{line1:string; line2:string; start:number; end:number}; end?:{start:number; line1:string; line2:string}; captions:{maxWords:number; from?:number; until?:number; emphasis?:string[]}; zoom:{peak:number; duration:number; keywords:string[]}; overlays:Overlay[]; scenes:Scene[]; sfx:{at:number; name:'pop'|'swoosh'|'tick'|'ding'}[]}`.
  - `type ValidateCtx = {video:string; duration:number; keeps:Keep[]; knownStyles:string[]; knownGenerated:string[]}`.
  - `validatePlan(plan: unknown, ctx: ValidateCtx): string[]` — `[]` si es válido; nunca lanza.
  - `defaultPlan(video: string): EditPlan` — `style:'referencia'`, `strategy:'captions'`, `captions:{maxWords:5}`, `zoom:{peak:1.08, duration:0.35, keywords:[]}`, listas vacías.
  - Campos obligatorios por tipo de `data`: `translate{word,translation}`, `false-friend{a,b}`, `pronounce{word,syllables[],phonetic}`, `mistake{wrong,right}`, `example{sentence,highlight}`, `quiz{question,options[2..3],answer}`, `generated{component}`.

- [ ] **Step 1: Tests** en `plan.test.ts` con `ctx = {video:'v.mp4', duration:20, keeps:[{start:1,end:8},{start:9,end:19}], knownStyles:['referencia'], knownGenerated:['demo']}` y una `base: EditPlan = defaultPlan('v.mp4')`. Un `test` por regla, todos asertando que el mensaje contiene una palabra clave: plan válido → `[]`; `defaultPlan` → `[]`; `version:2`; estilo desconocido; `video` distinto de `ctx.video` (Review Focus 5); tipo de escena desconocido; `data` incompleto (falta `translation`); `generated.component` no registrado; quiz con `answer:5` y con 4 opciones; escena con `start>=end`; escena de 0.5 s y de 9 s; dos escenas solapadas; escena fuera de `[0,duration]`; **escena `{start:7,end:8.5}` (cruza el corte)** → error que menciona "corte" (Review Focus 1); overlay y sfx en zona cortada (`start:8.5`); y `validatePlan(null, ctx)`, `validatePlan({}, ctx)`, `validatePlan({...base, scenes:'x'}, ctx)`, `validatePlan({...base, scenes:[{type:'translate', start:'2', end:3, data:null}]}, ctx)` devuelven un array no vacío y no lanzan (Review Focus 2).
- [ ] **Step 2:** `npm test` → FAIL (`./plan` no existe).
- [ ] **Step 3:** Implementar `plan.ts`. Validar con guardas de tipo manuales (sin dependencias nuevas); acumular todos los errores en una lista con mensajes del tipo `escena[1] (translate): falta data.translation`.
- [ ] **Step 4:** `npm test` → todos PASS.
- [ ] **Step 5:** Commit `feat(lib): EditPlan schema and validatePlan`.

---

### Task 2: Composición `Edit` data-driven y migración de `referencia`

**Files:**
- Create: `src/styles/referencia/theme.ts`, `src/overlays/index.tsx`, `src/Edit.tsx`, `public/ACTUALLY.edit.json`
- Modify: `src/Root.tsx` (composición `Edit` reemplaza a `Styled`), `package.json` (`render:styled` → `render:edit`)
- Delete: `src/styles/referencia/Styled.tsx`, `src/styles/referencia/config.ts`

**Interfaces:**
- Consumes: `EditPlan`, `defaultPlan` (Task 1); `buildPages`, `TikTokCaptions`, `CutVideo`, `cutPoints`, `mapTimeNext`, `remapWords`, `keywordEvents`, `zoomScale` (Plan 1).
- Produces:
  - `type Theme = {name:string; cream:string; highlight:string; fonts:{serif:string; serifItalic:string; sans:string}; captionTop:number; captionFontSize:number; sceneBg:string; sfxVolume:number}`; `themes: Record<string, Theme>`; `getTheme(name: string): Theme` (error si no existe).
  - `Edit: React.FC<EditProps>` con `EditProps = {videoSrc:string; transcript:Transcript|null; keeps:Keep[]; plan:EditPlan}`.
  - Composición `Edit` en `Root.tsx`: `calculateMetadata` carga `<nombre>.transcript.json`, `<nombre>.cuts.json` (si falta, tramo único) y `<nombre>.edit.json` (si falta, `defaultPlan`); `durationInFrames = totalFrames(keeps, 30)`.
- `public/ACTUALLY.edit.json` = el contenido actual de `config.ts` (título, fin, labels, emojis, sfx, `zoom.keywords: ['actually','library','embarrassed']`, `captions.maxWords: 5`, `captions.from: 2.8`, `strategy: 'captions'`), sin escenas.

- [ ] **Step 1: Baseline.** Antes de tocar nada, renderizar con la composición actual `Styled`: `npx remotion still src/index.ts Styled media/output/base_40.png --frame=40` y lo mismo para los frames 200 y 300 (`base_200.png`, `base_300.png`).
- [ ] **Step 2:** Crear `theme.ts` (valores de `CREAM`, fuentes y posiciones que hoy están en `Styled.tsx`), mover `Title`, `Label`, `Emoji`, `EndCard` a `overlays/index.tsx` recibiendo `theme` por props, y escribir `Edit.tsx` con la lógica de `Styled` pero leyendo todo de `plan`/`theme`. Crear `ACTUALLY.edit.json` desde `config.ts` y luego borrar `Styled.tsx` y `config.ts`; actualizar `Root.tsx` y `package.json`.
- [ ] **Step 3:** `npx tsc --noEmit` → sin errores; `npx remotion compositions src/index.ts` lista `Edit` con la misma duración que antes de la migración (473 frames con `ACTUALLY.cuts.json` actual).
- [ ] **Step 4: Equivalencia.** Renderizar `Edit` en los mismos frames (`edit_40.png`, `edit_200.png`, `edit_300.png`) y comparar con `ffmpeg -i media/output/base_40.png -i media/output/edit_40.png -lavfi psnr -f null -`. Expected: `psnr_avg` ≥ 45 dB (o `inf`) en los tres. Si es menor, revisar la imagen y corregir la migración.
- [ ] **Step 5:** Probar el fallback: renombrar temporalmente `public/ACTUALLY.edit.json`, `npx remotion still ... Edit --frame=200` renderiza (solo subtítulos y zoom) sin error; restaurar el archivo (Review Focus 5).
- [ ] **Step 6:** Commit `refactor: data-driven Edit composition and referencia theme`.

---

### Task 3: Capa de escenas con transición y plantilla `translate`

**Files:**
- Create: `src/lib/scenes.ts`, `src/lib/scenes.test.ts`, `src/lib/SceneLayer.tsx`, `src/templates/index.ts`, `src/templates/translate.tsx`
- Modify: `src/Edit.tsx` (monta `SceneLayer` entre el video y los subtítulos)

**Interfaces:**
- Produces (`scenes.ts`):
  - `sceneFrames(start: number, end: number, keeps: Keep[], fps: number): {from: number; duration: number} | null` — `null` si la escena colapsa a 0 frames tras remapear.
  - `sceneEnvelope(frame: number, duration: number, inFrames: number, outFrames: number): number` — 0..1; sube en `inFrames`, baja en los últimos `outFrames`; si `duration < inFrames + outFrames` reparte la duración a mitades; nunca devuelve fuera de [0,1] ni 0 en el centro de la escena (Review Focus 4).
- Produces (`templates/index.ts`): `type TemplateProps<D> = {data: D; theme: Theme}`; `TEMPLATES: Partial<Record<Exclude<SceneType,'generated'>, React.FC<TemplateProps<any>>>>` (se completa en Task 4 y 5, deja de ser `Partial`).
- Produces: `<SceneLayer scenes: Scene[]; keeps: Keep[]; theme: Theme />` — por escena: `Sequence` + fondo opaco `theme.sceneBg`, envolvente (opacidad + `translateY`), `swoosh.wav` al entrar, plantilla del registro. Tipo desconocido → no dibuja nada.
- Produces: `translate` muestra `word` (serif cursiva grande), flecha discontinua y `translation`, y `emoji` si existe; usa `fitFontSize` solo desde Task 4 (aquí tamaño fijo).

- [ ] **Step 1: Tests** en `scenes.test.ts` con `keeps=[{start:1,end:8},{start:9,end:19}]`, fps 30: `sceneFrames(2,4,keeps,30)` → `{from:30, duration:60}`; `sceneFrames(10,12,keeps,30)` → `{from:7*30+30, duration:60}` (reubicada tras el corte, `from = (7+1)*30`); `sceneFrames(8.2,8.8,keeps,30)` → `null`; `sceneEnvelope(0,60,6,6)===0`, `sceneEnvelope(30,60,6,6)===1`, `sceneEnvelope(59,60,6,6)` ∈ (0,1); y para `duration=30` (1 s) con `inFrames=20,outFrames=20`: todos los frames 0..29 dan valores en [0,1] y `sceneEnvelope(15,30,20,20)>0.9`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `scenes.ts`; `npm test` → PASS.
- [ ] **Step 4:** Implementar `translate.tsx`, `templates/index.ts` y `SceneLayer.tsx`; montar la capa en `Edit.tsx`.
- [ ] **Step 5:** Añadir temporalmente a una copia de plan una escena `translate {word:'actually', translation:'en realidad'}` de 5.0–7.0 s. Still en medio de la escena: se ve la plantilla opaca (no la persona) con los subtítulos encima. Still 20 frames antes: se ve la persona. Comprobar en los dos que la composición renderiza.
- [ ] **Step 6:** Commit `feat: scene layer with transitions and translate template`.

---

### Task 4: Plantillas de comparación de texto + `fitFontSize`

**Files:**
- Create: `src/templates/timing.ts`, `src/templates/timing.test.ts`, `src/templates/false-friend.tsx`, `src/templates/mistake.tsx`, `src/templates/example.tsx`
- Modify: `src/templates/index.ts` (registra las tres), `src/templates/translate.tsx` (usa `fitFontSize`)

**Interfaces:**
- Produces (`timing.ts`):
  - `fitFontSize(text: string, maxWidth: number, base: number, charWidth = 0.55, min = 28): number` — `min(base, maxWidth / (text.length * charWidth))` con piso `min`.
  - `wordsVisible(frame: number, fps: number, total: number, durationInFrames: number): number` — cuántas palabras de `total` ya son visibles; aparecen repartidas en el primer 60 % de la escena; al final de la escena siempre `total`.
- Plantillas (`data`): `false-friend {a,b,note?}` — A y B con símbolo "≠" entre ambos; `mistake {wrong,right}` — frase con ❌ tachada, luego ✅ con la correcta; `example {sentence,highlight}` — oración que aparece palabra por palabra, la palabra de `highlight` en `theme.cream`.

- [ ] **Step 1: Tests** en `timing.test.ts`: `fitFontSize('hi', 600, 80)===80`; `fitFontSize('x'.repeat(40), 600, 80) < 80` y `>= 28`; `fitFontSize('x'.repeat(500), 600, 80)===28` (Review Focus 3); `wordsVisible(0,30,5,150)===0`; `wordsVisible(149,30,5,150)===5`; monotónica no decreciente sobre los 150 frames; `wordsVisible(10,30,0,150)===0` (oración vacía).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementar `timing.ts`; `npm test` → PASS.
- [ ] **Step 4:** Implementar las tres plantillas (contenido entre y=380 y y=1100, letra con `fitFontSize` sobre ancho 600) y registrarlas.
- [ ] **Step 5:** Stills de cada una con datos normales y con texto largo (`translation` de 40 caracteres; `sentence` de 18 palabras): verificar a ojo que nada se sale del cuadro ni choca con la zona de subtítulos.
- [ ] **Step 6:** Commit `feat: false-friend, mistake, example templates`.

---

### Task 5: Plantillas `pronounce` y `quiz`

**Files:**
- Create: `src/templates/pronounce.tsx`, `src/templates/quiz.tsx`
- Modify: `src/templates/timing.ts` y `timing.test.ts` (añade `quizPhase`), `src/templates/index.ts` (registro completo)

**Interfaces:**
- Produces: `quizPhase(frame: number, fps: number, durationInFrames: number, countdown: number): {optionsShown: boolean; secondsLeft: number; revealed: boolean}` — las opciones aparecen tras el primer 20 % de la escena; `revealed` es verdadero en los últimos 1.5 s de la escena; `secondsLeft` baja de `countdown` a 0 antes del reveal (nunca negativo).
- `pronounce {word,syllables[],phonetic}`: sílabas que se iluminan una a una + fonética abajo. `quiz {question,options,answer,countdown?}`: pregunta, 2–3 opciones, cuenta regresiva (default 3) y reveal que resalta la correcta y atenúa las demás.
- `TEMPLATES` queda completo para los 6 tipos (el tipo deja de ser `Partial`).

- [ ] **Step 1: Tests** de `quizPhase` (duración 150 frames, 30 fps, countdown 3): frame 0 → `optionsShown:false, revealed:false`; frame 60 → `optionsShown:true, revealed:false, secondsLeft` entre 0 y 3; frame 149 → `revealed:true, secondsLeft:0`; ningún frame 0..149 da `secondsLeft<0`; con `durationInFrames:30` (1 s) no revienta y `revealed` termina en `true`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementar `quizPhase`; `npm test` → PASS.
- [ ] **Step 4:** Implementar `pronounce.tsx` y `quiz.tsx` y completar el registro. Test de registro en `src/templates/registry.test.ts`: para cada tipo de `SCENE_TYPES` distinto de `generated`, `TEMPLATES[tipo]` es una función.
- [ ] **Step 5:** Stills: quiz antes del reveal y después; pronounce con 2 y con 5 sílabas.
- [ ] **Step 6:** Commit `feat: pronounce and quiz templates`.

---

### Task 6: Registro de escenas generadas

**Files:**
- Create: `src/scenes/generated/index.ts`, `src/scenes/generated/demo.tsx`, `src/scenes/generated/registry.test.ts`
- Modify: `src/lib/SceneLayer.tsx` (resuelve `type:'generated'` por `data.component`)

**Interfaces:**
- Produces: `type GeneratedProps = {props: Record<string, unknown>; theme: Theme}`; `GENERATED: Record<string, React.FC<GeneratedProps>>` con la entrada `demo` (un pulso animado con texto `props.text`); `knownGenerated = Object.keys(GENERATED)` se usa en `ctx.knownGenerated`.
- Convención (para las skills del Plan 3): escena IA = un archivo `src/scenes/generated/<nombre>.tsx` + una línea en `index.ts`.

- [ ] **Step 1: Test** en `registry.test.ts`: toda entrada de `GENERATED` es una función; `Object.keys(GENERATED)` incluye `'demo'`; `validatePlan` con una escena `{type:'generated', data:{component:'demo'}}` y `knownGenerated: Object.keys(GENERATED)` → `[]`, y con `component:'nope'` → error.
- [ ] **Step 2:** `npm test` → FAIL (falta el módulo). **Step 3:** Implementar registro, `demo.tsx` y la resolución en `SceneLayer`; `npm test` → PASS.
- [ ] **Step 4:** Still de una escena `generated/demo` dentro de la composición `Edit` (plan temporal) → se ve el pulso con subtítulos encima.
- [ ] **Step 5:** Commit `feat: generated scenes registry`.

---

### Task 7: CLIs `validate` y `render`, plan de ejemplo y verificación de punta a punta

**Files:**
- Create: `scripts/validate.ts`, `scripts/render.js`
- Modify: `public/ACTUALLY.edit.json` (estrategia `mixed`), `scripts/edit.js` (valida antes de renderizar y pasa `plan: null` en las props), `package.json` (scripts `validate`, `render:plan`; devDependency `tsx`), `.gitignore` (`public/*.cuts.json`), `README.md`

**Interfaces:**
- `npm run validate -- <video>`: carga `public/<nombre>.edit.json` (o `defaultPlan`), `.transcript.json` y `.cuts.json`; arma `ValidateCtx` (`knownStyles = Object.keys(themes)`, `knownGenerated = Object.keys(GENERATED)`); imprime cada error en una línea; sale con código 0 si `[]` y 1 si no.
- `npm run render:plan -- <video>`: ejecuta `validate`; si pasa, renderiza `Edit` a `media/output/<nombre>_edited.mp4`.

- [ ] **Step 1:** `npm install -D tsx`; implementar `validate.ts` (importa `validatePlan`, `defaultPlan`, `themes`, `GENERATED`) y `render.js`.
- [ ] **Step 2:** Escribir a mano el plan de ejemplo `mixed` en `public/ACTUALLY.edit.json`: mantener título/labels/emojis/sfx y añadir 3 escenas sobre tramos conservados de `ACTUALLY` (por ejemplo `translate` actually→en realidad, `false-friend` library ≠ librería, y `quiz` al final sobre "embarrassed"), ajustando tiempos según `public/ACTUALLY.cuts.json`.
- [ ] **Step 3:** `npm run validate -- ACTUALLY` → código 0 y sin errores. Copia del plan con una escena `{start:7.0,end:8.8}` que cruza un corte → código 1 con mensaje que menciona "corte". Plan con `version:2` → código 1.
- [ ] **Step 4:** `npm run render:plan -- ACTUALLY` de punta a punta. Verificar con `ffprobe`: duración del video ≈ `keptDuration` de `cuts.json` (±1 frame), pista de audio presente y su duración dentro de 1 frame de la del video. Extraer frames con `scripts/extract_frames.js` en el medio de cada escena y fuera de ellas: la persona se oculta durante las escenas, la voz no se corta (el audio sigue) y los subtítulos están encima.
- [ ] **Step 5:** `npm test`, pytest y `npx tsc --noEmit` completos → PASS. Actualizar `README.md` (comandos, `edit.json`, cómo registrar una escena generada).
- [ ] **Step 6:** Commit `feat: validate and render CLIs, sample mixed edit plan`.
