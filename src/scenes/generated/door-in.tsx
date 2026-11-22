import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

/**
 * "get IN": una puerta se abre (hoja que gira), "in" entra por ella y se queda dentro; se escribe el significado,
 * despues un emoji (carro) entra deslizando por la puerta y al final aparece la frase de ejemplo en un globo.
 * props: {verb, particle, meaning, badge?, emoji? (public/emoji), example?: string,
 *         at?: {enter, meaning, emoji, example}} (segundos desde el inicio)
 */
export const DoorIn: React.FC<GeneratedProps> = ({props, theme}) => {
  const verb = String(props.verb ?? 'get');
  const particle = String(props.particle ?? 'in');
  const meaning = String(props.meaning ?? '');
  const badge = props.badge ? String(props.badge) : '';
  const emoji = String(props.emoji ?? '1f697');
  const example = props.example ? String(props.example) : '';
  const at = (props.at ?? {}) as {enter?: number; meaning?: number; emoji?: number; example?: number};
  const enter = at.enter ?? 0.1;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.badge', {y: -40, opacity: 0, duration: 0.3, ease: 'back.out(2)'}, 0)
      .from('.frame', {scaleY: 0, transformOrigin: '50% 100%', duration: 0.35, ease: 'power3.out'}, 0)
      .from('.verb', {opacity: 0, x: -80, duration: 0.3, ease: 'power2.out'}, Math.max(enter - 0.15, 0))
      .to('.leaf', {rotateY: -75, duration: 0.45, ease: 'power2.inOut'}, enter)
      .fromTo('.particle', {x: -420, opacity: 0}, {x: 0, opacity: 1, duration: 0.5, ease: 'power3.out'}, enter + 0.1)
      .from('.meaning', {clipPath: 'inset(0 100% 0 0)', duration: 0.5, ease: 'power2.out'}, at.meaning ?? enter + 1)
      .fromTo('.car', {x: -520}, {x: 0, duration: 0.6, ease: 'power3.out'}, at.emoji ?? enter + 2)
      .to('.car', {y: -8, duration: 0.12, repeat: 3, yoyo: true}, (at.emoji ?? enter + 2) + 0.6);
    if (example) tl.from('.example', {scale: 0, transformOrigin: '20% 100%', duration: 0.35, ease: 'back.out(2.2)'}, at.example ?? enter + 3);
  }, [verb, particle, meaning, emoji, example, JSON.stringify(at)]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, color: '#fff'}}>
        {badge ? (
          <div className="badge" style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 34, letterSpacing: 6, opacity: 0.8}}>{badge}</div>
        ) : null}
        <span className="verb" style={{position: 'absolute', top: 470, left: 70, fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 130}}>{verb}</span>
        {/* marco de la puerta con su hoja; "in" queda dentro */}
        <div className="frame" style={{position: 'absolute', top: 390, left: 360, width: 290, height: 420, border: `8px solid ${theme.cream}`, borderBottom: 'none', borderRadius: '16px 16px 0 0', perspective: 900, overflow: 'visible'}}>
          <span className="particle" style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 170, color: theme.cream}}>{particle}</span>
          <div className="leaf" style={{position: 'absolute', inset: 0, background: 'rgba(252,244,176,.18)', transformOrigin: '0% 50%', borderRight: `4px solid ${theme.cream}`}}>
            <div style={{position: 'absolute', right: 26, top: 200, width: 22, height: 22, borderRadius: 11, background: theme.cream}} />
          </div>
        </div>
        <div className="meaning" style={{position: 'absolute', top: 850, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 74, color: theme.cream}}>{meaning}</div>
        <Img className="car" src={staticFile(`emoji/${emoji}.png`)} style={{position: 'absolute', top: 950, left: 290, width: 150, height: 150}} />
        {example ? (
          <div className="example" style={{position: 'absolute', top: 1110, left: 110, padding: '18px 34px', borderRadius: 34, background: '#1d8cf8', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 48}}>{example}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
