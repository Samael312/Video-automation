# Render robusto: diseño

Fecha: 2026-11-23 · Pieza 1 de 4 de "mejorar la web" (robusto → rápido → orden → diseño).

## Problema
- Los errores del plan salen tarde. Un sfx `undefined` (overlay `fx` sin sonido definido) pasó `validate` y el preview, porque `renderStill` no carga audio, y rompió el render en el frame 0 después de empaquetar y copiar ~300 MB.
- Las props de los `fx` y de las escenas generadas (`emoji`, `avatar`…) no se validan. Si falta un PNG, solo se ve en el render.
- El compositor de Remotion a veces falla al azar ("No frame found at position…"). Repetir el mismo render funciona. Hoy no hay reintento.
- `render.js` escribe directo sobre `media/output/edited/<N>/<N>_edited.mp4`. Si un render falla, puede dañar el video bueno anterior.

## Objetivo
Que un plan roto falle en segundos y con un mensaje claro, que los fallos puntuales se reintenten solos y que un render fallido nunca dañe el video anterior. Desde fuera, `npm run render:plan -- <N> [--no-music]` se usa igual que hoy (web, skills, `edit.js`).

Fuera de alcance (pieza 2, velocidad): guardar el paquete entre renders y no copiar los archivos pesados de `public/`.

## Enfoque
Un nuevo `scripts/render.ts` que usa la API de Node de Remotion (`@remotion/bundler` + `@remotion/renderer`) en lugar de la CLI. Empaqueta una sola vez y usa ese paquete para la prueba y para el render. `scripts/render.js` queda como envoltorio fino (`npx tsx scripts/render.ts …`) para no romper a quien lo llame. Se descartó seguir llamando a `npx remotion` varias veces porque empaqueta 2 o 3 veces y la pieza 2 lo tendría que rehacer.

## Flujo de `render:plan`
Cada paso imprime `== <paso> ==`, que la web ya interpreta con `parseLineaPipeline`.

1. **validar**: `validate.ts`, ampliado:
   - **Assets en props:** en los overlays `fx` (`props`) y en las escenas `generated` (`data.props`), todo valor de texto bajo una clave cuyo nombre contenga `emoji` o `avatar` (también dentro de objetos y listas anidados), **si tiene forma de código emoji** (`/^[0-9a-f]{4,6}(-[0-9a-f]{4,6})*$/`), debe existir en la carpeta que carga ese componente (`emojiDirsOf` lee su código: `staticFile(\`emoji/…\`)` o `staticFile(\`emoji3d/…\`)`; si no se sabe, vale cualquiera de las dos). También se revisan los objetos que cuelgan de una clave de emoji (`emojis: [{code}]`). Los códigos empiezan por cifra (`/^[0-9][0-9a-f]{3,5}(-[0-9a-f]{4,6})*$/`), así "cafe" o "face" cuentan como palabras. Las palabras se ignoran, porque algunos componentes aceptan palabras especiales (p. ej. `two-worlds` dibuja una silueta con `"dragon"`); si una palabra rompe algo, lo atrapa la prueba (paso 3). El error dice la ruta: `overlays[3].props.comments[2].avatar: emoji 1f409 no existe en public/emoji ni en public/emoji3d`.
   - **Sonidos:** el validador recorre la lista completa de sfx que sonarán (manuales + automáticos) y exige que cada `public/sfx/<name>.wav` exista.
   - La música ya se valida hoy; no cambia.
2. **preparar**: copia la música del plan a `public/music` (como hoy), `bundle()` una vez y `selectComposition('Edit')`.
3. **prueba**: `renderFrames` con `everyNthFrame` ≈ fps/2 (1 frame cada ~0.5 s), con imágenes en memoria y sin escribir video. Carga imágenes, componentes y audio de casi todo el video. Si falla, imprime en español el segundo aproximado y el mensaje (`el render de prueba falló en el segundo 25.1: <mensaje>`) y sale con `FALLO en el paso: prueba`.
4. **renderizar**: `renderMedia` a `<N>_edited.tmp.mp4` en la misma carpeta, imprimiendo `Rendered x/y` en `onProgress` (ya lo entiende la web).
   - Si el error es del compositor (`/No frame found at position|Could not extract frame from compositor/`), reintenta **una vez** con la mitad de concurrencia (mínimo 1) y avisa (`fallo puntual del compositor, reintento con concurrencia N`).
   - Cualquier otro error, o un segundo fallo del compositor, es definitivo.
5. **volumen final**: `pipeline/final_loudness.py` sobre el `.tmp.mp4`.
6. **terminar**: renombra `.tmp.mp4` → `<N>_edited.mp4` (reemplaza el anterior) y luego `cleanResidue` (como hoy).

**Si cualquier paso falla:** se borra el `.tmp.mp4`, el `<N>_edited.mp4` anterior queda intacto, sale con código 1 y la última línea es `FALLO en el paso: <paso>`. Nunca se imprimen colores ANSI ni volcados de código: solo una línea de causa en español antes de la línea `FALLO`. El detalle técnico va a stderr una sola vez, recortado a ~20 líneas.

## Unidades y responsabilidades
- **`src/lib/sfxPlan.ts` (nuevo, puro):** `autoSfxEvents(input)` devuelve los sonidos automáticos `{at, name, volume}` tras `thinEvents` (antes era `autoEvents` dentro de `src/Edit.tsx`; ahora `Edit.tsx` lo usa). Los manuales siguen saliendo de `plan.sfx`. `sfxNamesUsed(plan)` da el conjunto de todos los sonidos que el plan puede tocar (fijos, manuales y automáticos), que es lo que comprueba `validatePlan` contra `public/sfx`.
- **`src/lib/plan.ts`:** `validatePlan` añade el chequeo de assets en props (función pura `propAssetErrors(props, ctx, tag)`).
- **`scripts/renderFlow.ts` (nuevo, puro de E/S inyectada):** `runRender(steps, io)` ordena los pasos, reintenta el compositor, maneja el `.tmp` (renombrar o borrar) y da formato a las líneas. `io` trae `bundle`, `probe`, `renderMedia`, `loudness`, `rename`, `remove` y `log`, que se pueden cambiar por falsos en los tests.
- **`scripts/render.ts` (nuevo):** lee los argumentos, conecta `runRender` con Remotion, ffmpeg/Python y `fs`.
- **`scripts/render.js`:** envoltorio que lanza `render.ts` con los mismos argumentos y código de salida.
- **`web/prompts.js`:** `traducirError` reconoce los mensajes nuevos (`falta public/emoji…`, `render de prueba falló…`).

## Tests (vitest)
- `sfxEvents`: overlays `emoji`/`label`/`item`/`chat` dan su sonido; `fx` no da ninguno; los manuales están; se aplica `thinEvents`; `autoSfx: false` apaga los automáticos.
- `propAssetErrors`: código emoji que falta en `props.emoji` o en una lista anidada (`comments[i].avatar`, `emojis[1]`) → error con la ruta; un código que está en `emoji` o en `emoji3d` no da error; una palabra (`"dragon"`) y las claves que no son de emoji se ignoran.
- `validatePlan` con un sfx manual inexistente → error.
- `runRender` (con io falso):
  - un error del compositor y luego éxito → reintenta con la mitad de concurrencia y renombra;
  - dos errores del compositor → falla, borra el `.tmp` y no renombra;
  - un error que no es del compositor → no reintenta;
  - la prueba falla → nunca llama a `renderMedia`;
  - falla el volumen → borra el `.tmp` y el final no cambia;
  - éxito → renombra y llama a `cleanResidue`.
- `traducirError` con los mensajes nuevos.

## Verificación real (al terminar; borrar todo después)
1. `npm run render:plan -- DRAGON` completo → OK, con el tiempo de cada paso anotado.
2. Copia de DRAGON con `props.comments[0].avatar` inexistente → falla en **validar** en segundos.
3. Copia con un sfx manual inexistente → falla en **validar**.
4. En los dos fallos: el `<N>_edited.mp4` anterior no cambia (mismo tamaño y fecha) y no queda ningún `.tmp.mp4`.
5. Desde la web: aprobar un video → progreso y estado `listo` como hoy.

## Riesgos
- `renderFrames` con `everyNthFrame` puede no pasar por un sfx muy corto que cae entre dos muestras. Eso lo cubre el chequeo estático de sonidos (paso 1), así que no depende de la prueba.
- La prueba suma ~20–40 s a cada render. La pieza 2 lo compensa con creces (caché del paquete, sin copiar ~300 MB).
