// Uso: npm run draft-motion -- <video>
// Borrador de bloques/beats de motion desde el transcript. Escribe `motion` y `strategy: "motion"` en public/<nombre>.edit.json
// (crea el plan por defecto si no existe; no toca title, end, overlays, etc.). Despues la skill edit-motion enriquece cada beat.
import fs from 'node:fs';
import path from 'node:path';
import {defaultPlan, type EditPlan} from '../src/lib/plan';
import {originalAt, quantizeKeeps} from '../src/lib/cuts';
import {draftMotion} from '../src/lib/draftMotion';
import {HOOK_SECONDS, motionShare} from '../src/lib/motion';
import {loadTranscriptAndKeeps, PUBLIC, readPublicJson, resolveVideo} from './common';

const FPS = 30;
const {name, video} = resolveVideo(process.argv[2], 'npm run draft-motion -- <video>');
const {transcript, keeps: rawKeeps} = loadTranscriptAndKeeps(name);
const keeps = quantizeKeeps(rawKeeps, FPS);
const plan = readPublicJson<EditPlan>(`${name}.edit.json`) ?? defaultPlan(video);

const from = Math.max(plan.title?.end ?? 0, originalAt(HOOK_SECONDS, keeps));
const until = plan.end?.start ?? keeps[keeps.length - 1].end;
const motion = draftMotion(transcript.words, keeps, {from, until});
const out: EditPlan = {...plan, strategy: 'motion', motion};
fs.writeFileSync(path.join(PUBLIC, `${name}.edit.json`), JSON.stringify(out, null, 2) + '\n');

const beats = motion.blocks.reduce((s, b) => s + b.beats.length, 0);
console.log(`Borrador: ${motion.blocks.length} bloques, ${beats} beats, motion ${Math.round(motionShare(out, keeps) * 100)} % de la duracion final`);
motion.blocks.forEach((b, i) => console.log(`  bloque ${i}: ${b.start.toFixed(2)}–${b.end.toFixed(2)} s, ${b.beats.length} beats`));
console.log(`Escrito public/${name}.edit.json. Siguiente: enriquecer beats (layout, emoji, key) y npm run validate -- ${name}`);
