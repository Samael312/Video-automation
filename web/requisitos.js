// Comprobación de requisitos del PC (sin efectos): se prueba en web/requisitos.test.ts
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Busca un ejecutable en el PATH (con PATHEXT en Windows). Devuelve la ruta o null. */
function whichPorDefecto(nombre, env = process.env) {
  const dirs = String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['', ...String(env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)] : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const f = path.join(dir, nombre + ext);
      try {
        if (fs.statSync(f).isFile()) return f;
      } catch {
        /* siguiente */
      }
    }
  }
  return null;
}

const PLACEHOLDER = /^(tu_|your_|xxx|changeme)/i;

/** ¿HF_TOKEN tiene un valor real en el texto de un .env? */
function tokenEnTexto(texto) {
  const m = /^\s*(?:export\s+)?HF_TOKEN\s*=\s*["']?([^\s"']+)/m.exec(String(texto || ''));
  return Boolean(m) && !PLACEHOLDER.test(m[1]);
}

/**
 * Revisa lo que necesita la web. `env` es el entorno (process.env por defecto).
 * Opciones inyectables para probar: `which(nombre)`, `fs` (existsSync, readdirSync, readFileSync) y `home`.
 */
function comprobarRequisitos(root, env = process.env, {which, fs: fsx = fs, home = os.homedir()} = {}) {
  const buscar = which || ((n) => whichPorDefecto(n, env));
  const existe = (f) => {
    try {
      return fsx.existsSync(f);
    } catch {
      return false;
    }
  };
  const leer = (f) => {
    try {
      return fsx.readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  };
  const item = (id, ok, titulo, detalle, arreglo) => ({id, ok: Boolean(ok), titulo, detalle, arreglo: ok ? '' : arreglo});

  const claude = buscar('claude');
  const venv = path.join(root, '.venv', 'Scripts', 'python.exe');
  const ffmpeg = buscar('ffmpeg');
  const ffprobe = buscar('ffprobe');
  const conToken = Boolean(env.HF_TOKEN && !PLACEHOLDER.test(env.HF_TOKEN)) || ['.env', '.env.txt'].some((n) => tokenEnTexto(leer(path.join(root, n))));
  const deepfilter = path.join(home, '.video-cleanup', 'bin', 'deep-filter.exe');
  const musicaDir = path.join(root, 'media', 'music');
  let mp3 = [];
  try {
    mp3 = fsx.readdirSync(musicaDir).filter((n) => /\.mp3$/i.test(n));
  } catch {
    mp3 = [];
  }
  const modulos = path.join(root, 'node_modules');

  return [
    item('claude', claude, 'Claude Code', claude ? `Encontrado: ${claude}` : 'No se encontró el comando claude.', 'Instala Claude Code: npm install -g @anthropic-ai/claude-code, y abre claude una vez para iniciar sesión.'),
    item('venv', existe(venv), 'Python (entorno .venv)', existe(venv) ? 'Entorno de Python listo.' : 'Falta .venv\\Scripts\\python.exe.', 'Crea el entorno: py -3 -m venv .venv y luego .venv\\Scripts\\pip install -r pipeline\\requirements.txt'),
    item('ffmpeg', ffmpeg, 'ffmpeg', ffmpeg ? `Encontrado: ${ffmpeg}` : 'No se encontró ffmpeg en el PATH.', 'Instala ffmpeg: winget install Gyan.FFmpeg (y reinicia la web).'),
    item('ffprobe', ffprobe, 'ffprobe', ffprobe ? `Encontrado: ${ffprobe}` : 'No se encontró ffprobe en el PATH.', 'Viene con ffmpeg: winget install Gyan.FFmpeg (y reinicia la web).'),
    item('hf_token', conToken, 'Token de Hugging Face', conToken ? 'HF_TOKEN configurado.' : 'Falta HF_TOKEN en .env.', 'Crea el archivo .env en la carpeta del proyecto con una línea: HF_TOKEN=tu_token (se saca en huggingface.co/settings/tokens).'),
    item('deepfilter', existe(deepfilter), 'DeepFilterNet (limpieza de audio)', existe(deepfilter) ? 'deep-filter.exe listo.' : `Falta ${deepfilter}`, 'Descarga deep-filter.exe de github.com/Rikorose/DeepFilterNet/releases y ponlo en %USERPROFILE%\\.video-cleanup\\bin\\'),
    item('musica', mp3.length > 0, 'Música de fondo', mp3.length > 0 ? `${mp3.length} pista(s) en media/music.` : 'No hay .mp3 en media/music.', 'Copia al menos una pista .mp3 a la carpeta media\\music.'),
    item('node_modules', existe(modulos), 'Dependencias de Node', existe(modulos) ? 'node_modules listo.' : 'Falta la carpeta node_modules.', 'Instala las dependencias: npm install (en la carpeta del proyecto).'),
  ];
}

module.exports = {comprobarRequisitos, whichPorDefecto, tokenEnTexto};
