import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Step = {phrase: string; tag: string; level: number};

/**
 * Velocimetro de "prisa" (pensado como overlay fx, sin fondo, en la parte baja sobre la profe):
 * cada frase entra con su cue, la aguja sube a su `level` (0-1) y debajo aparece su matiz;
 * en el cue final la ultima frase se desvanece letra por letra ("desaparecer sin decir nada").
 * props: {steps: [{phrase, tag, level}], vanish?: boolean, top?: number,
 *         cues: [frase1, matiz1, frase2, matiz2, ..., desvanecer?]} (cues en segundos desde el inicio; los pone Edit)
 */
export const RushMeter: React.FC<GeneratedProps> = ({props, theme}) => {
  const steps = (Array.isArray(props.steps) ? props.steps : []) as Step[];
  const cues = (Array.isArray(props.cues) ? props.cues : []) as number[];
  const vanish = Boolean(props.vanish);
  const top = Number(props.top ?? 860);
  const cue = (i: number, fallback: number) => cues[i] ?? fallback;
  const angle = (level: number) => -90 + 180 * Math.max(0, Math.min(1, level));
  const R = 150;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.panel', {opacity: 0, y: 60, scale: 0.92, duration: 0.35, ease: 'back.out(1.8)'}, 0)
      .set('.needle', {rotation: -90, svgOrigin: '360 0'}, 0);
    steps.forEach((s, i) => {
      const tIn = Math.max(cue(2 * i, i * 2) - 0.08, 0);
      const tTag = cue(2 * i + 1, tIn + 0.9);
      if (i > 0) tl.to(`.p-${i - 1}, .t-${i - 1}`, {y: -40, opacity: 0, duration: 0.15, ease: 'power2.in'}, tIn - 0.2);
      tl.fromTo(`.p-${i}`, {clipPath: 'inset(0 100% 0 0)', opacity: 1}, {clipPath: 'inset(0 0% 0 0)', duration: 0.35, ease: 'power2.out'}, tIn)
        .to('.needle', {rotation: angle(s.level), svgOrigin: '360 0', duration: 0.45, ease: 'back.out(2.2)'}, tIn)
        .to('.fill', {strokeDashoffset: 1 - s.level, duration: 0.45, ease: 'power2.out'}, tIn)
        .fromTo(`.t-${i}`, {y: 20, opacity: 0}, {y: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)'}, tTag);
      if (s.level > 0.85) tl.to('.needle', {rotation: '+=4', svgOrigin: '360 0', duration: 0.05, repeat: 7, yoyo: true, ease: 'none'}, tIn + 0.45);
    });
    if (vanish && steps.length) {
      const last = steps.length - 1;
      const tV = cue(2 * steps.length, 99);
      tl.to(`.p-${last} .ch`, {opacity: 0, y: -50, filter: 'blur(8px)', scale: 1.4, duration: 0.5, stagger: 0.03, ease: 'power1.in'}, tV)
        .to('.needle', {rotation: -90, svgOrigin: '360 0', duration: 0.6, ease: 'power2.inOut'}, tV + 0.2)
        .to('.fill', {strokeDashoffset: 1, duration: 0.6, ease: 'power2.inOut'}, tV + 0.2)
        .to('.panel', {opacity: 0, y: 40, duration: 0.35, ease: 'power2.in'}, tV + 0.9);
    }
  }, [JSON.stringify(steps), JSON.stringify(cues), vanish]);

  const arc = `M ${360 - R} 0 A ${R} ${R} 0 0 1 ${360 + R} 0`;
  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, color: '#fff'}}>
        <div className="panel" style={{position: 'absolute', top, left: 60, right: 60, height: 360, borderRadius: 36, background: 'rgba(20,18,16,.62)', backdropFilter: 'blur(6px)'}}>
          <svg width={600} height={200} viewBox={`60 ${-R - 20} 600 200`} style={{position: 'absolute', top: 16, left: 0}}>
            <path d={arc} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={18} strokeLinecap="round" />
            <path className="fill" d={arc} pathLength={1} fill="none" stroke={theme.cream} strokeWidth={18} strokeLinecap="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            <path d={`M ${360 + R * 0.72} ${-R * 0.69} A ${R} ${R} 0 0 1 ${360 + R} 0`} fill="none" stroke="#ff6b6b" strokeWidth={18} strokeLinecap="round" opacity={0.85} />
            <g className="needle">
              <line x1={360} y1={0} x2={360} y2={-R + 30} stroke="#fff" strokeWidth={8} strokeLinecap="round" />
            </g>
            <circle cx={360} cy={0} r={14} fill="#fff" />
          </svg>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`p-${i}`} style={{position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 66, color: theme.cream, clipPath: 'inset(0 100% 0 0)'}}>
                {[...s.phrase].map((c, j) => (
                  <span key={j} className="ch" style={{display: 'inline-block', whiteSpace: 'pre'}}>{c}</span>
                ))}
              </div>
              <div className={`t-${i}`} style={{position: 'absolute', top: 285, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 34, letterSpacing: 1, opacity: 0}}>{s.tag}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
