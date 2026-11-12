// Rutas de salida y limpieza de residuos.
// media/output/edited/<n>_edited.mp4   video final (nunca se borra)
// media/output/<n>_preview.png         hoja de preview (se borra al renderizar bien)
// media/output/work/<n>/               temporales: props del render, capturas del preview
const fs = require('fs');
const path = require('path');

const outputDir = (root) => path.join(root, 'media', 'output');

const outputPaths = (root, name) => {
  const out = outputDir(root);
  const work = path.join(out, 'work', name);
  return {
    finalDir: path.join(out, 'edited'),
    final: path.join(out, 'edited', `${name}_edited.mp4`),
    sheet: path.join(out, `${name}_preview.png`),
    work,
    props: path.join(work, 'props.json'),
    stills: path.join(work, 'stills'),
  };
};

/** Borra temporales y hoja de preview de un video. Deja el final y otros videos. */
const cleanResidue = (root, name) => {
  const p = outputPaths(root, name);
  fs.rmSync(p.work, {recursive: true, force: true});
  fs.rmSync(p.sheet, {force: true});
  const workRoot = path.dirname(p.work);
  if (fs.existsSync(workRoot) && fs.readdirSync(workRoot).length === 0) fs.rmdirSync(workRoot);
};

const KEEP = new Set(['edited', '.gitkeep']);

/** Deja media/output solo con edited/ (y .gitkeep). Devuelve los nombres borrados. */
const cleanAll = (root) => {
  const out = outputDir(root);
  if (!fs.existsSync(out)) return [];
  const removed = fs.readdirSync(out).filter((f) => !KEEP.has(f));
  for (const f of removed) fs.rmSync(path.join(out, f), {recursive: true, force: true});
  return removed;
};

module.exports = {outputPaths, cleanResidue, cleanAll};
