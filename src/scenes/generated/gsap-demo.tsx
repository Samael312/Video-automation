import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {gsap} from 'gsap';
import {SplitText} from 'gsap/SplitText';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

gsap.registerPlugin(SplitText);

/**
 * Prueba de GSAP: tipografia cinetica con SplitText.
 * props: {lead?: string, key?: string, sub?: string}
 */
export const GsapDemo: React.FC<GeneratedProps> = ({props, theme, durationInFrames}) => {
  const lead = String(props.lead ?? 'cuando la historia da un');
  const key = String(props.key ?? 'plot twist');
  const sub = String(props.sub ?? 'giro inesperado');
  const total = durationInFrames / 30;

  const scope = useGsap<HTMLDivElement>((tl, root) => {
    const leadSplit = SplitText.create(root.querySelector('.lead'), {type: 'words'});
    const keySplit = SplitText.create(root.querySelector('.key'), {type: 'chars'});
    tl.from(leadSplit.words, {y: 40, opacity: 0, duration: 0.35, stagger: 0.08, ease: 'power3.out'}, 0)
      .from(keySplit.chars, {yPercent: 120, rotate: (i: number) => (random(`${key}-${i}`) - 0.5) * 60, scale: 0.4, opacity: 0, duration: 0.5, stagger: 0.035, ease: 'back.out(2.2)'}, 0.35)
      .from('.bar', {scaleX: 0, transformOrigin: '0% 50%', duration: 0.4, ease: 'expo.out'}, '>-0.15')
      .from('.sub', {y: 30, opacity: 0, filter: 'blur(8px)', duration: 0.4, ease: 'power2.out'}, '<0.1')
      .to(keySplit.chars, {y: -10, duration: 0.25, stagger: {each: 0.04, yoyo: true, repeat: 1}, ease: 'sine.inOut'}, '+=0.2')
      .to(root.children, {opacity: 0, y: -40, duration: 0.3, ease: 'power2.in'}, Math.max(total - 0.3, 0));
  }, [lead, key, sub, total]);

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div ref={scope} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 640, textAlign: 'center'}}>
        <div className="lead" style={{fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 42, color: theme.cream}}>{lead}</div>
        <div className="key" style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 120, lineHeight: 1, color: theme.cream}}>{key}</div>
        <div className="bar" style={{width: 420, height: 10, borderRadius: 5, background: theme.cream}} />
        <div className="sub" style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 48, color: theme.cream}}>{sub}</div>
      </div>
    </AbsoluteFill>
  );
};
