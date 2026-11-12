---
name: analyze-reference
description: Analiza videos de referencia de TikTok (media/reference/) y propone cómo afinar el estilo de edición de la profe de inglés (tema visual, ganchos, cierres, ritmo, plantillas). Úsala cuando el usuario añade videos de referencia o pide "aprende de estos videos". Uso: /analyze-reference [video | todos]
---

# analyze-reference: aprender de videos de referencia

No cambia nada sin un "sí". Mira, compara con lo que ya hacemos, propone y espera.

## 0. Qué videos y de quién
- Lista `media/reference/` (una subcarpeta por creadora: `media/reference/<creadora>/<video>`) y lee `.claude/skills/video-base/references.md` (registro de lo ya analizado).
- El nombre de la carpeta dice de quién es. Videos sueltos en la raíz: pregunta de quién son.
- Analiza los que el usuario nombró; si no nombró ninguno, solo los que no están en el registro.
- **¿De qué creador es?** Si el usuario no lo dijo, pregúntalo antes de seguir:
  - **misma creadora** que el estilo `referencia` → se afina ese estilo (`src/styles/referencia/theme.ts`).
  - **otro creador** → estilo aparte `src/styles/<slug>/` (ver paso 6). Nunca mezcles su look con `referencia`.

## 1. Extraer
```
npm run reference -- <creadora>/<video>   # o: npm run reference -- <creadora>   # o: --all
```
Por video deja en `media/output/work/reference/<creadora>/<video>/`: `report.md` (ritmo, gancho, cierre, cortes, transcript) y `sheet_NN.png` (1 fotograma por segundo; hoja N, casilla k = segundo (N-1)*30 + k-1). Transcribe sin `vocab.txt` (tarda ~1–2 min por video).

## 2. Mirar
Lee `report.md` y **todas** las hojas (Read). Si una casilla no se entiende, saca el fotograma exacto:
`ffmpeg -v error -ss <s> -i media/reference/<creadora>/<video> -frames:v 1 media/output/work/reference/<creadora>/<video>/f_<s>.png`

Anota, con evidencia (video + segundo):

| Qué | Dónde mirar | Lo comparas con |
|---|---|---|
| Título: fuente, tamaño, colores, líneas, posición, cuánto dura | primeras casillas | `theme.ts`, overlay `Title` |
| Labels con flecha: estilo, qué palabras llevan label, posición, frecuencia | hojas | reglas de posición en `video-base` |
| Subtítulos: altura, tamaño, mayúsculas, color de la palabra activa, palabras por página | hojas | `theme.ts` (`captionTop`, `captionFontSize`, `highlight`), `captions.maxWords` |
| Emojis: cuáles, dónde, cada cuánto | hojas | `brand.md` (emojis frecuentes) |
| Ritmo: tomas/s, palabras/s, pausas, cada cuánto aparece algo nuevo | `report.md` + hojas | regla "algo nuevo cada ~3 s", `cut.py --gap` |
| Gancho y cierre: **estructura** (pregunta, promesa, lista...) | `report.md` → Texto | ganchos y cierres de `brand.md` |
| Gráficos que se repiten (tabla, lista, comparación) | hojas | `templates.md` |
| Cosas que no tenemos (B-roll, blur, zoom a objeto, stickers) | hojas | nada: "requiere código" |

Un patrón visto en 2+ videos es firme; visto en 1 es "a confirmar".

## 3. Proponer y esperar
```
Analizados: <videos> (<creador>)
Ya lo hacemos igual: <lista corta>
Cambios propuestos:
  1. <archivo>: <cambio concreto, con valor> — evidencia: <video> <s> s
  2. ...
Requiere código (no lo aplico sin tu ok): <idea> — <qué habría que hacer>
¿Aplico cuáles?
```
**Para y espera.** Aplica solo los números que el usuario apruebe.

## 4. Aplicar
- `brand.md`: ganchos y cierres **como patrón, en la voz de la profe**. Nunca copies frases textuales de otra creadora.
  Ej.: ella cierra con "¿Qué te parece? ¿Crees que me falta algo?" → patrón "pregunta al público" → cierre "¿Cuál te sorprendió más?".
- `theme.ts`: colores, tamaños, posiciones medidos.
- `video-base/SKILL.md`: reglas de ritmo o posición, solo si cambian para todas las estrategias.
- Plantilla nueva o efecto nuevo: es código. Sigue el patrón de `src/templates/` (+ tests), regístrala y añádela a `templates.md`.

## 5. Comprobar y cerrar
1. Si cambiaste el tema o una plantilla: `npm run preview -- ACTUALLY` y compara con las hojas de la referencia (Read de ambas).
2. `npm test` y `npx tsc --noEmit`.
3. Añade cada video a `references.md` (fecha, creador, qué se tomó).
4. `npm run clean -- reference`.
5. Lista los archivos cambiados y propone el mensaje de commit (los commits los hace el usuario).

## 6. Otro creador: estilo aparte
1. Copia `src/styles/referencia/theme.ts` a `src/styles/<slug>/theme.ts` con sus valores medidos y `name: '<slug>'`.
2. Regístralo en `src/styles/themes.ts` (`themes = {referencia, <slug>}`); el validador lo acepta solo.
3. Se usa por video con `"style": "<slug>"` en el plan.
4. Toma **ideas** (estructura, ritmo, tipos de gráfico), no su identidad: ni logo, ni nombre, ni frases firma, ni un calco de su look.
5. `brand.md` sigue siendo de la profe: sus ideas entran como patrón en su voz.
