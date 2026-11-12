import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TemplateProps} from './index';
import {fitFontSize, quizPhase} from './timing';

export type QuizData = {question: string; options: string[]; answer: number; countdown?: number};

const LETTERS = ['A', 'B', 'C'];

/** Pregunta, 2-3 opciones, cuenta regresiva y reveal de la respuesta correcta. */
export const Quiz: React.FC<TemplateProps<QuizData>> = ({data, theme, durationInFrames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const phase = quizPhase(f, fps, durationInFrames, data.countdown ?? 3);
  const q = spring({frame: f, fps, config: {damping: 13, stiffness: 140}});
  const optStart = Math.round(durationInFrames * 0.2);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 400}}>
      <div style={{maxWidth: 620, textAlign: 'center', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: fitFontSize(data.question, 620 * 2, 62, 0.55, 32), color: '#fff', opacity: q, transform: `scale(${0.85 + 0.15 * q})`, textShadow: '0 4px 20px rgba(0,0,0,.4)'}}>{data.question}</div>
      <div style={{marginTop: 50, display: 'flex', flexDirection: 'column', gap: 22, width: 560}}>
        {data.options.map((o, i) => {
          const a = phase.optionsShown ? spring({frame: f - optStart - i * 5, fps, config: {damping: 13, stiffness: 160}}) : 0;
          const correct = i === data.answer;
          const dim = phase.revealed && !correct;
          const hit = phase.revealed && correct;
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, padding: '16px 24px', borderRadius: 22, opacity: dim ? 0.3 : Math.min(1, a),
              transform: `translateY(${(1 - Math.min(1, a)) * 40}px) scale(${hit ? 1.06 : 1})`, background: hit ? 'rgba(74,222,128,.28)' : 'rgba(255,255,255,.1)', border: `3px solid ${hit ? '#4ade80' : 'rgba(255,255,255,.25)'}`}}>
              <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 34, color: hit ? '#4ade80' : theme.cream}}>{LETTERS[i]}</div>
              <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: fitFontSize(o, 420, 38, 0.55, 24), color: '#fff'}}>{o}</div>
              {hit ? <div style={{marginLeft: 'auto', fontSize: 40}}>✅</div> : null}
            </div>
          );
        })}
      </div>
      {phase.optionsShown && !phase.revealed ? (
        <div style={{marginTop: 50, width: 110, height: 110, borderRadius: 55, border: `5px solid ${theme.cream}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 64, color: theme.cream}}>{phase.secondsLeft}</div>
      ) : null}
    </AbsoluteFill>
  );
};
