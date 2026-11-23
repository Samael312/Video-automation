// Uso: npx tsx scripts/render.ts <video> [--no-music]   (normalmente via: npm run render:plan -- <video>)
// Render final robusto: valida, empaqueta una vez, hace un render de prueba (1 frame cada ~0.5 s, con audio),
// renderiza a <N>_edited.tmp.mp4 (1 reintento si falla el compositor), corrige el volumen y solo entonces
// reemplaza media/output/edited/<N>/<N>_edited.mp4. Si algo falla, el video anterior queda intacto.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getServeUrl} from './bundleCache';
import {renderFrames, renderMedia, selectComposition} from '@remotion/renderer';
import {cleanDetail, runRender, type RenderIO} from './renderFlow';
import {ROOT} from './common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {outputPaths, cleanResidue} = require('./outputs.js') as {
  outputPaths: (root: string, name: string) => {finalDir: string; final: string};
  cleanResidue: (root: string, name: string) => void;
};

type Composition = Awaited<ReturnType<typeof selectComposition>>;

const main = async () => {
  const args = process.argv.slice(2);
  const arg = args.find((a) => !a.startsWith('--'));
  if (!arg) {
    console.error('Uso: npm run render:plan -- <video> [--no-music]');
    process.exit(2);
  }
  const noMusic = args.includes('--no-music');
  const name = path.basename(arg).replace(/\.[^.]+$/, '');
  const videoSrc = `${name}.mp4`; // siempre el mp4 normalizado, aunque se pase X.mov
  const paths = outputPaths(ROOT, name);
  fs.mkdirSync(paths.finalDir, {recursive: true});
  const tmp = path.join(paths.finalDir, `${name}_edited.tmp.mp4`);
  const concurrency = Math.max(1, Math.floor(os.cpus().length / 2));

  let serveUrl = '';
  let composition: Composition | null = null;
  let inputProps: Record<string, unknown> = {};

  const io: RenderIO = {
    validate: async () => {
      try {
        execFileSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/validate.ts', videoSrc], {cwd: ROOT, stdio: 'inherit'});
      } catch {
        throw new Error('edit.json invalido (mira los errores de arriba)');
      }
    },
    prepare: async () => {
      const planFile = path.join(ROOT, 'public', `${name}.edit.json`);
      const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
      let planOverride = null;
      if (plan && plan.music && noMusic) {
        const {music, ...rest} = plan;
        planOverride = rest;
        console.log(`(--no-music: se renderiza sin ${music.file})`);
      } else if (plan && plan.music) {
        const src = path.join(ROOT, 'media', 'music', plan.music.file);
        if (!fs.existsSync(src)) throw new Error(`no existe media/music/${plan.music.file}`);
        fs.mkdirSync(path.join(ROOT, 'public', 'music'), {recursive: true});
        fs.copyFileSync(src, path.join(ROOT, 'public', 'music', plan.music.file));
      }
      inputProps = {videoSrc, transcript: null, keeps: [], plan: planOverride};
      serveUrl = await getServeUrl();
      composition = await selectComposition({serveUrl, id: 'Edit', inputProps});
    },
    probe: async () => {
      const comp = composition!;
      const every = Math.max(1, Math.round(comp.fps / 2));
      let ultimo = 0;
      try {
        await renderFrames({
          composition: comp,
          serveUrl,
          inputProps,
          imageFormat: 'jpeg',
          outputDir: null,
          onFrameBuffer: () => {},
          everyNthFrame: every,
          onStart: () => {},
          onFrameUpdate: (_n, frameIndex) => {
            ultimo = Math.max(ultimo, frameIndex);
          },
          concurrency,
        });
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`cerca del segundo ${(ultimo / comp.fps).toFixed(1)}: ${m}`);
      }
    },
    render: async (out, c) => {
      const comp = composition!;
      let paso = -1;
      await renderMedia({
        composition: comp,
        serveUrl,
        inputProps,
        codec: 'h264',
        outputLocation: out,
        overwrite: true,
        concurrency: c,
        onProgress: ({renderedFrames}) => {
          const p = Math.floor((renderedFrames / comp.durationInFrames) * 20);
          if (p !== paso) {
            paso = p;
            console.log(`Rendered ${renderedFrames}/${comp.durationInFrames}`);
          }
        },
      });
    },
    loudness: async (file) => {
      execFileSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe'), ['pipeline/final_loudness.py', file], {cwd: ROOT, stdio: 'inherit'});
    },
    rename: (from, to) => fs.renameSync(from, to),
    remove: (file) => fs.rmSync(file, {force: true}),
    cleanResidue: () => cleanResidue(ROOT, name),
    log: (line) => console.log(line),
    detail: (text) => console.error(text),
  };

  const ok = await runRender({final: paths.final, tmp, concurrency}, io);
  if (ok) console.log(`\nListo: ${paths.final}\n(temporales y hoja de preview de ${name} borrados)`);
  process.exit(ok ? 0 : 1);
};

// un error antes de runRender (rutas, carpetas) tambien debe terminar con la linea FALLO que lee la web
main().catch((err) => {
  console.error(cleanDetail(err instanceof Error && err.stack ? err.stack : String(err)));
  console.log(cleanDetail(err instanceof Error ? err.message : String(err), 1).slice(0, 200));
  console.log('FALLO en el paso: preparar');
  process.exit(1);
});
