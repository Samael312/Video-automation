import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionPage} from './captions';

type Props = {pages: CaptionPage[]; highlight: string; fontFamily: string; fontSize?: number; top?: number; color?: string};

/** Muestra la pagina activa por tiempo y resalta la palabra que se esta diciendo. */
export const TikTokCaptions: React.FC<Props> = ({pages, highlight, fontFamily, fontSize = 25, top = 285, color = '#fff'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!page) return null;
  const pop = spring({frame: frame - Math.round(page.start * fps), fps, config: {damping: 14, stiffness: 180}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: top}}>
      <div style={{fontFamily, fontWeight: 700, fontSize, textAlign: 'center', maxWidth: '84%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.3em', textShadow: '0 2px 10px rgba(0,0,0,.5)',
        transform: `scale(${0.85 + 0.15 * Math.min(1, pop)})`, opacity: Math.min(1, pop * 1.5)}}>
        {page.tokens.map((tok, i) => {
          const active = t >= tok.start && t < tok.end;
          return <span key={i} style={{color: active ? highlight : color, display: 'inline-block', transform: active ? 'scale(1.12)' : undefined}}>{tok.text}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};
