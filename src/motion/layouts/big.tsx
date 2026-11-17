import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useEnter} from '../primitives';
import {fitFontSize} from '../../templates/timing';
import type {LayoutProps} from './index';

/** Una palabra o numero enorme en un bloque negro con brillo; entra desde blur fuerte. */
export const Big: React.FC<LayoutProps> = ({beat, theme}) => {
  const p = useEnter(0, 9);
  const key = beat.key ?? '';
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 80}}>
      <div style={{padding: '30px 44px', borderRadius: 28, background: '#050505', boxShadow: '0 40px 80px rgba(0,0,0,.4)', opacity: p,
        filter: p < 1 ? `blur(${(1 - p) * 30}px)` : undefined, transform: `scale(${1.15 - 0.15 * p})`}}>
        <span style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(key, 560, 280, 0.5, 60), color: '#F4F2EE',
          lineHeight: 1, textShadow: `0 0 30px rgba(255,255,255,.45), 0 0 4px ${theme.cream}`}}>{key}</span>
      </div>
    </AbsoluteFill>
  );
};
