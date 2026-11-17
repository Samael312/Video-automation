import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {gsap} from 'gsap';
import {SplitText} from 'gsap/SplitText';
import {useGsap} from '../../lib/useGsap';
import type {GeneratedProps} from './index';

gsap.registerPlugin(SplitText);

type Note = {text: string; at: number};
type Item = {emoji: string; text: string; at: number};

/**
 * Plano azul con cuadricula: la palabra se arma letra por letra, aparecen anotaciones de plano y un sello;
 * luego una cinta transportadora va sacando los objetos que la profe nombra (emojis 3D de public/emoji3d).
 * props: {word, notes: [{text, at}], badge?: string, badgeAt?: s, items: [{emoji, text, at}]} (segundos desde el inicio de la escena)
 */
export const MakeFactory: React.FC<GeneratedProps> = ({props, theme}) => {
  const word = String(props.word ?? 'make');
  const notes = (Array.isArray(props.notes) ? props.notes : []) as Note[];
  const badge = props.badge ? String(props.badge) : '';
  const badgeAt = Number(props.badgeAt ?? 2);
  const items = (Array.isArray(props.items) ? props.items : []) as Item[];
  const beltAt = items.length ? items[0].at - 0.6 : 99;
  const slots = items.map((_, i) => 120 + i * ((720 - 240) / Math.max(items.length - 1, 1)));
  const blue = '#1d4f91';
  const line = 'rgba(255,255,255,.75)';

  const scope = useGsap<HTMLDivElement>((tl, root) => {
    const chars = SplitText.create(root.querySelector('.bp-word'), {type: 'chars'}).chars;
    tl.from('.grid', {opacity: 0, scale: 1.2, duration: 0.5, ease: 'power2.out'}, 0)
      .from(chars, {x: (i) => (random(`cx${i}`) - 0.5) * 600, y: (i) => (random(`cy${i}`) - 0.5) * 500, rotate: (i) => (random(`cr${i}`) - 0.5) * 180, opacity: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out'}, 0.05);
    notes.forEach((n, i) => {
      tl.fromTo(`.dim-${i}`, {scaleX: 0}, {scaleX: 1, duration: 0.3, ease: 'power2.out'}, Math.max(n.at - 0.1, 0.2))
        .from(`.note-${i}`, {opacity: 0, y: 14, duration: 0.25}, Math.max(n.at, 0.3));
    });
    if (badge) tl.fromTo('.badge', {scale: 3, opacity: 0, rotate: 20}, {scale: 1, opacity: 1, rotate: -8, duration: 0.25, ease: 'power4.in'}, badgeAt - 0.1);
    // Fase 2: sube la cinta; lo de arriba se achica
    tl.to('.notes, .badge-wrap', {opacity: 0, duration: 0.3}, beltAt)
      .to('.bp-word', {scale: 0.7, y: -40, duration: 0.4, ease: 'power2.inOut'}, beltAt)
      .fromTo('.belt', {y: 400, opacity: 0}, {y: 0, opacity: 1, duration: 0.45, ease: 'power3.out'}, beltAt)
      .fromTo('.belt-stripes', {backgroundPositionX: '0px'}, {backgroundPositionX: '-480px', duration: 6, ease: 'none'}, beltAt);
    items.forEach((it, i) => {
      tl.from(`.item-${i}`, {x: -260 - slots[i], rotate: -30, duration: 0.55, ease: 'back.out(1.4)'}, Math.max(it.at - 0.35, beltAt + 0.3))
        .from(`.label-${i}`, {opacity: 0, y: 20, duration: 0.25}, it.at + 0.1);
    });
  }, [word, JSON.stringify(notes), badge, badgeAt, JSON.stringify(items)]);

  return (
    <AbsoluteFill style={{background: blue, overflow: 'hidden'}}>
      <div ref={scope} style={{position: 'absolute', inset: 0}}>
        <div className="grid" style={{position: 'absolute', inset: -40, backgroundImage: 'linear-gradient(rgba(255,255,255,.12) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.12) 2px, transparent 2px), linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 410, display: 'flex', justifyContent: 'center'}}>
          <div className="bp-word" style={{fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontWeight: 800, fontSize: 180, lineHeight: 1, color: '#fff'}}>{word}</div>
        </div>
        <div className="notes" style={{position: 'absolute', left: 0, right: 0, top: 640}}>
          {notes.map((n, i) => (
            <div key={i} style={{position: 'absolute', left: i % 2 ? 330 : 90, top: i * 130, width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
              <div className={`dim-${i}`} style={{width: '100%', display: 'flex', alignItems: 'center', transformOrigin: i % 2 ? '100% 50%' : '0% 50%'}}>
                <div style={{width: 3, height: 26, background: line}} />
                <div style={{flex: 1, height: 3, background: line}} />
                <div style={{width: 3, height: 26, background: line}} />
              </div>
              <div className={`note-${i}`} style={{fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700, fontSize: 46, color: '#fff', letterSpacing: 2}}>{n.text}</div>
            </div>
          ))}
        </div>
        {badge ? (
          <div className="badge-wrap" style={{position: 'absolute', left: 0, right: 0, top: 960, display: 'flex', justifyContent: 'center'}}>
            <div className="badge" style={{padding: '12px 30px', border: `5px solid ${theme.cream}`, borderRadius: 14, color: theme.cream, fontFamily: theme.fonts.sans, fontWeight: 800, fontSize: 40, letterSpacing: 3, textTransform: 'uppercase', opacity: 0}}>{badge}</div>
          </div>
        ) : null}
        <div className="belt" style={{position: 'absolute', left: 0, right: 0, top: 700}}>
          {items.map((it, i) => (
            <div key={i} style={{position: 'absolute', left: slots[i] - 85, top: 0, width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <Img className={`item-${i}`} src={staticFile(`emoji3d/${it.emoji}.png`)} style={{width: 160, height: 160, objectFit: 'contain'}} />
            </div>
          ))}
          <div className="belt-stripes" style={{position: 'absolute', left: -20, right: -20, top: 168, height: 46, borderRadius: 23, background: '#0f2c55', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 18px, transparent 18px 60px)', border: '4px solid rgba(255,255,255,.35)'}} />
          {items.map((it, i) => (
            <div key={i} className={`label-${i}`} style={{position: 'absolute', left: slots[i] - 120, top: 240, width: 240, textAlign: 'center', fontFamily: theme.fonts.serif, fontWeight: 800, fontSize: 44, color: '#fff'}}>
              <span style={{fontFamily: theme.fonts.sans, fontWeight: 600, fontSize: 30, color: theme.cream, display: 'block'}}>{word}</span>
              {it.text}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
