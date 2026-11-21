---
name: video-base
description: Tratado base para editar TikToks de la profe de inglés en este repo (flujo, esquema edit.json, reglas comunes, marca). La cargan las skills edit-captions, edit-motion, edit-mixed, edit-voice y edit-router; no se usa sola porque no elige estrategia.
---

# video-base: flujo y reglas comunes de edición

Las skills de estrategia (`edit-captions`, `edit-motion`, `edit-mixed`, `edit-voice`) te mandaron aquí. Sigue este flujo; la estrategia solo cambia **qué** pones en el paso 3.

Antes de empezar lee también:
- `brand.md` (en esta carpeta): tono, ganchos y cierres de la profe.
- `templates.md` (en esta carpeta): qué muestra cada plantilla de escena y su `data` exacto.
- `caption.md` (en esta carpeta): caption y hashtags de TikTok que entregas con cada render (paso 7).

## Flujo (no te saltes pasos)

`<video>` es el archivo que te dio el usuario (normalmente `media/input/NOMBRE.mp4`; también vale `.mov` de iPhone, incluso HDR); `NOMBRE` es su nombre sin extensión. Todo lo demás usa `NOMBRE` y la salida siempre es mp4.

1. **Preparar** — `npm run edit -- media/input/NOMBRE.mp4 --plan-only`
   Normaliza, **limpia la voz** (DeepFilterNet + -14 LUFS; el original queda en `public/NOMBRE.raw.wav`), transcribe el audio limpio (WhisperX `medium`, tarda minutos la primera vez) y corta silencios. Si falla por falta de DeepFilterNet, dile al usuario que corra `npm run setup-audio` (pide confirmación para descargar ~30 MB) o usa `--no-clean`. Si la transcripción avisa de baja confianza, revisa `public/NOMBRE.transcript.json`.
   Si el usuario dice que ya está transcrito y existen `public/NOMBRE.transcript.json` y `public/NOMBRE.cuts.json`, sáltalo.
2. **Leer** — `npm run inspect -- NOMBRE`
   Muestra cada palabra con su tiempo **original** agrupada por TRAMO conservado, y las zonas `--- CORTE ---`. Todos los tiempos de `edit.json` salen de aquí.
3. **Planificar** — escribe `public/NOMBRE.edit.json` según la estrategia (ver "Escribir el plan").
   Si usas `"behind": true` (texto detrás de la profe): `npm run matte -- NOMBRE` después de escribir el plan (recorta solo esos tramos, ~10 s por segundo marcado; ver `templates.md`).
4. **Validar** — `npm run validate -- NOMBRE`. Corrige cada error con su mensaje y repite hasta `OK`. No sigas con errores.
5. **Preview y pausa** — `npm run preview -- NOMBRE` genera `media/output/NOMBRE_preview.png`. Míralo (Read) y revisa que cada captura muestre lo que planeaste. Luego muestra al usuario el resumen (formato abajo) y la ruta de la hoja. **Para y espera su aprobación. No renderices sin un "sí" explícito.**
6. **Render** — con aprobación: `npm run render:plan -- NOMBRE` → `media/output/edited/NOMBRE/NOMBRE_edited.mp4`. Confirma con `ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 media/output/edited/NOMBRE/NOMBRE_edited.mp4` que hay video y audio con la misma duración (±0.04 s). Al terminar borra solo sus temporales y la hoja de preview. El render corrige solo el volumen final (imprime `volumen final: X LUFS`). Si el usuario va a publicar con un sonido de TikTok: `npm run render:plan -- NOMBRE --no-music`.
   Si el usuario pide cambios: edita el plan, vuelve al paso 4 y genera un preview nuevo.
7. **Caption y hashtags (siempre, sin que te lo pidan)** — apenas termina el render, escribe `media/output/edited/NOMBRE/NOMBRE_caption.txt` (misma carpeta que el video) siguiendo `caption.md` (3 opciones, una recomendada, 4–6 hashtags) a partir de lo que dice la profe y del plan (título, palabras en inglés, CTA). En el mensaje final da la ruta del video, la del caption, y pega el caption recomendado con sus hashtags listo para copiar.

## Escribir el plan

Esquema completo y reglas: `src/lib/plan.ts`. Ejemplo real (estrategia mixed): `public/ACTUALLY.edit.json`.

```json
{
  "version": 1, "video": "NOMBRE.mp4", "style": "referencia", "strategy": "captions|motion|mixed|voice",
  "title":   {"line1": "...", "line2": "...", "start": 0, "end": 2.8},
  "end":     {"start": 17.7, "line1": "...", "line2": "..."},
  "captions": {"maxWords": 5, "from": 2.8},
  "zoom":    {"peak": 1.08, "duration": 0.35, "keywords": ["palabras", "en", "ingles"]},
  "overlays": [], "scenes": [], "sfx": [],
  "music":   {"file": "curious__pluck.mp3", "volume": 0.12}
}
```

Reglas comunes (todas las estrategias):

- **Tiempos**: segundos del video original, tal como los imprime `inspect`. El motor los reubica tras los cortes.
- **Escenas** (`scenes`): 1–8 s, sin solaparse, **dentro de un solo TRAMO**. Empieza ~0.1 s antes de la primera palabra de la idea que ilustra y termina antes de que empiece la siguiente idea. Nunca la estires sobre un `--- CORTE ---`.
- **Gancho en los primeros 2 s**: `title` desde 0 (dura 2–3 s, termina cuando la profe ya arrancó la idea). `captions.from` = `title.end` para no tapar el título.
- **Subtítulos**: estilo Ela, frase entera en blanco (sin palabra activa resaltada). Se esconden solos antes de `captions.from`, desde el cierre y mientras hay un `item` arriba.
- **Algo nuevo cada ~3 s**: label, emoji, ítem, chat, zoom por palabra clave, texto `behind`, escena o un recurso nuevo. Recorre `inspect` en bloques de 3 s; si un bloque no tiene nada, agrega algo que **no** hayas usado ya en el video.
- **Creatividad, no repetición (regla del usuario, gana a cualquier "usa un label por…" de las estrategias)**: el público ve todos los videos seguidos; si cada uno trae las mismas flechas, ítems y emojis en la esquina, se nota la plantilla.
  - Antes de planear, mira los 2–3 últimos planes (`ls -t public/*.edit.json`) y anota qué recursos usaron. No los repitas como recurso principal.
  - **Label con flecha**: máximo **1 por video**, y solo si ningún otro recurso lo dice mejor. Nunca uno por cada palabra.
  - Ningún recurso más de 2 veces en el mismo video (la lista de ítems "1-2-3" cuenta como un solo recurso).
  - Alternativas antes de un label: texto `behind` (detrás de la profe), `chat`, zoom en la palabra, un emoji que entra con su propio gesto, una escena generada corta, o un **overlay o escena GSAP nuevo** en `src/scenes/generated/` pensado para *esta* idea (un sello, una tachadura, una palabra que cae, un contador…).
  - En el resumen del paso 5, di qué recurso es nuevo en este video.
- **Zoom**: `keywords` = las palabras en inglés que se enseñan (tal como aparecen en el transcript). El zoom en cada corte es automático.
- **Overlays sobre escenas**: se dibujan **encima** de las escenas. No pongas un label/emoji durante una escena salvo que sea parte de la idea.
- **Posiciones** (frame 720x1280; los subtítulos ocupan la franja y≈260–330): labels en `y: 400`, con `x: 170, dir: "right"` (izquierda) o `x: 540, dir: "left"` (derecha); emojis en `y: 560`, `x: 130` o `570`, `size: 110`. Alterna lados.
- **Inglés correcto**: escribe las palabras en inglés como las dice la profe. Si WhisperX las deformó, corrige el texto en el plan; nunca inventes contenido que ella no dice.
- **Emojis**: solo los de `public/emoji/` (el validador lista los disponibles). Para otros: `npm run emoji -- 😀` (Noto, gratis) y usa el código que imprime.
- **Música** (`music`, opcional): lista `media/music/` (`ls media/music`). Elige por ánimo según el tono del video: curiosidad / "¿sabías que?" → `curious__*`; listas o tips rápidos → `upbeat__*`; pronunciación o explicación pausada → `calm__*`; errores, giros, "plot twist" → `dramatic__*`. `volume` 0.02–0.4 (por defecto 0.12; súbelo solo si la pista es muy suave), `duck` (por defecto 0.04) es el volumen mientras habla la profe. Si la carpeta está vacía, no pongas `music` y díselo al usuario.
- **sfx** (`pop`, `swoosh`, `tick`, `ding`): `pop` al aparecer un label/emoji, `swoosh` con el título. Las escenas y los cortes ya traen su swoosh: no los dupliques.
- **Cierre**: `end.start` = inicio de la frase de CTA de la profe (p. ej. "sígueme"); textos según `brand.md`. Si ella no dice CTA, ponlo en los últimos 2 s.
- **Escena que ninguna plantilla cubre**: crea `src/scenes/generated/<nombre>.tsx` (copia la forma de `demo.tsx`), regístralo en `src/scenes/generated/index.ts`, úsalo con `{"type": "generated", "data": {"component": "<nombre>", "props": {...}}}` y compruébalo en el preview. Corre `npm test` y `npx tsc --noEmit` después de crearla.

## Resumen para el usuario (paso 5)

```
Estrategia: <captions|motion|mixed|voice> — <por qué en una frase>
Gancho (0–Xs): "<title.line1> / <title.line2>"
Escenas:
  1. <tipo> X.X–Y.Y s: <qué muestra>   ← mientras dice "<frase>"
Overlays: <n> labels, <n> emojis
Música: <archivo> (o ninguna)
Cierre: "<end.line1> / <end.line2>" desde X.X s
Duración final: X s (de Y s, <n> cortes)
Preview: media/output/NOMBRE_preview.png
¿Renderizo así o cambio algo?
```

## Checklist antes del preview

- [ ] `npm run validate -- NOMBRE` → OK
- [ ] Título en 0–3 s, `line1` ≤ 14 y `line2` ≤ 18 caracteres, y `captions.from` = `title.end`
- [ ] Ningún bloque de 3 s sin algo nuevo
- [ ] Ningún overlay que duplique una escena
- [ ] Máximo 1 label con flecha; ningún recurso más de 2 veces; nada copiado como recurso principal de los últimos 2–3 planes
- [ ] Palabras en inglés escritas correctamente
- [ ] Cierre con CTA según `brand.md`
- [ ] Reglas de la estrategia cumplidas (ver su SKILL.md)
