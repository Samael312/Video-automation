// Gestor de trabajos de la web local: registro con id, candado de trabajo pesado, SSE con reenvio del registro
// y los dos corredores (comando normal y `claude -p`). Sin dependencias; los procesos se pueden sustituir en pruebas.
const crypto = require('crypto');
const {spawn} = require('child_process');

const IS_WIN = process.platform === 'win32';
const MAX_LOG = 500; // eventos que se guardan por trabajo (para reenviar al reconectar)
const KEEP_FINISHED = 20; // trabajos terminados que se recuerdan en memoria

/** Mata el proceso y todos sus hijos (en Windows `claude`/`npm` son cmd.exe con hijos). */
function killTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {windowsHide: true});
  else child.kill('SIGTERM');
}

/** Parte un flujo de texto en lineas completas; llama a `onLine` por cada una y devuelve `flush()` para el resto. */
function lineSplitter(onLine) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.search(/\r\n|\n|\r/)) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + (buf.startsWith('\r\n', i) ? 2 : 1));
        onLine(line);
      }
    },
    flush() {
      if (buf.trim()) onLine(buf);
      buf = '';
    },
  };
}

class Trabajo {
  constructor({tipo, plan = null, nombre = null, pesado = true}) {
    this.id = crypto.randomBytes(6).toString('hex');
    this.tipo = tipo;
    this.plan = plan;
    this.nombre = nombre;
    this.pesado = pesado;
    this.corriendo = true;
    this.cancelado = false;
    this.child = null;
    this.log = [];
    this.clientes = new Set();
    this.inicio = Date.now();
  }

  /** Guarda el evento (con tope y su hora `en`) y lo manda a quienes estan escuchando. */
  emitir(ev) {
    if (ev && typeof ev === 'object' && typeof ev.en !== 'number') ev = {...ev, en: Date.now()};
    this.log.push(ev);
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    const linea = `data: ${JSON.stringify(ev)}\n\n`;
    for (const res of this.clientes) res.write(linea);
  }

  /** Engancha una respuesta HTTP como cliente SSE: reenvia el registro y sigue en vivo. */
  suscribir(req, res) {
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive'});
    for (const ev of this.log) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    if (!this.corriendo) return res.end();
    this.clientes.add(res);
    req.on('close', () => this.clientes.delete(res));
  }

  cancelar() {
    if (!this.corriendo) return;
    this.cancelado = true;
    killTree(this.child);
  }

  terminar() {
    this.corriendo = false;
    this.child = null;
    for (const res of this.clientes) res.end();
    this.clientes.clear();
  }

  resumen() {
    return {id: this.id, tipo: this.tipo, plan: this.plan, nombre: this.nombre};
  }
}

class Gestor {
  constructor() {
    this.trabajos = new Map();
  }

  /** El trabajo pesado en curso (solo se permite uno a la vez: la CPU manda). */
  activoPesado() {
    for (const t of this.trabajos.values()) if (t.corriendo && t.pesado) return t;
    return null;
  }

  crear(opts) {
    const t = new Trabajo(opts);
    this.trabajos.set(t.id, t);
    // se recuerdan solo los ultimos terminados
    const terminados = [...this.trabajos.values()].filter((x) => !x.corriendo);
    for (const viejo of terminados.slice(0, Math.max(0, terminados.length - KEEP_FINISHED))) this.trabajos.delete(viejo.id);
    return t;
  }

  obtener(id) {
    return typeof id === 'string' ? this.trabajos.get(id) || null : null;
  }

  activos() {
    return [...this.trabajos.values()].filter((t) => t.corriendo).map((t) => t.resumen());
  }

  /** El trabajo en curso de un video (para reconectar al recargar la pagina). */
  activoDe(plan, nombre) {
    return [...this.trabajos.values()].find((t) => t.corriendo && t.plan === plan && t.nombre === nombre) || null;
  }
}

/**
 * Corre un comando (sin LLM). `onLine(linea, fuente)` recibe cada linea de stdout/stderr.
 * Devuelve {code, cola} con las ultimas lineas (para explicar fallos).
 */
function correrComando(trabajo, cmd, args, {cwd, env, shell = IS_WIN, timeoutMs = 60 * 60 * 1000, onLine = () => {}} = {}) {
  return new Promise((resolve) => {
    const cola = [];
    const recordar = (linea, fuente) => {
      if (linea.trim()) {
        cola.push(linea);
        if (cola.length > 60) cola.shift();
      }
      onLine(linea, fuente);
    };
    let child;
    try {
      child = spawn(cmd, args, {cwd, env, shell, windowsHide: true});
    } catch (err) {
      return resolve({code: -1, cola: [String(err.message)]});
    }
    trabajo.child = child;
    const out = lineSplitter((l) => recordar(l, 'stdout'));
    const err = lineSplitter((l) => recordar(l, 'stderr'));
    const timer = setTimeout(() => {
      cola.push('Se agotó el tiempo máximo del paso.');
      killTree(child);
    }, timeoutMs);
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({code: -1, cola: [e.code === 'ENOENT' ? `No se encontró el comando ${cmd}` : String(e.message)]});
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      out.flush();
      err.flush();
      resolve({code, cola});
    });
  });
}

/**
 * Corre `claude` headless: el prompt va por stdin y la salida stream-json se parte en eventos.
 * `onEvento(ev)` recibe cada evento; devuelve {code, result, stderr} (result = evento final de tipo `result`).
 */
function correrClaude(trabajo, args, prompt, {cwd, env, shell = IS_WIN, comando = 'claude', timeoutMs = 30 * 60 * 1000, onEvento = () => {}} = {}) {
  return new Promise((resolve) => {
    let result = null;
    let stderr = '';
    let child;
    try {
      child = spawn(comando, args, {cwd, env, shell, windowsHide: true});
    } catch (err) {
      return resolve({code: -1, result, stderr: String(err.message)});
    }
    trabajo.child = child;
    const out = lineSplitter((linea) => {
      const t = linea.trim();
      if (!t) return;
      try {
        const ev = JSON.parse(t);
        if (ev && ev.type === 'result') result = ev;
        onEvento(ev);
      } catch {
        /* linea que no es JSON: se ignora */
      }
    });
    const timer = setTimeout(() => killTree(child), timeoutMs);
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({code: -1, result, stderr: e.code === 'ENOENT' ? 'claude no instalado' : String(e.message)});
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      out.flush();
      resolve({code, result, stderr});
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

module.exports = {IS_WIN, MAX_LOG, killTree, lineSplitter, Trabajo, Gestor, correrComando, correrClaude};
