# Voice motion: guion + nota de voz → TikTok 100 % motion

Fecha: 2026-11-13 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

A partir de un **guion** (texto plano con solo lo que dice la profe, sin indicaciones de edición) y una **nota de voz** de ella leyéndolo, producir un TikTok **100 % motion graphics** al estilo de `media/reference/motion/m_1.mp4`, sin cámara.

Éxito = de `NOMBRE.txt` + `NOMBRE.m4a` sale un video listo para publicar, con beats sincronizados con la voz y el inglés escrito como en el guion (no como lo oye WhisperX).

## Decisiones del usuario

- Fuente: guion + **solo audio** de ella (no cámara, no voz IA).
- Gancho y CTA también son motion.
- Ella lee el guion **exacto, en una sola toma**; solo hay que cortar silencios largos.
- Enfoque elegido: el audio se envuelve en un mp4 de fondo plano y se reutiliza todo el pipeline, con una estrategia nueva `voice`.
- Skill propia (`edit-voice`), no dentro de `video-base`.
- Música: fuera de alcance (ya funciona si el plan trae `music`; en standby hasta que haya pistas).

## Entradas

- `media/input/NOMBRE.txt` — guion. Texto libre; saltos de línea y párrafos no importan; líneas vacías se ignoran.
- `media/input/NOMBRE.{m4a,mp3,ogg,opus,wav}` — nota de voz.

Uso: `/edit-voice media/input/NOMBRE.m4a`.

## Flujo

1. `npm run edit -- media/input/NOMBRE.m4a --plan-only`
   - `edit.js` detecta extensión de audio y llama a `npx tsx scripts/audio-to-video.ts` en lugar de `normalize_video.js`.
   - `audio-to-video.ts` crea `public/NOMBRE.mp4`: video 720×1280, 30 fps, yuv420p, color sólido = `palette('light').bg` de `src/motion/palette.ts`, duración = la del audio, audio AAC.
   - Después, como siempre: limpiar voz → WhisperX → **alinear con guion** (si existe `media/input/NOMBRE.txt`) → cortar silencios.
2. La skill escribe `"strategy": "voice"` y corre `npm run draft-motion -- NOMBRE` (cobertura total, ver abajo).
3. La skill enriquece cada beat como en `edit-motion` (tabla de layouts, emojis 3D, `key`, `lead`), con el guion como fuente de intención.
4. `validate` → `preview` (pausa y aprobación) → `render` → caption, como en `video-base`.

El alineado corre en `edit.js` para cualquier entrada (audio o video) que tenga `media/input/NOMBRE.txt`.

## Alineación guion ↔ transcript

`src/lib/scriptAlign.ts` (pura, testeada) + `scripts/script-align.ts` (`npm run script-align -- NOMBRE`).

`alignScript(script: string, words: Word[]): {words: Word[]; report: AlignReport}`

1. Tokeniza guion y transcript en palabras. Para comparar: minúsculas, sin tildes (NFD sin marcas), sin puntuación. Para mostrar se conserva el token original del guion (puntuación y tildes incluidas).
2. Diff de secuencias de palabras normalizadas (LCS):
   - **igual** → palabra del guion con `start`/`end`/`speaker` de WhisperX.
   - **reemplazo** n guion ↔ m whisper → el tramo `[primer.start, último.end]` de whisper se reparte entre las n palabras del guion en proporción a su número de letras.
   - **falta en whisper** (inserción) → tiempo interpolado entre la palabra anterior y la siguiente ya alineadas; duración mínima 0.08 s; si no hay hueco, se reparte el tramo de la vecina.
   - **sobra en whisper** (borrado) → se descarta.
3. `report`: `match` = palabras iguales / palabras del guion; listas de reemplazos, añadidas y descartadas.
4. `match < 0.7` → error `el audio no parece leer este guion (coincidencia X %)` con las primeras diferencias.

El script:
- Si no existe `public/NOMBRE.transcript.whisper.json`, copia ahí el transcript original. Siempre alinea **desde ese archivo** (idempotente).
- Escribe `public/NOMBRE.transcript.json` con las palabras corregidas y los `segments[].text` reconstruidos a partir de las palabras que caen en el tramo de cada segmento.
- Imprime: `coincidencia 94 % — 3 reemplazos, 1 añadida, 2 descartadas` y la lista de cambios.

Errores: guion vacío; transcript sin palabras; coincidencia < 70 %.

## Estrategia `voice`

`EditPlan.strategy` acepta `'voice'`. Usa `motion.blocks` / `beats` exactamente como `motion` (mismos layouts y validaciones de bloques/beats).

**Error (bloquea):** los bloques deben cubrir toda la duración final; cualquier hueco > 0.1 s (en tiempo final) es error con el tramo exacto (`hueco 12.3–13.1 s sin bloque`). Un bloque sigue sin cruzar un corte; los tramos conservados son contiguos en tiempo final, así que bloques consecutivos por tramo no dejan hueco. En `voice` un bloque puede durar menos de 3 s si su tramo es corto (mínimo: un beat, `MIN_BEAT`).

**Avisos en `voice`:**
- Se omiten: gancho (`HOOK_SECONDS`), profe entre bloques (`MIN_PROFE_GAP`), % de motion (`SHARE_MIN/MAX`).
- Se mantienen: beat largo, 3 layouts iguales seguidos.
- Nuevos: primer bloque no empieza en 0; último bloque no es `bg: "dark"`; más de 2 bloques seguidos con el mismo `bg`; `title` o `end` presentes (quedarían tapados).

**Gancho / CTA:** primer beat en 0 con la frase-gancho del guion (`big` o `word`); último bloque oscuro con el CTA que ella dice.

**Sin subtítulos visibles:** ya se ocultan dentro de bloques; en `voice` todo es bloque.

## Borrador con cobertura total

`draftMotion(words, keeps, {from, until, full: true})`:
- Cada tramo conservado se parte en bloques **contiguos** de 3–8 s, cortando preferentemente en fin de frase; el primer bloque empieza en el inicio del primer tramo y el último termina en el fin del último.
- Tramo < 3 s → un solo bloque corto.
- Beats `word` cada 2–4 palabras (lógica actual de `chunkWords`/`buildBeats`).
- `bg` alterna `light`/`dark`; el último bloque se fuerza a `dark`.

`scripts/draft-motion.ts`: si `plan.strategy === 'voice'`, usa `full: true`, `from` = 0 y `until` = fin del último tramo, y conserva `strategy: 'voice'`.

## Skill `edit-voice`

`.claude/skills/edit-voice/SKILL.md`:
- Carga `video-base` y sigue su flujo; reemplaza el paso 1 (entrada audio + guion obligatorio: si falta `NOMBRE.txt`, para con "falta el guion NOMBRE.txt junto al audio") y el paso 3 (planificar con `voice`).
- Para elegir layouts enlaza a la tabla de `edit-motion` (no la copia).
- Reglas propias: gancho y CTA en motion, cobertura total, alternar fondos, último oscuro, emojis del contenido.
- Resumen al usuario: igual que `edit-motion` + línea `Guion: coincidencia X %`.

`edit-router`: entrada de solo audio → `edit-voice`. `video-base`: añadir `voice` a la lista de estrategias. `MANUAL.md`: sección "Video desde guion + nota de voz".

## Errores y mensajes

| Caso | Comportamiento |
|---|---|
| audio sin `NOMBRE.txt` | `edit.js` sigue sin alinear; la skill `edit-voice` para y lo pide |
| guion vacío | error en `script-align` |
| WhisperX sin palabras | error antes de alinear |
| coincidencia < 70 % | error con las primeras diferencias |
| formato .opus/.ogg | `audio-to-video.ts` convierte a AAC; si ffmpeg falla, muestra su error |
| hueco en `voice` | error de `validate` con el tramo |

## Pruebas

- `src/lib/scriptAlign.test.ts`: iguales conservan tiempos; reemplazo 1↔2 reparte por letras; inserción interpolada ≥ 0.08 s; sobrante descartado; tildes/puntuación ignoradas al comparar y conservadas en salida; < 70 % → error; idempotencia.
- `src/lib/plan.test.ts` / motion: `voice` válida; hueco → error; cobertura total → sin error; sin avisos de gancho/profe/share; avisos nuevos (inicio en 0, último oscuro, mismo fondo ×3, title/end presentes).
- `src/lib/draftMotion.test.ts` con `full: true`: cubre 100 % sin huecos; último oscuro; fondos alternan; tramo corto → bloque corto.
- E2E: nota de voz real + guion. Si no hay, se extrae el audio de `media/input/PLOT_TWIST.mov`, se usa su transcript como guion con 2 errores introducidos a mano, y se verifica la corrección, el render, el preview y el caption.

## Fuera de alcance

- Voz IA / TTS.
- Guion con indicaciones de edición.
- Tomas repetidas o improvisación (la alineación asume lectura fiel; < 70 % es error).
- Música (otro sub-proyecto, en standby).
