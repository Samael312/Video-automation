import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Arrow} from '../overlays';
import type {TemplateProps} from './index';

export type TranslateData = {word: string; translation: string; emoji?: string};

/** Palabra en ingles -> flecha -> traduccion (+ emoji opcional). */
export const Translate: React.FC<TemplateProps<TranslateData>> = ({data, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const word = spring({frame: f, fps, config: {damping: 12, stiffness: 140}});
  const arrow = interpolate(f, [10, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const trans = spring({frame: f - 18, fps, config: {damping: 14, stiffness: 150}});
  const emoji = spring({frame: f - 28, fps, config: {damping: 9, stiffness: 160}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 96, color: theme.cream, opacity: word, transform: `scale(${0.8 + 0.2 * word})`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.word}</div>
      <div style={{marginTop: 10, marginLeft: 70}}><Arrow progress={arrow} dir="right" color={theme.cream} /></div>
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 80, color: '#fff', opacity: trans, transform: `translateY(${(1 - Math.min(1, trans)) * 30}px)`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.translation}</div>
      {data.emoji ? <Img src={staticFile(`emoji/${data.emoji}.png`)} style={{marginTop: 40, width: 130, height: 130, transform: `scale(${emoji}) rotate(${(1 - emoji) * -25}deg)`}} /> : null}
    </AbsoluteFill>
  );
};
