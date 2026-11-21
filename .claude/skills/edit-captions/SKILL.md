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
- **Cada palabra/frase en inglés que se enseña se marca en pantalla cuando la dice**, pero con un recurso distinto cada vez (ver "Creatividad, no repetición" en `video-base`): texto `behind`, `item`, zoom, un overlay GSAP nuevo… El label con flecha es una opción más, **máximo 1 por video**.
- **Emojis** solo donde suman emoción (no uno por idea en la misma esquina; no más de uno en pantalla a la vez).
- `item` (lista numerada) y `chat` (diálogo) también valen: son overlays, no escenas. Un `item` cuenta como el label en inglés de esa idea.
- `zoom.keywords`: todas las palabras en inglés enseñadas.
- `captions.maxWords`: 4–5 (ritmo rápido).

## Qué evitar
- Escenas de cualquier tipo.
- Más de 2 overlays a la vez en pantalla.
- Labels con frases largas: máximo ~3 palabras; si es una frase entera, deja que la lleven los subtítulos.

## Cómo elegir tiempos desde `inspect`
- Marca de la palabra en inglés (sea cual sea el recurso): `start` = tiempo de la palabra − 0.1; `end` = cuando empieza la traducción (o +1.5 s).
- Traducción o matiz: `start` = primera palabra de la traducción; `end` = fin de la idea (antes de la siguiente palabra en inglés).
- Emoji: lado opuesto a lo que esté en pantalla; si hay label, `end` = `start` del siguiente label (si no, su flecha cae encima del emoji).
- Un `pop` (o `tick`/`ding`, varía) en el `start` de cada overlay.
