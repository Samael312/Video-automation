import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Side = {label: string; emoji?: string};

/**
 * Overlay fx sobre la profe: una palabra en oro, como runa grabada, se parte en dos por una grieta en zigzag;
 * cada mitad se separa con su significado debajo (izquierda/derecha); en el segundo cue se vuelve a unir y brilla.
 * props: {word: string, left: Side, right: Side, top?: number, cues: [partir, unir]} (cues en s desde el inicio)
 */
export const RuneSplit: React.FC<GeneratedProps> = ({props, theme}) => {
  const word = String(props.word ?? 'SLAY');
  const left = (props.left ?? {label: ''}) as Side;
  const right = (props.right ?? {label: ''}) as Side;
  const top = Number(props.top ?? 820);
  const cues = (Array.isArray(props.cues) ? props.cues : []) as number[];
  const split = cues[0] ?? 0.3;
  const join = cues[1] ?? split + 1.2;
  // grieta en zigzag: misma linea para las dos mitades
  const crack = '50% 0%, 46% 18%, 54% 36%, 45% 55%, 55% 74%, 48% 100%';
  const leftClip = `polygon(0% 0%, ${crack}, 0% 100%)`;
  const rightClip = `polygon(100% 0%, ${crack}, 100% 100%)`;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.rune', {scale: 0.7, opacity: 0, filter: 'blur(10px)', duration: 0.3, ease: 'power3.out'}, Math.max(split - 0.35, 0))
      .fromTo('.crackline', {scaleY: 0}, {scaleY: 1, duration: 0.12, ease: 'power4.in', immediateRender: false}, split - 0.05)
      .to('.crackline', {opacity: 0, duration: 0.15}, split + 0.1)
      .to('.half-l', {x: -70, rotate: -8, duration: 0.4, ease: 'back.out(1.6)'}, split + 0.08)
      .to('.half-r', {x: 70, rotate: 8, duration: 0.4, ease: 'back.out(1.6)'}, split + 0.08)
      .from('.lab-l, .lab-r', {y: 30, opacity: 0, duration: 0.3, stagger: 0.12, ease: 'back.out(2)'}, split + 0.25)
      .to('.lab-l, .lab-r', {opacity: 0, y: 20, duration: 0.2}, join - 0.1)
      .to('.half-l, .half-r', {x: 0, rotate: 0, duration: 0.25, ease: 'power3.in'}, join - 0.1)
      .fromTo('.glow', {opacity: 0, scale: 0.6}, {opacity: 1, scale: 1.4, duration: 0.25, yoyo: true, repeat: 1, immediateRender: false}, join + 0.15)
      .to('.rune', {scale: 1.12, duration: 0.15, yoyo: true, repeat: 1}, join + 0.15);
  }, [JSON.stringify(props)]);

  const txt: React.CSSProperties = {fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 150, letterSpacing: 8, color: '#f3d48a', textShadow: '0 0 30px rgba(217,164,65,.7), 0 6px 0 #7a4b12', whiteSpace: 'nowrap'};
  const lab = (s: Side, cls: string): React.ReactNode => (
    <div className={cls} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 22px', borderRadius: 20, background: 'rgba(20,10,6,.72)', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 46, color: theme.cream, whiteSpace: 'nowrap'}}>
      {s.emoji ? <Img src={staticFile(`emoji/${s.emoji}.png`)} style={{width: 50, height: 50}} /> : null}
      {s.label}
    </div>
  );

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <div className="rune" style={{position: 'relative'}}>
            <div className="glow" style={{position: 'absolute', inset: -40, borderRadius: 80, background: 'radial-gradient(circle, rgba(255,200,90,.75) 0%, rgba(255,200,90,0) 70%)', opacity: 0}} />
            <div style={{...txt, visibility: 'hidden'}}>{word}</div>
            <div className="half-l" style={{...txt, position: 'absolute', inset: 0, clipPath: leftClip}}>{word}</div>
            <div className="half-r" style={{...txt, position: 'absolute', inset: 0, clipPath: rightClip}}>{word}</div>
            <svg className="crackline" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', transformOrigin: '50% 0%', overflow: 'visible'}}>
              <polyline points="50,0 46,18 54,36 45,55 55,74 48,100" fill="none" stroke="#fff6d8" strokeWidth={1.4} vectorEffect="non-scaling-stroke" style={{filter: 'drop-shadow(0 0 6px #ffcf70)'}} />
            </svg>
          </div>
        </div>
        <div style={{position: 'absolute', top: top + 250, left: 30, right: 30, display: 'flex', justifyContent: 'space-between'}}>
          {lab(left, 'lab-l')}
          {lab(right, 'lab-r')}
        </div>
      </div>
    </AbsoluteFill>
  );
};
