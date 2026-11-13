import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Enter, Lead} from '../primitives';
import {staggerDelays} from '../timing';
import type {LayoutProps} from './index';

/** Pastillas numeradas que entran una a una; `active` en crema, las anteriores atenuadas. */
export const List: React.FC<LayoutProps> = ({beat, theme, pal, durationInFrames, leadDelays}) => {
  const {fps} = useVideoConfig();
  const items = beat.items ?? [];
  const active = beat.active ?? items.length - 1;
  const delays = staggerDelays(items.length, durationInFrames, 4, 5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'flex-start', padding: '0 60px 80px', gap: 22}}>
      {beat.title ? <Lead text={beat.title} delays={leadDelays} fps={fps} theme={theme} color={pal.fg} size={44} /> : null}
      {items.map((it, i) => {
        const on = i === active;
        return (
          <Enter key={i} delay={delays[i]}>
            <div style={{display: 'inline-flex', alignItems: 'center', gap: 18, height: 88, padding: '0 36px 0 14px', borderRadius: 44,
              background: on ? theme.cream : pal.pill, opacity: i < active ? 0.45 : 1, boxShadow: on ? '0 14px 30px rgba(0,0,0,.18)' : undefined}}>
              <div style={{width: 58, height: 58, borderRadius: '50%', background: on ? '#111' : pal.fg, color: on ? theme.cream : pal.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 30}}>{i + 1}</div>
              <span style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 56, color: on ? '#111' : pal.fg, whiteSpace: 'nowrap'}}>{it}</span>
            </div>
          </Enter>
        );
      })}
    </AbsoluteFill>
  );
};
