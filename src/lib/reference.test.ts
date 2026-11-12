import {describe, expect, it} from 'vitest';
import {formatReport, parseSceneTimes, referenceStats} from './reference';

const w = (word: string, start: number, end = start + 0.3) => ({word, start, end});

describe('parseSceneTimes', () => {
  it('saca pts_time de las lineas showinfo de ffmpeg', () => {
    const log = [
      '[Parsed_showinfo_1 @ 0x1] n:   0 pts:  37000 pts_time:1.2333  duration:1',
      'otra linea',
      '[Parsed_showinfo_1 @ 0x1] n:   1 pts: 150000 pts_time:5  duration:1',
    ].join('\n');
    expect(parseSceneTimes(log)).toEqual([1.2333, 5]);
  });

  it('devuelve [] si no hay cortes', () => {
    expect(parseSceneTimes('nada')).toEqual([]);
  });
});

describe('referenceStats', () => {
  const words = [w('hola', 0.2), w('chicos', 0.6), w('hoy', 1.0), w('te', 5.0), w('cuento', 5.4), w('sígueme', 8.5), w('ya', 9.2)];

  it('mide tomas, ritmo de palabras, pausas largas, gancho y CTA', () => {
    const s = referenceStats({duration: 10, sceneTimes: [3, 6], words});
    expect(s.shotCount).toBe(3);
    expect(s.avgShot).toBeCloseTo(10 / 3, 5);
    expect(s.wordsPerSec).toBeCloseTo(0.7, 5);
    expect(s.longPauses).toBe(2); // 1.3->5.0 y 5.7->8.5
    expect(s.hook).toBe('hola chicos hoy');
    expect(s.cta).toBe('sígueme ya');
  });

  it('sin palabras ni cortes no falla', () => {
    const s = referenceStats({duration: 4, sceneTimes: [], words: []});
    expect(s.shotCount).toBe(1);
    expect(s.wordsPerSec).toBe(0);
    expect(s.hook).toBe('');
    expect(s.cta).toBe('');
  });
});

describe('formatReport', () => {
  it('incluye ritmo, gancho, CTA, cortes, hojas y transcript', () => {
    const stats = referenceStats({duration: 10, sceneTimes: [3], words: [w('hola', 0.2), w('adiós', 9)]});
    const r = formatReport({name: 'R1', stats, sceneTimes: [3], sheets: ['sheet_01.png'], words: [w('hola', 0.2), w('adiós', 9)]});
    expect(r).toContain('# Referencia: R1');
    expect(r).toContain('Duración: 10.0 s');
    expect(r).toContain('Tomas: 2');
    expect(r).toContain('Gancho (0–3 s): "hola"');
    expect(r).toContain('Cierre (últimos 4 s): "adiós"');
    expect(r).toContain('3.0');
    expect(r).toContain('sheet_01.png');
    expect(r).toContain('[0.20] hola');
  });
});
