# Diseño: web pulida, intuitiva y viva

Fecha: 2026-11-23. Pieza 4 de 4 de "mejorar la web" (robusto → rápido → orden → **diseño**). Opción A elegida: pulir sobre lo que hay. Es una herramienta interna: alcance moderado, sin framework.

## Objetivo
Que la profe sepa siempre qué hacer, que la web se vea consistente y que se note que está trabajando. Misma marca de tuprofemaria (rosa `#e91e8c`, Poppins + DM Sans, tarjetas redondeadas, manchas de color de fondo).

Fuera de alcance: adaptación al móvil (no se pidió), modo oscuro, cambiar la API y nuevas funciones de edición.

## 1. Pulida (`web/public/style.css`)
- **Tokens en `:root`** (se añaden a los colores que ya hay):
  - espaciado `--e1..--e6` = 4/8/12/16/24/32 px;
  - radios `--r-s` 10, `--r-m` 16, `--r-l` 24 y `--r-pill` 999;
  - sombras `--sombra-1` (tarjeta), `--sombra-2` (elevada) y `--sombra-rosa` (botón primario);
  - texto `--t-xs` 12, `--t-s` 14, `--t-m` 16, `--t-l` 20, `--t-xl` 28, `--t-2xl` 40;
  - transición `--rapido` 150 ms y `--suave` 250 ms.
- **Un estilo por componente**, aplicado en toda la web:
  - `.primario`, `.secundario`, `.pequeno` y `:disabled` (opacidad 0.5 y cursor `not-allowed`);
  - `:focus-visible` con anillo rosa de 3 px;
  - `.panel` (tarjeta), `.campo`/`input`/`select`/`textarea` (alto 44 px, borde slate-200, foco rosa) y `.tag`;
  - `.caja-aviso`/`.caja-error`/`.caja-accion` (color, icono y borde izquierdo de 4 px).
- **Limpieza:** se quitan las reglas duplicadas o muertas de las 278 actuales. Las clases que usa el JS no cambian de nombre, salvo las nuevas de esta pieza.

## 2. Intuitiva
- **Inicio nuevo (`#/`)**, con título "¿Qué quieres hacer hoy?":
  - 4 tarjetas grandes (icono, título y una frase): Crear guiones → `#/guiones` · Editar video → `#/editar` · Audio a video → `#/audio` · Video desde guion → `#/desde-guion`;
  - debajo, "Últimos videos": los 3 más recientes de `/api/videos`, con un enlace a Mis videos. Si no hay ninguno: "Cuando termines tu primer video aparecerá aquí."
- **Guiones pasa a `#/guiones`** (el generador y la lista de planes).
  - Los enlaces viejos siguen valiendo: `#/p/PLAN` igual, y "← Mis planes" apunta a `#/guiones`.
  - El menú lateral queda así: Inicio · Guiones · Video desde guion · Editar video · Audio a video · Mis videos.
- **Estados vacíos que guían**, siempre con un botón a la acción:
  - sin planes → "Todavía no hay guiones" + [Crear el primero];
  - Mis videos vacío → [Editar un video];
  - selector sin guiones → [Ir a Guiones].
- **Asistente:** debajo de la barra de pasos, una frase del paso actual:
  - Subir: "Sube la grabación y elige un estilo.";
  - Preparar: "Limpio el audio y transcribo. No tienes que hacer nada.";
  - Plan: "Claude está planificando las escenas.";
  - Revisar: "Mira la vista previa: apruébala o pide cambios.";
  - Render: "Generando el video final.";
  - Listo: "Descárgalo y copia el caption.";
  - en alerta: el texto de la alerta.
- **Errores con acción:** el panel de error ya tiene "Reintentar". Si el error trae requisitos que faltan, se muestra la lista con "Cómo arreglarlo", como en Subir.

## 3. Viva
- **Etapa actual con tiempo** (panel "en curso"):
  - el evento SSE `progreso` ya trae `paso` cuando empieza una etapa (`== transcribir ==`);
  - el navegador guarda `{paso, desde}` y muestra "🎙️ Transcribiendo · 0:18", con un reloj que se actualiza cada segundo;
  - debajo, la lista de etapas ya hechas con ✓ y su duración;
  - iconos por etapa: normalizar 🎬, limpiar audio 🎧, transcribir 🎙️, cortar silencios ✂️, planificar 🧠, validar ✅, preparar ⚙️, prueba 🔍, renderizar 🎞️, volumen final 🔊, terminar 📦; otra etapa → ⏳;
  - la lógica pura (`etapas.js`: nombre → icono y texto bonito, formato `m:ss`, historial de etapas) lleva tests.
- **Al terminar** (la fase pasa a `listo`): un check animado (escala + trazo, 600 ms) y un aviso breve abajo a la derecha, "¡Tu video está listo!" (4 s). Lo mismo en `revision`: "La vista previa está lista."
- **Subida:** "Subiendo… 45 % · 3.2 MB/s · quedan 0:12". Velocidad con media móvil de los últimos 3 s; la lógica pura va en `comun.js` y lleva tests.
- **Transiciones:**
  - las vistas aparecen con `fade-up` de 200 ms;
  - las tarjetas suben 2 px y aumentan su sombra al pasar el ratón;
  - los botones tienen `:active` con `scale(0.98)`;
  - todo se desactiva con `prefers-reduced-motion` (la regla ya existe).
- **Avisos** (`aviso.js`): `mostrarAviso(texto, tipo)`. Un contenedor fijo con `aria-live="polite"`, máximo 3 avisos a la vez. Se usa para listo/revisión y para "Caption copiado".

## Verificación
- vitest: tests de `etapas.js` y de la velocidad/tiempo restante de subida; actualizar `front.test.ts` si cambia algo exportado. El smoke test HTTP sigue verde.
- Chrome (web en el puerto 3999, con un plan de prueba temporal):
  - recorrer Inicio, las 4 tarjetas, Guiones, una carpeta y su visor, Mis videos y un video listo;
  - simular un trabajo en curso con un video de prueba copiado (nunca uno real) solo hasta "preparar", para ver la etapa con reloj; después cancelar;
  - consola sin errores; capturas de antes y después.
  
  Después, borrar el plan de prueba, la copia y las capturas.

## Riesgos
- **Rutas:** `#/` deja de ser Guiones. Los favoritos de la profe a `#/` llevan al Inicio, que enlaza a Guiones. No se rompe nada.
- **Emojis como iconos:** dependen de la fuente del sistema (Windows los tiene). Aceptable en una herramienta interna.
