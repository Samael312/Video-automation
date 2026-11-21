// Logica pura de la web local (sin red ni procesos): se prueba en web/lib.test.ts
const fs = require('fs');
const os = require('os');
const path = require('path');

const LARGOS = {
  corto: '',
  medio: ', de largo medio (30 a 45 segundos)',
  largo: ', de largo largo (45 a 65 segundos)',
};
const MAX_TEMA = 300;
const MAX_CANTIDAD = 12;

/** Arma la frase natural para /edit-script a partir del formulario. */
function buildRequest(form) {
  const f = form && typeof form === 'object' ? form : {};
  const tema = typeof f.tema === 'string' ? f.tema.replace(/\s+/g, ' ').trim() : '';
  if (tema.length > MAX_TEMA) return {ok: false, error: `El tema es muy largo (máximo ${MAX_TEMA} caracteres).`};
  const cantidad = f.cantidad === undefined || f.cantidad === '' ? 5 : Number(f.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
    return {ok: false, error: `La cantidad debe ser un número entre 1 y ${MAX_CANTIDAD}.`};
  }
  const largo = f.largo === undefined || f.largo === '' ? 'corto' : f.largo;
  if (!Object.prototype.hasOwnProperty.call(LARGOS, largo)) return {ok: false, error: 'El largo debe ser corto, medio o largo.'};
  const sujeto = `${cantidad} guion${cantidad === 1 ? '' : 'es'}`;
  const request = `${sujeto}${tema ? ` sobre: ${tema}` : ' con temas variados'}${LARGOS[largo]}`;
  return {ok: true, request};
}

/** Instruccion que recibe Claude (por stdin). */
const buildPrompt = (request) => `/edit-script ${request}`;
/** Plan B si el modo -p no resuelve la skill como comando. */
const buildFallbackPrompt = (request) => `Usa la skill edit-script con esta petición: ${request}`;

const SAFE_FOLDER = /^[A-Za-z0-9_-]{1,80}$/;
const isSafeFolder = (name) => typeof name === 'string' && SAFE_FOLDER.test(name);
const SAFE_GUION = /^[A-Za-z0-9_-]+\.txt$/;

const str = (x, max = 2000) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const strList = (x, maxItems = 12, max = 300) => (Array.isArray(x) ? x.map((v) => str(v, max)).filter(Boolean).slice(0, maxItems) : []);

/** Limpia plan.json (lo escribe Claude: no se confia en su forma). Devuelve null si no se puede leer. */
function parsePlan(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const videos = {};
  for (const v of Array.isArray(raw.videos) ? raw.videos : []) {
    if (!v || typeof v !== 'object') continue;
    const nombre = str(v.nombre, 120);
    if (!nombre) continue;
    videos[nombre] = {
      nombre,
      formato: str(v.formato, 120),
      largo: str(v.largo, 40),
      gancho: str(v.gancho),
      ganchos: strList(v.ganchos, 6),
      estrategia: str(v.estrategia, 200),
      duracion: str(v.duracion, 60),
      caption: str(v.caption, 1500),
      hashtags: strList(v.hashtags, 12, 60),
      notas: str(v.notas, 1500),
    };
  }
  return {titulo: str(raw.titulo, 120), tema: str(raw.tema, 300), creado: str(raw.creado, 40), orden: strList(raw.orden, 30, 120), videos};
}

const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const guionesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => SAFE_GUION.test(n)) : []);

/** Planes (carpetas de media/input) con lo basico para mostrarlos en una tarjeta; el mas reciente primero. */
function listFolders(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((d) => d.isDirectory() && isSafeFolder(d.name))
    .map((d) => {
      const full = path.join(dir, d.name);
      const files = fs.readdirSync(full).filter((n) => SAFE_GUION.test(n) || n === 'plan.json' || n === 'PLAN.md');
      const mtime = files.reduce((m, n) => Math.max(m, fs.statSync(path.join(full, n)).mtimeMs), fs.statSync(full).mtimeMs);
      const planText = readIf(path.join(full, 'plan.json'));
      const plan = planText ? parsePlan(planText) : null;
      return {name: d.name, titulo: (plan && plan.titulo) || d.name, tema: (plan && plan.tema) || '', creado: (plan && plan.creado) || '', count: guionesIn(full).length, mtime};
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.mtime - a.mtime);
}

/** Una carpeta completa: sus guiones con la informacion del plan de cada uno. */
function getFolder(dir, name) {
  if (!isSafeFolder(name)) return null;
  const full = path.join(dir, name);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return null;
  const planText = readIf(path.join(full, 'plan.json'));
  const plan = planText ? parsePlan(planText) : null;
  const files = guionesIn(full).map((f) => f.replace(/\.txt$/, ''));
  const rank = (n) => {
    const i = plan ? plan.orden.indexOf(n) : -1;
    return i < 0 ? 999 : i;
  };
  // primero los del orden sugerido de publicacion; el resto, alfabetico
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const guiones = files.map((nombre) => ({
    nombre,
    texto: fs.readFileSync(path.join(full, `${nombre}.txt`), 'utf8').trim(),
    info: (plan && plan.videos[nombre]) || null,
  }));
  return {name, titulo: (plan && plan.titulo) || name, tema: plan ? plan.tema : '', creado: plan ? plan.creado : '', hayPlan: Boolean(plan), planMd: readIf(path.join(full, 'PLAN.md')), guiones};
}

/** Nombres de carpetas nuevas o modificadas entre dos listados (por mtime). */
function changedFolders(before, after) {
  const prev = new Map(before.map((x) => [x.name, x.mtime]));
  return after.filter((x) => prev.get(x.name) !== x.mtime).map((x) => x.name);
}

/** Mensaje de progreso en español para un evento de `claude --output-format stream-json`; null si no aporta. */
function progressMessage(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (ev.type === 'system' && ev.subtype === 'init') return 'Claude está listo…';
  if (ev.type !== 'assistant' || !ev.message || !Array.isArray(ev.message.content)) return null;
  for (const part of ev.message.content) {
    if (part.type === 'tool_use') {
      const input = part.input || {};
      const target = String(input.file_path || input.path || input.pattern || '');
      const base = target.split(/[\\/]/).pop();
      if (part.name === 'Read') return base ? `Leyendo ${base}…` : 'Leyendo instrucciones…';
      if (part.name === 'Write') return base ? `Escribiendo ${base}…` : 'Escribiendo un guion…';
      if (part.name === 'Edit') return base ? `Ajustando ${base}…` : 'Ajustando un archivo…';
      if (part.name === 'Glob' || part.name === 'Grep') return 'Revisando guiones anteriores…';
      return 'Trabajando…';
    }
    if (part.type === 'text' && part.text && part.text.trim()) return 'Redactando…';
  }
  return null;
}

/** Texto amigable para errores comunes de la CLI. */
function friendlyError(text) {
  const t = String(text || '');
  if (/not logged in|please run \/login|invalid api key|authentication|401/i.test(t)) {
    return 'Claude Code no tiene la sesión iniciada en este PC (busqué en .claude-personal, .claude y .claude-work). Abre Claude Code una vez, inicia sesión y vuelve a intentar.';
  }
  if (/limit|quota|rate/i.test(t)) return 'Se alcanzó el límite de uso de Claude. Espera un rato y vuelve a intentar.';
  return t.trim().split('\n').slice(-3).join(' ').slice(0, 300) || 'Algo falló. Vuelve a intentar.';
}

/** ¿Hay una sesion de Claude Code iniciada en esta carpeta de configuracion? (credenciales o cuenta guardada) */
function hasSession(dir, home) {
  try {
    if (fs.existsSync(path.join(dir, '.credentials.json'))) return true;
    // la carpeta por defecto (~/.claude) guarda la cuenta en ~/.claude.json; las demas, dentro de su carpeta
    for (const f of [path.join(dir, '.claude.json'), ...(path.resolve(dir) === path.resolve(home, '.claude') ? [path.join(home, '.claude.json')] : [])]) {
      if (fs.existsSync(f) && /"oauthAccount"/.test(fs.readFileSync(f, 'utf8'))) return true;
    }
  } catch {
    /* ilegible: se trata como sin sesion */
  }
  return false;
}

/**
 * Elige la carpeta de configuracion de Claude Code con sesion iniciada, por prioridad:
 * 1) CLAUDE_CONFIG_DIR ya definida en el entorno, 2) ~/.claude-work (claude-w), 3) ~/.claude-personal, 4) ~/.claude (la normal).
 * Devuelve {dir, profile}; dir es null si no hace falta definirla (o no se encontro ninguna sesion).
 */
function detectClaudeConfig(home = os.homedir(), env = process.env) {
  if (env.CLAUDE_CONFIG_DIR) return {dir: env.CLAUDE_CONFIG_DIR, profile: 'entorno'};
  const candidatos = [
    ['work', path.join(home, '.claude-work')],
    ['personal', path.join(home, '.claude-personal')],
    ['normal', path.join(home, '.claude')],
  ];
  for (const [profile, dir] of candidatos) {
    if (hasSession(dir, home)) return {dir: profile === 'normal' ? null : dir, profile};
  }
  return {dir: null, profile: 'ninguno'};
}

/** Entorno para lanzar `claude`: el actual mas CLAUDE_CONFIG_DIR si hay que apuntar a otro perfil. */
function claudeEnv(base = process.env, home = os.homedir()) {
  const {dir} = detectClaudeConfig(home, base);
  return dir ? {...base, CLAUDE_CONFIG_DIR: dir} : base;
}

/**
 * Localiza el ejecutable de Claude Code para lanzarlo SIN shell (con `shell: true` cmd.exe rompe los argumentos
 * con espacios, parentesis o `*`, como las reglas de --allowedTools). Devuelve {cmd, prefijo} o null.
 * Windows: claude.exe nativo; si solo hay claude.cmd (instalacion npm), se corre su cli.js con node.
 */
function resolveClaude(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (platform !== 'win32') return {cmd: 'claude', prefijo: []};
  const dirs = String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    const exe = path.join(d, 'claude.exe');
    if (exists(exe)) return {cmd: exe, prefijo: []};
  }
  for (const d of dirs) {
    if (exists(path.join(d, 'claude.cmd'))) {
      const cli = path.join(d, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (exists(cli)) return {cmd: process.execPath, prefijo: [cli]};
    }
  }
  return null;
}

module.exports = {resolveClaude, hasSession, detectClaudeConfig, claudeEnv, LARGOS, MAX_TEMA, MAX_CANTIDAD, buildRequest, buildPrompt, buildFallbackPrompt, isSafeFolder, parsePlan, listFolders, getFolder, changedFolders, progressMessage, friendlyError};
