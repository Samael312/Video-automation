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

```json
{"kind": "item", "n": 1, "text": "actually", "start": 2.6, "end": 4.4}
```
**Ítem de lista numerada** (estilo Ela): cuadrito azul con el número (1–10) que entra con rebote + texto crema que se escribe. Arriba (y 190) por defecto; mientras está, los subtítulos se esconden. Úsalo con ganchos tipo "3 palabras…": un ítem al empezar cada una (`start` = la palabra − 0.1, 1.5–2.5 s). `y` opcional.

```json
{"kind": "chat", "start": 12.6, "end": 17.4, "messages": [
  {"text": "Why are you red?", "side": "left"},
  {"text": "I'm so embarrassed!", "side": "right", "at": 13.4}]}
```
**Burbujas de chat** (tipo iMessage): `left` = gris (recibido), `right` = azul (enviado). 1–4 mensajes; cada uno aparece en su `at` (segundo original, entre start y end) o escalonado cada 0.8 s. Abajo (y 720) para no tapar la cara. Úsalo para **diálogos en inglés** que la profe cuenta o ejemplifica. Sin emojis dentro del texto (la fuente no los tiene). Pon un `pop` en cada `at`.

### Texto detrás de la persona (`behind`)
`"behind": true` en `title` o en un `item`: la persona queda **delante** del texto (estilo Bog). Requiere `npm run matte -- NOMBRE` (~3–4 min por 20 s de video; el validador avisa si falta). Por defecto baja el texto para que cruce la parte alta de la cabeza (título y 330, ítem y 340). **Mira el preview**: el texto debe leerse con ≤ 1/3 tapado; si la cabeza lo tapa de más, sube `y` (menor número); si no la toca, bájalo. Úsalo en 1–2 momentos por video, no en todo.
