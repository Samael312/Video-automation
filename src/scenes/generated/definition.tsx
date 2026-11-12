import React from 'react';
import {AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize} from '../../templates/timing';
import type {GeneratedProps} from './index';

/** Palabra + definicion que se escribe letra a letra (como en un diccionario) + emoji opcional.
 *  props: {word: string, definition: string, emoji?: codigo de public/emoji} */
export const Definition: React.FC<GeneratedProps> = ({props, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const word = String(props.word ?? '');
  const def = String(props.definition ?? '');
  const w = spring({frame: f, fps, config: {damping: 12, stiffness: 140}});
  // la definicion termina de escribirse al 70 % de la escena
  const typeFrom = 14;
  const typeTo = Math.max(typeFrom + 1, Math.round(durationInFrames * 0.7));
  const chars = Math.max(0, Math.min(def.length, Math.round(((f - typeFrom) / (typeTo - typeFrom)) * def.length)));
  const e = spring({frame: f - typeTo, fps, config: {damping: 9, stiffness: 160}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400}}>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: fitFontSize(word, 620, 100), color: theme.cream, opacity: w, transform: `scale(${0.8 + 0.2 * w})`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>
        {word}
      </div>
      <div style={{width: 120, height: 4, background: theme.cream, borderRadius: 2, margin: '18px 0 34px', transform: `scaleX(${w})`}} />
      <div style={{maxWidth: 600, minHeight: 200, fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 46, lineHeight: 1.3, color: '#fff', textAlign: 'center'}}>
        {def.slice(0, chars)}
        {chars < def.length && f >= typeFrom ? <span style={{opacity: Math.floor(f / 8) % 2 ? 0 : 1}}>|</span> : null}
      </div>
      {props.emoji ? <Img src={staticFile(`emoji/${String(props.emoji)}.png`)} style={{marginTop: 30, width: 130, height: 130, transform: `scale(${e}) rotate(${(1 - e) * -25}deg)`}} /> : null}
    </AbsoluteFill>
  );
};
