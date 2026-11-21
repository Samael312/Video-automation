import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

/**
 * "get UP" que se levanta: suena un despertador (sacudida), "UP" sube de la cama estirandose,
 * y debajo se escribe el significado con sus contextos.
 * props: {verb: string ("get"), particle: string ("up"), meaning: string, notes?: string[], badge?: string,
 *         alarm?: string (emoji), bed?: string (emoji), at?: {rise, meaning, notes: number[]}} (segundos desde el inicio)
 */
export const RiseUp: React.FC<GeneratedProps> = ({props, theme}) => {
  const verb = String(props.verb ?? 'get');
  const particle = String(props.particle ?? 'up');
  const meaning = String(props.meaning ?? '');
  const notes = (Array.isArray(props.notes) ? props.notes : []).map(String);
  const badge = props.badge ? String(props.badge) : '';
  const alarm = String(props.alarm ?? '23f0');
  const bed = String(props.bed ?? '1f6cf');
  const at = (props.at ?? {}) as {rise?: number; meaning?: number; notes?: number[]};
  const rise = at.rise ?? 0.1;
  const tMeaning = at.meaning ?? rise + 1;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.badge', {y: -40, opacity: 0, duration: 0.3, ease: 'back.out(2)'}, 0)
      .from('.bed', {y: 80, opacity: 0, duration: 0.35, ease: 'power2.out'}, 0)
      .from('.alarm', {scale: 0, duration: 0.25, ease: 'back.out(3)'}, 0.05)
      .to('.alarm', {rotate: 14, duration: 0.05, repeat: 9, yoyo: true, ease: 'none'}, 0.3)
      .from('.verb', {opacity: 0, x: -60, duration: 0.3, ease: 'power2.out'}, Math.max(rise - 0.15, 0))
      .fromTo('.particle', {y: 330, scaleY: 0.3, opacity: 0}, {y: 0, scaleY: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.8)'}, rise)
      .fromTo('.bed', {y: 0}, {y: 30, duration: 0.2, yoyo: true, repeat: 1}, rise)
      .from('.meaning', {clipPath: 'inset(0 100% 0 0)', duration: 0.5, ease: 'power2.out'}, tMeaning);
    notes.forEach((_, i) => tl.from(`.note-${i}`, {y: 30, opacity: 0, duration: 0.3, ease: 'back.out(2)'}, at.notes?.[i] ?? tMeaning + 0.6 + i * 0.6));
  }, [verb, particle, meaning, JSON.stringify(notes), JSON.stringify(at)]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, color: '#fff'}}>
        {badge ? (
          <div className="badge" style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 34, letterSpacing: 6, opacity: 0.8}}>{badge}</div>
        ) : null}
        <Img className="alarm" src={staticFile(`emoji/${alarm}.png`)} style={{position: 'absolute', top: 340, right: 90, width: 120, height: 120}} />
        <div style={{position: 'absolute', top: 400, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 28}}>
          <span className="verb" style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 130}}>{verb}</span>
          <span className="particle" style={{display: 'inline-block', transformOrigin: '50% 100%', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 190, color: theme.cream}}>{particle}</span>
        </div>
        <Img className="bed" src={staticFile(`emoji/${bed}.png`)} style={{position: 'absolute', top: 660, left: 260, width: 200, height: 200}} />
        <div className="meaning" style={{position: 'absolute', top: 890, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 84, color: theme.cream}}>{meaning}</div>
        <div style={{position: 'absolute', top: 1010, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 22}}>
          {notes.map((n, i) => (
            <div key={i} className={`note-${i}`} style={{padding: '10px 26px', borderRadius: 40, background: 'rgba(255,255,255,.12)', fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 38}}>{n}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
