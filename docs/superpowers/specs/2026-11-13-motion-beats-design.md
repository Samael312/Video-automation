# Motion por beats (estrategia `motion` v2) — Diseño

Fecha: 2026-11-13. Continúa `2026-11-12-edit-skills-design.md` (skills `edit-*` implementadas y mergeadas).

## Problema
Plot_Twist editado con `edit-mixed` y con `edit-motion` sale casi igual. Las dos estrategias usan las mismas tarjetas oscuras fijas de 2–4 s (palabra → flecha → traducción → emoji chico); solo cambia cuánto rato salen. No hay lenguaje de motion graphics.

## Referencia de estilo
`media/reference/motion/m_1.mp4` (576×1024, 41.5 s). Se toma **solo el estilo**:
- Plano nuevo cada ~1 s; nada queda quieto.
- Tipografía cinética sincronizada a la voz: sans chica de entrada ("Parece una") + palabra clave grande en serif cursiva ("*tontería*"); resaltador amarillo; tachados.
- Objetos grandes con sombra y desenfoque de profundidad; puntos borrosos flotando; fondo claro gris/blanco con interludios negros.
- Cámara viva (empuje, golpes de zoom), entradas con blur, cortes secos.

**Los recursos (emojis, objetos, textos) NO se copian de m_1**: salen del contenido del video de la profe. Un cerebro, candado o reloj solo aparece si ella habla de eso.

## Decisiones del usuario
- La profe **no se recorta**: el video intercala bloques de motion a pantalla completa con la profe en cámara completa.
- Objetos = **emojis 3D Microsoft Fluent** (MIT) grandes. Sin imágenes IA.
- Paleta **clara como m_1** + crema `#FCF4B0` de resaltador; Playfair cursiva + Poppins (marca actual).
- Enfoque: **motor de beats** con borrador automático que la skill enriquece.

## Estructura del video (`strategy: "motion"`)
- Gancho: profe en cámara + `title` (como hoy). Ningún bloque en los primeros ~2.5 s.
- Medio: **bloques** de motion de 3–8 s; dentro, **beats** de 0.5–2 s que se suceden sin pausa. Entre bloques, 1–3 s de profe.
- Cierre: profe en cámara + `end` (CTA). Ningún bloque después de `end.start`.
- Objetivo: motion ≈ 60–75 % de la duración final.

## Formato en el plan
Campo nuevo opcional `motion` en `EditPlan` (sigue `version: 1`):

```json
"motion": {
  "blocks": [
    {"start": 3.1, "end": 9.4, "bg": "light",
     "beats": [
       {"at": 3.1, "layout": "word", "lead": "palabra", "key": "plot twist"},
       {"at": 4.0, "layout": "prop", "emoji": "1f631", "lead": "te deja en", "key": "shock"},
       {"at": 5.6, "layout": "list", "items": ["plot twist", "cliffhanger", "page turner"], "active": 0}
     ]}
  ]
}
```

- Tiempos en segundos del video **original** (como el resto del plan).
- `block.start/end`: dentro de un solo tramo conservado; sin solapes entre bloques ni con `scenes`.
- `block.bg`: `"light"` | `"dark"`.
- `beat.at`: inicio del beat; el beat dura hasta el siguiente `at` o hasta `block.end`. El primer beat empieza en `block.start`. `at` se alinea al inicio de una palabra del transcript.
- `lead`: texto chico (Poppins) cuyas palabras aparecen una a una en su tiempo del transcript (las que caen dentro del beat; si no hay coincidencia, todas juntas al entrar).
- `key`: palabra/expresión fuerte (Playfair cursiva, grande, resaltador crema que barre).
- Con `motion` presente, `scenes` puede seguir vacío; las plantillas actuales siguen sirviendo a `mixed` y `captions`.

## Layouts (lista cerrada; si nada encaja → `word`)

| layout | Se ve | Campos (negrita = obligatorio) |
|---|---|---|
| `word` | `lead` chico arriba, `key` grande cursiva | `lead`, **`key`** |
| `prop` | emoji 3D grande al centro, sombra, flota; texto arriba o abajo | **`emoji`**, `lead`, `key`, `pos` (`top`\|`bottom`) |
| `ring` | emoji dentro de círculo de borde discontinuo que gira | **`emoji`**, `lead`, `key` |
| `list` | pastillas numeradas que entran una a una; `active` en crema, anteriores atenuadas | **`items`** (2–5), `active`, `title` |
| `strike` | items que se tachan con línea animada; el último queda en pie | **`items`** (2–4) |
| `swap` | `from` → se tacha → `to` (mal→bien o inglés→español) | **`from`**, **`to`**, `lead` |
| `card` | tarjeta oscura tipo player o móvil con texto dentro | **`key`**, `lead`, **`frame`** (`player`\|`phone`) |
| `big` | una palabra/número enorme sobre negro con blur | **`key`** |

`generated` sigue disponible como escena (`scenes`) para casos raros.

### Reglas visuales comunes
- Entrada de beat: blur 12px→0, escala 0.92→1, leve subida, 6–8 frames. Salida: corte seco.
- Resaltador crema detrás de `key` que barre de izquierda a derecha.
- Motion blur suave en entradas (`@remotion/motion-blur`).
- Contenido entre y≈200 y y≈1000 (composición `Edit` = 720×1280); texto largo se achica solo (como las plantillas actuales).

## Fondo, cámara, transición, sonido
- **Fondo de bloque** (fijo durante el bloque; solo cambian los beats):
  - `light`: `#EEEDF0` con viñeta suave + puntos grises desenfocados flotando lento.
  - `dark`: `#111` con los mismos puntos tenues.
  - Objetos de profundidad: 1–2 emojis del propio bloque (tomados de sus beats), grandes y muy borrosos, entrando por esquinas. Si el bloque no tiene emojis, no hay objetos.
- **Cámara**: empuje lento 1.00→1.06 por bloque + golpe de zoom 1.04 en cada cambio de beat.
- **Transición**: entrada al bloque con wipe circular desde el centro (8 frames); salida a la profe con corte seco.
- **Sonido**: swoosh al entrar al bloque; tick suave al cambiar de beat, como máximo 1 cada 0.5 s.
- **Subtítulos**: ocultos dentro de los bloques (el texto cinético los reemplaza); normales con la profe en cámara.

## Emojis 3D
- `npm run emoji -- --3d <emoji o código...>` descarga de Microsoft Fluent Emoji (3D PNG, MIT) a `public/emoji3d/<código>.png`, con el mismo código que Noto (`1f631`).
- Fluent nombra carpetas por nombre CLDR, no por código. Índice código→PNG: árbol del repo (GitHub API, commit fijo `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc`) + nombres de `emoji-test.txt` de Unicode 15.1; se guarda en `.cache/fluent3d-index.json` (ignorado por git). Cubre ~1558 de 1898 emojis.
- Descarga por `raw.githubusercontent.com` al mismo commit (jsDelivr rechaza el repo por tamaño).
- Si Fluent no lo tiene: avisa, baja el Noto (si falta) y lo **copia** a `public/emoji3d/<código>.png`. Así el render siempre lee `emoji3d/`.

## Borrador automático
`npm run draft-motion -- <video>`:
- Lee transcript, cortes y el plan actual (`public/<video>.edit.json`, si existe, conserva title/end).
- Propone bloques en los tramos del medio (después de 2.5 s, antes de `end.start`), de 3–8 s, dejando ≥1 s de profe entre bloques, hasta ~65 % de motion.
- Dentro de cada bloque: beats cada 2–4 palabras, cortando en pausas y puntuación; todos `layout: "word"`, `key` = última palabra del grupo, `lead` = el resto.
- Escribe `motion` en el plan con `strategy: "motion"`. No toca otros campos.

## Validación (`validatePlan`)
Errores:
- bloque fuera de un tramo, solapado con otro bloque o con una escena;
- beat fuera de su bloque, `at` no creciente, primer `at` ≠ `block.start` (tolerancia 0.05 s);
- beat < 0.4 s;
- layout desconocido o campo obligatorio ausente/mal tipado;
- emoji de un beat que no existe en `public/emoji3d`.

Avisos (no bloquean; `validate` los imprime aparte):
- beat > 2.5 s ("divídelo");
- 3 layouts iguales seguidos;
- < 1 s de profe entre dos bloques;
- motion < 50 % o > 80 % de la duración final;
- bloque en los primeros 2.5 s o después de `end.start`.

`validatePlan` sigue devolviendo `string[]` de errores; los avisos salen de una función aparte `motionWarnings(plan, ctx)`.

## Skill `edit-motion` (reescritura)
1. `video-base` pasos 1–2 (plan-only, inspect).
2. `npm run draft-motion -- <video>`.
3. Recorrer cada beat y decidir:
   - layout según lo que dice la profe: enumera → `list`; "no es X / no se dice X" → `strike` o `swap`; traducción → `swap`; cifra o palabra muy fuerte → `big`; objeto, lugar o emoción → `prop`/`ring`; cita, serie, app → `card`; resto → `word`;
   - `key` = la palabra fuerte del beat;
   - emoji = algo que la profe nombra o ilustra **en ese beat**; nunca recursos de la referencia.
4. `npm run emoji -- --3d <códigos>` para los que falten.
5. `validate` (sin errores; avisos revisados) → `preview` → aprobación → `render:plan`.
6. Resumen: % motion, nº de bloques y beats, layouts usados.

`video-base/templates.md` gana una sección "Motion (beats)" con la tabla de layouts y el JSON exacto de cada uno.

## Código

| Archivo | Responsabilidad |
|---|---|
| `src/lib/motion.ts` | tipos `MotionPlan/Block/Beat`, validación, avisos, tiempos de beats (puro, testeado) |
| `src/lib/draftMotion.ts` + `scripts/draft-motion.ts` | borrador (puro + CLI) |
| `src/motion/MotionLayer.tsx` | secuencia de bloques: fondo, cámara, wipe, sonido, beats |
| `src/motion/Background.tsx` | fondo claro/oscuro, puntos, objetos de profundidad |
| `src/motion/layouts/*.tsx` | un archivo por layout + `index.ts` (registro) |
| `src/motion/primitives.tsx` | entrada blur/escala, resaltador, texto por palabras, emoji 3D |
| `src/lib/plan.ts` | `motion?` en `EditPlan`; `validatePlan` llama a la validación de motion |
| `src/lib/emoji.ts` + `scripts/emoji.ts` | opción `--3d` (Fluent) |
| `src/Edit.tsx` | pinta `MotionLayer`; oculta captions dentro de bloques |
| `src/compositions/MotionGallery.tsx` + `Root.tsx` | los 8 layouts en una composición para revisión visual |
| `scripts/validate.ts`, `scripts/preview.ts` | imprimir avisos; capturas por beat |
| `.claude/skills/edit-motion/SKILL.md`, `.claude/skills/video-base/templates.md` | docs |

## Pruebas
- Vitest: validación de motion (cada error y aviso), `beatSpans`, borrador (alineación a palabras, límites de bloque, % motion), resolución Fluent código→nombre.
- `MotionGallery` en el studio para revisión a ojo de los 8 layouts en claro y oscuro.
- E2E: re-editar Plot_Twist con la skill nueva; comparar su hoja de contactos con la versión mixed y con m_1.

## Fuera de alcance
Recortar a la profe (matte), imágenes IA, cambios en `edit-mixed` / `edit-captions`, nuevos estilos de marca.
