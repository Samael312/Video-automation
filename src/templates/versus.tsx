import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize} from './timing';

export type VersusData = {left: string; right: string; leftLabel?: string; rightLabel?: string};

/** Dos opciones frente a frente (UK vs US, formal vs informal, etc.). */
export const Versus: React.FC<TemplateProps<VersusData>> = ({data, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l = spring({frame: f, fps, config: {damping: 12, stiffness: 150}});
  const vs = spring({frame: f - 12, fps, config: {damping: 7, stiffness: 190}});
  const r = spring({frame: f - 22, fps, config: {damping: 12, stiffness: 150}});
  const side = (word: string, label: string | undefined, p: number, fromX: number, color: string) => (
    <div style={{width: 600, textAlign: 'center', opacity: Math.min(1, p), transform: `translateX(${(1 - Math.min(1, p)) * fromX}px)`}}>
      {label ? <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 34, color: 'rgba(255,255,255,.75)', marginBottom: 6}}>{label}</div> : null}
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fitFontSize(word, 600, 100, 0.55, 40), color, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{word}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400, gap: 20}}>
      {side(data.left, data.leftLabel, l, -260, theme.cream)}
      <div style={{width: 110, height: 110, borderRadius: 55, background: theme.keycap, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 46, color: '#fff', transform: `scale(${vs}) rotate(${(1 - vs) * 90}deg)`}}>VS</div>
      {side(data.right, data.rightLabel, r, 260, '#fff')}
    </AbsoluteFill>
  );
};
