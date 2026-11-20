import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize} from './timing';

export type BeforeAfterData = {before: string; after: string; beforeLabel?: string; afterLabel?: string};

/** Frase normal -> la misma idea dicha como un nativo (mejora, no error). */
export const BeforeAfter: React.FC<TemplateProps<BeforeAfterData>> = ({data, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 13, stiffness: 140}});
  const arrow = spring({frame: f - 16, fps, config: {damping: 10, stiffness: 160}});
  const b = spring({frame: f - 28, fps, config: {damping: 11, stiffness: 150}});
  const label = (t: string, color: string) => (
    <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color, marginBottom: 10}}>{t}</div>
  );
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400, gap: 26}}>
      <div style={{width: 600, textAlign: 'center', padding: '26px 28px', borderRadius: 26, background: 'rgba(255,255,255,.08)', border: '3px solid rgba(255,255,255,.2)',
        opacity: Math.min(1, a), transform: `scale(${0.88 + 0.12 * Math.min(1, a)})`}}>
        {label(data.beforeLabel ?? 'Normal', 'rgba(255,255,255,.6)')}
        <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fitFontSize(data.before, 540 * 2, 58, 0.55, 30), color: 'rgba(255,255,255,.75)'}}>{data.before}</div>
      </div>
      <div style={{fontSize: 80, lineHeight: 1, color: theme.cream, transform: `scale(${arrow}) translateY(${(1 - Math.min(1, arrow)) * -20}px)`}}>⬇</div>
      <div style={{width: 600, textAlign: 'center', padding: '30px 28px', borderRadius: 26, background: 'rgba(252,244,176,.14)', border: `4px solid ${theme.cream}`,
        opacity: Math.min(1, b), transform: `scale(${0.85 + 0.15 * Math.min(1.1, b)})`, boxShadow: `0 0 50px rgba(252,244,176,${0.25 * Math.min(1, b)})`}}>
        {label(data.afterLabel ?? 'Nativo ✨', theme.cream)}
        <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fitFontSize(data.after, 540 * 2, 66, 0.55, 32), color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.after}</div>
      </div>
    </AbsoluteFill>
  );
};
