import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize, revealWords} from './timing';

export type ListenData = {phrase: string; hint?: string};

const BARS = 17;

/** Reto de oido: ondas de sonido mientras se escucha, y la frase se revela palabra a palabra al final. */
export const Listen: React.FC<TemplateProps<ListenData>> = ({data, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = data.phrase.split(/\s+/).filter(Boolean);
  const shown = revealWords(f, durationInFrames, words.length);
  const intro = spring({frame: f, fps, config: {damping: 13, stiffness: 140}});
  const listening = shown === 0;
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 420}}>
      <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 44, color: theme.cream, opacity: Math.min(1, intro)}}>🔊 {listening ? 'Escucha' : 'Decía…'}</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 9, height: 200, marginTop: 30, opacity: listening ? 1 : 0.35}}>
        {Array.from({length: BARS}, (_, i) => {
          const amp = listening ? 0.25 + 0.75 * Math.abs(Math.sin(f / 5 + i * 1.3) * Math.cos(f / 9 + i * 0.7)) : 0.12;
          return <div key={i} style={{width: 20, height: 190 * amp, borderRadius: 10, background: i % 2 ? theme.cream : '#fff'}} />;
        })}
      </div>
      <div style={{marginTop: 50, maxWidth: 600, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 16px'}}>
        {words.map((w, i) => (
          <span key={i} style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fitFontSize(data.phrase, 600 * 2, 70, 0.55, 36), color: '#fff',
            opacity: i < shown ? 1 : 0, transform: `translateY(${i < shown ? 0 : 20}px)`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{w}</span>
        ))}
      </div>
      {data.hint ? <div style={{marginTop: 30, fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,.7)', opacity: shown >= words.length ? 1 : 0}}>{data.hint}</div> : null}
    </AbsoluteFill>
  );
};
