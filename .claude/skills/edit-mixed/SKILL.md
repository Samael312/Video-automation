---
name: edit-mixed
description: Edita un video de la profe de inglés para TikTok mezclando la profe en cámara con 1 a 3 escenas animadas en los momentos clave y un quiz de cierre opcional. Úsala para falsos amigos, "¿Sabías que?", curiosidades, idioms, phrasal verbs y vocabulario. Uso: /edit-mixed media/input/VIDEO.mp4
---

# edit-mixed: la profe cuenta, las escenas remarcan

**Primero carga la skill `video-base` y sigue su flujo completo.** Esta skill solo define qué poner en el plan (paso 3). Ejemplo completo de esta estrategia: `public/ACTUALLY.edit.json`.

## Cuándo
- Falsos amigos y "¿Sabías que?" ("X no significa Y").
- Idioms y phrasal verbs (qué significa + ejemplo).
- Vocabulario y curiosidades.

## Qué usar
- `"strategy": "mixed"`.
- **1 a 3 escenas** en los momentos que el público tiene que recordar:
  - "X no es Y" → `false-friend`
  - "X significa Y" → `translate`
  - idiom / phrasal verb con ejemplo → `example`
  - "en vez de X, di Y" (mejora, no error) → `before-after`; error claro → `mistake`
  - "en inglés británico X, en americano Y" / A o B → `versus`
  - "escucha esto: ..." (reto de oído) → `listen`
  - "3 palabras/errores/frases" → `countdown` (una sola escena) o un `item` por cada una
- **Quiz de cierre (opcional)**: si la idea principal se puede preguntar ("¿qué significa X?"), un `quiz` de 3–4 s antes del CTA, con la respuesta revelándose cuando la profe la dice. Cuenta como una de las 3 escenas. Los distractores: la traducción falsa obvia (el falso amigo) y una plausible.
- **Entre escenas, la profe con overlays**: marca las palabras en inglés que no tienen escena con recursos variados (`behind`, zoom, `chat`, un overlay GSAP nuevo); label con flecha máximo 1 por video (ver "Creatividad, no repetición" en `video-base`). Emojis solo donde suman.
- **Varias palabras/ideas** ("3 palabras…"): gancho de lista numerada + un `item` por cada una cuando la profe la nombra (el `item` puede ir antes de su escena).
- **Diálogo o ejemplo de conversación**: `chat` en vez de escena; deja a la profe a la vista.
- `zoom.keywords`: las palabras en inglés enseñadas.

## Qué evitar
- **Escena en el gancho** (primeros ~2.5 s): ahí va el título sobre la profe.
- Más de 3 escenas en videos de menos de 30 s (más de eso es `edit-motion`).
- Labels que repiten lo que muestra una escena (si hay `false-friend` de library, no pongas el label "library").
- Quiz cuya respuesta no dice la profe: la voz y el reveal tienen que coincidir.

## Cómo elegir tiempos desde `inspect`
- Escena: desde la palabra en inglés (− 0.1) hasta el fin de su explicación (+ 0.2), dentro del TRAMO.
- Quiz: `end` = tiempo de la palabra que da la respuesta + 1.0, `start` = `end` − 3.5 (ajusta para quedar en un solo tramo).
- Entre la última escena y `end.start` deja al menos ~1 s de profe.
