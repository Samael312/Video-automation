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
