---
name: edit-voice
description: Hace un TikTok 100 % motion graphics (estilo media/reference/motion/m_1.mp4) a partir de un guion de texto y una nota de voz de la profe leyéndolo, sin cámara. Úsala cuando la entrada es solo audio (.m4a, .mp3, .ogg, .opus, .wav) con su guion NOMBRE.txt al lado. Uso: /edit-voice media/input/NOMBRE.m4a
---

# edit-voice: guion + nota de voz → todo motion

**Primero carga la skill `video-base` y sigue su flujo completo.** Esta skill cambia el paso 1 (entrada) y el paso 3 (planificar). Para elegir layouts y escribir beats usa la sección "Paso 3" de la skill `edit-motion` (tabla de layouts, reglas de `key`/`lead`, emojis 3D, tiempos); el JSON de cada layout está en `video-base/templates.md` → "Motion (beats)".

## Qué se busca
Todo el video es motion: bloques de 3–8 s **seguidos, sin huecos**, con beats de 0.5–2 s que siguen la voz. No hay cámara: el gancho y el CTA también son motion. La voz nunca se corta.

**La referencia `m_1` da solo el estilo.** Emojis, objetos y textos salen **del guion**: lo que ella dice en ese beat.

## Paso 1 (reemplaza al de video-base)
1. Comprueba que existe el guion `media/input/NOMBRE.txt` (mismo nombre que el audio, misma carpeta). Si falta, **para** y dile al usuario: "falta el guion NOMBRE.txt junto al audio".
2. `npm run edit -- media/input/NOMBRE.m4a --plan-only`. Convierte el audio en `public/NOMBRE.mp4` (fondo plano), limpia la voz, transcribe, **alinea con el guion** y corta silencios.
3. Lee la línea `coincidencia X %` del paso "alinear con guion". Si el paso falla con "el audio no parece leer este guion", para y muéstrale al usuario las diferencias: o el guion no es de este audio, o ella improvisó.
4. `npm run inspect -- NOMBRE` como siempre. El texto ya viene del guion (inglés bien escrito).

## Paso 3 (reemplaza al de video-base)
1. Escribe `public/NOMBRE.edit.json` con `"strategy": "voice"` y **sin** `title` ni `end` (quedarían tapados por el motion).
2. `npm run draft-motion -- NOMBRE` arma bloques contiguos que cubren todo el audio, con fondos alternos y el último oscuro.
3. Enriquece **cada beat** siguiendo la tabla de `edit-motion`. Usa el guion para entender la intención: qué es lista, qué es traducción, qué es el ejemplo.
4. **Gancho:** el primer beat (en 0) es la frase-gancho del guion (la primera frase o la pregunta) con `big` o `word`, la `key` más fuerte que puedas.
5. **CTA:** el último bloque es `bg: "dark"` y muestra lo que ella pide al final ("sígueme", "cuéntame en comentarios…") con `word` o `big`.
6. Fondos: alterna `light`/`dark` entre bloques; nunca 3 seguidos iguales.
7. Si mueves un límite de bloque, el siguiente debe empezar donde termina el anterior: en `voice` un hueco es **error** (se vería el fondo vacío).
8. Emojis: `npm run emoji -- --3d <emoji…>` como en `edit-motion`.

## Validar y revisar
- `npm run validate -- NOMBRE`: corrige todos los errores (en especial `hueco A–B s sin bloque`). Lee los AVISOS (inicio en 0, último oscuro, fondos repetidos, beats largos, layouts repetidos) y corrígelos salvo que tengas una razón.
- `npm run preview -- NOMBRE`: una captura por beat. Revisa que cada una muestre lo que ella dice en ese momento.

## Resumen para el usuario (además del de video-base)
```
Guion: coincidencia X % (n reemplazos)
Motion: 100 % — <n> bloques, <n> beats
Gancho: <layout> "<key>"   CTA: <layout> "<key>"
Bloques:
  1. 0.0–Y.Y s (light): big "plot twist" → word … 
Layouts usados: word ×n, prop ×n, …
```
En el resumen de video-base, las líneas de gancho/cierre/subtítulos se reemplazan por estas.

## Qué evitar
- Huecos entre bloques.
- `title`, `end`, `scenes` u `overlays`: en voice todo va en beats.
- Beats que no coinciden con lo que ella dice.
- Emojis o recursos de `m_1` que no salen del guion.
