# video-automation

Automatiza la edición de TikToks (9:16) para una profe de inglés online: transcripción, cortes de silencio, subtítulos, transiciones y motion graphics.
**Manual de uso: [`docs/MANUAL.md`](docs/MANUAL.md)** (instalación, flujo diario con las skills `/edit-router`, `/edit-captions`, `/edit-motion`, `/edit-mixed`, problemas comunes).

Diseño completo: [`docs/superpowers/specs/2026-11-12-tiktok-auto-editor-design.md`](docs/superpowers/specs/2026-11-12-tiktok-auto-editor-design.md).

## Estructura

```
pipeline/            Python (WhisperX): transcripción, cortes, plan  → JSON
scripts/             Utilidades Node: normalizar video, extraer frames, verificar entorno
src/
  index.ts, Root.tsx Registro de composiciones Remotion
  compositions/      Composiciones base (Hello, Captions)
  styles/<estilo>/   Un paquete por estilo (config + componentes). Hoy: referencia
  templates/         Plantillas de motion graphics (translate, quiz, ...)
  scenes/generated/  Escenas generadas por IA
  lib/               Tipos y utilidades compartidas
public/              Assets que Remotion sirve (sfx/, emoji/ versionados; videos y transcripts no)
media/               input/ reference/ output/  (contenido ignorado por git)
docs/                Specs y planes
```

## Uso rápido

```bash
npm install
npm run edit -- media/input/video.mp4   # pipeline completo → media/output/edited/video_edited.mp4
npm run validate -- video              # valida public/video.edit.json
npm run render:plan -- video           # valida y renderiza con el plan
npm run inspect -- video               # palabras con tiempos, por tramos
npm run preview -- video               # hoja de capturas del plan
npm test                           # vitest (lib TypeScript)
.venv\Scripts\python -m pytest pipeline/tests   # pytest (pipeline)
npm run verify                     # revisa ffmpeg, venv, Remotion
npm run studio                     # previsualizar
.venv\Scripts\python pipeline\transcribe_diarize.py media\input\video.mp4
```

Copia `.env.example` a `.env` y pon tu `HF_TOKEN`.

## Pipeline actual

`normalizar → transcribir (WhisperX medium + vocab.txt) → cortar silencios (cuts.json) → validar edit.json → render Remotion (composición Edit)`.

### El plan de edición (`public/<video>.edit.json`)
Un archivo de datos describe la edición: título, cierre, subtítulos, zoom, overlays (labels/emojis), **escenas** y sfx. Todos los tiempos son segundos del video **original**; el motor los reubica según los cortes. Si no existe, se usa un plan por defecto (solo subtítulos + zoom). Ejemplo completo (estrategia `mixed`): `public/ACTUALLY.edit.json`. Reglas en `src/lib/plan.ts` (`validatePlan`).

Escenas (motion graphics a pantalla completa con la voz de fondo y subtítulos encima): `translate`, `false-friend`, `pronounce`, `mistake`, `example`, `quiz` (plantillas en `src/templates/`) y `generated`.

### Escenas generadas por IA
1. Crear `src/scenes/generated/<nombre>.tsx` (componente `React.FC<GeneratedProps>`; ver `demo.tsx`).
2. Registrarlo con una línea en `src/scenes/generated/index.ts`.
3. Usarlo en el plan: `{"type": "generated", "start": 4, "end": 6, "data": {"component": "<nombre>", "props": {...}}}`.

Los overlays se dibujan **encima** de las escenas: en un plan `mixed`, no dejes overlays que dupliquen el contenido de una escena.
