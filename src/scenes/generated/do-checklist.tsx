import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

type Timed = {text: string; at: number};

/**
 * La palabra arriba con resaltador; primero sus categorias aparecen como fichas, luego se encogen
 * en una linea y sube una libreta de tareas: cada tarea entra y se marca con check cuando la profe la dice.
 * props: {word: string, groups: [{text, at}], tasks: [{text, at}], switchAt: s} (segundos desde el inicio de la escena)
 */
export const DoChecklist: React.FC<GeneratedProps> = ({props, theme}) => {
  const word = String(props.word ?? 'do');
  const groups = (Array.isArray(props.groups) ? props.groups : []) as Timed[];
  const tasks = (Array.isArray(props.tasks) ? props.tasks : []) as Timed[];
  const switchAt = Number(props.switchAt ?? 3);
  const lastTask = tasks.length ? tasks[tasks.length - 1].at : switchAt;

  const scope = useGsap<HTMLDivElement>((tl) => {
    tl.from('.cw', {scale: 0.3, opacity: 0, duration: 0.45, ease: 'back.out(2.4)'}, 0)
      .fromTo('.cw-mark', {scaleX: 0}, {scaleX: 1, duration: 0.35, ease: 'power2.out'}, 0.3);
    groups.forEach((g, i) => {
      tl.from(`.chip-${i}`, {y: 120, rotate: (i - 1) * 14, opacity: 0, duration: 0.45, ease: 'back.out(2)'}, Math.max(g.at - 0.1, 0.2));
    });
    // Las fichas se encogen y desaparecen bajo la palabra mientras sube la libreta
    tl.to('.chips', {scale: 0.55, y: -150, opacity: 0, duration: 0.5, ease: 'power3.inOut'}, switchAt)
      .to('.cw', {scale: 0.7, y: -60, duration: 0.5, ease: 'power3.inOut'}, switchAt)
      .from('.pad', {y: 700, rotate: 6, duration: 0.6, ease: 'power3.out'}, switchAt + 0.1);
    tasks.forEach((t, i) => {
      tl.from(`.row-${i}`, {x: -60, opacity: 0, duration: 0.3, ease: 'power2.out'}, Math.max(t.at - 0.15, switchAt + 0.5))
        .fromTo(`.tick-${i}`, {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.25, ease: 'power2.out'}, t.at + 0.45)
        .from(`.box-${i}`, {scale: 1.4, duration: 0.25, ease: 'back.out(3)'}, t.at + 0.45);
    });
    tl.to('.pad', {rotate: -2, scale: 1.03, duration: 0.3, ease: 'back.out(3)'}, lastTask + 0.8);
  }, [word, JSON.stringify(groups), JSON.stringify(tasks), switchAt]);

  return (
    <AbsoluteFill>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="cw" style={{position: 'absolute', left: 0, right: 0, top: 400, display: 'flex', justifyContent: 'center'}}>
          <div style={{position: 'relative', fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 190, lineHeight: 1.1, color: theme.cream, padding: '0 24px'}}>
            <span className="cw-mark" style={{position: 'absolute', left: 10, right: 10, bottom: -6, height: 16, background: '#e07a5f', borderRadius: 8, zIndex: 0, transformOrigin: '0% 50%'}} />
            <span style={{position: 'relative'}}>{word}</span>
          </div>
        </div>
        <div className="chips" style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
          {groups.map((g, i) => (
            <div key={i} className={`chip-${i}`} style={{padding: '14px 38px', borderRadius: 60, border: `4px solid ${theme.cream}`, color: theme.cream, fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 60}}>{g.text}</div>
          ))}
        </div>
        <div className="pad" style={{position: 'absolute', left: 70, right: 70, top: 640, padding: '40px 44px 44px', borderRadius: 28, background: '#fffdf2', boxShadow: '0 30px 80px rgba(0,0,0,.5)', backgroundImage: 'repeating-linear-gradient(transparent 0 92px, rgba(80,120,200,.18) 92px 95px)', backgroundPosition: '0 30px'}}>
          <div style={{fontFamily: theme.fonts.sans, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: '#c0392b', marginBottom: 14}}>TO-DO</div>
          {tasks.map((t, i) => (
            <div key={i} className={`row-${i}`} style={{display: 'flex', alignItems: 'center', gap: 24, height: 95}}>
              <div className={`box-${i}`} style={{position: 'relative', width: 58, height: 58, flex: 'none', borderRadius: 12, border: '5px solid #1b1b1b'}}>
                <svg viewBox="0 0 60 60" style={{position: 'absolute', inset: -12, width: 82, height: 82, overflow: 'visible'}}>
                  <path className={`tick-${i}`} pathLength={1} d="M12 32 L26 46 L54 10" fill="none" stroke="#2e9e5b" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" style={{strokeDasharray: 1, strokeDashoffset: 1}} />
                </svg>
              </div>
              <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 56, color: '#1b1b1b', whiteSpace: 'nowrap'}}>{t.text}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
