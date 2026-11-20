---
name: edit-script
description: Genera guiones para TikToks de la profe de inglés a partir de una petición libre (una temática, una cantidad, o ambas). Reparte los guiones en subtemas y formatos distintos para que ninguno se parezca. Úsala cuando el usuario pida guiones o ideas de videos. Uso: /edit-script quiero hacer videos de temática navideña · /edit-script dame 10 guiones para 10 videos
---

# edit-script: guiones variados a partir de una frase

No edita video. Escribe guiones listos para que la profe los lea y se graben (nota de voz o cámara), en el formato que ya usa `edit-voice`.

Antes de escribir, lee `.claude/skills/video-base/brand.md` (público, tono, ganchos, cierres), `.claude/skills/video-base/caption.md` (caption y hashtags) y `.claude/skills/video-base/templates.md` (plantillas de escena disponibles). Si algo contradice a esta skill, gana `brand.md`.

Contexto: la cuenta estuvo inactiva mucho tiempo, así que importa publicar con constancia (3-5 videos por semana) y que cada video se vea distinto. Por eso variar formatos, ganchos y estilo de edición es parte del trabajo.

## 1. Entender la petición (sin preguntar de más)
La entrada es lenguaje libre. Saca tres cosas:
- **Temática**: "navideña", "viajes", "trabajo"... Si no hay, usa una mezcla de temas útiles y variados (comida, trabajo, viajes, redes, emociones).
- **Cantidad**: "10 guiones", "6 videos". Si no hay, **5**.
- **Largo**: por defecto **corto**. Si dice "más largos", "largos", "medios", "de 30 segundos", "de un minuto", "con más explicación", etc., usa **medio** o **largo** (ver tabla en el paso 3). Si pide algo concreto ("de 40 segundos"), elige el modo más cercano. Un mismo pedido puede mezclar largos ("3 cortos y 2 largos"); si no lo dice, todos del mismo modo.

Decide y entrega. Solo pregunta si falta algo que no puedes suponer (por ejemplo, nada de contexto y el usuario pide algo ambiguo).

## 2. Repartir en subtemas y formatos distintos
Con una sola temática, **no escribas N variaciones de lo mismo**. Reparte la cantidad entre subtemas y formatos. Reglas:
- Cada guion usa un **formato distinto** al anterior (ningún formato más de 2 veces si N ≤ 10).
- Cada guion tiene un **subtema distinto** dentro de la temática.
- Mezcla estrategias de edición: algunos 100 % motion (`edit-voice`), otros con cámara (`edit-captions` / `edit-mixed`).
- Con 5 o más guiones, al menos uno usa una plantilla nueva (`before-after`, `versus`, `listen` o `countdown`).

Formatos disponibles (elige según encaje con la temática):

| Formato | Forma del guion | Cómo lo puede mostrar la edición |
|---|---|---|
| Vocabulario con número | "3 palabras que debes conocer…" (2-5 ítems) | `countdown` o un `item` por palabra |
| Error común | "No digas X, di Y" + por qué | `mistake` |
| Falso amigo | "X no significa Y, significa Z" | `false-friend` |
| Idiom | expresión + significado + ejemplo | `example` |
| Phrasal verb | verbo + partícula + ejemplo | `example` |
| Frases para sonar nativo | "en vez de X, di Y" (mejora, no error) | `before-after` |
| Comparación | dos formas: UK/US, formal/informal, A o B | `versus` |
| Reto de oído | dice una frase rápida, pregunta qué entendiste y la explica | `listen` |
| Pronunciación | palabra + cómo suena + error típico | `pronounce` |
| Mini-historia / diálogo | 3-4 líneas de chat o escena | `chat` (overlay) |
| Quiz | pregunta + opciones + respuesta al final | `quiz` |
| Dato curioso / origen | "¿Sabías que…?" | `translate` / `example` |

### Lo que la edición puede hacer (escribe pensando en ello)
Tú solo escribes el guion; la edición (otras skills) lo convierte en video. Conocer sus recursos hace que el guion rinda más:
- **Escenas a pantalla completa** (1-8 s) en los momentos clave: `translate`, `false-friend`, `pronounce`, `mistake`, `example`, `quiz`, y las nuevas `before-after`, `versus`, `listen` y `countdown`. Cada idea que merezca escena debe ser una frase clara y separada, no mezclada con otra. `countdown` pide 2-5 ítems dichos uno tras otro; `versus` y `before-after` piden dos frases claramente separadas ("en Reino Unido dicen X; en Estados Unidos, Y"); `listen` pide que la profe diga la frase en inglés y luego la explique; `quiz` pide opciones cortas y que ella diga la respuesta al final.
- **Hook en pantalla** (≤ 40 caracteres) en los primeros ~2 s sobre el video oscurecido, y después el título: el primer enunciado del guion debe ser fuerte y cortable ("No digas Christmas night", "3 errores que cometes").
- **Palabras en inglés** reciben zoom, label con flecha, emoji y sonido solos. Dilas claras y de una en una, y repite la clave una vez; así la edición las puede marcar.
- **Una cosa nueva cada ~3 s**: las ideas cortas y encadenadas se montan con cortes rápidos (jump-cut con zoom), escenas y overlays. Evita párrafos largos de una sola idea.
- **Listas numeradas**: dichas con "uno, dos, tres" o "número uno…", cada ítem se ve como overlay numerado o en `countdown`.
- **Diálogos**: si hay una conversación, escribe 3-4 líneas cortas, alternando quién habla; se muestran como burbujas de chat.
- **Quiz**: la respuesta se revela con cuenta atrás; escribe "tienes tres segundos" y que la profe diga la respuesta justo al final.
- **Cierre**: el texto final (CTA) aparece escrito en pantalla; ponlo corto, y si hay open loop, que la última frase lo cierre y conecte con el gancho.
- **Música y sonidos**: hay música de fondo (curiosa, alegre, calmada o dramática) que baja cuando ella habla, y efectos automáticos. No escribas nada sobre sonido en el guion.

Ejemplo, "temática navideña" con 6 guiones: vocabulario navideño (3 palabras), falso amigo (*carol / carrol*), idiom de fiestas, frases para felicitar como nativo, pronunciación (*Christmas*, la *t* muda), quiz de villancicos.

## 3. Estructura de cada guion
- **Gancho (primeros 2 s)**: una frase corta que provoca curiosidad o corrige un error. Nunca saludo ni presentación. Debe funcionar también escrita en pantalla (≤ 40 caracteres si se puede).
- **Desarrollo**: frases cortas y un ejemplo en inglés por idea; cuántas ideas depende del largo (tabla de abajo).
- **Open loop** cuando encaje: promete algo que se resuelve al final ("al final te digo el error más típico").
- **CTA** al final, de `brand.md` ("¿Cuál conocías?", "Escribe una frase con ella").
- **Longitud** (una persona habla ~2.5 palabras por segundo; nunca te pases del máximo del modo):

| Modo | Palabras | Duración | Ideas / ejemplos | Cuándo |
|---|---|---|---|---|
| **corto** (defecto) | 40-65 (máx. 80) | 15-25 s | 1-3 ideas, 1 ejemplo por idea | casi siempre; rinde mejor para alcance |
| **medio** | 80-110 (máx. 125) | 30-45 s | 3-4 ideas, 2 ejemplos por idea | reglas con matices, comparaciones, historias |
| **largo** | 120-160 (máx. 175) | 45-65 s | 4-6 ideas, un mini-resumen o repaso al final | explicaciones completas, listas de 5 |

  En `medio` y `largo` el ritmo importa más: **vuelve a enganchar a mitad del video** con una frase que renueve la curiosidad ("ahora viene lo importante", "y este es el error que casi nadie nota"), alterna ideas y ejemplos (nada de bloques largos de una sola idea), usa más escenas (hasta 4-5 en `largo`, siempre separadas por la profe en cámara o un cambio de ritmo) y deja el open loop abierto hasta casi el final. La lista numerada puede llegar a 5 ítems. No alargues repitiendo: añade ideas, ejemplos o un repaso útil.
- **Solo lo que ella dice**: sin indicaciones de edición, sin "(pausa)", sin emojis, sin títulos. Un párrafo corto por idea. El inglés bien escrito; el español neutro y cercano, como en `brand.md`.
- No inventes datos. Si no estás seguro de una etimología o un uso, no lo incluyas.

## 4. Archivos que entregas
Cada petición crea **una carpeta de plan** dentro de `media/input/`, con todo adentro:

```
media/input/<PLAN>/
  plan.json          datos del plan (lo lee la web local; ver esquema)
  PLAN.md            el mismo plan legible: tabla, orden de publicación, ganchos y captions
  <NOMBRE>.txt       un guion por video
```

- **`<PLAN>`** = nombre de la carpeta: la temática en MAYÚSCULAS con guion bajo, sin acentos ni espacios, corto (`NAVIDAD`, `GRAMATICA`; si la temática es variada, `VARIADOS_<AAAAMMDD>`). Si ya existe una carpeta con ese nombre, usa `<PLAN>_2`, `<PLAN>_3`…: **nunca escribas en una carpeta existente ni sobrescribas nada**.
- **`<NOMBRE>.txt`** = el guion de un video, en MAYÚSCULAS con guion bajo, sin acentos, corto (`NAVIDAD_3_PALABRAS`). Debe ser **único en todo `media/input/`** (el pipeline guarda sus archivos por este nombre): antes de escribir, busca en todas las subcarpetas de `media/input/`, en `public/*.edit.json` y en `public/*.txt`; si existe, usa otro.
- **`plan.json`** (JSON válido, sin comentarios; un objeto por video en `videos`, y `orden` con los `nombre` en el orden de publicación recomendado):

```json
{
  "titulo": "Navidad",
  "tema": "videos de temática navideña",
  "creado": "2026-11-20",
  "orden": ["NAVIDAD_QUIZ_RENO", "NAVIDAD_3_PALABRAS"],
  "videos": [
    {
      "nombre": "NAVIDAD_3_PALABRAS",
      "formato": "Vocabulario con número",
      "largo": "corto",
      "gancho": "Tres palabras de Navidad que casi nadie te enseña.",
      "ganchos": ["Gancho A (el elegido)", "Gancho B", "Gancho C"],
      "estrategia": "edit-voice",
      "duracion": "~18 s",
      "caption": "El caption recomendado, sin los hashtags.",
      "hashtags": ["#inglés", "#aprenderinglés", "#navidad", "#vocabulario"],
      "notas": "Lo que conviene revisar o tener en cuenta al grabar (opcional)."
    }
  ]
}
```

- **`PLAN.md`**: tabla con una fila por video (nombre del archivo, formato, **largo** —corto, medio o largo—, gancho, estrategia recomendada —`edit-voice`, `edit-mixed`, `edit-captions` o `edit-motion`— y duración estimada), el orden sugerido de publicación, los 3 ganchos de cada video y su caption con hashtags, y las notas.

Cada video trae **3 variantes de gancho** (A/B/C) para que el usuario elija o pruebe, y un **caption recomendado con 4-6 hashtags** según `caption.md`. Todo lo que pongas en `plan.json` debe coincidir con `PLAN.md` y con el guion.

## 5. Mensaje final
Di el nombre de la carpeta creada, muestra la tabla del plan y los guiones completos, sin repetirlos en prosa. Indica qué sigue por video:
- Guion con nota de voz → deja la nota de voz **dentro de la misma carpeta del plan**, con el nombre del guion, y usa `/edit-voice media/input/<PLAN>/NOMBRE.m4a`.
- Con cámara → el video en esa misma carpeta (`/edit-router media/input/<PLAN>/NOMBRE.mp4`); el `.txt` al lado ayuda al alineado.

Si el usuario pide cambios ("más corto", "cambia el gancho del 3", "otro formato para el 5"), edita solo ese archivo y su entrada en `plan.json` y `PLAN.md`.
