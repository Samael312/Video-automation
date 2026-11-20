import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from '../styles/themes';
import {splitEmoji} from '../lib/emoji';

// ---------- Titulo de apertura ----------
export const TITLE_DEFAULT_Y = 150;
export const Title: React.FC<{line1: string; line2: string; theme: Theme; y?: number}> = ({line1, line2, theme, y = TITLE_DEFAULT_Y}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l2 = interpolate(f, [0.35 * fps, 0.35 * fps + 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // linea 1 entra con un pop (escala con rebote + aparicion rapida) para que el titulo "golpee" desde el primer frame
  const pop = spring({frame: f, fps, config: {damping: 10, stiffness: 220}});
  const a1 = interpolate(f, [0, 3], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: y}}>
      <div style={{fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 92, color: '#fff', lineHeight: 1.05, textShadow: '0 4px 20px rgba(0,0,0,.35)',
        opacity: a1, transform: `scale(${0.7 + 0.3 * pop})`}}>{line1}</div>
      <div style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 500, fontSize: 84, color: theme.cream, lineHeight: 1,
        opacity: l2, transform: `translateY(${(1 - l2) * 34}px)`, textShadow: '0 4px 20px rgba(0,0,0,.35)'}}>{line2}</div>
    </AbsoluteFill>
  );
};

// ---------- Gancho: frase grande sobre el video oscurecido (primeros segundos) ----------
const HOOK_FADE_FRAMES = 6;
export const Hook: React.FC<{text: string; theme: Theme}> = ({text, theme}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const out = interpolate(f, [durationInFrames - HOOK_FADE_FRAMES, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scrim = interpolate(f, [0, 4], [0, 0.55], {extrapolateRight: 'clamp'}) * out;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', backgroundColor: `rgba(0,0,0,${scrim})`}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 22px', maxWidth: '86%', opacity: out}}>
        {words.map((w, i) => {
          const s = spring({frame: f - i * 3, fps, config: {damping: 11, stiffness: 200}});
          const last = i === words.length - 1;
          return (
            <span key={i} style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 96, lineHeight: 1.1, color: last ? theme.cream : '#fff', textAlign: 'center',
              textShadow: '0 6px 24px rgba(0,0,0,.5)', display: 'inline-block', transform: `scale(${0.5 + 0.5 * Math.min(1.15, s)})`, opacity: Math.min(1, s * 2)}}>{w}</span>
          );
        })}
      </div>
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

// ---------- Item de lista numerada (estilo Ela: 1️⃣ + palabra que se escribe) ----------
export const ITEM_DEFAULT_Y = 190;
export const Item: React.FC<{n: number; text: string; y?: number; theme: Theme}> = ({n, text, y = ITEM_DEFAULT_Y, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps, config: {damping: 10, stiffness: 170}});
  const typed = Math.min(text.length, Math.max(0, Math.floor((f - 5) / FRAMES_PER_CHAR)));
  const typing = typed < text.length;
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: y}}>
      <div style={{width: 72, height: 72, borderRadius: 16, transform: `scale(${pop})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(180deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 55%), ${theme.keycap}`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,.18), 0 4px 14px rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.55)'}}>
        <span style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 46, color: '#fff', lineHeight: 1}}>{n}</span>
      </div>
      <div style={{fontFamily: theme.fonts.sans, fontWeight: 700, fontSize: 58, color: theme.cream, marginTop: 10, maxWidth: '90%', textAlign: 'center',
        textShadow: '0 3px 14px rgba(0,0,0,.4)', minHeight: 70}}>
        {text.slice(0, typed)}
        <span style={{opacity: typing ? 1 : 0, fontWeight: 400}}>|</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Burbujas de chat (izquierda = recibido gris, derecha = enviado azul) ----------
export const CHAT_DEFAULT_Y = 720;
export const Chat: React.FC<{messages: {text: string; side: 'left' | 'right'}[]; appearAt: number[]; y?: number; theme: Theme}> = ({messages, appearAt, y = CHAT_DEFAULT_Y, theme}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, display: 'flex', flexDirection: 'column', gap: 14}}>
      {messages.map((m, j) => {
        const s = spring({frame: f - appearAt[j], fps, config: {damping: 13, stiffness: 190}});
        if (f < appearAt[j]) return null;
        const right = m.side === 'right';
        return (
          <div key={j} style={{alignSelf: right ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '16px 26px', borderRadius: 34,
            [right ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 8, background: right ? '#0A84FF' : '#E9E9EB', color: right ? '#fff' : '#111',
            fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 34, lineHeight: 1.25, boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            transformOrigin: right ? 'bottom right' : 'bottom left', transform: `scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 18}px)`, opacity: Math.min(1, s * 1.4)}}>
            {splitEmoji(m.text).map((p, k) =>
              'emoji' in p ? (
                <Img key={k} src={staticFile(`emoji/${p.emoji}.png`)} style={{width: '1.2em', height: '1.2em', verticalAlign: '-0.25em', margin: '0 2px'}} />
              ) : (
                <React.Fragment key={k}>{p.text}</React.Fragment>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
};
