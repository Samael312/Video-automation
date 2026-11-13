import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Emoji3d, Enter, Key, Lead, keyDelay} from '../primitives';
import type {LayoutProps} from './index';

/** Emoji dentro de un circulo de borde discontinuo que gira; lead arriba, key abajo. */
export const Ring: React.FC<LayoutProps> = ({beat, theme, pal, dark, durationInFrames, leadDelays}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 34, paddingBottom: 60}}>
      {beat.lead ? <Lead text={beat.lead} delays={leadDelays} fps={fps} theme={theme} color={pal.fg} align="center" /> : null}
      <Enter blur={16}>
        <div style={{position: 'relative', width: 340, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `6px dashed ${pal.fg}`, transform: `rotate(${(f / fps) * 40}deg)`}} />
          <div style={{position: 'absolute', inset: 26, borderRadius: '50%', background: dark ? '#1c1c1c' : '#dcdbe0', boxShadow: 'inset 0 10px 30px rgba(0,0,0,.25)'}} />
          <Emoji3d code={beat.emoji ?? ''} size={230} />
        </div>
      </Enter>
      {beat.key ? <Key text={beat.key} theme={theme} pal={pal} dark={dark} size={84} delay={keyDelay(leadDelays, fps, durationInFrames)} /> : null}
    </AbsoluteFill>
  );
};
