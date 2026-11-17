import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Enter, Key} from '../primitives';
import {staggerDelays} from '../timing';
import type {LayoutProps} from './index';

/** Cada item se tacha con una linea animada; el ultimo queda en pie y resaltado. */
export const Strike: React.FC<LayoutProps> = ({beat, theme, pal, dark, durationInFrames}) => {
  const f = useCurrentFrame();
  const items = beat.items ?? [];
  const starts = staggerDelays(items.length, durationInFrames, 6, 9);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'flex-start', padding: '0 70px 80px', gap: 18}}>
      {items.map((it, i) => {
        const start = starts[i];
        if (i === items.length - 1) {
          return (
            <div key={i} style={{marginTop: 10}}>
              <Key text={it} theme={theme} pal={pal} dark={dark} size={96} delay={start} />
            </div>
          );
        }
        const line = interpolate(f, [start + 3, start + 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
        return (
          <Enter key={i} delay={Math.max(0, start - 4)}>
            <div style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 16, opacity: 1 - line * 0.45}}>
              <span style={{fontSize: 26, color: pal.fg}}>◆</span>
              <span style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 58, color: pal.fg}}>{it}</span>
              <div style={{position: 'absolute', left: 36, right: -8, top: '54%', height: 5, background: pal.fg, transformOrigin: 'left', transform: `scaleX(${line})`, borderRadius: 3}} />
            </div>
          </Enter>
        );
      })}
    </AbsoluteFill>
  );
};
