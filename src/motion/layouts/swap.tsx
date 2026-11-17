import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Enter, Key, Lead} from '../primitives';
import {fitFontSize} from '../../templates/timing';
import type {LayoutProps} from './index';

/** `from` se tacha y aparece `to` (mal -> bien, o ingles -> espanol). */
export const Swap: React.FC<LayoutProps> = ({beat, theme, pal, dark, durationInFrames, leadDelays}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = Math.min(10, Math.floor(durationInFrames * 0.25));
  const line = interpolate(f, [t0, t0 + 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const from = beat.from ?? '';
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 50px 100px', gap: 14}}>
      {beat.lead ? <Lead text={beat.lead} delays={leadDelays} fps={fps} theme={theme} color={pal.fg} align="center" /> : null}
      <Enter>
        <div style={{position: 'relative', opacity: 1 - line * 0.5}}>
          <span style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(from, 600, 80, 0.48, 36), color: pal.fg}}>{from}</span>
          <div style={{position: 'absolute', left: -8, right: -8, top: '55%', height: 5, background: '#d64545', transformOrigin: 'left', transform: `scaleX(${line})`, borderRadius: 3}} />
        </div>
      </Enter>
      <Key text={beat.to ?? ''} theme={theme} pal={pal} dark={dark} size={100} delay={t0 + 6} />
    </AbsoluteFill>
  );
};
