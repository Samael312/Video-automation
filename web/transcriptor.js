// Trabajador de transcripcion en memoria (pipeline/transcribe_worker.py): la web lo arranca al iniciar
// para que Whisper ya este cargado cuando la profe suba algo. Si no esta o muere, url() es null y
// edit.js usa la linea de comandos de siempre.
const childProcess = require('child_process');
const path = require('path');
const readline = require('readline');

const parsearListo = (linea) => {
  const m = /^LISTO (\d+)\s*$/.exec(String(linea));
  return m ? Number(m[1]) : null;
};

function crearTranscriptor({root, py, spawn = childProcess.spawn, log = console.log}) {
  let proc = null;
  let puerto = null;

  function iniciar() {
    if (proc) return;
    try {
      const p = spawn(py, ['-u', path.join(root, 'pipeline', 'transcribe_worker.py'), '--port', '0', '--parent-pid', String(process.pid), '--warm'], {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc = p;
      readline.createInterface({input: p.stdout}).on('line', (l) => {
        const n = parsearListo(l);
        if (n && proc === p) {
          puerto = n;
          log(`Transcriptor en memoria listo (puerto ${n}); se calienta en segundo plano.`);
        } else if (/trabajador caliente/.test(l)) log('Transcriptor en memoria caliente.');
      });
      p.stderr.on('data', () => {}); // avisos de librerias: no llenar la consola
      const fin = () => {
        if (proc !== p) return;
        proc = null;
        puerto = null;
      };
      p.on('exit', fin);
      p.on('error', (e) => {
        log(`aviso: no arrancó el transcriptor en memoria (${e.message}); se usa el normal.`);
        fin();
      });
    } catch (e) {
      log(`aviso: no arrancó el transcriptor en memoria (${e.message}); se usa el normal.`);
      proc = null;
      puerto = null;
    }
  }

  const url = () => (proc && puerto ? `http://127.0.0.1:${puerto}` : null);

  function parar() {
    const p = proc;
    proc = null;
    puerto = null;
    if (p) {
      try {
        p.kill();
      } catch {
        /* ya muerto */
      }
    }
  }

  let relanzamientos = 0;
  /** url() y, si el trabajador murio (no si esta arrancando), lo relanza una sola vez en total. */
  function urlConRelanzo() {
    const u = url();
    if (!u && !proc && relanzamientos < 1) {
      relanzamientos++;
      iniciar();
    }
    return u;
  }

  return {iniciar, url, urlConRelanzo, parar};
}

module.exports = {crearTranscriptor, parsearListo};
