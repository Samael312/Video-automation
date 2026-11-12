# Editor automático de TikToks — Diseño

Fecha: 2026-11-12

## Objetivo
Automatizar la edición de TikToks (9:16) para una profesora particular de inglés online. Entra un video de la profe hablando; sale un video editado, dinámico y llamativo, sin editar `styledConfig.ts` a mano.

## Supuestos
- Formato 9:16, idioma principal español con palabras clave en inglés.
- Todo local y gratuito (sin APIs de pago). El tiempo de procesamiento no es problema.
- Stack existente: Remotion 4.0.543 + WhisperX + ffmpeg. Video de prueba: `ACTUALLY.mp4`; estilo de referencia: `Referencia.mp4`.

## Dependencias instaladas
`@remotion/transitions`, `lottie`, `motion-blur`, `shapes`, `layout-utils`, `paths` (4.0.543, misma versión que `remotion`). `@remotion/captions` ya estaba. No se usa `auto-editor`.

## Arquitectura
Pipeline donde cada paso lee/escribe un archivo, para probarlo y repetirlo por separado:

```
video.mp4
  1 transcribe → words.json   (WhisperX medium + initial_prompt de vocabulario)
  2 cut        → cuts.json    (silencios por gaps de words.json + ffmpeg silencedetect; mapa tiempo original→nuevo)
  3 plan       → edit.json    (reglas + IA: labels, emojis, sfx, escenas)
  4 render     → Remotion (estilo + plantillas + escenas IA) → output.mp4
```

### 1. Transcripción
- Modelo `medium` por defecto, configurable por estilo/video (`large-v3` opcional). CPU `int8`.
- `initial_prompt` con vocabulario de la profe para no deformar palabras en inglés.
- `words.json` editable a mano antes de renderizar. Aviso si la confianza es baja.

### 2. Cortes
- Detectar pausas largas (umbral configurable; las pausas dramáticas intencionales, ~1 s, se pueden conservar) y recortarlas con ~0.1 s de colchón.
- Producir un mapa de tiempos original→nuevo; subtítulos, labels, emojis y sfx se remapean con él.
- Sfx sutil en cada corte.

### 3. Subtítulos
- `createTikTokStyleCaptions` de `@remotion/captions`, palabra activa resaltada.
- Entrada con `spring`; sin el `+0.25 s` fijo (termina en el inicio de la siguiente frase).

### 4. Estilos
- `src/styles/<nombre>/`: colores, fuentes, subtítulos, transiciones, sfx. "Referencia" es el primero.
- Más adelante, un skill por estilo.

### 5. Dinamismo
- Algo pasa cada ~3 s: zoom (punch-in) en palabras clave, emoji, sfx o cambio de plano.
- Transiciones con `@remotion/transitions` + swoosh.

### 6. Plantillas de motion graphics
| Plantilla | Muestra |
|---|---|
| `translate` | palabra en inglés → traducción, flecha, emoji |
| `false-friend` | A ≠ B (actually ≠ actualmente) |
| `pronounce` | palabra, sílabas, pronunciación fonética |
| `mistake` | ❌ frase mal → ✅ frase bien |
| `example` | oración con palabra clave resaltada, aparece palabra por palabra |
| `quiz` | pregunta, 2–3 opciones, cuenta regresiva, reveal |

### 7. Corte a animación
Cuando un tramo es explicativo: la persona se oculta, entra la plantilla con la voz original de fondo y los subtítulos; al terminar vuelve la persona en primer plano.

### 8. Plan automático
- Reglas marcan tramos explicativos (p. ej. tras "no significa", "se dice", "ejemplo").
- Salida: `scenes: [{type, start, end, data}]`. Si ninguna plantilla encaja: `type: "generated"` → se escribe un componente en `src/scenes/generated/` (registro automático). Si no se puede, queda marcada pendiente.
- `quiz` pensado para cerrar el video y empujar comentarios.

## Errores
- Transcripción de baja confianza → aviso y corrección manual de `words.json`.
- Sin plantilla aplicable → escena pendiente, no se inventa.
- El render falla si audio/video se desincronizan >1 frame.

## Pruebas
- `vitest` para el mapa de cortes y el armado de subtítulos.
- Visual: `scripts/verify.js` + comparación con `Referencia.mp4`.

## Orden de construcción
1. Transcripción `medium` + cortes de silencio con mapa de tiempos
2. Subtítulos con resaltado de palabra
3. Transiciones, zoom y sfx en cortes
4. Las 6 plantillas + corte a animación y vuelta a la persona
5. Plan automático + escenas IA
6. Skill por estilo
