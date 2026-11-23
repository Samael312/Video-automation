# Orden del código: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** partir `web/server.js` en http/rutas/arranque con un smoke test HTTP y pasar el navegador a módulos ES sin globales, sin cambios visibles.

**Architecture:** `crearServidor(deps)` recibe todo lo que hoy son constantes del módulo (root, gestor, flujo…), así el smoke test lo levanta sobre un root temporal con un flujo falso. `web/http.js` = utilidades; `web/rutas.js` = tabla de rutas. En el navegador, `main.js` importa módulos pequeños.

**Tech Stack:** Node CommonJS, vitest, módulos ES del navegador.

**Spec:** `docs/superpowers/specs/2026-11-23-orden-codigo-design.md`

## Global Constraints
- NUNCA `git add/commit/merge/push`. Al final: lista de archivos + mensaje propuesto.
- Mismas rutas, códigos HTTP, JSON y textos. Mismo HTML visible.
- `Cache-Control: no-store` en todo lo que hoy pasa por `send`.
- Los estáticos siguen en la raíz de `web/public/` (`RE_ESTATICO` sin subcarpetas).
- Nada de `innerHTML` (regla actual del frontend).
- Pruebas en Chrome con la web en el puerto 3999; sin tocar videos reales; borrar capturas al final.

## Review Focus
1. **Arranque directo** (`npm run web`, `Iniciar-web.bat`): `server.js` sigue escuchando, con transcriptor y los mensajes de consola. → Task 3, Step 4 (arranque real).
2. **El smoke test no arranca el transcriptor** (Python, 2–3 GB): `crearServidor` no lo toca; solo el bloque `require.main === module`. → Task 1 (el test no puede lanzar python: deps sin transcriptor).
3. **Orden de evaluación en módulos**: el código que se ejecuta al cargar (listeners, `ruta()` inicial, estado de los botones) debe seguir corriendo una vez. → Task 5, recorrido en Chrome.
4. **Ciclos de importación** `video.js` ↔ `paneles.js`: el estado compartido va en `asistente.js`. → Task 5, `node --check` + carga sin errores en la consola.
5. **Errores dentro de un manejador** (JSON inválido, cuerpo demasiado grande): siguen dando 400 con el mensaje. → smoke test (POST con JSON inválido → 400 "JSON inválido").

---

### Task 1: `crearServidor(deps)` + smoke test
**Files:** Modify `web/server.js`; Create `web/servidor.smoke.test.ts`.
**Interfaces (Produces):** `crearServidor({root, inputDir, publicDir, host, port, gestor, flujo, trabajosGuion, revisarRequisitos, checkClaude, voces}) -> http.Server` (sin `listen`); `module.exports = {crearServidor}`; el arranque real va en `if (require.main === module)`.
- [ ] Step 1: refactor mecánico. El cuerpo de hoy pasa dentro de `crearServidor`, con las constantes del módulo convertidas en `deps`. No se mueve código entre archivos.
- [ ] Step 2: smoke test con los 7 puntos del spec, más JSON inválido → 400, más `Cache-Control: no-store` en `/app.js`. Root temporal con `media/input/PLANX/G1.txt`, `media/output/edited/ED1/ED1_edited.mp4`; `publicDir` = el `web/public` real; flujo falso que registra llamadas.
- [ ] Step 3: `npx vitest run web/servidor.smoke.test.ts` → verde. (El RED aquí es "no existe crearServidor": se ve fallar antes del Step 1.)

### Task 2: `web/http.js` y `web/rutas.js`
**Files:** Create `web/http.js`, `web/rutas.js`, `web/http.test.ts`; Modify `web/server.js`.
**Interfaces:**
- `http.js`: `send`, `readJson(req, max)`, `allowed(req, esSubida, {host, port})`, `servirEstatico(req, res, publicDir, p) -> boolean` (true si lo atendió), `RE_ESTATICO`, `TIPOS_ESTATICO`, `MAX_BODY`.
- `rutas.js`: `crearRutas(deps) -> {manejar(req, res)}`.
- [ ] Step 1: `http.test.ts` (RED): `allowed` con Host/Origin/Content-Type buenos y malos; `readJson` con JSON inválido → rechaza con "JSON inválido"; con un cuerpo mayor que `max` → "Petición demasiado grande".
- [ ] Step 2: mover el código; `server.js` usa `crearRutas`. La tabla de rutas valida `plan` y `nombre` donde hoy se valida (sin validar más que hoy, para no cambiar respuestas).
- [ ] Step 3: vitest completo (el smoke test incluido) + `node --check web/*.js` → verde.

### Task 3: arranque real
- [ ] Step 1: `PORT=3999 node web/server.js` → mismos mensajes de consola; `/salud` del transcriptor responde. Cerrar.

### Task 4: navegador, funciones puras con tests
**Files:** Create `web/public/comun.js`, `web/public/markdown.js`, `web/public/pendiente.js`, `web/public/front.test.ts`.
- [ ] Step 1: tests (RED) de `renderMarkdown`/`inline` (escapa, negrita, listas, títulos; usa un `document` mínimo con happy-dom si vitest lo trae; si no, se prueba `inline` y la división en bloques), `nombreDesdeArchivo`, `pasoDe`, `mb`, `rutaVideo`, `urlArchivo` y `tomarPendiente` (una sola vez).
- [ ] Step 2: crear los módulos con `export`.

### Task 5: navegador, partir en módulos
**Files:** Create `guiones.js`, `video.js` (reescrito), `paneles.js`, `asistente.js`, `mis-videos.js`, `main.js`; Modify `secciones.js`, `index.html`; Delete `app.js` (su contenido pasa a `guiones.js` y `main.js`).
- [ ] Step 1: repartir según la tabla del spec. Cada archivo importa lo que usa.
- [ ] Step 2: `index.html` → `<script type="module" src="/main.js">`.
- [ ] Step 3: vitest + tsc → verde.
- [ ] Step 4: Chrome en el puerto 3999: recorrer todas las secciones y abrir un video de Mis videos; la consola debe estar sin errores. Comparar con capturas tomadas **antes** del Task 5.

### Task 6: docs + revisión final
- [ ] Step 1: `docs/WEB_API.md` (módulos backend/frontend).
- [ ] Step 2: revisor de contexto limpio; corregir Critical/Important con TDD.
