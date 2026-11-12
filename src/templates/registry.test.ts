import {expect, test} from 'vitest';
import {SCENE_TYPES} from '../lib/plan';
import {TEMPLATES} from './index';

test('hay una plantilla para cada tipo de escena salvo generated', () => {
  for (const type of SCENE_TYPES.filter((t) => t !== 'generated')) {
    expect(typeof (TEMPLATES as Record<string, unknown>)[type], `plantilla ${type}`).toBe('function');
  }
});
test('no hay plantillas de más', () => {
  expect(Object.keys(TEMPLATES).sort()).toEqual(SCENE_TYPES.filter((t) => t !== 'generated').sort());
});
