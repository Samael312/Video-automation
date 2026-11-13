# Audio profesional: voz limpia + música con ducking (sub-proyecto A) — Diseño

Fecha: 2026-11-13. Primer sub-proyecto de "videos más profesionales" (orden acordado: A audio → B imagen → C subtítulos/zonas seguras → D motion pulido → E skill `edit-broll`).

## Objetivo
Que todos los videos (cualquier estrategia) suenen profesionales: voz sin ruido/eco/zumbido a volumen de redes (-14 LUFS), música de fondo con licencia que baja sola cuando habla la profe, y un control de volumen final.

## Decisiones del usuario
- Limpieza automática en el pipeline.
- Música desde una carpeta del usuario (`media/music/`, pistas con licencia), con ducking; opción de renderizar sin música (para usar un sonido de TikTok al publicar).
- Sin música generada por IA.

## 1. Voz limpia (`pipeline/audio_clean.py`)
Adaptado de `video-cleanup` (MIT, © 2026 Mehdi Ksibi; atribución en la cabecera del archivo). Receta probada, sin cambiarla:
1. Canal: `auto` (mezcla o el lado más limpio si izquierda/derecha están desfasados), `highpass=f=80:poles=2`, 48 kHz.
2. DeepFilterNet (`deep-filter -D -a 35`): `-D` compensa el retardo (sincronía labial).
3. EQ suave + compresión ligera: `equalizer=f=220:t=q:w=1.2:g=-2, equalizer=f=3200:t=q:w=1.0:g=2.5, equalizer=f=7000:t=h:w=0.7:g=1.5, acompressor=threshold=-24dB:ratio=3:attack=8:release=150:makeup=2`.
4. `loudnorm` en dos pasadas a I=-14, TP=-1.5, LRA=9.
5. Verificación: volumen integrado, "voz sobre fondo" antes→después, desfase de sincronía; si |desfase| > 20 ms → error (sale con código 1).

Uso: `python pipeline/audio_clean.py public/NOMBRE.mp4` → reemplaza el audio de `public/NOMBRE.mp4` (video copiado sin recodificar) y guarda el audio original en `public/NOMBRE.raw.wav` (no lo sobrescribe si ya existe; cada corrida limpia siempre desde `raw.wav`, así correr dos veces no limpia lo ya limpio).

Sin gates ni denoise FFT agresivo (en las pruebas de `video-cleanup` sonaban "corruptos").

### Instalación
`npm run setup-audio`: comprueba ffmpeg y numpy; si falta DeepFilterNet, muestra nombre, origen (release oficial de GitHub) y tamaño (~30 MB), **pide confirmación**, lo descarga a `~/.video-cleanup/bin/` con checksum (misma lógica que `setup_tools.py`). `audio_clean.py` falla con un mensaje claro que manda a correr `npm run setup-audio` si no lo encuentra.

### En el pipeline
`scripts/edit.js`: normalizar → **limpiar audio** → transcribir **`public/NOMBRE.mp4`** (ya limpio; antes transcribía `media/input`) → cortar. Flag `--no-clean` lo salta. `npm run verify` reporta si DeepFilterNet está instalado.

## 2. Música con ducking
### Carpeta y nombres
`media/music/<animo>__<nombre>.<mp3|wav|m4a>` (ignorada por git como el resto de `media/`). Ánimos: `calm`, `upbeat`, `curious`, `dramatic`. Solo pistas con licencia para uso en redes (Pixabay Music, YouTube Audio Library, compras propias); lo dice el manual.

### Plan
Campo opcional nuevo en `EditPlan`:
```json
"music": {"file": "curious__pluck.mp3", "volume": 0.12, "duck": 0.04}
```
- `file`: nombre en `media/music/` (obligatorio).
- `volume`: 0.02–0.4, por defecto 0.12 (sin voz).
- `duck`: 0–`volume`, por defecto 0.04 (mientras habla la profe).

Validación: `file` existe en `media/music/` (el ctx recibe `knownMusic`), números en rango.

### Volumen en el tiempo (`src/lib/music.ts`, puro)
`musicVolume(t, speech, total, opts)`: `t` y `speech` en tiempo final.
- `speech`: intervalos de voz = palabras remapeadas, unidas si están a < 0.3 s.
- Ducking: baja a `duck` en 0.15 s antes de cada intervalo, sube a `volume` en 0.4 s después.
- Fade in 0.5 s al inicio, fade out 1 s al final.

### Render
- `Edit.tsx`: `<Audio src={staticFile('music/<file>')} loop volume={(f) => musicVolume(f / fps, ...)} />`.
- `scripts/render.js`: si el plan tiene `music`, copia la pista a `public/music/` (ignorada por git) antes de renderizar. Flag `--no-music` → render con `music` quitado de las props (el plan no se toca).
- `video-base`: regla para elegir ánimo (curiosidad/"¿sabías que?" → `curious`; listas/tips rápidos → `upbeat`; pronunciación/explicación pausada → `calm`; errores/"plot twist" → `dramatic`) y elegir la pista de `media/music/` (si no hay ninguna, no poner `music` y avisar al usuario).

## 3. Control final de volumen
Después del render, `render.js` mide el volumen integrado del mp4 (`ebur128`). Si |I − (−14)| > 1 LU o el pico > −1 dBTP, normaliza solo el audio (`loudnorm` dos pasadas, `-c:v copy`) y reemplaza el archivo. Imprime `volumen final: X LUFS, pico Y dBTP`.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `pipeline/audio_clean.py` (+ `pipeline/audio_common.py`) | cadena de limpieza, medidas y verificación (adaptado de video-cleanup) |
| `pipeline/tests/test_audio_clean.py` | cadena de filtros, `two_pass` parse, nombres/flujo de raw.wav |
| `scripts/setup_audio.py` + script npm `setup-audio` | instalación de DeepFilterNet con confirmación |
| `scripts/edit.js` | paso limpiar + transcribir el video limpio + `--no-clean` |
| `src/lib/music.ts` (+ test) | `speechSpans`, `musicVolume` |
| `src/lib/plan.ts` (+ test) | campo `music`, validación, `knownMusic` |
| `scripts/common.ts`, `scripts/validate.ts` | `knownMusic()` desde `media/music/` |
| `src/Edit.tsx` | pista de música |
| `scripts/render.js` | copia de pista, `--no-music`, control final de volumen |
| `scripts/verify.js` | estado de DeepFilterNet |
| `.claude/skills/video-base/SKILL.md`, `docs/MANUAL.md`, `README.md` | elegir música, flags, carpeta de música |

## Pruebas
- pytest: `post_chain`, parse de `loudnorm` JSON, lógica raw.wav (no sobrescribe; `--force`).
- vitest: `speechSpans` (une huecos < 0.3 s), `musicVolume` (fade in/out, ducking con rampas, nunca > volume ni < 0), validación de `music`.
- E2E: Plot_Twist re-procesado con limpieza + música; reportar volumen y "voz sobre fondo" antes→después y desfase; el usuario escucha con audífonos (Claude no puede oír).

## Fuera de alcance
Separación de música/voz, quitar pájaros u otros sonidos tonales, música generada por IA, sonidos de TikTok.
