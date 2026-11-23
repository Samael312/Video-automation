# Orden del código de la web: diseño

Fecha: 2026-11-23. Pieza 3 de 4 de "mejorar la web" (robusto → rápido → **orden** → diseño). Va después de `2026-11-23-velocidad-design.md`.

## Problema
- `web/server.js` (352 líneas) mezcla arranque, generación de guiones, utilidades HTTP y unas 15 rutas resueltas con cadenas de `if` + regex. No hay ningún test HTTP: cualquier cambio en las rutas se prueba a mano.
- El navegador son tres scripts clásicos (`video.js` 687 líneas, `app.js` 401, `secciones.js` 299) que comparten globales (`el`, `tag`, `api`, `W`, `ARCHIVO_PENDIENTE`, `carpetaActual`…). Dependen del orden de los `<script>` y no tienen tests.

## Objetivo
Archivos pequeños, cada uno con una responsabilidad, dependencias explícitas y una red de tests que proteja la API y la interfaz. **Sin cambios visibles:** mismas rutas, mismos JSON, mismos textos, mismo HTML.

Fuera de alcance: el diseño visual (pieza 4), cambiar la API y añadir funciones.

## 1. Servidor
- **`web/http.js`** (nuevo), movido sin cambios desde `server.js`:
  - `send(res, status, body, type)`, `readJson(req, max)`, `allowed(req, esSubida, {host, port})`;
  - `servirEstatico(res, publicDir, ruta)` con `RE_ESTATICO` y `TIPOS_ESTATICO`.
- **`web/rutas.js`** (nuevo): `crearRutas(deps) -> {manejar(req, res)}`.
  - `deps = {root, inputDir, publicDir, host, port, gestor, flujo, trabajosGuion, requisitos: () => [...], checkClaude, estadoMod, files}`.
  - Dentro, una tabla `[{metodo, patron, fn(req, res, params, url)}]`. Los parámetros `plan` y `nombre` se validan una sola vez con `RE_PLAN` y `RE_NOMBRE`; si no pasan, 400 con el mismo texto que hoy.
  - También se mueven aquí: `generarGuiones`, `listaListos`, `carpetaConEstados`, `subir`, `archivosDe` y `responder`.
- **`web/server.js`**:
  - Exporta `crearServidor(deps) -> http.Server`, que crea el servidor con `rutas.manejar` y `requestTimeout = 0`.
  - Al ejecutarse directamente (`require.main === module`) arma las dependencias reales (gestor, flujo, transcriptor, `marcarInterrumpidos`), hace `listen` y escribe los mismos mensajes de consola que hoy.
- **Smoke test `web/servidor.smoke.test.ts`**:
  - Levanta `crearServidor` en el puerto 0, sobre un root temporal con `media/input/<PLAN>/`, `media/output/edited/<N>/<N>_edited.mp4` y `web/public` real. Usa un `flujo` y unos requisitos falsos.
  - Hace peticiones HTTP reales y comprueba:
    1. `GET /` → 200 html; `GET /app.js` → 200 `text/javascript`.
    2. `GET /api/carpetas` → la lista; `GET /api/videos` (Mis videos) incluye el editado de `edited/`.
    3. `GET /api/video/<plan>/<n>` → el estado.
    4. Host ajeno → 403; `POST` con Origin ajeno → 403.
    5. Ruta desconocida → 404; plan con `..` o caracteres raros → 400.
    6. `GET /api/archivo/.../video` con Range → 206.
    7. `POST /api/video/<plan>/<n>/empezar` llama a `flujo.empezar` y responde 202 `{trabajo}`.
  - **El test se escribe y pasa contra el `server.js` de hoy antes de partirlo.** Después debe seguir pasando sin cambios.

## 2. Navegador (módulos ES)
- `index.html` carga un solo `<script type="module" src="/main.js">`. Nada de globales: cada archivo importa lo que usa. Los archivos siguen en la raíz de `web/public/`, porque `RE_ESTATICO` no permite subcarpetas.
- Reparto:

| Archivo | Contenido (viene de) |
|---|---|
| `comun.js` | `el`, `tag`, `fecha`, `copiar`, `botonCopiar`, `api`, `pedir`, `textoError`, `conBloqueo`, `enc`, `mb`, `setProgreso`, `setOcupado` (app.js / video.js) |
| `markdown.js` | `inline`, `renderMarkdown` (app.js) |
| `guiones.js` | planes, carpeta, visor, generar y su progreso (app.js) |
| `secciones.js` | inicio de cada sección, `mostrarElegir`, voces, retro (secciones.js) |
| `pendiente.js` | `ponerPendiente(x)`, `tomarPendiente() -> x|null` (sustituye a `ARCHIVO_PENDIENTE`) |
| `video.js` | asistente: `mostrarVideo`, `pintar`, SSE, `lanzar`, acciones (video.js) |
| `paneles.js` | `panelSubir`, `panelRevision`, `panelListo`, `panelAlerta`, `panelCurso`… (video.js) |
| `mis-videos.js` | `mostrarVideos` (video.js) |
| `main.js` | router `hashchange` (`ruta()`), arranque (app.js) |

- Ciclos: si `video.js` y `paneles.js` se necesitan mutuamente, el estado del asistente (`W`, `tokenW`) va en `asistente.js` y los dos lo importan. Así no hay ciclos de importación.
- **Tests (vitest)** de las funciones puras que se exportan:
  - `renderMarkdown`/`inline`: escapa HTML y aplica negrita, listas y títulos;
  - `nombreDesdeArchivo`;
  - `pasoDe(fase)`;
  - `mb`, `fecha`, `rutaVideo`, `urlArchivo`;
  - `tomarPendiente`: devuelve el valor una sola vez.
  
  Si una de ellas toca `document` para construir nodos, se prueba solo su parte pura.

## 3. Reglas y verificación
- Pasos pequeños, cada uno con vitest + tsc verdes: primero el smoke test, luego `http.js`, `rutas.js`, `server.js` y, al final, el navegador.
- `docs/WEB_API.md`: la API no cambia; se actualiza la sección de módulos (backend y frontend).
- **Verificación real en Chrome** (web en el puerto 3999, sin tocar videos reales):
  - recorrer inicio, Guiones (una carpeta y el visor), Editar video, Audio a video, Video desde guion y Mis videos (abrir uno);
  - consola sin errores;
  - capturas comparadas con las de antes del cambio.
  
  Luego borrar las capturas.

## Riesgos
- **Módulos y caché del navegador:** no hay riesgo. `send` ya responde todo con `Cache-Control: no-store` (`web/server.js:97`), así que el navegador nunca usa `.js` viejos. El smoke test lo fija.
- **Orden de evaluación:** el código que hoy corre al cargar (listeners, `ruta()` inicial) pasa a `main.js`, que se ejecuta cuando el DOM ya está listo (los módulos son `defer`).
