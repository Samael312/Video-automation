import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {CREAM, styledConfig as C, type LabelCfg} from './config';
import type {Transcript} from '../../lib/types';
import {CutVideo} from '../../lib/CutVideo';
import {cutPoints, mapTimeNext, remapWords, type Keep} from '../../lib/cuts';
import {buildPages} from '../../lib/captions';
import {keywordEvents, zoomScale} from '../../lib/dynamics';
import {TikTokCaptions} from '../../lib/TikTokCaptions';

const playfair = loadPlayfair('normal', {weights: ['800']});
const playfairI = loadPlayfair('italic', {weights: ['500']});
const poppins = loadPoppins('normal', {weights: ['700']});
const SERIF = playfair.fontFamily;
const SERIF_I = playfairI.fontFamily;
const SANS = poppins.fontFamily;

export type StyledProps = {videoSrc: string; transcript: Transcript | null; keeps: Keep[]};

// ---------- Titulo de apertura ----------
const Title: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l2 = interpolate(f, [0.35 * fps, 0.35 * fps + 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 150}}>
      <div style={{fontFamily: SERIF, fontWeight: 800, fontSize: 92, color: '#fff', lineHeight: 1.05, textShadow: '0 4px 20px rgba(0,0,0,.35)'}}>{C.title.line1}</div>
      <div style={{fontFamily: SERIF_I, fontStyle: 'italic', fontWeight: 500, fontSize: 84, color: CREAM, lineHeight: 1,
        opacity: l2, transform: `translateY(${(1 - l2) * 34}px)`, textShadow: '0 4px 20px rgba(0,0,0,.35)'}}>{C.title.line2}</div>
    </AbsoluteFill>
  );
};

// ---------- Etiqueta serif + flecha discontinua ----------
const Arrow: React.FC<{progress: number; dir: 'left' | 'right'}> = ({progress, dir}) => (
  <svg width="150" height="150" viewBox="0 0 150 150" style={{transform: dir === 'left' ? 'scaleX(-1)' : undefined, overflow: 'visible'}}>
    <defs>
      <mask id={`m-${dir}`}>
        <path d="M10 12 Q115 0 118 78" pathLength={1} stroke="#fff" strokeWidth="14" fill="none" strokeDasharray="1" strokeDashoffset={1 - progress} />
      </mask>
    </defs>
    <path d="M10 12 Q115 0 118 78" stroke={CREAM} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="13 12" mask={`url(#m-${dir})`} />
    <polygon points="100,92 136,92 118,124" fill="none" stroke={CREAM} strokeWidth="5" strokeLinejoin="round" opacity={progress > 0.85 ? 1 : 0} />
  </svg>
);

const Label: React.FC<{text: string; x: number; y: number; dir: 'left' | 'right'}> = ({text, x, y, dir}) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  const p = interpolate(f, [4, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{fontFamily: SERIF_I, fontStyle: 'italic', fontWeight: 500, fontSize: 46, color: CREAM, opacity: a, transform: `translateY(${(1 - a) * 12}px)`, whiteSpace: 'nowrap', textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{text}</div>
      <div style={{marginTop: 6, marginLeft: dir === 'right' ? 40 : -40}}><Arrow progress={p} dir={dir} /></div>
    </div>
  );
};

const Emoji: React.FC<{file: string; x: number; y: number; size: number}> = ({file, x, y, size}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f, fps, config: {damping: 9, stiffness: 160}});
  return <Img src={staticFile(`emoji/${file}.png`)} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${s}) rotate(${(1 - s) * -25}deg)`}} />;
};

// ---------- Cierre con maquina de escribir ----------
const FRAMES_PER_CHAR = 2.2;
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = C.end.line1;
  const typed = Math.min(l1.length, Math.floor(f / FRAMES_PER_CHAR));
  const done = typed >= l1.length;
  const cursorOn = done ? Math.floor(f / 10) % 2 === 0 : true;
  const t0 = l1.length * FRAMES_PER_CHAR;
  const l2 = interpolate(f, [t0 + 6, t0 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 270}}>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 52, color: CREAM, textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>
        {l1.slice(0, typed)}
        <span style={{opacity: cursorOn ? 1 : 0, fontWeight: 400}}>|</span>
      </div>
      <div style={{fontFamily: SERIF_I, fontStyle: 'italic', fontWeight: 500, fontSize: 38, color: '#fff', opacity: l2, marginTop: 6, textShadow: '0 3px 14px rgba(0,0,0,.4)'}}>{C.end.line2}</div>
    </AbsoluteFill>
  );
};

// ---------- Composicion ----------
type Span = {start: number; end: number};

export const Styled: React.FC<StyledProps> = ({videoSrc, transcript, keeps}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const fr = (s: number) => Math.round(s * fps);
  // Todo lo definido en config.ts esta en tiempo del video ORIGINAL; aqui se pasa al tiempo del video recortado.
  const mapSpan = <T extends Span>(x: T): T | null => {
    const start = mapTimeNext(x.start, keeps);
    const end = mapTimeNext(x.end, keeps);
    return end > start ? {...x, start, end} : null;
  };
  const mapAt = (t: number) => mapTimeNext(t, keeps);
  const newWords = useMemo(() => (transcript ? remapWords(transcript.words, keeps) : []), [transcript, keeps]);
  const pages = useMemo(() => buildPages(newWords, C.subtitles.maxWords), [newWords]);
  const zoomEvents = useMemo(() => [...cutPoints(keeps), ...keywordEvents(newWords, C.dynamics.keywords)], [keeps, newWords]);
  const zoom = zoomScale(frame / fps, zoomEvents, C.dynamics.zoom, C.dynamics.duration);
  const subFrom = mapAt(C.subtitles.from);
  const endAt = mapAt(C.end.start);
  const visiblePages = pages.filter((p) => p.end > subFrom && p.start < endAt);
  const title = mapSpan(C.title);
  const labels = C.labels.map(mapSpan).filter((x): x is LabelCfg => x !== null);
  const emojis = C.emojis.map(mapSpan).filter((x) => x !== null);
  const vol = C.sfx.volume;
  const popAt = C.sfx.popAt.map(mapAt);
  const swooshAt = C.sfx.swooshAt.map(mapAt);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <CutVideo src={videoSrc} keeps={keeps} fps={fps} />
      </AbsoluteFill>

      {title ? (
        <Sequence from={fr(title.start)} durationInFrames={fr(title.end - title.start)}>
          <Title />
        </Sequence>
      ) : null}

      <TikTokCaptions pages={visiblePages} highlight={C.subtitles.highlight} fontFamily={SANS} />

      {labels.map((l, i) => (
        <Sequence key={i} from={fr(l.start)} durationInFrames={fr(l.end - l.start)}>
          <Label text={l.text} x={l.x} y={l.y} dir={l.dir} />
        </Sequence>
      ))}
      {emojis.map((e, i) => (
        <Sequence key={i} from={fr(e!.start)} durationInFrames={fr(e!.end - e!.start)}>
          <Emoji file={e!.file} x={e!.x} y={e!.y} size={e!.size} />
        </Sequence>
      ))}

      <Sequence from={fr(endAt)}>
        <EndCard />
      </Sequence>

      {/* Efectos de sonido sintetizados (public/sfx) */}
      {swooshAt.map((t, i) => (
        <Sequence key={`s${i}`} from={fr(t)}>
          <Audio src={staticFile('sfx/swoosh.wav')} volume={vol} />
        </Sequence>
      ))}
      {popAt.map((t, i) => (
        <Sequence key={`p${i}`} from={fr(t)}>
          <Audio src={staticFile('sfx/pop.wav')} volume={vol} />
        </Sequence>
      ))}
      {Array.from(C.end.line1).map((_, i) => (
        <Sequence key={`k${i}`} from={fr(endAt) + Math.round(i * FRAMES_PER_CHAR)}>
          <Audio src={staticFile('sfx/tick.wav')} volume={vol * 0.8} />
        </Sequence>
      ))}
      <Sequence from={fr(endAt) + Math.round(C.end.line1.length * FRAMES_PER_CHAR) + 8}>
        <Audio src={staticFile('sfx/ding.wav')} volume={vol * 0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
