---
name: edit-motion
description: Edita un video de la profe de inglés para TikTok con motion graphics como protagonista (escenas de ejemplo, error/corrección, pronunciación) mientras su voz sigue de fondo. Úsala para gramática, reglas y pronunciación. Uso: /edit-motion media/input/VIDEO.mp4
---

# edit-motion: las escenas explican, la profe presenta

**Primero carga la skill `video-base` y sigue su flujo completo.** Esta skill solo define qué poner en el plan (paso 3).

## Cuándo
- Gramática y reglas (tiempos verbales, preposiciones, orden de palabras).
- Pronunciación (sonidos, sílabas, palabras que se dicen distinto a como se escriben).
- Cualquier explicación con pasos o ejemplos donde ver el texto ayuda más que ver a la profe.

## Qué usar
- `"strategy": "motion"`.
- **Una escena por tramo explicativo.** Recorre `inspect` y marca cada idea que la profe explica; cada una es una escena:
  - regla con ejemplo → `example`
  - "no se dice X, se dice Y" → `mistake`
  - cómo suena → `pronounce`
  - significado → `translate`
  - nada encaja (p. ej. una tabla de conjugación, una línea de tiempo) → `generated` (ver `video-base`)
- **La profe en el gancho y en el cierre**: ninguna escena en los primeros ~2.5 s (título sobre la profe) ni durante el CTA.
- Overlays: casi ninguno; solo en los tramos con la profe en cámara entre escenas (un emoji o un label para no dejar 3 s vacíos).
- `zoom.keywords`: las palabras clave de la regla.

## Qué evitar
- **Más del ~60 % del video en escenas seguidas** sin volver a la profe: entre dos escenas deja al menos ~1 s de profe (si el tramo no da, une las dos ideas en una escena o deja una fuera).
- Escenas que no coinciden con lo que ella dice en ese momento (la voz sigue: debe hablar de lo que se ve).
- Dos escenas iguales seguidas (dos `example` seguidos): alterna tipos o combina.

## Cómo elegir tiempos desde `inspect`
- `start` = primera palabra de la idea − 0.1; `end` = última palabra de la idea + 0.2 (sin pasar el fin del TRAMO).
- Si una idea cruza un `--- CORTE ---`, divídela en dos escenas (una por tramo) o acórtala al tramo más largo.
- Si la idea dura más de 8 s, divídela (por ejemplo `example` y luego `mistake`).
- Calcula al final qué porcentaje de la duración final ocupan las escenas (`Duración final` de `inspect`) y dilo en el resumen.
