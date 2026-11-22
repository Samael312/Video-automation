import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {gsap} from 'gsap';
import {MotionPathPlugin} from 'gsap/MotionPathPlugin';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

gsap.registerPlugin(MotionPathPlugin);

/**
 * "get BACK" como bumeran: "back" sale de la casa, recorre un lazo dibujado y vuelve a ella;
 * los significados aparecen uno por uno.
 * props: {verb, particle, meanings: string[], badge?, home? (emoji), at?: {fly, meanings: number[]}} (segundos desde el inicio)
 */
export const BoomerangBack: React.FC<GeneratedProps> = ({props, theme}) => {
  const verb = String(props.verb ?? 'get');
  const particle = String(props.particle ?? 'back');
  const meanings = (Array.isArray(props.meanings) ? props.meanings : []).map(String);
  const badge = props.badge ? String(props.badge) : '';
  const home = String(props.home ?? '1f3e0');
  const at = (props.at ?? {}) as {fly?: number; meanings?: number[]};
  const fly = at.fly ?? 0.1;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.badge', {y: -40, opacity: 0, duration: 0.3, ease: 'back.out(2)'}, 0)
      .from('.home', {scale: 0, duration: 0.3, ease: 'back.out(2.5)'}, 0)
      .from('.verb', {opacity: 0, y: -40, duration: 0.3, ease: 'power2.out'}, Math.max(fly - 0.15, 0))
      .fromTo('.loop', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut'}, fly)
      .fromTo('.particle', {opacity: 0}, {opacity: 1, duration: 0.1}, fly)
      .to('.particle', {motionPath: {path: '.loop', align: '.loop', alignOrigin: [0.5, 0.5]}, rotate: 360, duration: 1.1, ease: 'power1.inOut'}, fly)
      .to('.home', {scale: 1.2, duration: 0.12, yoyo: true, repeat: 1}, fly + 1.1);
    meanings.forEach((_, i) => tl.from(`.m-${i}`, {x: 60, opacity: 0, duration: 0.35, ease: 'back.out(2)'}, at.meanings?.[i] ?? fly + 1.3 + i * 0.7));
  }, [verb, particle, JSON.stringify(meanings), home, JSON.stringify(at)]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, color: '#fff'}}>
        {badge ? (
          <div className="badge" style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 34, letterSpacing: 6, opacity: 0.8}}>{badge}</div>
        ) : null}
        <div className="verb" style={{position: 'absolute', top: 370, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 110}}>{verb} …</div>
        <svg width={720} height={1280} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {/* sale de la casa (abajo), da la vuelta arriba y regresa al mismo punto */}
          <path className="loop" pathLength={1} d="M 360 760 C 60 700, 60 540, 360 540 S 660 700, 360 760" fill="none" stroke="rgba(252,244,176,.5)" strokeWidth={6} strokeDasharray="1" strokeLinecap="round" style={{strokeDashoffset: 1}} />
        </svg>
        <span className="particle" style={{position: 'absolute', left: 0, top: 0, fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 110, color: theme.cream, opacity: 0}}>{particle}</span>
        <Img className="home" src={staticFile(`emoji/${home}.png`)} style={{position: 'absolute', top: 830, left: 290, width: 140, height: 140}} />
        <div style={{position: 'absolute', top: 990, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
          {meanings.map((m, i) => (
            <div key={i} className={`m-${i}`} style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 76, color: theme.cream}}>{m}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
