import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {GeneratedProps} from './index';

/** Lista numerada que se arma: titulo + palabras con cuadrito azul, una a una.
 *  props: {title?: string, words: string[], stagger?: segundos entre palabras (0.5)} */
export const WordList: React.FC<GeneratedProps> = ({props, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = Array.isArray(props.words) ? props.words.map(String) : [];
  const stagger = Math.round((Number(props.stagger) || 0.5) * fps);
  const head = spring({frame: f, fps, config: {damping: 14, stiffness: 140}});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400}}>
      {props.title ? (
        <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 84, color: '#fff', opacity: head, transform: `translateY(${(1 - head) * -30}px)`, marginBottom: 50}}>
          {String(props.title)}
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'flex-start'}}>
        {words.map((w, i) => {
          const s = spring({frame: f - 12 - i * stagger, fps, config: {damping: 11, stiffness: 170}});
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, opacity: Math.min(1, s * 1.5), transform: `translateX(${(1 - s) * 60}px)`}}>
              <div style={{width: 74, height: 74, borderRadius: 16, background: theme.keycap, color: '#fff', fontFamily: theme.fonts.sans, fontWeight: 800, fontSize: 46,
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.25), 0 4px 14px rgba(0,0,0,.35)', transform: `scale(${s})`}}>
                {i + 1}
              </div>
              <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 70, color: theme.cream, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{w}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
