import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {autoSfxEvents, BASE_SFX, sfxNamesUsed} from './sfxPlan';
import {defaultPlan, SFX_NAMES, type EditPlan, type Overlay} from './plan';

const plan = (over: Partial<EditPlan> = {}): EditPlan => ({...defaultPlan('X.mp4'), ...over});
const keeps = [{start: 0, end: 100}];
const base = {cuts: [], hookEnd: 0, title: null, words: [], keeps, manualAt: [] as number[]};
const emoji: Overlay = {kind: 'emoji', file: '1f409', start: 1, end: 2, x: 0, y: 0, size: 100};
const fx: Overlay = {kind: 'fx', component: 'embers', start: 1, end: 2};
const label: Overlay = {kind: 'label', text: 'a', start: 3, end: 4, x: 0, y: 0, dir: 'left'};

describe('autoSfxEvents', () => {
  it('overlay emoji suena pop2', () => {
    expect(autoSfxEvents({...base, plan: plan(), overlays: [emoji]})).toEqual([{at: 1, name: 'pop2', volume: 0.7}]);
  });
  it('overlay fx no suena', () => {
    expect(autoSfxEvents({...base, plan: plan(), overlays: [fx]})).toEqual([]);
  });
  it('autoSfx false apaga todo', () => {
    expect(autoSfxEvents({...base, plan: plan({autoSfx: false}), overlays: [emoji]})).toEqual([]);
  });
  it('descarta el evento pegado a un sfx manual', () => {
    expect(autoSfxEvents({...base, plan: plan(), overlays: [emoji], manualAt: [1.05]})).toEqual([]);
  });
});

describe('sfxNamesUsed', () => {
  it('junta base, manuales y automáticos sin undefined', () => {
    const names = sfxNamesUsed(plan({overlays: [label, fx], cutFx: 'glitch', sfx: [{at: 1, name: 'riser'}]}));
    for (const n of ['pop', 'glitch', 'riser', 'swoosh', 'tick', 'ding']) expect(names).toContain(n);
    expect(names).not.toContain(undefined);
  });
  it('plan por defecto: solo base', () => {
    expect(sfxNamesUsed(defaultPlan('X.mp4'))).toEqual([...BASE_SFX].sort());
  });
  it('todos los SFX_NAMES tienen su wav en public/sfx', () => {
    for (const n of SFX_NAMES) expect(fs.existsSync(path.join(__dirname, '..', '..', 'public', 'sfx', `${n}.wav`)), n).toBe(true);
  });
});
