import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize, wordsVisible} from './timing';

export type ExampleData = {sentence: string; highlight: string};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Oracion que aparece palabra por palabra con la palabra clave resaltada. */
export const Example: React.FC<TemplateProps<ExampleData>> = ({data, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = data.sentence.split(/\s+/).filter(Boolean);
  const total = words.length;
  const visible = wordsVisible(f, fps, total, durationInFrames);
  const size = fitFontSize(data.sentence, 620 * 3, 68, 0.55, 30);
  const key = norm(data.highlight);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 430}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 40, color: theme.cream, opacity: 0.9, marginBottom: 40}}>example</div>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.3em', maxWidth: 620, textAlign: 'center'}}>
        {words.map((w, i) => {
          const on = norm(w) === key;
          return (
            <span key={i} style={{fontFamily: on ? theme.fonts.serif : theme.fonts.sans, fontWeight: on ? 800 : 700, fontSize: size, color: on ? theme.cream : '#fff', opacity: i < visible ? 1 : 0,
              transform: i < visible ? 'translateY(0)' : 'translateY(14px)', textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
