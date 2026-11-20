import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize, itemsShown} from './timing';

export type CountdownData = {title?: string; items: string[]};

/** Lista numerada en cuenta regresiva (3, 2, 1): cada item entra repartido a lo largo de la escena. */
export const Countdown: React.FC<TemplateProps<CountdownData>> = ({data, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = data.items.length;
  const shown = itemsShown(f, durationInFrames, n);
  const t = spring({frame: f, fps, config: {damping: 13, stiffness: 140}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400, gap: 22}}>
      {data.title ? (
        <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(data.title, 620, 62, 0.5, 36), color: theme.cream, opacity: Math.min(1, t), marginBottom: 12}}>{data.title}</div>
      ) : null}
      {data.items.map((item, i) => {
        const p = i < shown ? spring({frame: f - Math.round((i / n) * durationInFrames * 0.85), fps, config: {damping: 11, stiffness: 170}}) : 0;
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 24, width: 600, opacity: Math.min(1, p), transform: `translateX(${(1 - Math.min(1, p)) * -80}px) scale(${0.9 + 0.1 * Math.min(1.1, p)})`}}>
            <div style={{width: 96, height: 96, borderRadius: 24, background: theme.keycap, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 60, color: '#fff'}}>{n - i}</div>
            <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fitFontSize(item, 440, 50, 0.55, 28), color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{item}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
