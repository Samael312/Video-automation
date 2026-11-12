import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {tokenStyle, type CaptionPage} from './captions';

type Props = {pages: CaptionPage[]; highlight: string; fontFamily: string; fontSize?: number; top?: number; color?: string; karaoke?: boolean};

/** Muestra la pagina activa por tiempo; con `karaoke` resalta la palabra que se esta diciendo. */
export const TikTokCaptions: React.FC<Props> = ({pages, highlight, fontFamily, fontSize = 25, top = 285, color = '#fff', karaoke = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!page) return null;
  const pop = spring({frame: frame - Math.round(page.start * fps), fps, config: {damping: 14, stiffness: 180}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: top}}>
      <div style={{fontFamily, fontWeight: 700, fontSize, textAlign: 'center', maxWidth: '84%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.4em', textShadow: '0 2px 10px rgba(0,0,0,.5)',
        transform: `scale(${0.85 + 0.15 * Math.min(1, pop)})`, opacity: Math.min(1, pop * 1.5)}}>
        {page.tokens.map((tok, i) => (
          <span key={i} style={{...tokenStyle(tok, t, {karaoke, highlight, color}), display: 'inline-block'}}>{tok.text}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
