import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';
import {DragonSilhouette} from './dragon-silhouette';

type World = {tag: string; words: string[]; emojis?: string[]};

/**
 * Pantalla partida en dos mundos con la misma palabra: arriba fantasia oscura (oro, brasas, emojis 3D),
 * abajo TikTok rosa brillante. Cada mitad entra en su cue con su etiqueta y sus palabras una a una;
 * la palabra `hl` se marca en ambas mitades.
 * props: {top: World, bottom: World, hl?: string,
 *         at: {top: number, topWords: number[], bottom: number, bottomWords: number[]}} (segundos desde el inicio)
 */
export const TwoWorlds: React.FC<GeneratedProps> = ({props, theme}) => {
  const top = (props.top ?? {tag: '', words: []}) as World;
  const bottom = (props.bottom ?? {tag: '', words: []}) as World;
  const hl = String(props.hl ?? 'slay').toLowerCase();
  const at = (props.at ?? {}) as {top?: number; topWords?: number[]; bottom?: number; bottomWords?: number[]};
  const tIn = at.top ?? 0.1;
  const bIn = at.bottom ?? 2;
  const isHl = (w: string) => w.toLowerCase().startsWith(hl);

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.top', {yPercent: -100, duration: 0.45, ease: 'power3.out'}, Math.max(tIn - 0.1, 0))
      .from('.top .tag', {opacity: 0, letterSpacing: '0.8em', duration: 0.5}, tIn + 0.1)
      .from('.top .emo', {scale: 0, opacity: 0, stagger: 0.12, duration: 0.4, ease: 'back.out(2)'}, tIn + 0.2);
    top.words.forEach((_, i) => tl.from(`.top .w-${i}`, {y: 50, opacity: 0, duration: 0.3, ease: 'power3.out'}, Math.max((at.topWords?.[i] ?? tIn + 0.3 + i * 0.25) - 0.05, 0)));
    tl.to('.top', {filter: 'brightness(.55)', duration: 0.3}, bIn)
      .from('.bottom', {yPercent: 100, duration: 0.45, ease: 'power3.out'}, Math.max(bIn - 0.1, 0))
      .from('.bottom .tag', {opacity: 0, scale: 0.5, duration: 0.35, ease: 'back.out(2)'}, bIn + 0.1)
      .from('.bottom .emo', {scale: 0, rotate: -30, opacity: 0, stagger: 0.12, duration: 0.4, ease: 'back.out(2.5)'}, bIn + 0.2);
    bottom.words.forEach((_, i) => tl.from(`.bottom .w-${i}`, {scale: 1.6, opacity: 0, duration: 0.25, ease: 'back.out(2)'}, Math.max((at.bottomWords?.[i] ?? bIn + 0.3 + i * 0.25) - 0.05, 0)));
    const last = Math.max(...(at.bottomWords ?? [bIn + 1]));
    tl.to('.top', {filter: 'brightness(1)', duration: 0.3}, last + 0.3)
      .fromTo('.hl', {textShadow: '0 0 0px rgba(255,255,255,0)'}, {textShadow: '0 0 34px rgba(255,255,255,.9)', duration: 0.3, yoyo: true, repeat: 1}, last + 0.3);
  }, [JSON.stringify(props)]);

  const words = (w: World, color: string, font: string, size: number, hlColor: string) => (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 20px', padding: '0 40px'}}>
      {w.words.map((x, i) => (
        <span key={i} className={`w-${i}${isHl(x) ? ' hl' : ''}`} style={{fontFamily: font, fontWeight: 800, fontSize: size, color: isHl(x) ? hlColor : color, fontStyle: font === theme.fonts.serifItalic ? 'italic' : 'normal'}}>{x}</span>
      ))}
    </div>
  );

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <div className="top" style={{position: 'absolute', left: 0, right: 0, top: 0, height: 790, background: 'radial-gradient(ellipse at 50% 85%, #4a1308 0%, #160604 60%, #070302 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, gap: 26}}>
          <div className="tag" style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 30, letterSpacing: 10, color: '#d9a441'}}>⟡ {top.tag} ⟡</div>
          {words(top, '#f3d48a', theme.fonts.serif, 92, '#ffb347')}
          <div style={{display: 'flex', gap: 30}}>
            {(top.emojis ?? []).map((e, i) => (e === 'dragon' ? <div key={i} className="emo"><DragonSilhouette size={170} /></div> : <Img key={i} className="emo" src={staticFile(`emoji3d/${e}.png`)} style={{width: 150, height: 150, filter: 'drop-shadow(0 0 26px rgba(255,90,30,.5))'}} />))}
          </div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 787, height: 6, background: 'linear-gradient(90deg, #d9a441, #ff4f9a)', zIndex: 2}} />
        <div className="bottom" style={{position: 'absolute', left: 0, right: 0, top: 790, bottom: 0, background: 'linear-gradient(160deg, #ffe3f1 0%, #ffc2df 55%, #ffd9a8 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 50, gap: 26}}>
          <div className="tag" style={{padding: '6px 24px', borderRadius: 30, background: '#111', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 30, color: '#fff', letterSpacing: 2}}>{bottom.tag}</div>
          {words(bottom, '#2a1020', theme.fonts.sans, 84, '#ff2d7a')}
          <div style={{display: 'flex', gap: 30}}>
            {(bottom.emojis ?? []).map((e, i) => <Img key={i} className="emo" src={staticFile(`emoji3d/${e}.png`)} style={{width: 140, height: 140}} />)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
