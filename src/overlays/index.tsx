import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from '../styles/themes';

// ---------- Titulo de apertura ----------
export const Title: React.FC<{line1: string; line2: string; theme: Theme}> = ({line1, line2, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l2 = interpolate(f, [0.35 * fps, 0.35 * fps + 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 150}}>
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 92, color: '#fff', lineHeight: 1.05, textShadow: '0 4px 20px rgba(0,0,0,.35)'}}>{line1}</div>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 84, color: theme.cream, lineHeight: 1,
        opacity: l2, transform: `translateY(${(1 - l2) * 34}px)`, textShadow: '0 4px 20px rgba(0,0,0,.35)'}}>{line2}</div>
    </AbsoluteFill>
  );
};

// ---------- Etiqueta serif + flecha discontinua ----------
export const Arrow: React.FC<{progress: number; dir: 'left' | 'right'; color: string}> = ({progress, dir, color}) => (
  <svg width="150" height="150" viewBox="0 0 150 150" style={{transform: dir === 'left' ? 'scaleX(-1)' : undefined, overflow: 'visible'}}>
    <defs>
      <mask id={`m-${dir}`}>
        <path d="M10 12 Q115 0 118 78" pathLength={1} stroke="#fff" strokeWidth="14" fill="none" strokeDasharray="1" strokeDashoffset={1 - progress} />
      </mask>
    </defs>
    <path d="M10 12 Q115 0 118 78" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="13 12" mask={`url(#m-${dir})`} />
    <polygon points="100,92 136,92 118,124" fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" opacity={progress > 0.85 ? 1 : 0} />
  </svg>
);

export const Label: React.FC<{text: string; x: number; y: number; dir: 'left' | 'right'; theme: Theme}> = ({text, x, y, dir, theme}) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  const p = interpolate(f, [4, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 46, color: theme.cream, opacity: a, transform: `translateY(${(1 - a) * 12}px)`, whiteSpace: 'nowrap', textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{text}</div>
      <div style={{marginTop: 6, marginLeft: dir === 'right' ? 40 : -40}}><Arrow progress={p} dir={dir} color={theme.cream} /></div>
    </div>
  );
};

export const Emoji: React.FC<{file: string; x: number; y: number; size: number}> = ({file, x, y, size}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f, fps, config: {damping: 9, stiffness: 160}});
  return <Img src={staticFile(`emoji/${file}.png`)} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${s}) rotate(${(1 - s) * -25}deg)`}} />;
};

// ---------- Cierre con maquina de escribir ----------
export const FRAMES_PER_CHAR = 2.2;
export const EndCard: React.FC<{line1: string; line2: string; theme: Theme}> = ({line1, line2, theme}) => {
  const f = useCurrentFrame();
  const typed = Math.min(line1.length, Math.floor(f / FRAMES_PER_CHAR));
  const done = typed >= line1.length;
  const cursorOn = done ? Math.floor(f / 10) % 2 === 0 : true;
  const t0 = line1.length * FRAMES_PER_CHAR;
  const l2 = interpolate(f, [t0 + 6, t0 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 270}}>
      <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 52, color: theme.cream, textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>
        {line1.slice(0, typed)}
        <span style={{opacity: cursorOn ? 1 : 0, fontWeight: 400}}>|</span>
      </div>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 38, color: '#fff', opacity: l2, marginTop: 6, textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{line2}</div>
    </AbsoluteFill>
  );
};
