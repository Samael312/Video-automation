# Web local: contrato del flujo de video (etapa 2)

Contrato entre `web/server.js`, los módulos de `web/` y el frontend `web/public/`. Todo en español en la interfaz; código en CommonJS sin dependencias nuevas.

## Estado por video
Archivo `media/input/<PLAN>/<NOMBRE>.estado.json` (escritura atómica). `<PLAN>` cumple `isSafeFolder` (`^[A-Za-z0-9_-]{1,80}$`) y `<NOMBRE>` cumple `^[A-Za-z0-9_-]{1,120}$`.

```json
{
  "version": 1, "plan": "NAVIDAD", "nombre": "NAVIDAD_EVE",
  "fase": "revision",
  "estilo": "mixed",
  "entrada": {"archivo": "NAVIDAD_EVE.mp4", "tipo": "video", "bytes": 123456} ,
  "sessionId": "uuid o null",
  "resumen": "texto del resumen del preview",
  "cambios": [{"texto": "cambia el gancho", "en": "2026-11-20T12:00:00.000Z"}],
  "mensaje": "último mensaje de progreso",
  "accion": null,
  "error": null,
  "trabajo": null,
  "actualizado": "2026-11-20T12:00:00.000Z"
}
```
- `fase` ∈ `sin_grabar, subido, preparando, planificando, revision, renderizando, listo, error, necesita_accion, interrumpido`.
- En curso: `preparando, planificando, renderizando`. Al arrancar el servidor, las fases en curso pasan a `interrumpido`.
- `estilo` ∈ `captions, motion, mixed, voice` o `null`. Si la entrada es audio, solo `voice`.
- `accion`: texto que la profe debe atender (fase `necesita_accion`); `error`: texto en español (fase `error`).
- Sin archivo de estado: `sin_grabar`; si existe un archivo de entrada en la carpeta: `subido`.
- Log técnico: `<NOMBRE>.log` (texto, últimas ~400 líneas).

## Videos sin guion
Las secciones "Editar video" y "Audio a video" suben el archivo sin elegir guion. Se guarda en las carpetas `media/input/VIDEOS_PROFE/` (solo video) y `media/input/AUDIOS_PROFE/` (solo audio). En ellas no hace falta `<NOMBRE>.txt` (`estado.existeVideo`). La primera subida da 409 si el nombre ya lo usa otro video (`estado.nombreOcupado`: ya editado, o con guion/estado en otro plan). Sin guion, `edit.js` no alinea y `edit-voice` usa la transcripción. `GET /api/videos` lista además todo lo que haya en `media/output/edited/`. Su plan es el que tenga su estado o su guion (`estado.planDeVideo`); si no tiene ninguno, `VIDEOS_PROFE`.

## Cambios a videos ya editados
`POST /api/video/<PLAN>/<NOMBRE>/cambios` acepta también la fase `listo`. El video vuelve a `revision` con un preview nuevo; al aprobar se renderiza otra vez y se reemplazan el mp4 y el caption de `edited/`. Un video editado fuera de la web no tiene estado: al pedirlo con `GET /api/video/<PLAN>/<NOMBRE>` se le crea un estado `listo` (`estado.adoptarEditado`). Solo pasa si existen su mp4 editado y `public/<NOMBRE>.edit.json`, y si no pertenece a otro plan.

## Render (`npm run render:plan -- <N>`, lo usa "aprobar")
`scripts/render.js` lanza `scripts/render.ts`, que usa el orquestador de `scripts/renderFlow.ts`. Los pasos (`== paso ==`) son: `validar edit.json` (incluye emojis en props de fx/escenas y sonidos de `public/sfx`), `preparar` (música y un solo bundle), `prueba` (1 frame cada ~0.5 s, con audio), `renderizar` (a `<N>_edited.tmp.mp4`, con progreso `Rendered x/y`; un reintento con la mitad de concurrencia si falla el compositor), `volumen final` y `terminar` (renombra el `.tmp` sobre el final). Si algo falla: una línea de causa en español, después `FALLO en el paso: <paso>`, se borra el `.tmp` y el video anterior queda intacto. `traducirError` convierte esas causas en textos para la profe.

## Paquete de Remotion compartido (`scripts/bundleCache.ts`)
`preview.ts` y `render.ts` usan `getServeUrl()`: un solo paquete por hash de `src/**` + `package-lock.json` + `remotion.config.ts` en `media/output/.remotion-bundle/<hash>/`, con `public` como junction a la `public/` real (no se copian ~280 MB). Si el paquete ya existe se reutiliza (log `(paquete de Remotion reutilizado: …)`). Si no se puede enlazar, se empaqueta copiando como antes (`aviso: …`). Borrar un paquete quita primero el junction: nunca toca `public/`. Un cambio en `node_modules` sin tocar el lock no invalida la caché: en ese caso borra `media/output/.remotion-bundle`.

## Transcriptor en memoria (`web/transcriptor.js` + `pipeline/transcribe_worker.py`)
Al arrancar, la web lanza el trabajador en segundo plano (`--port 0 --parent-pid <pid web> --warm`, ~2–3 GB de RAM). Carga Whisper y los alineadores es/en una vez (~2 min) y escucha en `127.0.0.1` (`GET /salud`, `POST /transcribir`; solo rutas dentro del proyecto; una petición a la vez). `crearFlujo({transcriptorUrl})` pasa `TRANSCRIBIR_URL` a `npm run edit`; `scripts/edit.js` lo usa (`scripts/transcribeClient.js`, log `transcriptor en memoria (n palabras)`) y, si no responde o falla, usa `pipeline/transcribe_diarize.py --no-diarize` con `aviso: transcriptor en memoria no disponible (…), uso el normal`. Si el trabajador muere, la web lo relanza una vez. Se cierra al salir la web, o solo si el proceso de la web desaparece (lo comprueba cada 5 s). La lógica común está en `pipeline/transcribe_core.py`. La edición ya no diariza: todo es `SPEAKER_00`.

## Organización del código
**Servidor:**
- `web/server.js`: exporta `crearServidor(deps)`, un `http.Server` sin `listen`.
  - `deps = {root, inputDir, publicDir, host, port, gestor, flujo, trabajosGuion, revisarRequisitos, checkClaude?, voces}`.
  - Con `port: 0`, Host y Origin se comparan con el puerto real tras `listen`.
  - Solo al ejecutarse directamente (`npm run web`) arma las dependencias reales, el transcriptor y `listen`.
- `web/http.js`: `send` (siempre `Cache-Control: no-store`), `readJson(req, max)`, `allowed(req, esSubida, {host, port})`, `servirEstatico` y `RE_ESTATICO`.
- `web/rutas.js`: `crearRutas(deps) → {manejar(req, res)}`, una tabla `[método, patrón, manejador]` donde gana la primera que coincide.
- `web/servidor.smoke.test.ts`: peticiones HTTP reales sobre un root temporal, sin Claude ni Python.

**Navegador** (`web/public`, módulos ES; `index.html` solo carga `/main.js`):
- `comun.js`: `el`, `tag`, `pedir`, `conBloqueo`, `copiar`, fases, `rutaVideo`, `urlArchivo`…
- `markdown.js`
- `pendiente.js`: el archivo elegido antes de abrir el asistente.
- `guiones.js`: planes, carpeta, visor y generar.
- `secciones.js`: Video desde guion, Editar video, Audio a video, `panelRetro` y `selectorGuion`.
- `asistente.js`: el estado `W`, SSE y acciones; `pintar` y `pintarRecom` se registran en `ganchos` para evitar ciclos.
- `paneles.js`: paneles por fase.
- `video.js`: abrir, dibujar y pintar.
- `mis-videos.js`
- `main.js`: rutas `#/…` y arranque.

Las funciones puras tienen tests en `web/front.test.ts`.

## Módulos (exports CommonJS)
**`web/estado.js`**: `FASES`, `EN_CURSO`, `NOMBRE_SEGURO` (regex), `estadoPath(inputDir, plan, nombre)` (null si inseguro), `leerEstado(inputDir, plan, nombre)` (saneado; con valores por defecto), `escribirEstado(inputDir, plan, nombre, patch)` (mezcla, valida fase, escritura atómica, devuelve el estado nuevo), `marcarInterrumpidos(inputDir)` (devuelve cuántos), `estadosDePlan(inputDir, plan)` (`{nombre: {fase, actualizado}}`), `listarListos(inputDir)` (`[{plan, nombre, actualizado}]` con fase `listo`), `agregarLog(inputDir, plan, nombre, linea)`, `leerLog(inputDir, plan, nombre, max=200)`.

**`web/files.js`**: `parseRange(header, size)` → `null` (sin header) | `'invalido'` | `{start, end}`; `EXT_PERMITIDAS` (`mov mp4 m4v m4a mp3 wav ogg opus`), `MAX_SUBIDA` (3 GB), `validarSubida({ext, bytes})` → `{ok, error?}`, `tipoDeEntrada(ext)` → `'audio'|'video'|null`, `resolverArchivo(root, plan, nombre, tipo)` → ruta absoluta o `null` (tipos: `entrada` = `media/input/<plan>/<nombre>.<ext permitida>`, `preview` = `media/output/<nombre>_preview.png`, `video` = `media/output/edited/<nombre>/<nombre>_edited.mp4`, `caption` = `media/output/edited/<nombre>/<nombre>_caption.txt`; rechaza symlinks y todo lo que salga de la base), `tipoMime(archivo)`, `servirArchivo(req, res, archivo, {descargar})` (streaming con `Range` 206/416, `Accept-Ranges`, `Content-Disposition` si `descargar`), `guardarSubida(req, destino, {max})` → Promise `{bytes}` (stream a archivo temporal y rename; rechaza si excede `max`, aborta o falla; borra el temporal).

**`web/requisitos.js`**: `comprobarRequisitos(root, env, {which})` → `[{id, ok, titulo, detalle, arreglo}]` para `claude`, `venv` (`.venv/Scripts/python.exe`), `ffmpeg`, `ffprobe`, `hf_token` (en `.env` o `.env.txt` o env), `deepfilter` (`~/.video-cleanup/bin/deep-filter.exe`), `musica` (`media/music/*.mp3`), `node_modules`. `arreglo` es un texto breve en español con el comando o paso exacto.

**`web/prompts.js`**: `ESTILOS`, `estiloParaEntrada(tipo)`, `skillDe(estilo)` (`edit-<estilo>`), `SYSTEM_WEB` (texto para `--append-system-prompt`), `promptPlanificar({plan, nombre, archivo, estilo})`, `promptCambios({nombre, texto})`, `promptCambiosSinSesion({nombre, texto})`, `promptCaption({plan, nombre})`, `promptRecomendar({plan, nombre, archivo})`, `argsClaude({sessionId, resume, solo_lectura})` (array de argumentos de `claude`: `-p --output-format stream-json --verbose --permission-mode ... --allowedTools ... --disallowedTools ...` y `--session-id`/`--resume`), `PERMITIDAS`, `DENEGADAS`, `parseSalidaClaude(result)` → `{texto, resumen, accion, recomendacion, denegaciones}`, `traducirError(texto)`, `parseLineaPipeline(linea)` → `{tipo: 'paso'|'fallo'|'render'|'aviso', texto, porcentaje?}` o `null`.

## API HTTP (todas con las comprobaciones Host/Origin existentes)
| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/requisitos` | | `[{id, ok, titulo, detalle, arreglo}]` |
| `GET /api/carpetas/<PLAN>` | | como hoy, y cada guion trae `estado: {fase, actualizado}` |
| `GET /api/video/<PLAN>/<NOMBRE>` | | `{estado, log: [líneas], archivos: {entrada, preview, video, caption}}` (booleanos) |
| `POST /api/subidas/<PLAN>/<NOMBRE>?ext=m4a` | binario (`application/octet-stream`) | `{estado}` |
| `POST /api/video/<PLAN>/<NOMBRE>/empezar` | `{estilo}` | `202 {trabajo}`: prepara y planifica hasta el preview |
| `POST /api/video/<PLAN>/<NOMBRE>/recomendar` | `{}` | `202 {trabajo}`; el resultado llega por SSE como `recomendacion` |
| `POST /api/video/<PLAN>/<NOMBRE>/cambios` | `{texto}` (≤ 1500 caracteres) | `202 {trabajo}`: aplica cambios y regenera el preview |
| `POST /api/video/<PLAN>/<NOMBRE>/aprobar` | `{}` | `202 {trabajo}`: renderiza y escribe el caption |
| `POST /api/video/<PLAN>/<NOMBRE>/reintentar` | `{}` | `202 {trabajo}` |
| `POST /api/cancelar` | `{trabajo?}` | `{ok}` |
| `GET /api/trabajos` | | `[{id, tipo, plan, nombre}]` activos |
| `GET /api/trabajos/<ID>/progreso` | | SSE (ver eventos) |
| `GET /api/archivo/<PLAN>/<NOMBRE>/<tipo>[?descargar=1]` | | archivo (`entrada\|preview\|video\|caption`) con `Range` |
| `GET /api/videos` | | `[{plan, nombre, titulo, actualizado}]` de los videos `listo` |
| `GET /api/voces` | | `[{id, nombre, disponible, motivo?}]` (`laura`, `profe`; `motivo` explica por qué no está disponible, p. ej. falta `ELEVENLABS_VOICE_ID_LAURA` en `.env`; nunca incluye claves) |
| `POST /api/guiones/<PLAN>` | `{tema?, cantidad?}` (tema ≤ 300, cantidad 1–12, defecto 5) | `202 {trabajo}`: Claude (edit-script) **añade** guiones a un plan existente (404 si no existe). No confundir con `POST /api/guiones` (plan nuevo: `tema, cantidad, largo`, responde `202 {request}` y usa `/api/guiones/progreso`) |
| `POST /api/guiones/<PLAN>/<NOMBRE>/cambios` | `{texto}` (≤ 1500 caracteres) | `202 {trabajo}`: Claude modifica `<NOMBRE>.txt` (y su entrada en plan.json/PLAN.md); `fin ok:false` si el guion no cambió |
| `POST /api/video-desde-guion/<PLAN>/<NOMBRE>/empezar` | `{voz}` (`laura`; `profe` → 409 «todavía no está lista»; otra → 400) | `202 {trabajo}`: genera la voz con ElevenLabs desde el guion, la guarda como `media/input/<PLAN>/<NOMBRE>.mp3` (reemplaza otra entrada y lo intermedio), pone entrada `audio` + estilo `voice` y encadena preparación + planificación `edit-voice` como `empezar`. 400 si la voz no está configurada o el guion está vacío/supera 5000 caracteres |
Los trabajos de guiones (`tipo` `guion-cambios` / `guion-plan`) emiten `progreso`, `accion` y `fin` por `GET /api/trabajos/<ID>/progreso`; comparten el candado global y se cancelan con `POST /api/cancelar`. Cancelar mientras se genera la voz espera a que termine la petición a ElevenLabs y descarta el audio.

Errores: `{error: "texto en español"}` con 400/404/409 (ya hay un trabajo pesado en curso: incluye `trabajo`) / 413.

## Eventos SSE (`data: <json>`)
`{type:'progreso', mensaje, paso?, porcentaje?}` · `{type:'estado', estado}` (estado completo nuevo) · `{type:'recomendacion', estilo, texto}` · `{type:'accion', texto}` · `{type:'fin', ok, error?, cancelado?}`. Al conectar se reenvía el registro del trabajo.

## Reglas
- Un solo trabajo pesado a la vez (candado global). Cancelar mata el árbol de procesos.
- Los nombres de archivo del cliente nunca se usan: el destino se arma con `<PLAN>/<NOMBRE>` validados.
- Todo texto de Claude o de scripts se muestra con `textContent` (nunca `innerHTML`).
