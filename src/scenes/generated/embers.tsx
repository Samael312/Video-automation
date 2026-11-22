import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 57.3 + k * 199.1) * 31415.9265;
  return x - Math.floor(x);
};

/**
 * Overlay fx de ambiente: brasas que suben desde abajo con brillo naranja y un velo rojo en el borde inferior
 * (para dar aire de fantasia/fuego a un tramo con la profe). Sin texto.
 * props: {count?: number, duration?: number (s visibles)} — se apaga al final.
 */
export const Embers: React.FC<GeneratedProps> = ({props, durationInFrames}) => {
  const count = Number(props.count ?? 30);
  const total = Number(props.duration ?? durationInFrames / 30);
  const list = Array.from({length: count}, (_, i) => i);

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.fromTo('.veil', {opacity: 0}, {opacity: 1, duration: 0.4}, 0).to('.veil', {opacity: 0, duration: 0.4}, Math.max(total - 0.4, 0));
    list.forEach((i) => {
      const d = 1.6 + rnd(i, 1) * 1.6;
      tl.fromTo(`.e-${i}`, {y: 0, x: 0, opacity: 0}, {y: -700 - rnd(i, 2) * 500, x: (rnd(i, 3) - 0.5) * 160, duration: d, ease: 'none', keyframes: {opacity: [0, 1, 0.8, 0]}, repeat: Math.max(Math.floor(total / d) - 1, 0)}, rnd(i, 4) * 0.9);
    });
  }, [count, total]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <div className="veil" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 420, background: 'linear-gradient(0deg, rgba(150,30,0,.45), rgba(150,30,0,0))'}} />
        {list.map((i) => {
          const s = 4 + rnd(i, 5) * 7;
          return <div key={i} className={`e-${i}`} style={{position: 'absolute', left: rnd(i, 6) * 720, top: 1230 + rnd(i, 7) * 60, width: s, height: s, borderRadius: s, background: rnd(i, 8) > 0.3 ? '#ff8a3d' : '#ffd27a', boxShadow: '0 0 12px #ff7a2f', opacity: 0}} />;
        })}
      </div>
    </AbsoluteFill>
  );
};
