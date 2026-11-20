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
| `before-after` | frase normal ⬇ misma idea como nativo (no es un error) | mejora una frase: "en vez de very tired, di exhausted" | 3–4 s |
| `versus` | dos opciones frente a frente con VS | compara dos formas (UK/US, formal/informal, A o B) | 2–4 s |
| `listen` | ondas de sonido ("Escucha") y luego la frase se revela palabra a palabra | reto de oído: dice una frase rápida y luego la explica | 3–5 s |
| `countdown` | lista numerada en cuenta regresiva (3, 2, 1) con título | "3 palabras/errores/frases": todos los ítems en una sola escena | 3–6 s |
| `generated` | componente propio en `src/scenes/generated/` | ninguna de las anteriores sirve | 1–8 s |

## Transición de la escena (`transition`, opcional)
Campo de la escena, junto a `type`: `"transition": "wipe"`. Valores: `fade-slide` (defecto, aparece subiendo), `slide-left` / `slide-right` (entra y sale por el lado), `wipe` (círculo que se abre desde el centro), `zoom` (crece desde pequeña), `flip` (gira como una tarjeta). Varía entre escenas del mismo video (no repitas la misma dos veces seguidas) y usa `wipe` o `zoom` en revelaciones, `slide-*` en comparaciones (`versus`, `before-after`).

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
{"type": "before-after", "start": 6.0, "end": 9.5,
 "data": {"before": "I'm very tired", "after": "I'm exhausted", "beforeLabel": "Normal", "afterLabel": "Nativo ✨"}}
```
**before**, **after**; las etiquetas son opcionales. A diferencia de `mistake`, aquí la frase de arriba no es un error: solo suena básica.

```json
{"type": "versus", "start": 6.0, "end": 9.0,
 "data": {"left": "lift", "right": "elevator", "leftLabel": "Reino Unido", "rightLabel": "Estados Unidos"}}
```
**left**, **right**; etiquetas opcionales. No uses emojis de bandera (Chrome en Windows los dibuja como letras).

```json
{"type": "listen", "start": 3.0, "end": 7.0,
 "data": {"phrase": "What are you up to", "hint": "¿Qué haces?"}}
```
**phrase**; `hint` opcional (traducción, sale al final). Las ondas suenan durante el primer 45 % y la frase se revela entre el 45 % y el 85 %: haz coincidir el reveal con cuando la profe la explica.

```json
{"type": "countdown", "start": 4.0, "end": 9.0,
 "data": {"title": "3 palabras de Navidad", "items": ["stocking", "ornament", "wrapping paper"]}}
```
**items** (2 a 5 textos, en el orden en que los dice; se numeran de mayor a menor); `title` opcional. Los ítems entran repartidos de forma pareja: elige la duración para que coincida con el ritmo de la profe.

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

```json
{"kind": "item", "n": 1, "text": "actually", "start": 2.6, "end": 4.4}
```
**Ítem de lista numerada** (estilo Ela): cuadrito azul con el número (1–10) que entra con rebote + texto crema que se escribe. Arriba (y 190) por defecto; mientras está, los subtítulos se esconden. Úsalo con ganchos tipo "3 palabras…": un ítem al empezar cada una (`start` = la palabra − 0.1, 1.5–2.5 s). `y` opcional.

```json
{"kind": "chat", "start": 12.6, "end": 17.4, "messages": [
  {"text": "Why are you red?", "side": "left"},
  {"text": "I'm so embarrassed!", "side": "right", "at": 13.4}]}
```
**Burbujas de chat** (tipo iMessage): `left` = gris (recibido), `right` = azul (enviado). 1–4 mensajes; cada uno aparece en su `at` (segundo original, entre start y end) o escalonado cada 0.8 s. Abajo (y 720) para no tapar la cara. Úsalo para **diálogos en inglés** que la profe cuenta o ejemplifica. Puede llevar emojis dentro del texto ("See you! 👋"): se dibujan como PNG de `public/emoji/`; si falta alguno el validador dice el `npm run emoji -- <código>` que lo baja. Pon un `pop` en cada `at`.

### Texto detrás de la persona (`behind`)
`"behind": true` en `title` o en un `item`: la persona queda **delante** del texto (estilo Bog). Requiere `npm run matte -- NOMBRE` **después de escribir el plan**: solo recorta los tramos con `behind` (+0.5 s antes), así que tarda ~10 s por cada segundo marcado, no el video entero. Si cambias esos tiempos, el validador pide volver a correrlo (si ya cubre lo pedido, no repite trabajo). Sin `y`, la altura sale **sola** de la posición de la cabeza en esos frames (el texto cruza la parte alta de la cabeza); `y` explícito manda. **Mira el preview**: el texto debe leerse con ≤ 1/3 tapado; si la cabeza lo tapa de más, sube `y` (menor número); si no la toca, bájalo. Úsalo en 1–2 momentos por video, no en todo.

## Motion (beats) — `strategy: "motion"` y `"voice"`

En `voice` el formato es el mismo, pero los bloques cubren todo el video sin huecos (ver `edit-voice`).

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
