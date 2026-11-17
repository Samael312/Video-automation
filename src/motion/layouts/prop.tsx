import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Emoji3d, Enter, Key, Lead, keyDelay} from '../primitives';
import type {LayoutProps} from './index';

/** Objeto (emoji 3D) grande al centro; texto arriba (pos top, por defecto) o abajo. */
export const Prop: React.FC<LayoutProps> = ({beat, theme, pal, dark, durationInFrames, leadDelays}) => {
  const {fps} = useVideoConfig();
  const text = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 200, justifyContent: 'center'}}>
      {beat.lead ? <Lead text={beat.lead} delays={leadDelays} fps={fps} theme={theme} color={pal.fg} align="center" /> : null}
      {beat.key ? <Key text={beat.key} theme={theme} pal={pal} dark={dark} size={92} delay={keyDelay(leadDelays, fps, durationInFrames)} /> : null}
    </div>
  );
  const bottom = beat.pos === 'bottom';
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 30, paddingBottom: 60}}>
      {!bottom ? text : null}
      <Enter delay={2} blur={20}>
        <Emoji3d code={beat.emoji ?? ''} size={360} />
      </Enter>
      {bottom ? text : null}
    </AbsoluteFill>
  );
};
