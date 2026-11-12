import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {GeneratedProps} from './index';

/** Escena de ejemplo: un texto que pulsa. Sirve de plantilla para las escenas generadas por IA. */
export const Demo: React.FC<GeneratedProps> = ({props, theme}) => {
  const f = useCurrentFrame();
  const pulse = 1 + 0.06 * Math.sin(f / 6);
  const fade = interpolate(f, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 96, color: theme.cream, opacity: fade, transform: `scale(${pulse})`, textAlign: 'center', maxWidth: 620}}>
        {String(props.text ?? 'demo')}
      </div>
    </AbsoluteFill>
  );
};
