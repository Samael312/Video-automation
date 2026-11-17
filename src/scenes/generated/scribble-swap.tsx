import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

/**
 * "No uses X, usa Y": X se tacha con un garabato rojo dibujado a mano; Y cae con rebote,
 * se encierra en un circulo crema y suelta chispas.
 * props: {no: string, yes: string, noAt?: s, yesAt?: s, noLabel?: string, yesLabel?: string}
 * (noAt / yesAt = segundos desde el inicio de la escena en que la profe dice cada palabra)
 */
export const ScribbleSwap: React.FC<GeneratedProps> = ({props, theme}) => {
  const no = String(props.no ?? 'wish');
  const yes = String(props.yes ?? 'hope');
  const noAt = Number(props.noAt ?? 0.4);
  const yesAt = Number(props.yesAt ?? 1.4);
  const noLabel = String(props.noLabel ?? 'no uses');
  const yesLabel = String(props.yesLabel ?? 'usa');
  const sparks = Array.from({length: 10}, (_, i) => ({a: (i / 10) * Math.PI * 2 + random(`a${i}`) * 0.4, d: 150 + random(`d${i}`) * 70}));

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.no-row', {y: -60, opacity: 0, duration: 0.3, ease: 'power3.out'}, 0)
      .fromTo('.scribble', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.45, ease: 'power1.inOut'}, noAt)
      .to('.no-word', {opacity: 0.35, x: '+=6', duration: 0.06, repeat: 5, yoyo: true, ease: 'none'}, noAt + 0.1)
      .to('.no-row', {scale: 0.8, y: -30, duration: 0.35, ease: 'power2.out'}, noAt + 0.45)
      .from('.yes-label', {opacity: 0, y: 20, duration: 0.25}, yesAt - 0.25)
      .from('.yes-word', {y: -260, scale: 1.6, opacity: 0, duration: 0.45, ease: 'bounce.out'}, yesAt - 0.3)
      .fromTo('.ring', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.3, ease: 'power2.out'}, yesAt + 0.05)
      .fromTo('.spark', {scale: 0, x: 0, y: 0, opacity: 1}, {scale: 1, x: (i) => Math.cos(sparks[i].a) * sparks[i].d, y: (i) => Math.sin(sparks[i].a) * sparks[i].d * 0.6, opacity: 0, duration: 0.5, ease: 'expo.out'}, yesAt + 0.05);
  }, [noAt, yesAt, no, yes]);

  const serif = {fontFamily: theme.fonts.serif, fontWeight: 800, lineHeight: 1} as const;
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 420}}>
      <div ref={scope} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50}}>
        <div className="no-row" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
          <div style={{fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 34, color: '#ff8a80'}}>{noLabel}</div>
          <div style={{position: 'relative'}}>
            <div className="no-word" style={{...serif, fontSize: 130, color: '#fff'}}>{no}</div>
            <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{position: 'absolute', inset: '-10% -8%', width: '116%', height: '120%', overflow: 'visible'}}>
              <path className="scribble" pathLength={1} d="M8 60 L60 30 L40 75 L110 25 L95 80 L170 22 L150 78 L230 28 L215 74 L292 40" fill="none" stroke="#ff4d4d" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            </svg>
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div className="yes-label" style={{fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 34, color: theme.cream}}>{yesLabel}</div>
          <div style={{position: 'relative', padding: '20px 50px'}}>
            {sparks.map((_, i) => (
              <div key={i} className="spark" style={{position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, background: i % 2 ? theme.cream : '#fff'}} />
            ))}
            <div className="yes-word" style={{...serif, fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 150, color: theme.cream}}>{yes}</div>
            <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
              <path className="ring" pathLength={1} d="M200 12 C320 8 392 50 388 105 C384 165 290 192 195 190 C90 188 12 160 14 100 C16 45 100 14 215 20" fill="none" stroke={theme.cream} strokeWidth={6} strokeLinecap="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
