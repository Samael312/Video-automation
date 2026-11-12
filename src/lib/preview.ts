import {mapTimeNext, type Keep} from './cuts';
import type {EditPlan} from './plan';
import {sceneFrames} from './scenes';

export type PreviewFrame = {frame: number; label: string};

const MIN_FRAMES = 4;
const AT = 0.6; // capturar al 60 % de un elemento: su animacion de entrada ya termino

/**
 * Frames a capturar para revisar un plan: centro de cada escena, 60 % de cada label, titulo y cierre.
 * Si quedan menos de 4, completa con frames repartidos. `keeps` deben ser los mismos (alineados a frames) que usa el render.
 */
export const previewFrames = (plan: EditPlan, keeps: Keep[], fps: number, total: number): PreviewFrame[] => {
  const out: PreviewFrame[] = [];
  const clamp = (f: number) => Math.max(0, Math.min(total - 1, Math.round(f)));
  const at = (start: number, end: number) => clamp((mapTimeNext(start, keeps) + AT * (mapTimeNext(end, keeps) - mapTimeNext(start, keeps))) * fps);

  plan.scenes.forEach((s, i) => {
    const fr = sceneFrames(s.start, s.end, keeps, fps);
    if (fr) out.push({frame: clamp(fr.from + fr.duration / 2), label: `escena ${i}: ${s.type}`});
  });
  plan.overlays.forEach((o) => {
    if (o.kind === 'label') out.push({frame: at(o.start, o.end), label: `label: ${o.text}`});
  });
  if (plan.title) out.push({frame: at(plan.title.start, plan.title.end), label: 'título'});
  if (plan.end) {
    const from = mapTimeNext(plan.end.start, keeps) * fps;
    out.push({frame: clamp(from + AT * (total - from)), label: 'cierre'});
  }

  for (let i = 1; out.length < MIN_FRAMES && i <= MIN_FRAMES; i++) {
    const frame = clamp((total * i) / (MIN_FRAMES + 1));
    if (!out.some((f) => f.frame === frame)) out.push({frame, label: 'muestra'});
  }

  const seen = new Set<number>();
  return out
    .sort((a, b) => a.frame - b.frame)
    .filter((f) => (seen.has(f.frame) ? false : (seen.add(f.frame), true)));
};
