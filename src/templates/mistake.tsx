import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize} from './timing';

export type MistakeData = {wrong: string; right: string};

/** ❌ frase mal -> ✅ frase bien. */
export const Mistake: React.FC<TemplateProps<MistakeData>> = ({data, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wrong = spring({frame: f, fps, config: {damping: 13, stiffness: 140}});
  const strike = Math.max(0, Math.min(1, (f - 16) / 10));
  const right = spring({frame: f - 30, fps, config: {damping: 12, stiffness: 150}});
  const fs = (t: string) => fitFontSize(t, 620 * 2, 60, 0.55, 30);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 420, gap: 70}}>
      <div style={{maxWidth: 620, textAlign: 'center', opacity: wrong, transform: `scale(${0.85 + 0.15 * wrong})`}}>
        <div style={{fontSize: 70}}>❌</div>
        <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fs(data.wrong), color: 'rgba(255,255,255,.6)', textDecoration: strike > 0.5 ? 'line-through' : 'none',
          textDecorationColor: '#ff6b6b', textDecorationThickness: 5}}>
          {data.wrong}
        </div>
      </div>
      <div style={{maxWidth: 620, textAlign: 'center', opacity: right, transform: `translateY(${(1 - Math.min(1, right)) * 40}px)`}}>
        <div style={{fontSize: 70}}>✅</div>
        <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fs(data.right), color: theme.cream, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.right}</div>
      </div>
    </AbsoluteFill>
  );
};
