import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize, litSyllables} from './timing';

export type PronounceData = {word: string; syllables: string[]; phonetic: string};

/** Palabra, silabas que se iluminan una a una y pronunciacion fonetica. */
export const Pronounce: React.FC<TemplateProps<PronounceData>> = ({data, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const word = spring({frame: f, fps, config: {damping: 12, stiffness: 140}});
  const phon = spring({frame: f - Math.round(durationInFrames * 0.45), fps, config: {damping: 14}});
  const lit = litSyllables(f, durationInFrames, data.syllables.length);
  const joined = data.syllables.join(' · ');
  const size = fitFontSize(joined, 620, 100, 0.6, 36);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 440}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(data.word, 620, 64, 0.5, 36), color: theme.cream, opacity: word * 0.9, marginBottom: 50}}>{data.word}</div>
      <div style={{display: 'flex', gap: '0.25em', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 620, fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: size}}>
        {data.syllables.map((s, i) => (
          <span key={i} style={{color: i < lit ? theme.cream : 'rgba(255,255,255,.35)', transform: i === lit - 1 ? 'scale(1.12)' : undefined, display: 'inline-block', textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>
            {s}
            {i < data.syllables.length - 1 ? <span style={{color: 'rgba(255,255,255,.25)', marginLeft: '0.25em'}}>·</span> : null}
          </span>
        ))}
      </div>
      <div style={{marginTop: 60, fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fitFontSize(data.phonetic, 620, 56, 0.55, 30), color: '#fff', opacity: Math.min(1, phon), transform: `translateY(${(1 - Math.min(1, phon)) * 24}px)`}}>{data.phonetic}</div>
    </AbsoluteFill>
  );
};
