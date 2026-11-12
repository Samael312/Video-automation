import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize} from './timing';

export type FalseFriendData = {a: string; b: string; note?: string};

/** A ≠ B (falso amigo). */
export const FalseFriend: React.FC<TemplateProps<FalseFriendData>> = ({data, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 12, stiffness: 140}});
  const neq = spring({frame: f - 14, fps, config: {damping: 8, stiffness: 170}});
  const b = spring({frame: f - 26, fps, config: {damping: 12, stiffness: 140}});
  const note = spring({frame: f - 40, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(data.a, 620, 96), color: theme.cream, opacity: a, transform: `scale(${0.8 + 0.2 * a})`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.a}</div>
      <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 120, color: '#ff6b6b', lineHeight: 1.1, transform: `scale(${neq}) rotate(${(1 - neq) * 40}deg)`}}>≠</div>
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fitFontSize(data.b, 620, 88), color: '#fff', opacity: b, transform: `translateY(${(1 - Math.min(1, b)) * 30}px)`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.b}</div>
      {data.note ? <div style={{marginTop: 36, maxWidth: 560, textAlign: 'center', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fitFontSize(data.note, 1100, 34), color: '#fff', opacity: note * 0.85}}>{data.note}</div> : null}
    </AbsoluteFill>
  );
};
