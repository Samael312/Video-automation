// Web local de guiones y edicion de video. Uso: npm run web  (o doble clic en Iniciar-web.bat)
// Escucha solo en 127.0.0.1. Lanza `claude -p` (Claude Code sin pantalla, con la sesion ya iniciada en este PC) y los
// scripts del pipeline dentro de la carpeta del proyecto. Contrato de la API: docs/WEB_API.md
// Este archivo solo arma las dependencias y arranca; utilidades HTTP en http.js y rutas en rutas.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const {execFile} = require('child_process');
const lib = require('./lib');
const estadoMod = require('./estado');
const requisitos = require('./requisitos');
const jobs = require('./jobs');
const {crearFlujo, REQ_PIPELINE} = require('./flujo');
const {crearTrabajosGuion} = require('./guionesjob');
const voces = require('./voces');
const {crearTranscriptor} = require('./transcriptor');
const {crearRutas} = require('./rutas');

function checkClaudeReal() {
  return new Promise((resolve) => {
    const r = lib.resolveClaude();
    if (!r) return resolve({claude: false});
    execFile(r.cmd, [...r.prefijo, '--version'], {shell: false, windowsHide: true, timeout: 15000, env: lib.claudeEnv()}, (err, stdout) => {
      const perfil = lib.detectClaudeConfig().profile;
      resolve(err ? {claude: false} : {claude: true, version: String(stdout).trim(), perfil, sesion: perfil !== 'ninguno'});
    });
  });
}

/**
 * Servidor HTTP de la web, sin listen. deps: {root, inputDir, publicDir, host, port, gestor, flujo, trabajosGuion,
 * revisarRequisitos, checkClaude?, voces}. port 0 = el que asigne listen (Host/Origin se comparan con el real).
 */
function crearServidor(deps) {
  let server = null;
  const port = () => deps.port || (server && server.address() ? server.address().port : 0);
  const rutas = crearRutas({...deps, checkClaude: deps.checkClaude || checkClaudeReal, port});
  server = http.createServer((req, res) => rutas.manejar(req, res));
  // Las subidas son archivos grandes: sin limite de tiempo por peticion (el tope es el tamano).
  server.requestTimeout = 0;
  return server;
}

if (require.main === module) {
  const ROOT = path.join(__dirname, '..');
  const INPUT = path.join(ROOT, 'media', 'input');
  const HOST = '127.0.0.1';
  const PORT = Number(process.env.PORT) || 3000;
  const gestor = new jobs.Gestor();
  const revisarRequisitos = () => requisitos.comprobarRequisitos(ROOT, process.env);
  const faltantes = async (ids) => revisarRequisitos().filter((r) => !r.ok && ids.includes(r.id));

  // Transcriptor en memoria: arranca tras listen; si muere se relanza una sola vez (luego, camino normal).
  const PY_VENV = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  const transcriptor = crearTranscriptor({root: ROOT, py: PY_VENV});
  const transcriptorUrl = () => (fs.existsSync(PY_VENV) ? transcriptor.urlConRelanzo() : null);
  process.on('exit', () => transcriptor.parar());
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(0));

  const flujo = crearFlujo({root: ROOT, inputDir: INPUT, gestor, faltantes, voces, transcriptorUrl});
  const trabajosGuion = crearTrabajosGuion({root: ROOT, inputDir: INPUT, gestor, faltantes});
  const server = crearServidor({root: ROOT, inputDir: INPUT, publicDir: path.join(__dirname, 'public'), host: HOST, port: PORT, gestor, flujo, trabajosGuion, revisarRequisitos, voces});
  const interrumpidos = estadoMod.marcarInterrumpidos(INPUT);

  server.listen(PORT, HOST, () => {
    console.log(`
Web de guiones y edición lista: http://localhost:${PORT}
Perfil de Claude: ${lib.detectClaudeConfig().profile}`);
    if (interrumpidos) console.log(`${interrumpidos} edición(es) se habían interrumpido: se pueden reintentar desde la web.`);
    const faltan = revisarRequisitos().filter((r) => !r.ok && REQ_PIPELINE.includes(r.id));
    if (faltan.length) console.log(`Faltan requisitos para editar video: ${faltan.map((f) => f.titulo).join(', ')} (la web lo explica).`);
    console.log('(Deja esta ventana abierta mientras la uses; ciérrala para apagar la web.)');
    if (fs.existsSync(PY_VENV)) transcriptor.iniciar();
  });
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `El puerto ${PORT} ya está en uso. ¿Ya tienes la web abierta?` : err.message);
    process.exit(1);
  });
}

module.exports = {crearServidor};
