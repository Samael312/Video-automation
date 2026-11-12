// Uso: npm run matte -- <video>   -> public/<nombre>.matte.webm (persona recortada para `behind`)
const {spawnSync} = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const py = path.join(root, '.venv', 'Scripts', 'python.exe');
const r = spawnSync(py, [path.join(root, 'pipeline', 'matte.py'), ...process.argv.slice(2)], {cwd: root, stdio: 'inherit'});
process.exit(r.status ?? 1);
