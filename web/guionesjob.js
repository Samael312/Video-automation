// Trabajos de guiones sobre planes ya existentes: pedir cambios a un guion y generar mas guiones dentro de un plan.
// Corren `claude -p` (skill edit-script) bajo el mismo candado global que el resto. Los procesos se pueden sustituir en pruebas.
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const jobs = require('./jobs');
const prompts = require('./prompts');
const guiones = require('./guiones');

const MIN = 60 * 1000;
const err = (status, error, extra = {}) => ({ok: false, status, error, ...extra});

/** Mas guiones dentro de un plan que ya existe (promptPlan crea carpetas nuevas; aqui se anade a la existente). */
function promptMasGuiones({plan, tema, cantidad}) {
  if (!lib.isSafeFolder(plan)) throw new Error('plan no válido');
  const base = guiones.promptPlan({tema, cantidad}); // valida tema y cantidad
  return [
    base,
    `CAMBIO IMPORTANTE para esta petición: NO crees una carpeta nueva. Añade los guiones nuevos dentro de la carpeta existente media/input/${plan}/ ` +
      '(un .txt por guion con un nombre que no exista ya) y añade sus entradas a plan.json y PLAN.md. No modifiques ni borres los guiones que ya existen.',
  ].join('\n');
}

function crearTrabajosGuion({root, inputDir = path.join(root, 'media', 'input'), gestor, faltantes = async () => [], claudeEnv = () => lib.claudeEnv(), resolveClaude = () => lib.resolveClaude(), correrClaude = jobs.correrClaude}) {
  async function previo(plan, nombre) {
    if (!lib.isSafeFolder(plan)) return err(400, 'Nombre no válido.');
    if (nombre !== undefined) {
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(nombre)) return err(400, 'Nombre no válido.');
      if (!guiones.leerGuion(root, plan, nombre)) return err(404, 'No encuentro ese guion.');
    } else if (!fs.existsSync(path.join(inputDir, plan)) || !lib.getFolder(inputDir, plan)) return err(404, 'No encuentro ese plan.');
    const activo = gestor.activoPesado();
    if (activo) return err(409, 'Ya hay un trabajo en curso. Espera a que termine o cancélalo.', {trabajo: activo.id});
    const f = await faltantes(['claude']);
    if (f.length) return err(400, `Faltan requisitos en este PC: ${f.map((x) => x.titulo).join(', ')}.`, {faltantes: f});
    return {ok: true};
  }

  function lanzar(tipo, plan, nombre, prompt, despues) {
    const job = gestor.crear({tipo, plan, nombre: nombre || null, pesado: true});
    job.emitir({type: 'progreso', mensaje: 'Empezando…'});
    (async () => {
      try {
        const r = resolveClaude();
        if (!r) return job.emitir({type: 'fin', ok: false, error: 'No encuentro Claude Code en este PC.'});
        const run = await correrClaude(job, [...r.prefijo, ...prompts.argsClaude({sessionId: require('crypto').randomUUID()})], prompt, {
          cwd: root,
          env: claudeEnv(),
          comando: r.cmd,
          shell: false,
          timeoutMs: 15 * MIN,
          onEvento: (ev) => {
            const m = lib.progressMessage(ev);
            if (m) job.emitir({type: 'progreso', mensaje: m});
          },
        });
        if (job.cancelado) return job.emitir({type: 'fin', ok: false, cancelado: true});
        const salida = guiones.parseSalidaGuiones(run.result);
        if (!run.result) return job.emitir({type: 'fin', ok: false, error: prompts.traducirError(run.stderr || 'Claude no respondió.')});
        if (salida.error) return job.emitir({type: 'fin', ok: false, error: prompts.traducirError(run.result.result || run.stderr)});
        if (salida.accion) {
          job.emitir({type: 'accion', texto: salida.accion});
          return job.emitir({type: 'fin', ok: false, error: salida.accion});
        }
        const mal = despues ? despues() : null;
        if (mal) return job.emitir({type: 'fin', ok: false, error: mal});
        job.emitir({type: 'fin', ok: true, resumen: salida.resumen || ''});
      } catch (e) {
        job.emitir({type: 'fin', ok: false, error: lib.friendlyError(String(e && e.message))});
      } finally {
        job.terminar();
      }
    })();
    return {ok: true, trabajo: job.id};
  }

  /** POST /api/guiones/<PLAN>/<NOMBRE>/cambios {texto} */
  async function cambiosGuion(plan, nombre, texto) {
    let limpio;
    try {
      limpio = prompts.limpiarCambios(texto);
    } catch {
      return err(400, 'Escribe qué quieres cambiar.');
    }
    if (String(texto).trim().length > guiones.MAX_FEEDBACK) return err(400, `Los cambios son muy largos (máximo ${guiones.MAX_FEEDBACK} caracteres).`);
    const p = await previo(plan, nombre);
    if (!p.ok) return p;
    const antes = guiones.leerGuion(root, plan, nombre).texto;
    return lanzar('guion-cambios', plan, nombre, guiones.promptFeedbackGuion({plan, nombre, texto: limpio}), () => {
      const ahora = guiones.leerGuion(root, plan, nombre);
      return ahora && ahora.texto !== antes ? null : 'Claude respondió pero no cambió el guion. Prueba a explicarlo de otra forma.';
    });
  }

  /** POST /api/guiones/<PLAN> {tema, cantidad}: mas guiones en un plan existente. */
  async function masGuiones(plan, {tema, cantidad} = {}) {
    let prompt;
    try {
      prompt = promptMasGuiones({plan, tema, cantidad});
    } catch (e) {
      return err(400, `${String(e.message).charAt(0).toUpperCase()}${String(e.message).slice(1)}.`);
    }
    const p = await previo(plan);
    if (!p.ok) return p;
    const antes = new Set(guiones.listarGuiones(root, plan).map((g) => g.nombre));
    return lanzar('guion-plan', plan, null, prompt, () => (guiones.listarGuiones(root, plan).some((g) => !antes.has(g.nombre)) ? null : 'Claude respondió pero no creó ningún guion nuevo en el plan. Vuelve a intentar.'));
  }

  return {cambiosGuion, masGuiones};
}

module.exports = {crearTrabajosGuion, promptMasGuiones};
