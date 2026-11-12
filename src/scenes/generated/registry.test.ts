import {describe, expect, test} from 'vitest';
import {defaultPlan, validatePlan, type Scene} from '../../lib/plan';
import {GENERATED} from './index';

const ctx = () => ({video: 'v.mp4', duration: 20, keeps: [{start: 0, end: 20}], knownStyles: ['referencia'], knownGenerated: Object.keys(GENERATED)});
const planWith = (component: string) => ({...defaultPlan('v.mp4'), scenes: [{type: 'generated', start: 2, end: 4, data: {component}} as Scene]});

describe('registro de escenas generadas', () => {
  test('toda entrada es un componente (función)', () => {
    for (const [name, c] of Object.entries(GENERATED)) expect(typeof c, name).toBe('function');
  });
  test('incluye la escena demo', () => expect(Object.keys(GENERATED)).toContain('demo'));
  test('incluye wordlist y definition', () => expect(Object.keys(GENERATED)).toEqual(expect.arrayContaining(['wordlist', 'definition'])));
  test('el validador acepta una escena registrada', () => expect(validatePlan(planWith('demo'), ctx())).toEqual([]));
  test('el validador rechaza una escena no registrada', () => expect(validatePlan(planWith('nope'), ctx()).join('\n')).toContain('nope'));
});
