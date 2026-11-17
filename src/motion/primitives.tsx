import React from 'react';
import {Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Palette} from './palette';
import type {Theme} from '../styles/themes';
import {fitFontSize} from '../templates/timing';

export const ENTER_FRAMES = 7;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Avance 0..1 de una entrada que empieza en `delay` frames. */
export const useEnter = (delay = 0, frames = ENTER_FRAMES): number => {
  const f = useCurrentFrame();
  // arranca 2 frames antes: el primer frame de un beat ya muestra algo (sin parpadeo vacio entre beats)
  return interpolate(f, [delay - 2, delay + frames], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
};

export const enterStyle = (p: number, blur = 12): React.CSSProperties => ({
  opacity: p,
  filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined,
  transform: `translateY(${(1 - p) * 20}px) scale(${0.92 + 0.08 * p})`,
});

/** Entrada estandar de m_1: blur 12px -> 0, escala .92 -> 1, leve subida. */
export const Enter: React.FC<{children: React.ReactNode; delay?: number; blur?: number; style?: React.CSSProperties}> = ({children, delay = 0, blur, style}) => {
  const p = useEnter(delay);
  return <div style={{...style, ...enterStyle(p, blur)}}>{children}</div>;
};

/** Palabra clave: serif cursiva grande con resaltador crema que barre de izquierda a derecha (en oscuro: texto crema, sin barra). */
export const Key: React.FC<{text: string; theme: Theme; pal: Palette; dark: boolean; size?: number; maxWidth?: number; delay?: number; color?: string}> = ({
  text, theme, pal, dark, size = 104, maxWidth = 620, delay = 0, color,
}) => {
  const p = useEnter(delay);
  const f = useCurrentFrame();
  const bar = interpolate(f, [delay + 4, delay + 12], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const fontSize = fitFontSize(text, maxWidth, size, 0.48, 40);
  return (
    <div style={{...enterStyle(p), position: 'relative', display: 'inline-block', maxWidth, lineHeight: 1.04}}>
      {!dark ? (
        <div style={{position: 'absolute', left: -10, right: -10, bottom: '6%', height: '42%', background: theme.cream, transformOrigin: 'left', transform: `scaleX(${bar})`, borderRadius: 4}} />
      ) : null}
      <span style={{position: 'relative', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize, color: color ?? (dark ? theme.cream : pal.fg)}}>{text}</span>
    </div>
  );
};

/** Texto chico de entrada: cada palabra aparece en su momento de la voz (`delays` en segundos). */
export const Lead: React.FC<{text: string; delays: number[]; fps: number; theme: Theme; color: string; size?: number; align?: 'left' | 'center'}> = ({
  text, delays, fps, theme, color, size = 40, align = 'left',
}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.28}px`, justifyContent: align === 'center' ? 'center' : 'flex-start', maxWidth: 620}}>
    {text.split(/\s+/).filter(Boolean).map((w, i) => (
      <Enter key={i} delay={Math.round((delays[i] ?? 0) * fps)} blur={8}>
        <span style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: size, color, lineHeight: 1.15}}>{w}</span>
      </Enter>
    ))}
  </div>
);

/** Frame en que entra la palabra clave: justo despues de la ultima palabra del lead (como mucho a mitad del beat). */
export const keyDelay = (leadDelays: number[], fps: number, durationInFrames: number): number =>
  leadDelays.length ? Math.min(Math.round(leadDelays[leadDelays.length - 1] * fps) + 6, Math.floor(durationInFrames * 0.5)) : 0;

/** Emoji 3D (public/emoji3d) con sombra suave; `float` lo hace flotar. */
export const Emoji3d: React.FC<{code: string; size: number; float?: boolean; style?: React.CSSProperties}> = ({code, size, float = true, style}) => {
  const f = useCurrentFrame();
  const y = float ? Math.sin(f / 16) * 8 : 0;
  const r = float ? Math.sin(f / 23) * 3 : 0;
  return (
    <Img
      src={staticFile(`emoji3d/${code}.png`)}
      style={{width: size, height: size, objectFit: 'contain', transform: `translateY(${y}px) rotate(${r}deg)`, filter: 'drop-shadow(0 28px 30px rgba(0,0,0,.28))', ...style}}
    />
  );
};
