import path from 'node:path';
import {describe, expect, test} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {isHdr, normalizeFilter, publicMp4} = require('./normalize.js');

describe('publicMp4', () => {
  test('cualquier entrada (mov, MOV, mp4, m4v) -> public/<nombre>.mp4', () => {
    for (const f of ['media/input/clase.mov', 'clase.MOV', 'clase.mp4', 'C:\\x\\clase.m4v']) {
      expect(publicMp4(f, '/r')).toBe(path.join('/r', 'public', 'clase.mp4'));
    }
  });
});

describe('isHdr', () => {
  test('HLG y PQ son HDR; bt709 o sin dato no', () => {
    expect(isHdr({color_transfer: 'arib-std-b67'})).toBe(true);
    expect(isHdr({color_transfer: 'smpte2084'})).toBe(true);
    expect(isHdr({color_transfer: 'bt709'})).toBe(false);
    expect(isHdr({})).toBe(false);
  });
});

describe('normalizeFilter', () => {
  test('siempre 30 fps y 720x1280 (cubre y recorta el centro)', () => {
    const f = normalizeFilter({color_transfer: 'bt709'});
    expect(f).toContain('fps=30');
    expect(f).toContain('scale=720:1280:force_original_aspect_ratio=increase');
    expect(f).toContain('crop=720:1280');
    expect(f).not.toContain('tonemap');
  });
  test('HDR (iPhone) se convierte a SDR bt709 antes de escalar', () => {
    const f = normalizeFilter({color_transfer: 'arib-std-b67'});
    expect(f.indexOf('tonemap')).toBeGreaterThan(-1);
    expect(f.indexOf('tonemap')).toBeLessThan(f.indexOf('scale=720'));
  });
});
