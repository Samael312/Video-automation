import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Key, Lead, keyDelay} from '../primitives';
import type {LayoutProps} from './index';

/** "Parece una / *tonteria*": lead chico arriba, key grande en cursiva con resaltador. */
export const Word: React.FC<LayoutProps> = ({beat, theme, pal, dark, durationInFrames, leadDelays}) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: '0 50px 120px'}}>
      {beat.lead ? <Lead text={beat.lead} delays={leadDelays} fps={fps} theme={theme} color={pal.fg} /> : null}
      <div style={{marginTop: 6, marginLeft: beat.lead ? 24 : 0}}>
        <Key text={beat.key ?? ''} theme={theme} pal={pal} dark={dark} delay={keyDelay(leadDelays, fps, durationInFrames)} />
      </div>
    </AbsoluteFill>
  );
};
