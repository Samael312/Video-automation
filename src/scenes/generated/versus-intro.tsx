import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

/**
 * Duelo de dos palabras sobre un fondo partido en diagonal (arriba coral para que los subtitulos blancos se lean): entran de lados opuestos, chocan con un destello,
 * se apartan a las esquinas, un foco se dibuja a trazo y la palabra final se estampa.
 * props: {a, b, aAt, bAt, bulbAt, stamp, stampAt} (segundos desde el inicio de la escena)
 */
export const VersusIntro: React.FC<GeneratedProps> = ({props, theme}) => {
  const a = String(props.a ?? 'make');
  const b = String(props.b ?? 'do');
  const aAt = Number(props.aAt ?? 0.1);
  const bAt = Number(props.bAt ?? 0.8);
  const bulbAt = Number(props.bulbAt ?? 1.8);
  const stamp = String(props.stamp ?? 'definitivo');
  const stampAt = Number(props.stampAt ?? 2.4);
  const coral = '#e07a5f';
  const ink = '#1b1b1b';

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.half-a', {xPercent: -100, duration: 0.4, ease: 'power3.out'}, 0)
      .from('.half-b', {xPercent: 100, duration: 0.4, ease: 'power3.out'}, 0)
      .from('.word-a', {x: -700, rotate: -20, duration: 0.45, ease: 'power4.out'}, Math.max(aAt - 0.15, 0.1))
      .from('.word-b', {x: 700, rotate: 20, duration: 0.3, ease: 'power4.in'}, bAt - 0.3)
      .fromTo('.flash', {scale: 0, opacity: 1}, {scale: 2.2, opacity: 0, duration: 0.45, ease: 'expo.out'}, bAt)
      .to('.word-a', {x: -18, duration: 0.06, repeat: 3, yoyo: true}, bAt)
      .to('.word-b', {x: 18, duration: 0.06, repeat: 3, yoyo: true}, bAt)
      .to('.half-a, .half-b', {x: 10, duration: 0.05, repeat: 3, yoyo: true}, bAt)
      // Se apartan a las esquinas para dejar sitio al foco
      .to('.word-a', {x: -150, y: -260, scale: 0.6, duration: 0.45, ease: 'power3.inOut'}, bulbAt - 0.4)
      .to('.word-b', {x: 170, y: 300, scale: 0.6, duration: 0.45, ease: 'power3.inOut'}, bulbAt - 0.4)
      .fromTo('.bulb-line', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out'}, bulbAt - 0.1)
      .to('.bulb-glow', {opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)'}, bulbAt + 0.35)
      .fromTo('.ray', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.2, stagger: 0.04}, bulbAt + 0.4)
      .fromTo('.stamp', {scale: 3, opacity: 0, rotate: 10}, {scale: 1, opacity: 1, rotate: -6, duration: 0.25, ease: 'power4.in'}, stampAt - 0.15)
      .to('.bulb', {y: -10, duration: 0.5, repeat: 3, yoyo: true, ease: 'sine.inOut'}, stampAt + 0.2);
  }, [a, b, aAt, bAt, bulbAt, stamp, stampAt]);

  const word: React.CSSProperties = {position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 170, lineHeight: 1};
  const rays = [0, 45, 90, 135, 180].map((d) => (d - 90) * (Math.PI / 180));
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="half-a" style={{position: 'absolute', inset: 0, background: coral, clipPath: 'polygon(0 0, 100% 0, 100% 38%, 0 66%)'}} />
        <div className="half-b" style={{position: 'absolute', inset: 0, background: theme.cream, clipPath: 'polygon(0 66%, 100% 38%, 100% 100%, 0 100%)'}} />
        <div className="flash" style={{position: 'absolute', left: 360 - 200, top: 640 - 200, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%)', opacity: 0}} />
        <div className="word-a" style={{...word, color: '#fff'}}>
          <span style={{display: 'inline-block', transform: 'translateX(-110px)', textShadow: '0 6px 24px rgba(0,0,0,.25)'}}>{a}</span>
        </div>
        <div className="word-b" style={{...word, color: ink}}>
          <span style={{display: 'inline-block', transform: 'translateX(170px)'}}>{b}</span>
        </div>
        <div className="bulb" style={{position: 'absolute', left: 360 - 120, top: 470, width: 240, height: 300}}>
          <div className="bulb-glow" style={{position: 'absolute', left: 30, top: 10, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, #ffe066 0%, rgba(255,224,102,0) 70%)', opacity: 0, transform: 'scale(0.4)'}} />
          <svg viewBox="0 0 240 300" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <path className="bulb-line" pathLength={1} d="M85 200 C85 160 50 145 50 100 A70 70 0 1 1 190 100 C190 145 155 160 155 200 Z" fill="none" stroke={ink} strokeWidth={9} strokeLinejoin="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            <path className="bulb-line" pathLength={1} d="M88 225 L152 225 M92 250 L148 250 M105 272 L135 272" fill="none" stroke={ink} strokeWidth={9} strokeLinecap="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            <path className="bulb-line" pathLength={1} d="M100 200 L100 130 L120 150 L140 130 L140 200" fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            {rays.map((r, i) => (
              <path key={i} className="ray" pathLength={1} d={`M${120 + Math.cos(r) * 95} ${100 + Math.sin(r) * 95} L${120 + Math.cos(r) * 130} ${100 + Math.sin(r) * 130}`} stroke={ink} strokeWidth={8} strokeLinecap="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            ))}
          </svg>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 820, display: 'flex', justifyContent: 'center'}}>
          <div className="stamp" style={{padding: '12px 36px', borderRadius: 16, background: ink, color: theme.cream, fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 72, opacity: 0}}>{stamp}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
