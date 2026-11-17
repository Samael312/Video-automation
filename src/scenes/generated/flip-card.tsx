import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Timed = {text: string; at: number};

/**
 * Tarjeta que se voltea: al frente las frases en español (aparecen cuando la profe las dice),
 * al dorso la frase en inglés palabra por palabra con la clave resaltada y un sol que gira detrás.
 * props: {front: [{text, at}], back: [{text, at}], key: string, flipAt: s} (segundos desde el inicio de la escena)
 */
export const FlipCard: React.FC<GeneratedProps> = ({props, theme}) => {
  const front = (Array.isArray(props.front) ? props.front : []) as Timed[];
  const back = (Array.isArray(props.back) ? props.back : []) as Timed[];
  const key = String(props.key ?? '').toLowerCase();
  const flipAt = Number(props.flipAt ?? 2);
  const keyIdx = back.findIndex((w) => w.text.toLowerCase().replace(/[^a-z']/g, '') === key);

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.card', {y: 300, rotateZ: -8, opacity: 0, duration: 0.5, ease: 'power3.out'}, 0);
    front.forEach((p, i) => {
      tl.from(`.front-${i}`, {opacity: 0, y: 30, duration: 0.35, ease: 'power2.out'}, Math.max(p.at - 0.1, 0.2));
    });
    tl.to('.card', {rotateY: 180, duration: 0.6, ease: 'power2.inOut'}, flipAt)
      .from('.sun', {scale: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.4)'}, flipAt + 0.2)
      .to('.sun', {rotate: 120, duration: 6, ease: 'none'}, flipAt + 0.2);
    back.forEach((w, i) => {
      tl.from(`.back-${i}`, {y: -80, opacity: 0, rotateX: 90, duration: 0.3, ease: 'back.out(2)'}, Math.max(w.at - 0.08, flipAt + 0.3));
    });
    if (keyIdx >= 0) tl.fromTo('.marker', {scaleX: 0}, {scaleX: 1, duration: 0.35, ease: 'power2.out'}, back[keyIdx].at + 0.2);
  }, [JSON.stringify(front), JSON.stringify(back), key, flipAt]);

  const face: React.CSSProperties = {position: 'absolute', inset: 0, borderRadius: 36, backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 46, textAlign: 'center'};
  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, perspective: 1400}}>
        <div className="sun" style={{position: 'absolute', left: 360 - 380, top: 720 - 380, width: 760, height: 760, borderRadius: '50%', background: `repeating-conic-gradient(rgba(252,244,176,.22) 0deg 10deg, transparent 10deg 24deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 35%, transparent 70%)'}} />
        <div className="card" style={{position: 'absolute', left: 80, top: 500, width: 560, height: 440, transformStyle: 'preserve-3d'}}>
          <div style={{...face, background: '#2a2a2a', border: '2px solid rgba(255,255,255,.12)', gap: 18}}>
            <div style={{fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 28, color: 'rgba(255,255,255,.55)', letterSpacing: 3}}>EN ESPAÑOL</div>
            {front.map((p, i) => (
              <div key={i} className={`front-${i}`} style={{fontFamily: theme.fonts.serif, fontWeight: 700, fontSize: 48, lineHeight: 1.15, color: '#fff'}}>
                {i > 0 ? <span style={{display: 'block', fontFamily: theme.fonts.sans, fontSize: 28, color: 'rgba(255,255,255,.5)', marginBottom: 8}}>o</span> : null}
                “{p.text}”
              </div>
            ))}
          </div>
          <div style={{...face, transform: 'rotateY(180deg)', background: theme.cream, boxShadow: '0 30px 80px rgba(0,0,0,.45)'}}>
            <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 28, color: 'rgba(27,27,27,.55)', letterSpacing: 3, marginBottom: 22}}>EN INGLÉS</div>
            <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 6, perspective: 600}}>
              {back.map((w, i) => (
                <span key={i} className={`back-${i}`} style={{position: 'relative', display: 'inline-block', fontFamily: i === keyIdx ? theme.fonts.serifItalic : theme.fonts.serif, fontStyle: i === keyIdx ? 'italic' : 'normal', fontWeight: 800, fontSize: 76, lineHeight: 1.1, color: '#1b1b1b'}}>
                  {i === keyIdx ? <span className="marker" style={{position: 'absolute', left: -8, right: -8, bottom: 6, height: 30, background: '#ff8a65', borderRadius: 6, zIndex: -1, transformOrigin: '0% 50%'}} /> : null}
                  <span style={{position: 'relative'}}>{w.text}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
