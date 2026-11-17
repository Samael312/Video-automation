---
name: edit-motion
description: Edita un video de la profe de inglés para TikTok con motion graphics como protagonista, al estilo de media/reference/motion/m_1.mp4 — bloques a pantalla completa con tipografía cinética, emojis 3D y planos nuevos cada ~1 s, intercalados con la profe en cámara. Úsala para gramática, reglas, pronunciación, listas de palabras o explicaciones con pasos. Uso: /edit-motion media/input/VIDEO.mp4
---

# edit-motion: las escenas explican, la profe presenta

**Primero carga la skill `video-base` y sigue su flujo completo.** Esta skill cambia el paso 3 (planificar) y agrega comandos. El formato de bloques y beats y el JSON exacto de cada layout están en `video-base/templates.md` → "Motion (beats)".

## Qué se busca
El video **alterna** la profe en cámara con **bloques** de motion a pantalla completa de 3–8 s. Dentro de cada bloque, **beats** de 0.5–2 s cambian sin pausa: tipografía cinética que sigue la voz, palabra clave en cursiva con resaltador crema, emojis 3D grandes, fondo claro con puntos desenfocados. La voz nunca se corta.

- Gancho (título) y CTA: la profe en cámara. Ningún bloque en los primeros ~2.5 s ni después de `end.start`.
- Entre bloques: 1–3 s de profe.
- Reglas o errores numerados ("3 errores…"): un `item` (ver `video-base/templates.md`) en el tramo de profe antes de cada bloque, para que se sepa en qué punto va.
- Motion ≈ 60–75 % de la duración final.

**La referencia `m_1` da solo el estilo** (ritmo, tipografía, movimiento, paleta). Los emojis, objetos y textos salen **del contenido del video**: lo que la profe nombra o ilustra en ese beat. Nunca copies recursos de la referencia (cerebro, candado, reloj…) si ella no habla de eso.

## Paso 3 (reemplaza al de video-base)
1. Escribe `title` y `end` como en `video-base`, con `"strategy": "motion"`.
2. `npm run draft-motion -- NOMBRE` arma bloques y beats `word` desde el transcript. Respeta `title.end` y `end.start`.
3. Recorre **cada beat** con `inspect` al lado y decide:

| La profe… | layout | campos |
|---|---|---|
| enumera ("3 palabras", "primero… segundo…") | `list` | `items`, `active` = la que está diciendo, `title` |
| dice "no es X / no se dice X" | `strike` (varias) o `swap` (una) | `items` / `from`, `to` |
| traduce o define ("plot twist = giro inesperado") | `swap` | `from` (inglés), `to` (español), `lead` |
| nombra un objeto, lugar o emoción | `prop` o `ring` | `emoji`, `lead`, `key` |
| dice una cifra o una palabra muy fuerte | `big` | `key` |
| habla de una serie, app, libro, video o cita | `card` | `key`, `frame` (`player`/`phone`), `lead` |
| cualquier otra cosa | `word` | `lead`, `key` |

   - `key` = la palabra fuerte del beat. Nunca un conector ("y", "que", "en"). Si el borrador puso uno, cambia la `key` y mueve el `at`.
   - `lead` = lo que dice justo antes, tal como suena. Sus palabras aparecen al ritmo de la voz si coinciden con el transcript.
   - Inglés bien escrito aunque WhisperX lo haya deformado.
   - Alterna layouts: nunca 3 iguales seguidos. Usa `bg: "dark"` en 1 de cada 2–3 bloques (sobre todo con `list` y `big`).
4. Emojis: `npm run emoji -- --3d <emoji…>` baja los 3D a `public/emoji3d/`. Si Fluent no tiene alguno, el comando copia el de Noto. Los fondos de cada bloque usan solos los emojis de sus beats.
5. Tiempos: un beat dura de 0.4 a 2.5 s. Si uno queda largo, pártelo (otra `key` dicha en ese tramo). Un bloque nunca cruza un `--- CORTE ---`.

## Validar y revisar
- `npm run validate -- NOMBRE`: corrige todos los errores. Lee los **AVISOS** (beats largos, layouts repetidos, poca profe entre bloques, % de motion) y corrígelos salvo que tengas una razón.
- `npm run preview -- NOMBRE` saca una captura por beat. Revisa que cada una muestre lo que la profe dice en ese momento.

## Resumen para el usuario (además del de video-base)
```
Motion: <XX> % de la duración final — <n> bloques, <n> beats
Bloques:
  1. X.X–Y.Y s (<light|dark>): word "plot twist" → prop 😱 "shock" → list (3) …
Layouts usados: word ×n, prop ×n, …
```

## Qué evitar
- Beats que no coinciden con lo que ella dice en ese momento.
- Bloques en el gancho o en el CTA.
- Emojis que no tienen que ver con el contenido.
- Las plantillas de `scenes` (tarjetas oscuras fijas): en motion se usan bloques, no escenas. `generated` solo si nada de lo anterior sirve.
