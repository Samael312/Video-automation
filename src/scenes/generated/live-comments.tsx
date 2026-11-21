import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Comment = {user: string; text: string; emoji?: string; avatar?: string};
type Sticker = {text: string; emoji?: string};

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 91.7 + k * 47.3) * 24634.6345;
  return x - Math.floor(x);
};

/**
 * Overlay fx estilo live de TikTok sobre la profe: los comentarios suben por la izquierda (usuario + texto + emoji),
 * corazones flotan por la derecha; despues los comentarios se van y entran stickers rosas con los significados.
 * props: {comments: Comment[], stickers: Sticker[], cues: [comentario0, …, sticker0, …]}
 *   (cues en s desde el inicio del overlay; emoji/avatar = codigos de public/emoji)
 */
export const LiveComments: React.FC<GeneratedProps> = ({props, theme}) => {
  const comments = (Array.isArray(props.comments) ? props.comments : []) as Comment[];
  const stickers = (Array.isArray(props.stickers) ? props.stickers : []) as Sticker[];
  const cues = (Array.isArray(props.cues) ? props.cues : []) as number[];
  const cAt = comments.map((_, i) => cues[i] ?? 0.2 + i * 0.8);
  const sAt = stickers.map((_, i) => cues[comments.length + i] ?? 3 + i * 0.8);
  const leave = sAt.length ? sAt[0] - 0.2 : 99;
  const hearts = Array.from({length: 14}, (_, i) => i);
  const ROW = 96;

  const scope = useGsap<HTMLDivElement>((tl) => {
    comments.forEach((_, i) => {
      tl.fromTo(`.c-${i}`, {y: 60, opacity: 0}, {y: 0, opacity: 1, duration: 0.3, ease: 'power2.out'}, Math.max(cAt[i] - 0.1, 0));
      // los comentarios anteriores suben una fila
      for (let j = 0; j < i; j++) tl.to(`.c-${j}`, {y: -(i - j) * ROW, duration: 0.3, ease: 'power2.out'}, Math.max(cAt[i] - 0.1, 0));
    });
    hearts.forEach((i) => {
      const t0 = (cAt[0] ?? 0) + rnd(i, 1) * Math.max(leave - (cAt[0] ?? 0) - 1, 0.5);
      tl.fromTo(`.h-${i}`, {y: 0, x: 0, opacity: 0, scale: 0.6}, {y: -520 - rnd(i, 2) * 200, x: (rnd(i, 3) - 0.5) * 120, scale: 1.1, duration: 1.8, ease: 'power1.out', keyframes: {opacity: [0, 1, 1, 0]}, immediateRender: false}, t0);
    });
    if (sAt.length) tl.to('.feed', {opacity: 0, x: -60, duration: 0.25, ease: 'power2.in'}, leave);
    stickers.forEach((_, i) => {
      tl.fromTo(`.s-${i}`, {scale: 0, rotate: i % 2 ? 14 : -14, opacity: 0}, {scale: 1, rotate: i % 2 ? 3 : -3, opacity: 1, duration: 0.4, ease: 'back.out(2.6)'}, Math.max(sAt[i] - 0.1, 0));
    });
  }, [JSON.stringify(props)]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="feed" style={{position: 'absolute', left: 30, top: 1060}}>
          {comments.map((c, i) => (
            <div key={i} className={`c-${i}`} style={{position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 14, opacity: 0, whiteSpace: 'nowrap'}}>
              <div style={{width: 62, height: 62, borderRadius: 31, background: `hsl(${(i * 77 + 320) % 360} 70% 62%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid rgba(255,255,255,.85)'}}>
                {c.avatar ? <Img src={staticFile(`emoji/${c.avatar}.png`)} style={{width: 44, height: 44}} /> : <span style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 30, color: '#fff'}}>{c.user[0]?.toUpperCase()}</span>}
              </div>
              <div style={{padding: '8px 18px', borderRadius: 22, background: 'rgba(0,0,0,.42)'}}>
                <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 24, color: 'rgba(255,255,255,.7)'}}>{c.user}</div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 36, color: '#fff'}}>
                  {c.text}
                  {c.emoji ? <Img src={staticFile(`emoji/${c.emoji}.png`)} style={{width: 40, height: 40}} /> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        {hearts.map((i) => (
          <div key={i} className={`h-${i}`} style={{position: 'absolute', left: 600 + rnd(i, 4) * 70, top: 1140, fontSize: 52 + rnd(i, 5) * 24, color: ['#ff2d6f', '#ff5fa2', '#ff8a3d', '#ffffff'][i % 4], opacity: 0, textShadow: '0 4px 12px rgba(0,0,0,.25)'}}>♥</div>
        ))}
        <div style={{position: 'absolute', top: 820, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
          {stickers.map((s, i) => (
            <div key={i} className={`s-${i}`} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 30px', borderRadius: 40, background: 'linear-gradient(135deg, #ff4f9a, #ff8fc4)', boxShadow: '0 10px 26px rgba(255,60,140,.4)', border: '4px solid #fff', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 52, color: '#fff', opacity: 0, whiteSpace: 'nowrap'}}>
              {s.text}
              {s.emoji ? <Img src={staticFile(`emoji/${s.emoji}.png`)} style={{width: 56, height: 56}} /> : null}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
