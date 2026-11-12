---
name: edit-captions
description: Edita un video de la profe de inglés para TikTok solo con subtítulos animados, labels con flecha, emojis y zoom, sin cortes a animación. Úsala para videos rápidos, con mucha expresión en cámara o de "frases para sonar más nativo". Uso: /edit-captions media/input/VIDEO.mp4
---

# edit-captions: la profe siempre en cámara

**Primero carga la skill `video-base` y sigue su flujo completo.** Esta skill solo define qué poner en el plan (paso 3).

## Cuándo
- Frases para sonar más nativo, expresiones rápidas, listas cortas.
- La profe actúa o gesticula mucho: taparla con escenas le quita fuerza.
- Videos de menos de ~20 s con una sola idea.

Si el video explica una regla o una pronunciación paso a paso, sugiere `edit-motion` al usuario antes de seguir.

## Qué usar
- `"strategy": "captions"`, `"scenes": []` (siempre vacío).
- **Un label por cada palabra/frase en inglés que se enseña**, cuando la dice; y su traducción en otro label del lado opuesto cuando la profe la traduce (como en `ACTUALLY`: "actually" a la izquierda, "en realidad" a la derecha).
- **Emojis** que refuercen la emoción de cada idea (1 por idea, no más de uno en pantalla a la vez).
- `zoom.keywords`: todas las palabras en inglés enseñadas.
- `captions.maxWords`: 4–5 (ritmo rápido).

## Qué evitar
- Escenas de cualquier tipo.
- Más de 2 overlays a la vez en pantalla.
- Labels con frases largas: máximo ~3 palabras; si es una frase entera, deja que la lleven los subtítulos.

## Cómo elegir tiempos desde `inspect`
- Label en inglés: `start` = tiempo de la palabra en inglés − 0.1; `end` = cuando empieza la traducción (o +1.5 s).
- Label de traducción: `start` = primera palabra de la traducción; `end` = fin de la idea (antes de la siguiente palabra en inglés).
- Emoji: mismo `start` que el label en inglés de esa idea, `end` cuando termina la idea.
- Un `pop` en el `start` de cada label/emoji.
