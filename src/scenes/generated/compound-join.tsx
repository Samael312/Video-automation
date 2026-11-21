import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Part = {word: string; hint?: string};

/**
 * Palabra compuesta que se arma sola (overlay fx sobre la profe): cada parte entra como ficha en su cue
 * con su pista en español debajo ("lluvia", "abrigo"); en el cue final las fichas chocan, se funden en
 * una sola palabra crema y aparece el emoji. El orden de `parts` es el de la palabra final.
 * props: {parts: Part[] (2), emoji?: string (public/emoji), top?: number,
 *         cues: [parte0, parte1, juntar]} (cues en s desde el inicio; las partes pueden entrar en cualquier orden)
 */
export const CompoundJoin: React.FC<GeneratedProps> = ({props, theme}) => {
  const parts = (Array.isArray(props.parts) ? props.parts : []) as Part[];
  const cues = (Array.isArray(props.cues) ? props.cues : []) as number[];
  const emoji = props.emoji ? String(props.emoji) : '';
  const top = Number(props.top ?? 840);
  const join = cues[parts.length] ?? (cues[parts.length - 1] ?? 0) + 1;
  const whole = parts.map((p) => p.word).join('');

  const scope = useGsap<HTMLDivElement>((tl) => {
    parts.forEach((_, i) => {
      const t = Math.max((cues[i] ?? i) - 0.1, 0);
      tl.fromTo(`.chip-${i}`, {y: 80, opacity: 0, rotate: i ? 8 : -8}, {y: 0, opacity: 1, rotate: i ? 4 : -4, duration: 0.35, ease: 'back.out(2.2)'}, t)
        .fromTo(`.hint-${i}`, {opacity: 0}, {opacity: 1, duration: 0.25}, t + 0.2);
    });
    tl.to('.hint', {opacity: 0, duration: 0.15}, join - 0.15)
      .to('.chip-0', {x: 150, rotate: 0, duration: 0.25, ease: 'power3.in'}, join - 0.1)
      .to('.chip-1', {x: -150, rotate: 0, duration: 0.25, ease: 'power3.in'}, join - 0.1)
      .to('.chips', {opacity: 0, scale: 1.25, duration: 0.12}, join + 0.15)
      .fromTo('.whole', {scale: 0.4, opacity: 0}, {scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)'}, join + 0.15)
      .fromTo('.burst', {scale: 0.3, opacity: 1}, {scale: 2.2, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false}, join + 0.15);
    if (emoji) tl.fromTo('.emoji', {y: 40, scale: 0, opacity: 0}, {y: 0, scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)'}, join + 0.35);
  }, [JSON.stringify(parts), JSON.stringify(cues), emoji]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="chips" style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 70}}>
          {parts.map((p, i) => (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
              <div className={`chip-${i}`} style={{padding: '10px 30px', borderRadius: 24, background: 'rgba(255,255,255,.92)', color: '#1b1917', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 84, opacity: 0, boxShadow: '0 10px 30px rgba(0,0,0,.25)'}}>{p.word}</div>
              {p.hint ? <div className={`hint hint-${i}`} style={{padding: '4px 16px', borderRadius: 12, background: 'rgba(20,18,16,.6)', color: '#fff', fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 34, opacity: 0}}>{p.hint}</div> : null}
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', top: top - 20, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{position: 'relative'}}>
            <div className="burst" style={{position: 'absolute', inset: -20, borderRadius: 60, background: `radial-gradient(circle, ${theme.cream} 0%, rgba(252,244,176,0) 70%)`, opacity: 0}} />
            <div className="whole" style={{position: 'relative', padding: '8px 40px', borderRadius: 30, background: 'rgba(20,18,16,.7)', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 112, color: theme.cream, opacity: 0}}>{whole}</div>
          </div>
          {emoji ? <Img className="emoji" src={staticFile(`emoji/${emoji}.png`)} style={{width: 130, height: 130, marginTop: 14, opacity: 0}} /> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
