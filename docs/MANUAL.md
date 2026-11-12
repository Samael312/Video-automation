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
npm run verify              # revisa ffmpeg, venv y Remotion
```

**`HF_TOKEN`**: token gratis de Hugging Face (huggingface.co → Settings → Access Tokens, tipo *read*). Hace falta para separar voces. Acepta también las condiciones del modelo `pyannote/speaker-diarization-community-1` en su página de Hugging Face. El `.env` no se sube a git; no lo compartas.

La primera transcripción descarga el modelo WhisperX `medium` (~1.5 GB) y tarda varios minutos. Después es más rápido.

---

## 2. Flujo diario

1. Copia el video grabado a `media/input/` (por ejemplo `media/input/IDIOM1.mp4`).
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
6. Resultado: `media/output/edited/IDIOM1_edited.mp4`, listo para subir. Al terminar se borran solos los temporales y la hoja de preview.

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
Una escena animada por idea (ejemplo, error → corrección, pronunciación por sílabas, traducción). La profe aparece en el gancho, entre escenas (≥ 1 s) y en el cierre. Ideal para gramática, reglas y pronunciación.

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

## 5. Comandos (por si quieres hacerlo a mano)

| Comando | Qué hace |
|---|---|
| `npm run edit -- media/input/X.mp4 --plan-only` | normaliza, transcribe y corta silencios; no renderiza |
| `npm run edit -- media/input/X.mp4` | todo de una vez con el plan por defecto (solo subtítulos + zoom) |
| `npm run inspect -- X` | lista cada palabra con su tiempo, por tramos y cortes |
| `npm run validate -- X` | revisa `public/X.edit.json` y explica cada error |
| `npm run preview -- X` | hoja de capturas `media/output/X_preview.png` (~20 s) |
| `npm run render:plan -- X` | valida y renderiza `media/output/edited/X_edited.mp4` y borra sus temporales |
| `npm run clean -- X` | borra temporales y hoja de preview de X |
| `npm run clean -- --all` | deja `media/output` solo con `edited/` (los videos finales) |
| `npm run reference -- V` (o `--all`) | analiza videos de `media/reference/`: hojas, cortes, ritmo, transcript |
| `npm run emoji -- 😀` | descarga un emoji Noto a `public/emoji/` |
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

1. Copia los videos a `media/reference/`.
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
