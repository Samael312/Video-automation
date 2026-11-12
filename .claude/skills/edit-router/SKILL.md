---
name: edit-router
description: Mira un video de la profe de inglés, detecta de qué formato es (¿Sabías que?, gramática, pronunciación, idioms, vocabulario...) y recomienda la estrategia de edición para TikTok (edit-captions, edit-motion o edit-mixed). Úsala cuando no sepas qué estilo usar. Uso: /edit-router media/input/VIDEO.mp4
---

# edit-router: elige la estrategia

No edita nada por sí sola: clasifica, recomienda, espera tu "sí" y luego sigue con la skill elegida.

## 1. Transcribir y ver
Haz los pasos 1 y 2 de la skill `video-base` (carga `video-base`):
```
npm run edit -- media/input/VIDEO.mp4 --plan-only
npm run inspect -- VIDEO
```

## 2. Clasificar
Lee el transcript de `inspect` y elige **uno** de los 9 formatos. Señales típicas:

| Formato | Señales en lo que dice | Estrategia |
|---|---|---|
| ¿Sabías que? | "sabías que", "no significa", "en realidad" | `edit-mixed` |
| Curiosidades | "dato curioso", origen de una palabra | `edit-mixed` |
| Falsos amigos | "no es X, es Y", "parece pero no" | `edit-mixed` |
| Idioms | expresión fija + "significa" + ejemplo | `edit-mixed` |
| Phrasal verbs | verbo + partícula (get up, give up...) | `edit-mixed` |
| Vocabulario | lista de palabras con su traducción | `edit-mixed` |
| Gramática | tiempos, "se usa cuando", "regla" | `edit-motion` |
| Reglas | "siempre", "nunca", "cuando... entonces" | `edit-motion` |
| Pronunciación | "se pronuncia", "suena", sílabas, "no se dice" | `edit-motion` |
| Frases para sonar nativo | "en vez de decir X, di Y", "los nativos dicen" | `edit-captions` (o `edit-mixed` si explica el significado) |

Ajustes:
- Video muy corto (< 12 s) o la profe actúa mucho → inclina a `edit-captions`.
- Muchos pasos o ejemplos seguidos (> 3 ideas) → inclina a `edit-motion`.

## 3. Recomendar y esperar
Muestra al usuario, corto:
```
Formato: <formato>
Evidencia: "<cita 1 del transcript>" (t=...), "<cita 2>" (t=...)
Recomiendo: edit-<x> — <razón en una frase>
Otra opción: edit-<y> — <cuándo sería mejor>
¿Sigo con edit-<x>?
```
**Espera la respuesta.** Si elige otra, usa esa.

## 4. Continuar
Carga la skill elegida (`edit-captions`, `edit-motion` o `edit-mixed`) y sigue el flujo de `video-base` **desde el paso 3** (escribir el plan): los pasos 1 y 2 ya están hechos, no los repitas.
