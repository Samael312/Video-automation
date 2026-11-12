# Motor de edición por plan (`edit.json`) y skills por estrategia — Diseño

Fecha: 2026-11-12. Continúa `2026-11-12-tiktok-auto-editor-design.md` (Plan 1 ya implementado: transcripción `medium`, cortes, subtítulos TikTok, zoom, sfx en cortes).

## Objetivo
Que la edición de un video quede descrita en un archivo de datos (`public/<video>.edit.json`) que un motor Remotion renderiza de forma determinista. Quien **decide** (qué estrategia, qué escenas, qué texto) son **skills de Claude Code**; el motor **solo ejecuta**.

## Decisiones tomadas (con el usuario)
- Ejecuta Claude Code en sesión con el usuario; las skills escriben `edit.json`. Sin APIs de pago.
- Motion graphics por **plantillas + escenas generadas por IA**. Contexto: videos de TikTok de una profesora particular de inglés; deben ser dinámicos y llamativos.
- Skills por estrategia (especializadas y mixtas) con una base común (`video-base`) y un router opcional. Esto es el **Plan 3**; este documento define el **Plan 2 (motor)** y deja fijado el contrato que las skills usarán.

## Alcance de este plan (Plan 2: motor)
Esquema y validador de `edit.json`; composición genérica `Edit` que lo lee; migración del estilo `referencia` a datos; capa de escenas (corte a animación con la voz de fondo, subtítulos encima, vuelta a la persona) con transiciones; las 6 plantillas; registro de escenas generadas; comandos `validate` y `render`.
**Fuera de alcance:** las skills (Plan 3).

## Contrato: `EditPlan` v1
Todos los tiempos en segundos del video **original**; el motor los reubica con el mapa de cortes (`mapTimeNext`).

```
EditPlan = {
  version: 1,
  video: string,                       // p. ej. "ACTUALLY.mp4"
  style: string,                       // "referencia" (hoy el único)
  strategy: "captions" | "motion" | "mixed",   // informativo
  title?: {line1, line2, start, end},
  end?: {start, line1, line2},         // cierre con máquina de escribir
  captions: {maxWords, from?, until?, emphasis?: string[]},
  zoom: {peak, duration, keywords: string[]},
  overlays: Overlay[],                 // label (texto serif + flecha) | emoji, con start/end/x/y
  scenes: Scene[],
  sfx: {at: number, name: "pop"|"swoosh"|"tick"|"ding"}[]
}
Scene = {type: "translate"|"false-friend"|"pronounce"|"mistake"|"example"|"quiz"|"generated",
         start, end, data: <por tipo>}
```
`data` por tipo:
- `translate`: `{word, translation, emoji?}`
- `false-friend`: `{a, b, note?}` (A ≠ B)
- `pronounce`: `{word, syllables: string[], phonetic}`
- `mistake`: `{wrong, right}`
- `example`: `{sentence, highlight}` (la oración aparece palabra por palabra, `highlight` resaltada)
- `quiz`: `{question, options: string[2..3], answer: number, countdown?: number}`
- `generated`: `{component: string, props?: object}` (nombre registrado en `src/scenes/generated/index.ts`)

## Validación (`validatePlan(plan, ctx) -> string[]`)
`ctx = {duration, keeps, knownStyles, knownGenerated}`. Errores legibles (las skills los leen para autocorregirse):
- `version` ≠ 1, estilo o tipo de escena desconocido, `data` incompleto, `generated.component` no registrado, quiz con `answer` fuera de rango.
- `start >= end`; tiempos fuera de `[0, duration]`.
- Escenas: duración entre 1 s y 8 s; sin solapes entre sí; inicio y fin deben caer en tramos conservados (no en zona cortada).
- Overlays y sfx en zona cortada: error (para que quien planifica los mueva, no desaparezcan en silencio).

## Motor
- **Composición `Edit`** (reemplaza a `Styled`): props `{videoSrc, transcript, keeps, plan}`. `calculateMetadata` carga transcript, cuts y plan.
- **Estilo = tema** (`src/styles/<nombre>/theme.ts`): colores, fuentes, posiciones y tamaños de subtítulos y títulos, transición por defecto. El contenido ya no va en el estilo sino en el plan. `referencia` se migra: su `config.ts` actual se convierte en `public/ACTUALLY.edit.json` + `theme.ts`.
- **Capa de escenas:** el video recortado (con su audio) siempre está montado. Cada escena es una capa opaca a pantalla completa encima de la persona, con entrada/salida animadas (fade + slide con `interpolate`/`spring` propios, más swoosh; `@remotion/transitions` queda instalado pero no se usa porque su API exige `TransitionSeries` y la voz debe seguir montada sin interrupción). Así la voz y la sincronía no se tocan. Los subtítulos TikTok se dibujan por encima de la escena, en una zona que cada plantilla deja libre.
- **Plantillas** (`src/templates/<tipo>.tsx`): componente `({data, theme}) => JSX` + registro `src/templates/index.ts` (`tipo → componente + validador de data`). Animaciones con `spring`/`interpolate`; emojis desde `public/emoji/`.
- **Escenas generadas:** componentes en `src/scenes/generated/<nombre>.tsx` y una línea en `src/scenes/generated/index.ts`. Un test verifica que toda entrada del registro resuelve a un componente.
- **Plan por defecto:** si no existe `edit.json`, el motor usa uno de solo subtítulos + zoom (equivale al comportamiento del Plan 1), así `npm run edit` sigue funcionando.

## Comandos
- `npm run validate -- <video>` valida `public/<video>.edit.json` y sale con código ≠ 0 si hay errores.
- `npm run render -- <video>` valida y renderiza `media/output/<video>_edited.mp4`.
- `npm run edit` (ya existe) = normalizar → transcribir → cortar → render (usa `edit.json` si existe).

## Pruebas
- `vitest`: validador (un test por regla), registro de plantillas y de escenas generadas completos, mapeo de escenas a frames.
- Visual: un still por plantilla con datos de ejemplo; render de punta a punta de `ACTUALLY` con un `edit.json` escrito a mano (estrategia `mixed`: translate, false-friend y quiz de cierre) verificando con `ffprobe` duración y audio.

## Contexto para el Plan 3 (skills, no se implementa aquí)
`.claude/skills/`: `video-base` (tratado común: pipeline, esquema, ritmo TikTok ~1 evento cada 3 s, reglas de subtítulos/cortes, marca, checklist), `edit-captions`, `edit-motion`, `edit-mixed`, `edit-router`. Las especializadas referencian la base y solo describen en qué divergen. Cada una termina escribiendo y validando un `edit.json`.

## Orden de construcción
1. Tipos de `EditPlan` + `validatePlan`
2. Composición `Edit` data-driven + migración de `referencia` (mismo resultado visual que hoy)
3. Capa de escenas con transiciones y sfx
4. Las 6 plantillas
5. Registro de escenas generadas
6. `validate` / `render` + integración en `edit.js` + README
