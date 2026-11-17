import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Side = {cond: string; word: string; condAt: number; wordAt: number};

/**
 * Regla en pantalla partida. Arriba: "construir" — ladrillos que caen y se apilan, y la palabra se estampa.
 * Abajo: "ejecutar" — un boton play que se pulsa, una barra que se llena, y la palabra se estampa.
 * props: {top: {cond, word, condAt, wordAt}, bottom: {cond, word, condAt, wordAt}} (segundos desde el inicio de la escena)
 */
export const BuildVsRun: React.FC<GeneratedProps> = ({props, theme}) => {
  const top = (props.top ?? {cond: 'si lo construyes', word: 'make', condAt: 0.1, wordAt: 1.5}) as Side;
  const bottom = (props.bottom ?? {cond: 'si lo ejecutas', word: 'do', condAt: 2.1, wordAt: 3.5}) as Side;
  const bricks = [{x: 0, y: 2}, {x: 1, y: 2}, {x: 2, y: 2}, {x: 0.5, y: 1}, {x: 1.5, y: 1}, {x: 1, y: 0}];

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.divider', {scaleX: 0, duration: 0.4, ease: 'power3.out'}, 0)
      .from('.top-cond', {opacity: 0, y: -30, duration: 0.3}, top.condAt)
      .from('.brick', {y: -500, opacity: 0, duration: 0.35, stagger: 0.12, ease: 'bounce.out'}, top.condAt + 0.2)
      .from('.top-word', {scale: 3, opacity: 0, rotate: -12, duration: 0.3, ease: 'power4.in'}, top.wordAt - 0.1)
      .to('.bricks', {x: '+=8', duration: 0.05, repeat: 3, yoyo: true}, top.wordAt + 0.2)
      .to('.top-half', {opacity: 0.45, duration: 0.3}, bottom.condAt)
      .from('.bot-cond', {opacity: 0, y: 30, duration: 0.3}, bottom.condAt)
      .from('.play', {scale: 0, rotate: -90, duration: 0.35, ease: 'back.out(2.5)'}, bottom.condAt + 0.15)
      .to('.play', {scale: 0.85, duration: 0.1, yoyo: true, repeat: 1}, bottom.condAt + 0.6)
      .fromTo('.bar-fill', {scaleX: 0}, {scaleX: 1, duration: Math.max(bottom.wordAt - bottom.condAt - 0.8, 0.4), ease: 'power1.inOut'}, bottom.condAt + 0.75)
      .from('.bot-word', {scale: 3, opacity: 0, rotate: 12, duration: 0.3, ease: 'power4.in'}, bottom.wordAt - 0.1)
      .to('.top-half', {opacity: 1, duration: 0.3}, bottom.wordAt + 0.3);
  }, [JSON.stringify(top), JSON.stringify(bottom)]);

  const cond: React.CSSProperties = {fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 40, color: '#fff'};
  const stamp: React.CSSProperties = {fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 130, lineHeight: 1, color: theme.cream, textShadow: '0 6px 30px rgba(0,0,0,.5)'};
  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="top-half" style={{position: 'absolute', left: 0, right: 0, top: 380, height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div className="top-cond" style={cond}>{top.cond}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 40, marginTop: 30}}>
            <div className="bricks" style={{position: 'relative', width: 3 * 74, height: 3 * 50}}>
              {bricks.map((b, i) => (
                <div key={i} className="brick" style={{position: 'absolute', left: b.x * 74, top: b.y * 50, width: 70, height: 46, borderRadius: 6, background: i % 2 ? '#e07a5f' : '#f2a07b', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.18)'}} />
              ))}
            </div>
            <div className="top-word" style={stamp}>{top.word}</div>
          </div>
        </div>
        <div className="divider" style={{position: 'absolute', left: 60, right: 60, top: 760, height: 4, borderRadius: 2, background: 'rgba(252,244,176,.5)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 800, height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div className="bot-cond" style={cond}>{bottom.cond}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 40, marginTop: 30}}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
              <div className="play" style={{width: 110, height: 110, borderRadius: '50%', background: '#5fb87a', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{width: 0, height: 0, marginLeft: 10, borderTop: '24px solid transparent', borderBottom: '24px solid transparent', borderLeft: '38px solid #fff'}} />
              </div>
              <div style={{width: 220, height: 20, borderRadius: 10, background: 'rgba(255,255,255,.15)', overflow: 'hidden'}}>
                <div className="bar-fill" style={{width: '100%', height: '100%', background: '#5fb87a', transformOrigin: '0% 50%'}} />
              </div>
            </div>
            <div className="bot-word" style={stamp}>{bottom.word}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
