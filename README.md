# video-automation

Automatiza la edición de TikToks (9:16) para una profe de inglés online: transcripción, cortes de silencio, subtítulos, transiciones y motion graphics.
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
npm run verify                     # revisa ffmpeg, venv, Remotion
npm run studio                     # previsualizar
npm run render:styled              # → media/output/ACTUALLY_edited.mp4
.venv\Scripts\python pipeline\transcribe_diarize.py media\input\video.mp4
```

Copia `.env.example` a `.env` y pon tu `HF_TOKEN`.
