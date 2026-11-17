import React from 'react';
import {AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame} from 'remotion';
import {palette} from './palette';

const DOTS = Array.from({length: 18}, (_, i) => ({
  x: random(`dx${i}`) * 720,
  y: random(`dy${i}`) * 1280,
  r: 6 + random(`dr${i}`) * 34,
  blur: 2 + random(`db${i}`) * 8,
  phase: random(`dp${i}`) * 200,
}));
const PROP_SPOTS = [
  {x: 420, y: -140, fromX: 220, fromY: -160, rot: -14},
  {x: -230, y: 940, fromX: -220, fromY: 200, rot: 12},
];

/** Fondo fijo de un bloque: color, viñeta, puntos desenfocados que flotan y hasta 2 emojis gigantes muy borrosos en esquinas. */
export const Background: React.FC<{bg: 'light' | 'dark'; props: string[]; durationInFrames: number}> = ({bg, props, durationInFrames}) => {
  const f = useCurrentFrame();
  const pal = palette(bg);
  const drift = interpolate(f, [0, durationInFrames], [0, 1]);
  return (
    <AbsoluteFill style={{backgroundColor: pal.bg, overflow: 'hidden'}}>
      {DOTS.map((d, i) => (
        <div key={i} style={{position: 'absolute', left: d.x, top: d.y + Math.sin((f + d.phase) / 45) * 14, width: d.r * 2, height: d.r * 2, borderRadius: '50%', background: pal.dot, filter: `blur(${d.blur}px)`}} />
      ))}
      {props.slice(0, 2).map((code, i) => {
        const s = PROP_SPOTS[i];
        const p = interpolate(f, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
        return (
          <Img
            key={code + i}
            src={staticFile(`emoji3d/${code}.png`)}
            style={{position: 'absolute', left: s.x + (1 - p) * s.fromX, top: s.y + (1 - p) * s.fromY - drift * 40, width: 520, height: 520, opacity: 0.45 * p,
              filter: 'blur(18px)', transform: `rotate(${s.rot + drift * 10}deg)`}}
          />
        );
      })}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 50%, ${pal.vignette} 100%)`}} />
    </AbsoluteFill>
  );
};
