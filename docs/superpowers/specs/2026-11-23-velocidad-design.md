# Velocidad: diseño

Fecha: 2026-11-23. Pieza 2 de 4 de "mejorar la web" (robusto → rápido → orden → diseño). Va después de `2026-11-23-render-robusto-design.md`.

## Mediciones (este PC: 22 hilos, sin GPU; video de 21 s)
| Etapa | Tiempo |
|---|---|
| normalizar + limpiar audio | 15 s |
| transcribir (`transcribe_diarize.py`, en caliente) | **84 s**: 23 importar librerías · 23 cargar Whisper medium · 17 transcribir · 5 alinear · 15 diarizar |
| transcribir en frío (primera vez después de arrancar el PC) | **272 s** |
| preparar el render (empaquetar + copiar `public/`, 281 MB) | 13 s en frío, 5 s con la caché de webpack; pasa en **cada** preview y en cada render |

## Problema
1. Cada transcripción arranca Python y carga los modelos desde cero: más de la mitad del tiempo es arranque.
2. La diarización (pyannote) tarda unos 15 s y el editor no la usa. Solo la usa la composición vieja `Captions` (`src/compositions/Captions.tsx`).
3. Remotion empaqueta y copia `public/` en cada `preview` y en cada `render`. En Windows ignora `symlinkPublicDir` (`node_modules/@remotion/bundler/dist/bundle.js:282`) y siempre copia.

## Objetivo
Reducir el tiempo de punta a punta de cada video sin cambiar la calidad (mismo modelo, mismo resultado) ni la interfaz de los comandos, y con vuelta automática al camino de hoy si algo nuevo falla.

Fuera de alcance: cambiar de modelo (Whisper "small"), usar GPU y optimizar los prompts de Claude.

## 1. Paquete de Remotion compartido (`scripts/bundleCache.ts`)
- `getServeUrl(opts?: {log?: (s: string) => void}): Promise<string>`:
  - `hash` = sha256 (12 caracteres) del contenido de todos los archivos de `src/**` (ordenados por ruta relativa), de `package-lock.json` y de `remotion.config.ts`.
  - Carpeta: `media/output/.remotion-bundle/<hash>/`. Si existe con `index.html` y `public` es un junction que apunta a la `public/` real, se reutiliza (0 s).
  - Si no: `bundle({entryPoint: src/index.ts, outDir: <hash>.tmp-<rand>, publicDir: <carpeta vacía temporal>, enableCaching: true})`. Después se borra `outDir/public` (está vacía), se crea un junction `outDir/public → <ROOT>/public` (`fs.symlinkSync(target, path, 'junction')`) y se renombra `outDir` → `<hash>`. Si otro proceso ganó la carrera y `<hash>` ya existe, se descarta el temporal.
  - Si no se puede crear el junction: se avisa y se empaqueta como hoy (`bundle` normal, que copia), sin guardar en caché.
  - Al terminar, borra las carpetas `<otro-hash>` y `*.tmp-*` viejas. **Seguridad:** antes de cualquier borrado recursivo, el junction `public` de esa carpeta se quita con `fs.unlinkSync`/`fs.rmdirSync` (sin seguirlo). Nunca se llama `rmSync(recursive)` sobre una carpeta que todavía tiene el junction.
- La lógica pura va en funciones que se pueden probar: `hashFuentes(root): string`, `esBundleValido(dir, publicReal): boolean`, `borrarBundle(dir): void`.
- `scripts/preview.ts` y `scripts/render.ts` (`prepare`) usan `getServeUrl()` en lugar de `bundle(...)`.
- `media/output/.remotion-bundle/` ya está ignorado por git (`.gitignore:14 media/output/*`).

## 2. Transcripción
### 2a. Diarización opcional
- `pipeline/transcribe_diarize.py --no-diarize`: no carga pyannote; todas las palabras y segmentos llevan `speaker: "SPEAKER_00"`, `speakers: ["SPEAKER_00"]`. El JSON tiene la misma forma que hoy.
- `scripts/edit.js` pasa `--no-diarize` siempre. `Captions` y cualquier uso directo de la línea de comandos sin el flag siguen igual.

### 2b. Lógica común
- Nuevo `pipeline/transcribe_core.py` con `class Transcriptor` (guarda el modelo Whisper por nombre y el modelo de alineación por idioma) y `transcribir(video, out, model, prompt, diarize) -> dict` (la misma lógica de hoy: reintento sin prompt según `needs_retry`/`pick_plain`, construcción del `payload` y escritura de `out`).
- El prompt cambia sin recargar el modelo (reemplazando `initial_prompt` en las opciones del pipeline). Si la versión de whisperx no lo permite, se recarga el modelo solo en ese caso.
- `transcribe_diarize.py` queda como línea de comandos fina sobre `transcribe_core` (mismos argumentos, misma salida).

### 2c. Trabajador persistente (`pipeline/transcribe_worker.py`)
- Uso: `python pipeline/transcribe_worker.py --port 0 --parent-pid <pid> [--model medium] [--warm]`. Escucha en `127.0.0.1` e imprime una línea `LISTO <puerto>` cuando está listo para recibir.
- `GET /salud` → `{"ok": true, "ocupado": bool, "modelos": [...]}`.
- `POST /transcribir` `{"video", "out", "model", "prompt", "diarize": false}` → `{"ok": true, "palabras": n}` o `{"ok": false, "error": "texto"}`. Atiende una petición a la vez (un candado); si llega otra, espera.
- `--warm` carga Whisper y el modelo de alineación de `es` y de `en` al arrancar.
- Vigila `--parent-pid` cada 5 s y se cierra si el padre ya no existe.
- Solo acepta rutas dentro de la carpeta del proyecto (`video` y `out`); si no, 400.

### 2d. La web y `edit.js`
- `web/transcriptor.js` (nuevo): `iniciar({root, py})` lanza el trabajador en segundo plano (sin bloquear el arranque de la web), lee `LISTO <puerto>` y guarda la URL; `url()` devuelve la URL o `null`; `parar()` lo cierra. Si el proceso muere, `url()` pasa a `null` y se reintenta arrancarlo una vez en la siguiente preparación.
- `web/server.js` llama a `iniciar` al arrancar (después de `listen`) y a `parar` al salir (`SIGINT`/`exit`).
- `web/flujo.js` añade `TRANSCRIBIR_URL=<url>` al `env` de `npm run edit` cuando `url()` no es null.
- `scripts/edit.js`, paso `transcribir`: si hay `TRANSCRIBIR_URL` y `GET /salud` responde en < 2 s, hace `POST /transcribir` (con timeout de 15 min) e imprime `transcriptor en memoria` en el log. Si no responde, da error o devuelve `ok:false`, imprime `aviso: transcriptor en memoria no disponible (…), uso el normal` y corre la línea de comandos de hoy. El cliente es `scripts/transcribeClient.js` (funciones puras más un `fetch` inyectable).
- Cancelar desde la web mata `edit.js`; el trabajador termina la petición en curso y la descarta (no se reinicia).

## 3. Errores, tests y medición
**Errores.** Todo lo nuevo tiene vuelta al camino de hoy: sin caché de paquete → empaqueta copiando; sin trabajador → línea de comandos. Los avisos son líneas `aviso: …` (la web no las trata como fallo). Los fallos reales de transcripción siguen saliendo como hoy (`FALLO en el paso: transcribir`).

**Tests.**
- vitest:
  - `hashFuentes`: cambia si cambia un archivo de `src/` y no cambia si solo cambia `public/`.
  - `esBundleValido`: sin `index.html` → no vale; con un junction que apunta a otro sitio → no vale.
  - `borrarBundle`: en un directorio temporal con un junction a una carpeta "real" con archivos, después de borrar el bundle **los archivos reales siguen ahí**.
  - `transcribeClient`: con `fetch` falso, salud OK + transcribir OK → usa el trabajador; salud lenta, error o `ok:false` → devuelve "usar normal" con el motivo.
  - `web/transcriptor.js`: parsea `LISTO 51234`; `url()` es null antes de LISTO y después de que el proceso muere.
- pytest (`pipeline/tests/test_transcribe_core.py`, con whisperx simulado): `diarize=False` → todas las palabras `SPEAKER_00` y no se importa ni se llama a pyannote; el `payload` tiene las mismas claves que hoy; la segunda llamada con el mismo modelo no lo recarga; un prompt distinto no recarga el modelo. Las rutas fuera del proyecto se rechazan en el trabajador.

**Medición real** (con una copia de prueba, nunca con videos de la profe; borrar todo al final):
1. `edit.js --plan-only` sobre una copia de 21 s: antes 84 s de transcripción en caliente; meta ≤ 25 s con el trabajador caliente y ≤ 70 s sin trabajador (sin diarización).
2. Transcript con trabajador vs línea de comandos (`--no-diarize`) sobre el mismo audio: mismas palabras y tiempos (diferencias ≤ 0.01 s).
3. `preview` y `render` dos veces seguidas: la segunda vez, "preparar" ≤ 1 s, y `media/output/.remotion-bundle` no crece con copias de `public/`.
4. Web: arrancar, subir un video de prueba y empezar → en el log se ve `transcriptor en memoria`; matar el trabajador a mano → la siguiente preparación usa el camino normal con un aviso.

## Riesgos
- **RAM:** el trabajador ocupa ~2–3 GB mientras la web está abierta. Aceptado por el usuario.
- **Junction en Windows:** si un antivirus o una política lo bloquea, se vuelve a copiar (más lento, pero funciona).
- **Caché del paquete obsoleta:** el hash incluye todo `src/`, `package-lock.json` y `remotion.config.ts`. Un cambio en `node_modules` sin cambiar el lock no invalidaría la caché. Es poco probable en este flujo; se documenta.
