# Plantillas de escena

Cada escena tapa a la profe con un fondo oscuro a pantalla completa; su voz y los subtítulos siguen. Entra y sale con fade + slide y un swoosh automático. Contenido entre y=380 y y=1100; el texto largo se achica solo.

| Tipo | Muestra | Úsala cuando la profe… | Duración |
|---|---|---|---|
| `translate` | palabra → flecha → traducción (+ emoji) | da el significado de una palabra/expresión | 2–3 s |
| `false-friend` | A ≠ B (+ nota) | dice "X no es / no significa Y" | 2–3 s |
| `pronounce` | sílabas que se iluminan + fonética | explica cómo se pronuncia | 2–4 s |
| `mistake` | ❌ frase mal tachada → ✅ frase bien | corrige un error típico | 3–4 s |
| `example` | oración que aparece palabra por palabra, clave resaltada | da un ejemplo de uso | 3–5 s |
| `quiz` | pregunta, 2–3 opciones, cuenta regresiva, respuesta | (cierre) quieres que el público piense y comente | 3–5 s |
| `generated` | componente propio en `src/scenes/generated/` | ninguna de las anteriores sirve | 1–8 s |

## `data` exacto (campos obligatorios en negrita en la descripción)

```json
{"type": "translate", "start": 4.8, "end": 6.9,
 "data": {"word": "actually", "translation": "en realidad", "emoji": "1f92b"}}
```
**word**, **translation**; `emoji` opcional (código de `public/emoji/`).

```json
{"type": "false-friend", "start": 8.1, "end": 10.6,
 "data": {"a": "library", "b": "librería", "note": "library = biblioteca"}}
```
**a** (inglés), **b** (lo que NO significa); `note` opcional.

```json
{"type": "pronounce", "start": 3.0, "end": 6.0,
 "data": {"word": "comfortable", "syllables": ["comf", "ta", "ble"], "phonetic": "/ˈkʌmf.tə.bəl/"}}
```
**word**, **syllables** (lista, como se pronuncian), **phonetic**.

```json
{"type": "mistake", "start": 5.0, "end": 8.5,
 "data": {"wrong": "I am agree", "right": "I agree"}}
```
**wrong**, **right**.

```json
{"type": "example", "start": 9.0, "end": 13.0,
 "data": {"sentence": "I was so embarrassed yesterday", "highlight": "embarrassed"}}
```
**sentence**, **highlight** (una palabra de la oración).

```json
{"type": "quiz", "start": 12.9, "end": 16.4,
 "data": {"question": "¿Qué significa \"embarrassed\"?", "options": ["Embarazada", "Avergonzado", "Emocionado"], "answer": 1, "countdown": 2}}
```
**question**, **options** (2 o 3), **answer** (índice desde 0); `countdown` 1–10 (default 3). La respuesta se revela en los últimos 1.5 s: haz coincidir ese momento con cuando la profe la dice.

```json
{"type": "generated", "start": 4.0, "end": 6.0,
 "data": {"component": "demo", "props": {"text": "Escena IA"}}}
```
**component** registrado en `src/scenes/generated/index.ts`; `props` libre.

## Overlays

```json
{"kind": "label", "text": "biblioteca", "start": 11.1, "end": 12.4, "x": 540, "y": 400, "dir": "left"}
{"kind": "emoji", "file": "1f4da", "start": 8.0, "end": 10.4, "x": 570, "y": 560, "size": 110}
```
Label = texto serif con flecha discontinua animada. Emoji = entra con rebote. `start` debe caer en un tramo conservado.

## Motion (beats) — solo `strategy: "motion"`

Campo `motion` del plan: **bloques** a pantalla completa (la profe no se ve, la voz sigue) con **beats** que cambian cada 0.5–2 s. Lo arma `npm run draft-motion -- NOMBRE`; la skill `edit-motion` lo enriquece. Tipos y validación: `src/lib/motion.ts`.

```json
"motion": {"blocks": [
  {"start": 3.1, "end": 9.4, "bg": "light", "beats": [
    {"at": 3.1, "layout": "word", "lead": "en la historia que te", "key": "plot twist"},
    {"at": 4.0, "layout": "prop", "emoji": "1f631", "lead": "te deja en", "key": "shock"}
  ]}
]}
```

Reglas:
- Bloque: dentro de **un solo TRAMO**, sin solaparse con otros bloques ni con `scenes`. `bg`: `light` o `dark`.
- Beat: el primero en `at` = `block.start`; los `at` crecen; cada beat dura hasta el siguiente `at` (o el fin del bloque). Mínimo 0.4 s (error), recomendado ≤ 2.5 s (aviso).
- Avisos: 3 layouts iguales seguidos, < 1 s de profe entre bloques, motion fuera de 50–80 %, bloque en el gancho (< 2.5 s) o después de `end.start`.
- `emoji`: código en `public/emoji3d/` (`npm run emoji -- --3d 😱`).

| layout | Muestra | JSON exacto (negrita = obligatorio en la descripción) |
|---|---|---|
| `word` | lead chico + **key** grande en cursiva con resaltador | `{"at": 0, "layout": "word", "lead": "parece una", "key": "tontería"}` |
| `prop` | emoji 3D grande; texto arriba (`pos: "top"`) o abajo | `{"at": 0, "layout": "prop", "emoji": "1f631", "lead": "te deja en", "key": "shock", "pos": "top"}` — **emoji** |
| `ring` | emoji en círculo discontinuo que gira | `{"at": 0, "layout": "ring", "emoji": "1f4d6", "lead": "un capítulo que", "key": "termina"}` — **emoji** |
| `list` | pastillas numeradas; `active` resaltada | `{"at": 0, "layout": "list", "title": "3 palabras", "items": ["plot twist", "cliffhanger", "page turner"], "active": 0}` — **items** 2–5 |
| `strike` | items tachados; el último queda en pie | `{"at": 0, "layout": "strike", "items": ["aburrido", "lento", "page turner"]}` — **items** 2–4 |
| `swap` | **from** tachado → **to** | `{"at": 0, "layout": "swap", "lead": "plot twist =", "from": "plot twist", "to": "giro inesperado"}` |
| `card` | tarjeta oscura de reproductor o móvil | `{"at": 0, "layout": "card", "frame": "player", "lead": "cuando un capítulo", "key": "cliffhanger"}` — **key**, **frame** |
| `big` | una palabra o número enorme sobre negro | `{"at": 0, "layout": "big", "key": "3"}` — **key** |

Galería para ver los 8 layouts: `npx remotion studio src/index.ts` → composición `MotionGallery`.
