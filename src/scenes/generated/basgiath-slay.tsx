import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';
import {DragonSilhouette} from './dragon-silhouette';

const GOLD = '#d9a441';
const EMBER = '#ff7a2f';
/** pseudoaleatorio estable por indice (mismo resultado en cada frame) */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Escena de fantasia oscura (estilo colegio de guerra con dragones, sin arte de terceros): noche roja con brasas,
 * encabezado tipo blason, la frase en oro palabra por palabra, un dragon 3D que respira; en `slash` un tajo de
 * espada lo cruza con destello y aparece el significado; en `ash` el dragon se deshace en ceniza.
 * props: {header?: string, words: string[], meaning: string, meaning2?: string, dragon?: 'svg' (silueta propia, por defecto) o codigo emoji3d,
 *         at: {words: number[], literal?: number, slash: number, ash: number}} (segundos desde el inicio)
 */
export const BasgiathSlay: React.FC<GeneratedProps> = ({props, theme}) => {
  const header = String(props.header ?? 'BASGIATH WAR COLLEGE');
  const words = (Array.isArray(props.words) ? props.words : ['slay', 'the', 'dragon']) as string[];
  const meaning = String(props.meaning ?? '');
  const meaning2 = props.meaning2 ? String(props.meaning2) : '';
  const dragon = String(props.dragon ?? 'svg');
  const at = (props.at ?? {}) as {words?: number[]; literal?: number; slash?: number; ash?: number};
  const wAt = at.words ?? words.map((_, i) => 0.1 + i * 0.3);
  const slash = at.slash ?? 2.5;
  const ash = at.ash ?? 3.8;
  const embers = Array.from({length: 26}, (_, i) => i);
  const flakes = Array.from({length: 34}, (_, i) => i);

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.crest', {opacity: 0, y: -30, duration: 0.4, ease: 'power2.out'}, 0)
      .from('.rule', {scaleX: 0, duration: 0.5, ease: 'power3.out'}, 0.1);
    embers.forEach((i) => {
      tl.fromTo(`.em-${i}`, {y: 0, opacity: 0}, {y: -500 - rnd(i, 1) * 600, opacity: 0.9, duration: 2.2 + rnd(i, 2) * 2, ease: 'none', repeat: 3}, rnd(i, 3) * 1.5);
    });
    words.forEach((_, i) => {
      tl.from(`.w-${i}`, {y: 60, opacity: 0, filter: 'blur(8px)', duration: 0.35, ease: 'power3.out'}, Math.max(wAt[i] - 0.05, 0));
    });
    tl.from('.drag', {scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(1.8)'}, Math.max((wAt[words.length - 1] ?? 0.6) - 0.05, 0))
      .to('.drag', {scale: 1.05, duration: 0.8, yoyo: true, repeat: 3, ease: 'sine.inOut'}, (wAt[words.length - 1] ?? 0.6) + 0.5);
    if (at.literal !== undefined) tl.from('.literal', {opacity: 0, letterSpacing: '0.6em', duration: 0.5, ease: 'power2.out'}, at.literal);
    tl.fromTo('.slash', {scaleX: 0, opacity: 1}, {scaleX: 1, duration: 0.16, ease: 'power4.in', immediateRender: false}, slash - 0.12)
      .to('.slash', {opacity: 0, duration: 0.35}, slash + 0.15)
      .fromTo('.flash', {opacity: 0.85}, {opacity: 0, duration: 0.4, immediateRender: false}, slash + 0.04)
      .to('.drag', {x: -14, duration: 0.05, repeat: 5, yoyo: true, ease: 'none'}, slash + 0.04)
      .from('.meaning', {y: 40, opacity: 0, duration: 0.35, ease: 'back.out(2)'}, slash + 0.1)
      .to('.drag', {opacity: 0, scale: 1.25, y: -60, filter: 'blur(14px) grayscale(1)', duration: 1.0, ease: 'power2.in'}, ash);
    flakes.forEach((i) => {
      const a = rnd(i, 4) * Math.PI * 2;
      tl.fromTo(`.fl-${i}`, {x: 0, y: 0, opacity: 0, scale: 1}, {x: Math.cos(a) * (120 + rnd(i, 5) * 260), y: Math.sin(a) * 160 - 260 - rnd(i, 6) * 200, opacity: 0, scale: 0.3, duration: 1.4, ease: 'power2.out', keyframes: {opacity: [0, 1, 1, 0]}, immediateRender: false}, ash + rnd(i, 7) * 0.4);
    });
    if (meaning2) tl.from('.meaning2', {y: 30, opacity: 0, duration: 0.35, ease: 'back.out(2)'}, ash);
  }, [JSON.stringify(props)]);

  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 62%, #4a1308 0%, #1a0705 48%, #070302 100%)'}}>
      <div ref={scope} style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        {embers.map((i) => (
          <div key={i} className={`em-${i}`} style={{position: 'absolute', left: rnd(i, 8) * 720, top: 1150 + rnd(i, 9) * 150, width: 4 + rnd(i, 10) * 6, height: 4 + rnd(i, 10) * 6, borderRadius: 10, background: EMBER, boxShadow: `0 0 12px ${EMBER}`, opacity: 0}} />
        ))}
        <div className="crest" style={{position: 'absolute', top: 360, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 28, letterSpacing: 9, color: GOLD}}>
          ⟡ {header} ⟡
        </div>
        <div className="rule" style={{position: 'absolute', top: 405, left: 140, right: 140, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`}} />
        <div style={{position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 24}}>
          {words.map((w, i) => (
            <span key={i} className={`w-${i}`} style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 86, color: '#f3d48a', textShadow: `0 0 30px rgba(217,164,65,.55)`}}>{w}</span>
          ))}
        </div>
        <div className="literal" style={{position: 'absolute', top: 565, left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 40, color: '#e9c9a0'}}>literalmente</div>
        <div style={{position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <div style={{position: 'relative', width: 400, height: 400}}>
            {dragon === 'svg' ? <div className="drag"><DragonSilhouette size={400} /></div> : <Img className="drag" src={staticFile(`emoji3d/${dragon}.png`)} style={{width: 400, height: 400, filter: 'drop-shadow(0 0 40px rgba(255,90,30,.45))'}} />}
            {flakes.map((i) => (
              <div key={i} className={`fl-${i}`} style={{position: 'absolute', left: 120 + rnd(i, 11) * 160, top: 120 + rnd(i, 12) * 160, width: 8 + rnd(i, 13) * 10, height: 8 + rnd(i, 13) * 10, borderRadius: 3, background: rnd(i, 14) > 0.5 ? '#5d5d5d' : EMBER, opacity: 0}} />
            ))}
            <div className="slash" style={{position: 'absolute', left: -120, top: 190, width: 640, height: 10, borderRadius: 6, background: 'linear-gradient(90deg, transparent, #fff 30%, #ffe7a8 70%, transparent)', boxShadow: '0 0 30px #fff', transform: 'rotate(-32deg)', transformOrigin: '0% 50%', opacity: 0}} />
          </div>
        </div>
        <div className="flash" style={{position: 'absolute', inset: 0, background: '#fff7e0', opacity: 0}} />
        <div style={{position: 'absolute', top: 1065, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 22, alignItems: 'baseline'}}>
          <span className="meaning" style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 78, color: theme.cream}}>{meaning}</span>
          {meaning2 ? <span className="meaning2" style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 78, color: '#e9c9a0'}}>· {meaning2}</span> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
