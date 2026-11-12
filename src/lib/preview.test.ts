import {describe, expect, test} from 'vitest';
import {previewFrames} from './preview';
import {defaultPlan, type EditPlan, type Scene} from './plan';

const keeps = [{start: 1, end: 8}, {start: 9, end: 19}];
const total = 17 * 30; // 7 s + 10 s
const scene = (start: number, end: number): Scene => ({type: 'translate', start, end, data: {word: 'a', translation: 'b'}});
const plan = (over: Partial<EditPlan>): EditPlan => ({...defaultPlan('v.mp4'), ...over});

describe('previewFrames', () => {
  test('una captura en el centro de cada escena', () => {
    const fr = previewFrames(plan({scenes: [scene(2, 4)]}), keeps, 30, total);
    expect(fr).toContainEqual({frame: 60, label: 'escena 0: translate'});
  });
  test('escena tras un corte se reubica', () => {
    const fr = previewFrames(plan({scenes: [scene(10, 12)]}), keeps, 30, total);
    expect(fr).toContainEqual({frame: 270, label: 'escena 0: translate'});
  });
  test('labels, título y cierre tienen captura', () => {
    const fr = previewFrames(
      plan({
        overlays: [{kind: 'label', text: 'hola', start: 2, end: 3, x: 1, y: 1, dir: 'left'}],
        title: {line1: 'a', line2: 'b', start: 0, end: 2},
        end: {start: 17, line1: 'a', line2: 'b'},
      }),
      keeps,
      30,
      total,
    );
    const labels = fr.map((f) => f.label);
    expect(labels).toContain('label: hola');
    expect(labels).toContain('título');
    expect(labels).toContain('cierre');
  });
  test('plan sin escenas ni labels: 4 capturas de muestra en rango', () => {
    const fr = previewFrames(defaultPlan('v.mp4'), keeps, 30, total);
    expect(fr).toHaveLength(4);
    fr.forEach((f) => {
      expect(f.label).toBe('muestra');
      expect(f.frame).toBeGreaterThanOrEqual(0);
      expect(f.frame).toBeLessThan(total);
    });
  });
  test('ordenadas, sin duplicados y dentro del video', () => {
    const fr = previewFrames(plan({scenes: [scene(2, 4), scene(10, 12)], end: {start: 18.99, line1: 'a', line2: 'b'}}), keeps, 30, total);
    const frames = fr.map((f) => f.frame);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(new Set(frames).size).toBe(frames.length);
    frames.forEach((f) => expect(f).toBeLessThan(total));
  });
});
