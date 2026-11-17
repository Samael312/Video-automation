# Manual de uso: editor automático de TikToks

Este proyecto edita los videos de la profe de inglés para TikTok (720x1280, 30 fps): corta silencios, pone subtítulos animados, zoom, labels, emojis, escenas animadas y sonidos. Todo corre en tu PC y es gratis.

Tú le pasas un video a Claude Code con una skill. Claude escribe un **plan de edición**, te muestra una hoja de capturas y, **solo si dices que sí**, renderiza el video final.

---

## 1. Instalación (una sola vez)

Necesitas: Node 18+, Python 3.10+, ffmpeg en el PATH, y Claude Code.

```bash
npm install
python -m venv .venv
.venv\Scripts\pip install -r pipeline\requirements.txt
copy .env.example .env      # y pon tu HF_TOKEN (ver abajo)
npm run setup-audio -- --yes   # descarga DeepFilterNet (~30 MB) para limpiar la voz
npm run verify              # revisa ffmpeg, venv, Remotion y DeepFilterNet
```

**`HF_TOKEN`**: token gratis de Hugging Face (huggingface.co → Settings → Access Tokens, tipo *read*). Hace falta para separar voces. Acepta también las condiciones del modelo `pyannote/speaker-diarization-community-1` en su página de Hugging Face. El `.env` no se sube a git; no lo compartas.

La primera transcripción descarga el modelo WhisperX `medium` (~1.5 GB) y tarda varios minutos. Después es más rápido.

---

## 2. Flujo diario

1. Copia el video grabado a `media/input/` (por ejemplo `media/input/IDIOM1.mp4`). Sirve también `.mov` del iPhone (incluso HDR): se pasa solo a 720x1280, 30 fps y colores normales. El resultado siempre es `.mp4`.
2. Abre Claude Code en la carpeta del proyecto.
3. Escribe **una** de estas skills con la ruta del video:

| Si no sabes qué estilo usar | `/edit-router media/input/IDIOM1.mp4` |
|---|---|
| Profe siempre en cámara | `/edit-captions media/input/IDIOM1.mp4` |
| Escenas animadas protagonistas | `/edit-motion media/input/IDIOM1.mp4` |
| Mezcla (1–3 escenas) | `/edit-mixed media/input/IDIOM1.mp4` |

4. Claude transcribe, corta y escribe el plan. Luego te muestra:
   - un **resumen** (gancho, escenas, overlays, cierre, duración), y
   - la **hoja de capturas** `media/output/IDIOM1_preview.png`.
5. Revisa. Responde **"sí"** para renderizar o pide cambios (ver sección 4).
6. Resultado: la carpeta `media/output/edited/IDIOM1/` con `IDIOM1_edited.mp4`, listo para subir, y `IDIOM1_caption.txt` con el caption (3 opciones) y los hashtags para TikTok. Claude te pega el recomendado al terminar. Al terminar se borran solos los temporales y la hoja de preview.

No hace falta llamar a `video-base`: cada skill la carga sola.

> Las skills del proyecto se cargan al abrir Claude Code. Si acabas de actualizar el repo, abre una sesión nueva.

---

## 3. Qué hace cada skill

### `/edit-router` — elige por ti
Transcribe, lee lo que dice la profe y detecta el formato. Te muestra la evidencia (frases con su segundo) y recomienda una estrategia. **Espera tu confirmación** y sigue con la skill elegida.

| Formato del video | Estrategia |
|---|---|
| ¿Sabías que?, curiosidades, falsos amigos, idioms, phrasal verbs, vocabulario | `edit-mixed` |
| Gramática, reglas, pronunciación | `edit-motion` |
| Frases para sonar más nativo | `edit-captions` (o `edit-mixed`) |

### `/edit-captions` — la profe siempre en cámara
Sin escenas. Subtítulos rápidos, un label con flecha para cada palabra en inglés, otro con su traducción, un emoji por idea y zoom en las palabras clave. Ideal para videos cortos o cuando la profe actúa mucho.

### `/edit-motion` — las escenas explican
Estilo de `media/reference/motion/m_1.mp4`: **bloques** de motion graphics a pantalla completa (3–8 s) intercalados con la profe en cámara. Dentro de cada bloque, un plano nuevo cada ~1 s: texto que aparece al ritmo de la voz, la palabra clave en cursiva con resaltador crema, emojis 3D grandes, listas, tachados, tarjetas tipo reproductor o móvil. La profe sale en el gancho, entre bloques (≥ 1 s) y en el cierre. Los emojis y textos salen de lo que ella dice; la referencia solo da el estilo. Ideal para gramática, reglas, pronunciación y listas de palabras. Para ver los 8 layouts: `npm run studio` → composición `MotionGallery`.

### `/edit-voice` — guion + nota de voz, todo motion
Para videos **sin cámara**. Pon en `media/input/` dos archivos con el mismo nombre:
- `NOMBRE.txt`: el guion, solo lo que ella dice (sin indicaciones de edición).
- `NOMBRE.m4a` (o `.mp3`, `.ogg`, `.opus`, `.wav`): la nota de voz leyéndolo, de una sola toma.

`/edit-voice media/input/NOMBRE.m4a` convierte el audio en un video de fondo plano, limpia la voz, transcribe y **alinea con el guion**: el inglés queda escrito como en el guion y los tiempos salen de la voz. Si la voz no se parece al guion (menos de 70 % de coincidencia), se detiene y muestra las diferencias. Después arma bloques de motion seguidos de principio a fin (gancho y CTA incluidos), estilo `m_1`. Si un video con cámara trae `NOMBRE.txt` al lado, también se alinea con el guion.

### `/edit-mixed` — la profe cuenta, las escenas remarcan
1 a 3 escenas en los momentos clave (traducción, falso amigo, ejemplo) y un **quiz** opcional al final. Entre escenas, labels y emojis. Ejemplo real: `public/ACTUALLY.edit.json`.

### Escenas disponibles
| Escena | Qué muestra |
|---|---|
| `translate` | palabra → traducción (+ emoji) |
| `false-friend` | A ≠ B + nota |
| `pronounce` | sílabas que se iluminan + fonética |
| `mistake` | ❌ frase mal tachada → ✅ frase bien |
| `example` | oración palabra por palabra con la clave resaltada |
| `quiz` | pregunta, opciones, cuenta regresiva y respuesta |
| `generated` | una escena nueva que Claude programa para ese video |

Durante una escena la voz y los subtítulos siguen; solo se tapa la imagen.

### Otros elementos (sin tapar a la profe)
| Elemento | Qué muestra | Ideal para |
|---|---|---|
| label | palabra en serif con flecha | señalar una palabra u objeto |
| emoji | emoji que entra con rebote | emoción de cada idea |
| **item** | 1️⃣ + palabra que se escribe (arriba) | listas: "3 palabras que debes conocer" |
| **chat** | burbujas tipo iMessage, una a una (con emojis) | diálogos en inglés |

**Texto detrás de la profe** (`behind`): el título o un ítem quedan *detrás* de su cabeza, como si ella estuviera delante del texto. Pídelo así: "pon el título detrás de ella". Claude corre `npm run matte -- NOMBRE` (recorta a la profe solo en esos momentos: ~10 s por cada segundo con texto detrás). La altura del texto se calcula sola según dónde está su cabeza; si hace falta, Claude la ajusta mirando el preview.

Los subtítulos van en blanco, frase entera (estilo Ela), y se esconden solos mientras hay un ítem arriba.

---

## 4. Cómo pedir cambios

En la pausa del preview, dile a Claude en palabras normales. Ejemplos:

- "Cambia el gancho por *No digas esto*."
- "Quita el quiz."
- "La escena de library que dure hasta que dice biblioteca."
- "Pon un emoji de libro cuando dice library."
- "Usa edit-captions en vez de mixed."
- "Escribe *embarrassed*, no *embarased*."

Claude edita el plan, lo valida y te da una hoja nueva. Repite hasta que te guste y di "sí".

¿Quieres tocar el plan tú? Es `public/NOMBRE.edit.json`. Los tiempos son segundos del video **original** (los que imprime `npm run inspect`). Después corre `npm run validate -- NOMBRE` y `npm run render:plan -- NOMBRE`.

---

## Audio: voz limpia y música

**Voz limpia (automático).** `npm run edit` limpia la voz antes de transcribir: quita ruido, zumbido y algo de eco (DeepFilterNet), ecualiza suave y deja el volumen a -14 LUFS (nivel de TikTok). El audio original queda en `public/NOMBRE.raw.wav`; correrlo dos veces no limpia lo ya limpio. Para saltarlo: `--no-clean`. Lo que no arregla: grabar lejos del teléfono sin micrófono (un micrófono de solapa barato lo resuelve) y pájaros u otros silbidos.

**Música de fondo.** Pon pistas en `media/music/` con el ánimo al inicio del nombre:

| Ánimo | Ejemplo de nombre | Para |
|---|---|---|
| `curious` | `curious__pluck.mp3` | ¿Sabías que?, curiosidades |
| `upbeat` | `upbeat__pop.mp3` | listas, tips rápidos |
| `calm` | `calm__lofi.mp3` | pronunciación, explicación pausada |
| `dramatic` | `dramatic__tension.mp3` | errores, giros |

Usa solo música con licencia para redes (Pixabay Music, YouTube Audio Library o compradas). Claude elige la pista según el video; suena baja y baja aún más cuando habla la profe. Si vas a publicar con un sonido de TikTok (ayuda al alcance), renderiza sin música: `npm run render:plan -- NOMBRE --no-music`.

**Volumen final.** Después de cada render se mide el volumen y, si hace falta, se ajusta a -14 LUFS sin tocar el video.

---

## 5. Comandos (por si quieres hacerlo a mano)

| Comando | Qué hace |
|---|---|
| `npm run edit -- media/input/X.mp4 --plan-only` | normaliza, transcribe y corta silencios; no renderiza |
| `npm run edit -- media/input/X.mp4` | todo de una vez con el plan por defecto (solo subtítulos + zoom) |
| `npm run inspect -- X` | lista cada palabra con su tiempo, por tramos y cortes |
| `npm run validate -- X` | revisa `public/X.edit.json` y explica cada error |
| `npm run preview -- X` | hoja de capturas `media/output/X_preview.png` (~20 s) |
| `npm run render:plan -- X` | valida y renderiza `media/output/edited/X/X_edited.mp4` y borra sus temporales |
| `npm run render:plan -- X --no-music` | renderiza sin la música del plan |
| `npm run clean -- X` | borra temporales y hoja de preview de X |
| `npm run clean -- --all` | deja `media/output` solo con `edited/` (los videos finales) |
| `npm run reference -- V` (o `--all`) | analiza videos de `media/reference/`: hojas, cortes, ritmo, transcript |
| `npm run matte -- X` | recorta a la profe (fondo transparente) solo en los tramos con `behind`; `--all` todo el video, `--force` rehace |
| `npm run setup-audio -- --yes` | instala DeepFilterNet para limpiar la voz (`--check` solo revisa) |
| `npm run emoji -- 😀` | descarga un emoji Noto a `public/emoji/` |
| `npm run emoji -- --3d 😀` | descarga el emoji 3D (Microsoft Fluent) a `public/emoji3d/` para los beats de motion |
| `npm run draft-motion -- X` | borrador de bloques y beats de motion en `public/X.edit.json` (con `strategy: "voice"` cubre todo el video) |
| `npm run edit -- media/input/X.m4a --plan-only` | nota de voz: la pasa a video de fondo plano y sigue igual (alinea con `X.txt` si existe) |
| `npm run script-align -- X [guion.txt]` | pone el texto del guion sobre los tiempos de la transcripción (original en `public/X.transcript.whisper.json`) |
| `npm run audio-to-video -- audio.m4a public/X.mp4` | solo la conversión de audio a video 720×1280 |
| `npm run studio` | abre Remotion Studio para ver el video en vivo |
| `npm test` | tests de TypeScript |
| `npm run verify` | revisa ffmpeg, venv y Remotion |

---

## 6. La marca de la profe: `brand.md`

Archivo: `.claude/skills/video-base/brand.md`. **Puedes editarlo** y Claude lo obedece por encima de las skills. Contiene:

- público y tono,
- estilo visual,
- lista de **ganchos** (títulos) y **cierres** (CTA),
- emojis frecuentes.

Regla de los títulos: `line1` ≤ 14 caracteres, `line2` ≤ 18. Más largo se sale de la pantalla.

Si la profe estrena una muletilla o un cierre nuevo ("¡Nos vemos en la próxima!"), añádelo aquí.

### Aprender de videos de referencia: `/analyze-reference`

1. Copia los videos a `media/reference/<creadora>/` (una carpeta por creadora, p. ej. `media/reference/Ela/`).
2. Escribe `/analyze-reference` (solo los nuevos) o `/analyze-reference Video2.mp4`. Dile de qué creador son si no es la de siempre.
3. Claude saca fotogramas, cortes, ritmo y transcripción (`npm run reference`), lo compara con el estilo actual y te propone cambios numerados, con el segundo del video como prueba.
4. Tú eliges cuáles aplicar. Lo analizado queda anotado en `.claude/skills/video-base/references.md`.

- **Misma creadora**: se afina el estilo `referencia` (colores, tamaños, ritmo) y se añaden ganchos/cierres a `brand.md` como patrón, en la voz de la profe.
- **Otro creador**: se crea un estilo aparte (`"style": "<nombre>"` en el plan). Se toman ideas, no su marca.

---

## 7. Emojis

Solo se pueden usar los que están en `public/emoji/` (estilo Noto, licencia Apache 2.0). Para añadir uno:

```bash
npm run emoji -- 🎉
```

Imprime el código (p. ej. `1f389`) que va en el plan. Claude lo hace solo cuando lo necesita. No sobrescribe archivos existentes.

---

## 8. Escenas generadas

Si ninguna plantilla sirve (una tabla de verbos, una línea de tiempo), Claude puede programar una escena nueva:

1. crea `src/scenes/generated/<nombre>.tsx` (copiando la forma de `demo.tsx`),
2. la registra en `src/scenes/generated/index.ts`,
3. la usa en el plan con `{"type": "generated", "data": {"component": "<nombre>", "props": {...}}}`.

Queda guardada para próximos videos. Puedes pedirlo directo: "haz una escena con la tabla del verbo *to be*".

---

## 9. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `ERROR: falta HF_TOKEN en .env` | no hay token | copia `.env.example` a `.env` y pon el token |
| Error 401/403 al diarizar | no aceptaste las condiciones de pyannote | acepta `pyannote/speaker-diarization-community-1` en Hugging Face |
| `validate` avisa que falta `cuts.json` | no se corrió el paso de cortes | `npm run edit -- media/input/X.mp4 --plan-only` |
| "emoji no existe" | el código no está en `public/emoji/` | `npm run emoji -- <emoji>` |
| Palabra en inglés mal escrita en los subtítulos | WhisperX la oyó mal | añádela a `pipeline/vocab.txt` y vuelve a transcribir; en el plan Claude escribe la forma correcta |
| "escena cruza un corte" | la escena pisa un silencio cortado | acórtala al tramo (ver `inspect`) |
| Título cortado en los bordes | texto muy largo | acórtalo (ver regla en `brand.md`) |
| "behind necesita la persona recortada" | falta el matte | `npm run matte -- X` |
| "behind cae fuera de lo recortado" | cambiaste tiempos del título/ítem | `npm run matte -- X` otra vez |
| Texto detrás casi no se lee | la cabeza lo tapa de más | pide subirlo (menor `y`) |
| El video final dura distinto que lo esperado | normal: se quitaron los silencios | `inspect` muestra la "Duración final" |
| Las skills no aparecen en Claude Code | sesión abierta antes de crearlas | cierra y abre Claude Code |

---

## 10. Dónde queda cada cosa

```
media/input/            tus videos originales
media/output/edited/    videos finales (lo único que se queda)
media/output/           hoja de preview mientras revisas (se borra al renderizar)
media/output/work/      temporales (se borran solos)
public/X.edit.json      el plan de edición de cada video
public/X.transcript.json, X.cuts.json   transcripción y cortes (no se suben a git)
.claude/skills/         las skills (router, captions, motion, mixed, base)
src/templates/          las escenas animadas
src/scenes/generated/   escenas hechas a medida
```
