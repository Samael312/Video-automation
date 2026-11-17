import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {gsap} from 'gsap';
import {MotionPathPlugin} from 'gsap/MotionPathPlugin';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

gsap.registerPlugin(MotionPathPlugin);

type Timed = {text: string; at: number};

/**
 * Frase de ejemplo que "sale volando": las palabras caen al ritmo de la voz, la clave va en cursiva crema,
 * y en la ultima palabra un emoji cruza la pantalla por una curva dibujada mientras la palabra se eleva;
 * al final, un sello con la nota.
 * props: {words: [{text, at}], key?: string, emoji?: string (public/emoji), stamp?: string}
 * (at = segundos desde el inicio de la escena)
 */
export const FlyAway: React.FC<GeneratedProps> = ({props, theme}) => {
  const words = (Array.isArray(props.words) ? props.words : []) as Timed[];
  const key = String(props.key ?? '').toLowerCase();
  const emoji = String(props.emoji ?? '1f54a');
  const stamp = props.stamp ? String(props.stamp) : '';
  const last = words.length - 1;
  const takeoff = (words[last]?.at ?? 1) + 0.1;

  const scope = useGsap<HTMLDivElement>((tl) => {
    words.forEach((w, i) => {
      tl.from(`.w-${i}`, {y: -120, opacity: 0, rotate: i % 2 ? 12 : -12, duration: 0.3, ease: 'back.out(2.5)'}, Math.max(w.at - 0.1, 0));
    });
    tl.fromTo('.trail', {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut'}, takeoff)
      .fromTo('.bird', {opacity: 0, scale: 0.5}, {opacity: 1, scale: 1, duration: 0.15}, takeoff)
      .to('.bird', {motionPath: {path: '.trail', align: '.trail', alignOrigin: [0.5, 0.5]}, duration: 0.8, ease: 'power1.inOut'}, takeoff)
      .to(`.w-${last}`, {y: -40, rotate: -6, color: theme.cream, duration: 0.5, ease: 'sine.out'}, takeoff)
      .to(`.w-${last}`, {y: -55, duration: 0.4, repeat: 3, yoyo: true, ease: 'sine.inOut'}, takeoff + 0.5);
    if (stamp) tl.fromTo('.stamp', {scale: 3, opacity: 0, rotate: 8}, {scale: 1, opacity: 1, rotate: -10, duration: 0.25, ease: 'power4.in'}, takeoff + 0.15);
  }, [JSON.stringify(words), key, emoji, stamp]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <svg width={720} height={1280} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <path className="trail" pathLength={1} d="M 70 1090 C 260 1010, 140 860, 360 860 S 640 700, 820 330" fill="none" stroke="rgba(252,244,176,.45)" strokeWidth={5} strokeLinecap="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
        </svg>
        <div style={{position: 'absolute', left: 40, right: 40, top: 430, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, rowGap: 0}}>
          {words.map((w, i) => {
            const isKey = w.text.toLowerCase().replace(/[^a-z']/g, '') === key;
            return (
              <span key={i} className={`w-${i}`} style={{display: 'inline-block', fontFamily: isKey ? theme.fonts.serifItalic : theme.fonts.serif, fontStyle: isKey ? 'italic' : 'normal', fontWeight: 800, fontSize: 110, lineHeight: 1.15, color: isKey ? theme.cream : '#fff'}}>{w.text}</span>
            );
          })}
        </div>
        <div className="bird" style={{position: 'absolute', left: 0, top: 0, width: 130, height: 130, opacity: 0}}>
          {/* El emoji mira a la izquierda; se voltea porque la curva va hacia la derecha */}
          <Img src={staticFile(`emoji/${emoji}.png`)} style={{width: '100%', height: '100%', transform: 'scaleX(-1)'}} />
        </div>
        {stamp ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center'}}>
            <div className="stamp" style={{padding: '10px 30px', border: '5px solid #ff6b6b', borderRadius: 14, color: '#ff6b6b', fontFamily: theme.fonts.sans, fontWeight: 800, fontSize: 46, letterSpacing: 4, textTransform: 'uppercase', opacity: 0}}>{stamp}</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
