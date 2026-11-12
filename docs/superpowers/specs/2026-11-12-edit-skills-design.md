# Skills de edición por estrategia (Plan 3) — Diseño

Fecha: 2026-11-12. Continúa `2026-11-12-edit-plan-engine-design.md` (motor `edit.json` implementado y mergeado; arreglos de sincronía/emojis en `fix/sync-and-emoji`).

## Objetivo
Que la edición de cada TikTok la decida Claude Code siguiendo una **skill de estrategia**, que produce un `edit.json` válido y lo renderiza después de que el usuario apruebe el plan. Las skills codifican el criterio editorial (cuándo usar motion graphics, cuánto, qué evitar); el motor ya ejecuta.

## Contexto (del usuario)
- Videos de una profesora particular de inglés online para TikTok. Deben ser dinámicos y llamar la atención.
- Formatos: ¿Sabías que?, gramática, reglas, idioms, phrasal verbs, pronunciación, frases para sonar más nativo, vocabulario, curiosidades (como *actually*).
- Ejecuta Claude Code en sesión con el usuario. Sin APIs de pago.
- Revisión elegida: **revisar el plan** (resumen + capturas por escena) antes del render final.
- El usuario solo invoca una skill (`/edit-mixed video.mp4`, `/edit-router video.mp4`, ...). Cada skill de estrategia carga `video-base` por sí misma.

## Skills (`.claude/skills/<nombre>/SKILL.md`)

### `video-base` (no se invoca directo; la cargan las demás)
1. **Flujo** (igual para todas):
   1. `npm run edit -- <video> --plan-only` → normaliza, transcribe (`medium`), corta. No renderiza.
   2. `npm run inspect -- <video>` → leer transcripción con tiempos originales y tramos conservados/cortados.
   3. Escribir `public/<video>.edit.json` según la estrategia.
   4. `npm run validate -- <video>` hasta que pase; corregir con los mensajes del validador.
   5. `npm run preview -- <video>` → hoja de capturas; mostrar al usuario un resumen (gancho, escenas con su texto, overlays, CTA) y la hoja. **Parar y esperar aprobación.**
   6. Con aprobación: `npm run render:plan -- <video>`. Con cambios: volver al paso 3.
2. **Esquema** de `edit.json`: referencia a `src/lib/plan.ts` y el ejemplo `public/ACTUALLY.edit.json`, con una tabla de plantillas (`data` de cada tipo) y cuándo usar cada una.
3. **Reglas comunes:**
   - Gancho en los primeros 2 s (título o primera escena).
   - Algo nuevo en pantalla cada ~3 s (overlay, emoji, zoom por palabra clave, escena).
   - Escenas solo sobre tramos conservados, dentro de un solo tramo, 1–8 s.
   - No dejar overlays que dupliquen el contenido de una escena (se dibujan encima).
   - Texto en inglés tal como lo dice la profe; si la transcripción lo deformó, corregir el texto del plan (nunca inventar contenido que no dice).
   - Emojis solo de `public/emoji/` o descargados con `npm run emoji`.
   - Cierre con CTA (`end`) según `brand.md`.
4. **`brand.md`**: tono, público, frases de gancho y de cierre de la profe, colores ya fijados por el tema. Arranca con los valores del video de referencia ("Sabias que??", "¿Te sirvió?", "Sígueme para más tips") y el usuario lo edita.

### Estrategias (cada una: "carga `video-base`, sigue su flujo, y además…")
| Skill | Para | Usa | Evita |
|---|---|---|---|
| `edit-captions` | Videos rápidos, mucha emoción en cámara, frases para sonar nativo | Subtítulos, labels con flecha, emojis, zoom en palabras clave; `scenes: []` | Cortar a animación |
| `edit-motion` | Gramática, reglas, pronunciación | Una escena por tramo explicativo (`example`, `mistake`, `pronounce`, `generated` si ninguna plantilla encaja); persona en el gancho y el cierre | Más del ~60 % del video en escenas seguidas sin volver a la persona |
| `edit-mixed` | Falsos amigos / ¿Sabías que?, idioms, phrasal verbs, vocabulario, curiosidades | Persona + 1–3 escenas en los momentos clave (`translate`, `false-friend`, `example`), `quiz` de cierre opcional | Escena en el gancho; más de 3 escenas en < 30 s |
| `edit-router` | Cualquier video | Clasifica el formato (los 9 del contexto) con `inspect` y recomienda estrategia con su razón; el usuario confirma y se sigue esa skill | Decidir sin mostrar la razón |

Mapeo del router: gramática/reglas/pronunciación → `motion`; falsos amigos/¿Sabías que?/curiosidades/idioms/phrasal verbs/vocabulario → `mixed`; frases para sonar nativo → `captions` (o `mixed` si la profe explica cada frase).

### Escenas generadas
Si ninguna plantilla encaja, la skill puede crear `src/scenes/generated/<nombre>.tsx` y registrarlo (convención del Plan 2). Debe verificarlo en la hoja de preview antes de pedir aprobación.

## Herramientas nuevas (código, con tests)
- **`npm run edit -- <video> --plan-only`**: el pipeline de `scripts/edit.js` se detiene antes de validar/renderizar.
- **`npm run inspect -- <video>`**: imprime una línea por palabra `[t_original] palabra` agrupada por tramo, marcando `--- CORTE (a..b) ---` entre tramos y la duración final. Lógica pura `formatInspect(transcript, keeps)` en `src/lib/inspect.ts`, testeada.
- **`npm run preview -- <video>`**: valida, renderiza un still en el centro de cada escena y de cada overlay label (tiempos reubicados con los cortes) y los une en `media/output/<video>_preview.png` (ffmpeg). Lógica pura `previewFrames(plan, keeps, fps)` testeada.
- **`npm run emoji -- <codepoint...>`**: descarga Noto Emoji PNG 512 px (Apache 2.0) desde jsDelivr con tag fijado a `public/emoji/<codepoint>.png`; no sobrescribe; error claro si el código no existe. Normalización del código (`U+1F600`, `1F600`, `😀` → `1f600`) en una función pura testeada.

## Pruebas
- vitest: `formatInspect`, `previewFrames`, normalización de códigos de emoji.
- Validación de skills (manual, con el usuario): correr `/edit-router` y al menos dos estrategias sobre `ACTUALLY.mp4` (y otro video si el usuario lo aporta) siguiendo el flujo completo hasta la pausa de revisión y el render.

## Fuera de alcance
Estilos visuales nuevos, nuevos tipos de plantilla, publicación en TikTok.

## Orden de construcción
1. `--plan-only` + `inspect`
2. `preview`
3. `emoji`
4. `video-base` + `brand.md`
5. `edit-captions`, `edit-motion`, `edit-mixed`
6. `edit-router`
7. Prueba de punta a punta con el usuario
