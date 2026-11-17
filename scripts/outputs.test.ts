import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {outputPaths, cleanResidue, cleanAll} = require('./outputs.js');

let root: string;
const touch = (p: string) => {
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, 'x');
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'outputs-'));
});
afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

describe('outputPaths', () => {
  it('pone el video final en media/output/edited y lo temporal en media/output/work/<n>', () => {
    const p = outputPaths(root, 'ACTUALLY');
    expect(p.final).toBe(path.join(root, 'media', 'output', 'edited', 'ACTUALLY', 'ACTUALLY_edited.mp4'));
    expect(p.sheet).toBe(path.join(root, 'media', 'output', 'ACTUALLY_preview.png'));
    expect(p.props.startsWith(path.join(root, 'media', 'output', 'work', 'ACTUALLY'))).toBe(true);
    expect(p.stills.startsWith(path.join(root, 'media', 'output', 'work', 'ACTUALLY'))).toBe(true);
  });
});

describe('cleanResidue', () => {
  it('borra lo temporal y la hoja de ese video; deja el final y otros videos', () => {
    const a = outputPaths(root, 'A');
    const b = outputPaths(root, 'B');
    [a.props, path.join(a.stills, '01.png'), a.sheet, a.final, b.props, b.sheet].forEach(touch);
    cleanResidue(root, 'A');
    expect(fs.existsSync(a.final)).toBe(true);
    expect(fs.existsSync(a.sheet)).toBe(false);
    expect(fs.existsSync(path.dirname(a.props))).toBe(false);
    expect(fs.existsSync(b.props)).toBe(true);
    expect(fs.existsSync(b.sheet)).toBe(true);
  });

  it('no falla si no hay nada que borrar', () => {
    expect(() => cleanResidue(root, 'NADA')).not.toThrow();
  });
});

describe('cleanAll', () => {
  it('deja solo edited/ y .gitkeep en media/output y devuelve lo borrado', () => {
    const out = path.join(root, 'media', 'output');
    const fin = outputPaths(root, 'A').final;
    [fin, path.join(out, '.gitkeep'), path.join(out, 'x.png'), path.join(out, 'frames', 'f.jpg')].forEach(touch);
    const removed: string[] = cleanAll(root);
    expect(removed.sort()).toEqual(['frames', 'x.png']);
    expect(fs.readdirSync(out).sort()).toEqual(['.gitkeep', 'edited']);
    expect(fs.existsSync(fin)).toBe(true);
  });
});
