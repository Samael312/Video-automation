import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Item = {text: string; at: number};

/**
 * Nube de pensamiento: la palabra flota dentro de una nube con estrellas que titilan;
 * las ideas suben como burbujas cuando la profe las dice.
 * props: {word: string, wordAt?: s, items: [{text, at}]} (at = segundos desde el inicio de la escena)
 */
export const DreamBubble: React.FC<GeneratedProps> = ({props, theme}) => {
  const word = String(props.word ?? 'wish');
  const wordAt = Number(props.wordAt ?? 0.1);
  const items = (Array.isArray(props.items) ? props.items : []) as Item[];
  const stars = Array.from({length: 16}, (_, i) => ({x: 40 + random(`sx${i}`) * 640, y: 380 + random(`sy${i}`) * 520, s: 18 + random(`ss${i}`) * 26, d: random(`sd${i}`) * 1.2}));
  const puffs = [{x: 0, y: 40, r: 150}, {x: 150, y: 0, r: 170}, {x: 310, y: 30, r: 150}, {x: 80, y: 120, r: 150}, {x: 240, y: 120, r: 160}];

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.star', {scale: 0, opacity: 0, duration: 0.4, stagger: 0.04, ease: 'back.out(3)'}, 0)
      .to('.star', {opacity: 0.25, scale: 0.6, duration: 0.5, repeat: 9, yoyo: true, ease: 'sine.inOut', stagger: {each: 0.07, from: 'random'}}, 0.4)
      .from('.tail', {scale: 0, opacity: 0, duration: 0.25, stagger: 0.12, ease: 'back.out(3)'}, 0)
      .from('.puff', {scale: 0, duration: 0.5, stagger: 0.05, ease: 'elastic.out(1, 0.6)'}, 0.2)
      .from('.dream-word', {opacity: 0, scale: 0.3, filter: 'blur(14px)', duration: 0.5, ease: 'power3.out'}, Math.max(wordAt, 0.35))
      .to('.cloud', {y: -14, duration: 1.1, repeat: 5, yoyo: true, ease: 'sine.inOut'}, 0.6)
      .to('.dream-word', {rotate: -4, duration: 0.9, repeat: 5, yoyo: true, ease: 'sine.inOut'}, 0.9);
    items.forEach((it, i) => {
      tl.from(`.item-${i}`, {y: 260, scale: 0.4, opacity: 0, duration: 0.6, ease: 'back.out(1.6)'}, Math.max(it.at - 0.15, 0))
        .to(`.item-${i}`, {y: -8, duration: 0.8, repeat: 3, yoyo: true, ease: 'sine.inOut'}, it.at + 0.5);
    });
  }, [word, wordAt, JSON.stringify(items)]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        {stars.map((s, i) => (
          <div key={i} className="star" style={{position: 'absolute', left: s.x, top: s.y, fontSize: s.s, color: i % 3 ? theme.cream : '#fff', lineHeight: 1}}>✦</div>
        ))}
        <div className="cloud" style={{position: 'absolute', left: 100, top: 410, width: 520, height: 330}}>
          {/* Circulos solidos dentro de un contenedor con opacidad: se funden en una sola nube */}
          <div style={{position: 'absolute', inset: 0, opacity: 0.2, filter: 'drop-shadow(0 0 30px rgba(252,244,176,.9))'}}>
            {puffs.map((p, i) => (
              <div key={i} className="puff" style={{position: 'absolute', left: p.x, top: p.y, width: p.r * 1.3, height: p.r * 1.3, borderRadius: '50%', background: theme.cream}} />
            ))}
          </div>
          <div className="dream-word" style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 50, fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 700, fontSize: 150, color: theme.cream, textShadow: '0 0 40px rgba(252,244,176,.55)'}}>{word}</div>
          {[{x: 60, y: 360, r: 34}, {x: 20, y: 420, r: 20}].map((t, i) => (
            <div key={i} className="tail" style={{position: 'absolute', left: t.x, top: t.y, width: t.r, height: t.r, borderRadius: '50%', background: 'rgba(252,244,176,0.3)'}} />
          ))}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
          {items.map((it, i) => (
            <div key={i} className={`item-${i}`} style={{padding: '14px 34px', borderRadius: 60, background: theme.cream, color: '#1b1b1b', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 50, transform: `rotate(${i % 2 ? 3 : -3}deg)`}}>{it.text}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
