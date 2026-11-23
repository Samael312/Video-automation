# Velocidad: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada video tarde menos de punta a punta, con un paquete de Remotion compartido (sin copiar `public/`), la transcripción sin diarización y un trabajador de transcripción que se queda cargado mientras la web está abierta.

**Architecture:** `scripts/bundleCache.ts` empaqueta una vez por hash de las fuentes y enlaza `public/` con un junction; lo usan `preview.ts` y `render.ts`. La lógica de `transcribe_diarize.py` pasa a `pipeline/transcribe_core.py` (modelos en caché), que usan tanto la línea de comandos como `pipeline/transcribe_worker.py` (HTTP local). La web arranca el trabajador (`web/transcriptor.js`) y pasa `TRANSCRIBIR_URL` a `edit.js`, que lo usa con `scripts/transcribeClient.js` y, si falla, vuelve a la línea de comandos.

**Tech Stack:** TypeScript/Node (tsx, vitest), Remotion 4.0.543 `@remotion/bundler`, Python (whisperx, pytest), `http.server`.

**Spec:** `docs/superpowers/specs/2026-11-23-velocidad-design.md`

## Global Constraints
- **NUNCA hacer `git commit`/`add`/`merge`/`push`.** Al final de cada tarea: listar los archivos y proponer el mensaje de commit.
- No cambian ni las interfaces ni las salidas: `npm run edit`, `npm run preview`, `npm run render:plan`, la forma del JSON de transcript y las líneas `== paso ==` y `FALLO en el paso:`.
- Toda pieza nueva tiene vuelta al camino actual, con una línea `aviso: …`.
- Carpeta de la caché: `media/output/.remotion-bundle/<hash12>/`. Hash: sha256 de `src/**` (ordenado por ruta relativa con `/`), `package-lock.json` y `remotion.config.ts`.
- Junction: `fs.symlinkSync(<ROOT>/public, <dir>/public, 'junction')`. **Nunca** `rmSync(recursive)` sobre una carpeta con el junction dentro: antes, `unlink`/`rmdir` del junction.
- Trabajador: `127.0.0.1`, `--port 0`, línea `LISTO <puerto>`, `GET /salud`, `POST /transcribir`. Solo rutas dentro del proyecto. Vigila al padre cada 5 s.
- Cliente: salud con timeout de 2 s; transcribir con timeout de 15 min.
- Diarización: `--no-diarize` ⇒ `speaker: "SPEAKER_00"` en palabras y segmentos, y `speakers: ["SPEAKER_00"]`.
- Pruebas reales solo con copias (`PRUEBA_VEL`), y se borran al terminar.

## Review Focus
1. **Dos procesos crean el mismo paquete a la vez** (preview de Claude y render seguidos): el segundo no debe romper el paquete del primero ni dejar basura. → test en la tarea 1 ("rename a destino existente descarta el temporal").
2. **La web se cierra de golpe (se cierra la ventana)**: el trabajador no debe quedar huérfano gastando RAM. → vigilancia del padre (tarea 3) + prueba manual en la tarea 6.
3. **Llega una petición al trabajador mientras está cargando modelos (`--warm`)**: debe esperar, no fallar. → test en la tarea 3 (el candado cubre la carga).
4. **Un `TRANSCRIBIR_URL` viejo (el trabajador se reinició en otro puerto)**: `edit.js` debe volver a la línea de comandos sin fallar. → test en la tarea 4 (salud con error de conexión → usar normal).
5. **Rutas con espacios o mayúsculas distintas** (`C:\Users\HP\Desktop\CHU\Videos` vs `Chu\videos`): la comprobación "dentro del proyecto" no debe rechazar rutas válidas en Windows. → test en la tarea 3 (comparación sin distinguir mayúsculas y con `resolve`).

---

### Task 1: paquete de Remotion compartido

**Files:**
- Create: `scripts/bundleCache.ts`, `scripts/bundleCache.test.ts`
- Modify: `scripts/preview.ts:31` y `scripts/render.ts` (`prepare`: `bundle(...)` → `getServeUrl(...)`)

**Interfaces:**
- Produces:
  - `hashFuentes(root: string): string` (12 hex)
  - `esBundleValido(dir: string, publicReal: string): boolean`: existe `index.html`, y `dir/public` es un enlace cuyo `realpath` coincide (sin distinguir mayúsculas) con el `realpath` de `publicReal`.
  - `borrarBundle(dir: string): void`: si `dir/public` es un enlace, lo quita sin seguirlo y luego hace `rmSync(dir, {recursive, force})`.
  - `instalar(tmpDir: string, destino: string): 'instalado' | 'ya-existia'`: `rename`; si el destino ya existe, `borrarBundle(tmpDir)` y devuelve `'ya-existia'`.
  - `getServeUrl(opts?: {log?: (s: string) => void; root?: string}): Promise<string>`: hace lo del spec §1 y devuelve la ruta de la carpeta (sirve como `serveUrl`).

- [ ] **Step 1: tests que fallan** (en un directorio temporal, sin Remotion):
  - `hashFuentes`: igual con dos llamadas; cambia al tocar `src/a.ts`; no cambia al tocar `public/x.mp4`.
  - `esBundleValido`: sin `index.html` → false; con `index.html` y un junction a `public` → true; con un junction a otra carpeta → false; con `public` como carpeta normal → false.
  - `borrarBundle`: bundle con junction a una carpeta "real" que tiene `keep.txt` → después de borrar, `keep.txt` sigue ahí y el bundle ya no existe (Review Focus: seguridad).
  - `instalar`: destino libre → `'instalado'` y el tmp ya no existe; destino existente → `'ya-existia'`, el tmp se borra y el destino no cambia, y el `keep.txt` real sigue ahí (Review Focus 1).
  - Si la máquina no deja crear junctions, se salta con `it.skipIf`.
- [ ] **Step 2:** `npx vitest run scripts/bundleCache.test.ts` → FALLA (no existe el módulo).
- [ ] **Step 3:** implementar. En `getServeUrl`: si falla crear el junction → `log('aviso: no se pudo enlazar public/, empaqueto copiando')` y devolver `bundle({entryPoint})` normal. Limpiar las carpetas hermanas de otro hash y los `*.tmp-*` con `borrarBundle`.
- [ ] **Step 4:** usarlo en `preview.ts` y `render.ts`. `npx vitest run` y `npx tsc --noEmit -p .` → OK.
- [ ] **Step 5: real** (copia `PRUEBA_VEL` desde un video con fx, como en la pieza 1): `npm run render:plan -- PRUEBA_VEL` dos veces → la 2ª vez `preparar` ≤ 1 s y el render queda bien (con video y audio). `du -sh media/output/.remotion-bundle` < 30 MB. `npm run preview -- PRUEBA_VEL` reutiliza el paquete. Borrar la copia.
- [ ] **Step 6:** listar los archivos y proponer el commit `Velocidad: paquete de Remotion compartido con junction a public/`.

### Task 2: lógica de transcripción común y diarización opcional

**Files:**
- Create: `pipeline/transcribe_core.py`, `pipeline/tests/test_transcribe_core.py`
- Modify: `pipeline/transcribe_diarize.py` (línea de comandos fina + `--no-diarize`), `scripts/edit.js:42` (añadir `--no-diarize`)

**Interfaces:**
- Produces (`transcribe_core.py`):
  - `class Transcriptor(whisperx_mod=None, device='cpu', compute='int8', log=print)`:
    - `modelo(nombre)`: lo carga una vez.
    - `alineador(lang)`: lo carga una vez por idioma.
    - `transcribir(video: Path, out: Path, model: str, prompt: str | None, diarize: bool, speakers: int | None = None, token: str | None = None) -> dict`: el `payload` de hoy, escrito en `out`.
  - El prompt se cambia con `model.options = dataclasses.replace(model.options, initial_prompt=prompt)`; si falla, se recarga el modelo.
  - La diarización se importa solo cuando `diarize=True` (import dentro de la función).
- `transcribe_diarize.py` acepta los argumentos de hoy más `--no-diarize`; `HF_TOKEN` solo se exige si hay diarización.

- [ ] **Step 1: tests que fallan** (pytest, con un `whisperx` falso inyectado que cuenta las cargas y devuelve segmentos fijos):
  - `diarize=False` → todas las palabras y segmentos con `speaker == "SPEAKER_00"` y `speakers == ["SPEAKER_00"]`; `whisperx.diarize` no se importa (comprobar `sys.modules`).
  - `payload` con las claves `video, language, model, vocab_prompt, duration, speakers, segments, words`.
  - Dos `transcribir` con el mismo modelo → `load_model` se llama 1 vez; con otro prompt → sigue siendo 1 vez.
  - El alineador se carga una vez por idioma.
  - Con prompt y baja confianza (`needs_retry` → True) → se hace un segundo pase sin prompt y se elige con `pick_plain` (igual que hoy).
- [ ] **Step 2:** `cd pipeline; ..\.venv\Scripts\python.exe -m pytest tests/test_transcribe_core.py -q` → FALLA.
- [ ] **Step 3:** implementar `transcribe_core.py` moviendo la lógica, y adelgazar `transcribe_diarize.py`. `edit.js` pasa `--no-diarize`.
- [ ] **Step 4:** pytest de todo `pipeline/tests` → OK; `npx vitest run` → OK.
- [ ] **Step 5: real:** sobre una copia de 21 s, `transcribe_diarize.py --no-diarize` → mismas palabras que la versión con diarización (texto y tiempos ≤ 0.01 s, quitando `speaker`) y menos tiempo. Anotar los tiempos. Borrar la copia.
- [ ] **Step 6:** listar los archivos y proponer el commit `Velocidad: transcribe_core con modelos en caché y diarización opcional`.

### Task 3: trabajador de transcripción

**Files:**
- Create: `pipeline/transcribe_worker.py`, `pipeline/tests/test_transcribe_worker.py`

**Interfaces:**
- Consumes: `Transcriptor` (tarea 2).
- Produces:
  - `dentro_del_proyecto(ruta: str, root: Path) -> bool`: `resolve()` y comparación sin distinguir mayúsculas (Windows).
  - `crear_servidor(transcriptor, root, port=0) -> ThreadingHTTPServer`, con un `threading.Lock` que cubre `--warm` y cada `/transcribir`.
  - `main()`: argumentos `--port`, `--parent-pid`, `--model`, `--warm`; imprime `LISTO <puerto>`; un hilo vigila al padre (`os.kill(pid, 0)` / `psutil` si ya está instalado) cada 5 s y llama a `os._exit(0)` si el padre murió.
  - Respuestas: `GET /salud` → `{"ok": true, "ocupado": bool, "modelos": [...]}`; `POST /transcribir` → `{"ok": true, "palabras": n}` o 400/500 con `{"ok": false, "error": "…"}`.

- [ ] **Step 1: tests que fallan** (servidor real en `127.0.0.1:0` con un `Transcriptor` falso):
  - `/salud` → 200 `ok: true`.
  - `/transcribir` con rutas válidas → llama a `transcribir(diarize=False)` y responde `palabras`.
  - Una ruta fuera del proyecto → 400 y no llama al transcriptor.
  - `dentro_del_proyecto` con distinta capitalización → True; `..\..\x` → False (Review Focus 5).
  - Dos peticiones a la vez → se atienden en serie (el falso registra que no se solapan) (Review Focus 3).
  - Si el transcriptor lanza error → 500 con `ok: false` y el texto del error.
- [ ] **Step 2:** pytest → FALLA.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** pytest de `pipeline/tests` → OK.
- [ ] **Step 5:** listar los archivos y proponer el commit `Velocidad: trabajador HTTP de transcripción`.

### Task 4: cliente en `edit.js`

**Files:**
- Create: `scripts/transcribeClient.js`, `scripts/transcribeClient.test.ts`
- Modify: `scripts/edit.js` (paso `transcribir`: una función que primero intenta con el cliente y si no, usa el comando de hoy)

**Interfaces:**
- Produces: `async transcribirConTrabajador({url, video, out, model, prompt, fetch = globalThis.fetch}) -> {ok: true} | {ok: false, motivo: string}`. `video` y `out` son rutas absolutas; `prompt` es la ruta del vocab o `''`.
- `edit.js` ya acepta pasos como función (`typeof cmd === 'function'`); el paso `transcribir` pasa a ser `async` → adaptar el bucle para esperar (`await`) las funciones que devuelven una promesa.

- [ ] **Step 1: tests que fallan** con un `fetch` falso:
  - salud OK y transcribir `{ok:true}` → `{ok: true}`, y el cuerpo enviado lleva `diarize: false`;
  - salud que lanza `ECONNREFUSED` → `{ok:false, motivo}` con `no responde` (Review Focus 4);
  - salud que tarda más de 2 s (fake con un abort) → `{ok:false}`;
  - transcribir `{ok:false, error:'x'}` → `{ok:false, motivo: contiene 'x'}`;
  - sin `url` → `{ok:false}` y nunca llama a `fetch`.
- [ ] **Step 2:** `npx vitest run scripts/transcribeClient.test.ts` → FALLA.
- [ ] **Step 3:** implementar el cliente y la integración: si `process.env.TRANSCRIBIR_URL` → intentar; si sale bien, log `transcriptor en memoria`; si no, `aviso: transcriptor en memoria no disponible (<motivo>), uso el normal` y `execSync` del comando de hoy.
- [ ] **Step 4:** `npx vitest run` → OK.
- [ ] **Step 5:** listar los archivos y proponer el commit `Velocidad: edit.js usa el transcriptor en memoria si está`.

### Task 5: la web arranca el trabajador

**Files:**
- Create: `web/transcriptor.js`, `web/transcriptor.test.ts`
- Modify: `web/server.js` (iniciar después de `listen`; parar al salir), `web/flujo.js` (el `env` del comando `edit` añade `TRANSCRIBIR_URL`)

**Interfaces:**
- Produces: `crearTranscriptor({root, py, spawn = child_process.spawn, log = console.log})` → `{iniciar(), url(), parar()}` y `parsearListo(linea) -> number | null`.
- `crearFlujo` recibe una opción nueva, `transcriptorUrl = () => null`; el `env` del comando `npm run edit` = `{...env(), ...(url ? {TRANSCRIBIR_URL: url} : {})}`.

- [ ] **Step 1: tests que fallan:**
  - `parsearListo('LISTO 51234')` → 51234; `parsearListo('otra')` → null.
  - Con un `spawn` falso (EventEmitter con stdout): antes de `LISTO`, `url()` es null; después, `http://127.0.0.1:51234`; al emitir `exit`, `url()` vuelve a null; un segundo `iniciar()` con el proceso vivo no lanza otro.
  - Se lanza con `--parent-pid <process.pid>`, `--warm` y `windowsHide: true`.
  - En `flujo.test.ts`: con `transcriptorUrl: () => 'http://x'`, el comando de preparación recibe `TRANSCRIBIR_URL=http://x` en `env`; con `null`, no la recibe.
- [ ] **Step 2:** `npx vitest run web/transcriptor.test.ts web/flujo.test.ts` → FALLA.
- [ ] **Step 3:** implementar; en `server.js`, `const transcriptor = crearTranscriptor({root: ROOT, py: <venv python>})`, `iniciar()` dentro del callback de `listen` (solo si existe el python del venv), y `process.on('exit'|'SIGINT')` → `parar()`.
- [ ] **Step 4:** `npx vitest run` → OK.
- [ ] **Step 5:** listar los archivos y proponer el commit `Velocidad: la web mantiene el transcriptor cargado`.

### Task 6: medición real y documentación

- [ ] **Step 1:** `PORT=3999 node web/server.js` → en ~1 min, `GET <url>/salud` responde (mirar con `curl` el puerto del log o por `transcriptor.url()` en el log de arranque).
- [ ] **Step 2:** copia `VIDEOS_PROFE/PRUEBA_VEL` (21 s) → empezar con estilo `captions` desde la API → en el log aparece `transcriptor en memoria`; anotar el tiempo de `transcribir` (meta ≤ 25 s). Cancelar después de la preparación (no gastar en Claude).
- [ ] **Step 3:** matar el proceso Python del trabajador → repetir la preparación → `aviso: … uso el normal` y la preparación termina bien (meta ≤ 70 s).
- [ ] **Step 4:** cerrar la web (matar node) → en ≤ 10 s no queda ningún proceso del trabajador (Review Focus 2).
- [ ] **Step 5:** borrar todo lo de `PRUEBA_VEL` (input, public, output, work, preview). Actualizar `docs/WEB_API.md` (secciones Transcriptor y Caché de render) y `docs/MANUAL.md` si habla de la diarización. Escribir el resumen con los tiempos de antes y después.
