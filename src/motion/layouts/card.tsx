import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Enter, Key, Lead} from '../primitives';
import type {LayoutProps} from './index';

const INK = '#161616';
const PAPER = '#F4F2EE';

/** Tarjeta oscura tipo reproductor de video o movil, con el texto dentro. */
export const Card: React.FC<LayoutProps> = ({beat, theme, pal, durationInFrames, leadDelays}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(f, [0, durationInFrames], [0.15, 0.6]);
  const phone = beat.frame === 'phone';
  const inner = (
    <>
      {beat.lead ? <Lead text={beat.lead} delays={leadDelays} fps={fps} theme={theme} color={PAPER} size={phone ? 30 : 28} /> : null}
      <div style={{marginTop: 6}}>
        <Key text={beat.key ?? ''} theme={theme} pal={pal} dark size={phone ? 74 : 92} maxWidth={phone ? 300 : 520} delay={6} color={PAPER} />
      </div>
    </>
  );
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 80}}>
      <Enter blur={18}>
        {phone ? (
          <div style={{width: 380, height: 720, borderRadius: 56, background: INK, border: '10px solid #2a2a2a', boxShadow: '0 40px 70px rgba(0,0,0,.35)',
            position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 34px'}}>
            <div style={{position: 'absolute', top: 18, left: '50%', width: 110, height: 28, marginLeft: -55, borderRadius: 14, background: '#000'}} />
            {inner}
          </div>
        ) : (
          <div style={{width: 600, height: 380, borderRadius: 26, background: INK, boxShadow: '0 40px 70px rgba(0,0,0,.35)', position: 'relative',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px'}}>
            {inner}
            <div style={{position: 'absolute', left: 30, right: 30, bottom: 26, display: 'flex', alignItems: 'center', gap: 14}}>
              <div style={{width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `14px solid ${PAPER}`}} />
              <div style={{flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.2)'}}>
                <div style={{width: `${progress * 100}%`, height: '100%', borderRadius: 3, background: theme.cream}} />
              </div>
            </div>
          </div>
        )}
      </Enter>
    </AbsoluteFill>
  );
};
