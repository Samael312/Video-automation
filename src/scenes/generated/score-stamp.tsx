import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

/**
 * Sello de goma que golpea la pantalla (pensado como overlay fx sobre la profe): cae grande y girado,
 * rebota, la pantalla tiembla un poco y queda con textura de tinta; `sub` se escribe debajo.
 * props: {text: string, sub?: string, color?: string, top?: number, cues: [golpe]} (cues en s desde el inicio)
 */
export const ScoreStamp: React.FC<GeneratedProps> = ({props, theme}) => {
  const text = String(props.text ?? '');
  const sub = props.sub ? String(props.sub) : '';
  const color = String(props.color ?? '#ff5a5f');
  const top = Number(props.top ?? 760);
  const cues = (Array.isArray(props.cues) ? props.cues : []) as number[];
  const hit = Math.max((cues[0] ?? 0.1) - 0.15, 0);

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.fromTo('.stamp', {scale: 3.2, rotate: -28, opacity: 0}, {scale: 1, rotate: -9, opacity: 1, duration: 0.18, ease: 'power4.in'}, hit)
      .to('.stamp', {scale: 1.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out'}, hit + 0.18)
      .fromTo('.shake', {x: 0}, {x: 10, duration: 0.04, repeat: 5, yoyo: true, ease: 'none'}, hit + 0.18)
      .fromTo('.ring', {scale: 0.6, opacity: 0.9}, {scale: 1.9, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false}, hit + 0.18);
    if (sub) tl.from('.sub', {clipPath: 'inset(0 100% 0 0)', duration: 0.35, ease: 'power2.out'}, hit + 0.4);
  }, [text, sub, color, JSON.stringify(cues)]);

  return (
    <AbsoluteFill>
      <div ref={scope} className="shake" style={{position: 'absolute', inset: 0}}>
        <div style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <div style={{position: 'relative'}}>
            <div className="ring" style={{position: 'absolute', inset: -30, borderRadius: 40, border: `6px solid ${color}`, opacity: 0}} />
            <div className="stamp" style={{padding: '14px 40px', border: `9px solid ${color}`, borderRadius: 22, color, background: 'rgba(255,255,255,.82)', fontFamily: theme.fonts.sans, fontWeight: 900, fontSize: text.length > 7 ? 84 : 104, letterSpacing: 4, whiteSpace: 'nowrap', textTransform: 'uppercase', opacity: 0,
              maskImage: 'radial-gradient(circle at 30% 40%, #000 60%, rgba(0,0,0,.75) 61%, #000 75%)', WebkitMaskImage: 'radial-gradient(circle at 30% 40%, #000 60%, rgba(0,0,0,.75) 61%, #000 75%)'}}>
              {text}
            </div>
          </div>
          {sub ? (
            <div className="sub" style={{padding: '6px 22px', borderRadius: 14, background: 'rgba(20,18,16,.6)', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 52, color: theme.cream}}>{sub}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
