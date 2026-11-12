import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {getTheme} from './styles/themes';
import {Emoji, EndCard, FRAMES_PER_CHAR, Label, Title} from './overlays';
import {CutVideo} from './lib/CutVideo';
import {cutPoints, mapTimeNext, remapWords, type Keep} from './lib/cuts';
import {buildPages} from './lib/captions';
import {keywordEvents, zoomScale} from './lib/dynamics';
import {TikTokCaptions} from './lib/TikTokCaptions';
import {SceneLayer} from './lib/SceneLayer';
import type {EditPlan} from './lib/plan';
import type {Transcript} from './lib/types';

export type EditProps = {videoSrc: string; transcript: Transcript | null; keeps: Keep[]; plan: EditPlan};

type Span = {start: number; end: number};

/** Composicion generica: renderiza cualquier EditPlan. Los tiempos del plan son del video original. */
export const Edit: React.FC<EditProps> = ({videoSrc, transcript, keeps, plan}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const theme = getTheme(plan.style);
  const fr = (s: number) => Math.round(s * fps);
  const mapAt = (t: number) => mapTimeNext(t, keeps);
  const mapSpan = <T extends Span>(x: T): T | null => {
    const start = mapAt(x.start);
    const end = mapAt(x.end);
    return end > start ? {...x, start, end} : null;
  };

  const newWords = useMemo(() => (transcript ? remapWords(transcript.words, keeps) : []), [transcript, keeps]);
  const pages = useMemo(() => buildPages(newWords, plan.captions.maxWords), [newWords, plan.captions.maxWords]);
  const zoomEvents = useMemo(() => [...cutPoints(keeps), ...keywordEvents(newWords, plan.zoom.keywords)], [keeps, newWords, plan.zoom.keywords]);
  const zoom = zoomScale(frame / fps, zoomEvents, plan.zoom.peak, plan.zoom.duration);

  const subFrom = mapAt(plan.captions.from ?? 0);
  const endAt = plan.end ? mapAt(plan.end.start) : Infinity;
  const subUntil = Math.min(plan.captions.until !== undefined ? mapAt(plan.captions.until) : Infinity, endAt);
  const visiblePages = pages.filter((p) => p.end > subFrom && p.start < subUntil);

  const title = plan.title ? mapSpan(plan.title) : null;
  const overlays = plan.overlays.map(mapSpan).filter((x) => x !== null);
  const vol = theme.sfxVolume;
  const hasEnd = plan.end !== undefined && Number.isFinite(endAt);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <CutVideo src={videoSrc} keeps={keeps} fps={fps} />
      </AbsoluteFill>

      <SceneLayer scenes={plan.scenes} keeps={keeps} theme={theme} fps={fps} />

      {title && plan.title ? (
        <Sequence from={fr(title.start)} durationInFrames={fr(title.end - title.start)}>
          <Title line1={plan.title.line1} line2={plan.title.line2} theme={theme} />
        </Sequence>
      ) : null}

      <TikTokCaptions pages={visiblePages} highlight={theme.highlight} fontFamily={theme.fonts.sans} fontSize={theme.captionFontSize} top={theme.captionTop} />

      {overlays.map((o, i) => (
        <Sequence key={i} from={fr(o!.start)} durationInFrames={fr(o!.end - o!.start)}>
          {o!.kind === 'label' ? <Label text={o!.text} x={o!.x} y={o!.y} dir={o!.dir} theme={theme} /> : <Emoji file={o!.file} x={o!.x} y={o!.y} size={o!.size} />}
        </Sequence>
      ))}

      {hasEnd && plan.end ? (
        <Sequence from={fr(endAt)}>
          <EndCard line1={plan.end.line1} line2={plan.end.line2} theme={theme} />
        </Sequence>
      ) : null}

      {/* Efectos de sonido (public/sfx) */}
      {plan.sfx.map((s, i) => (
        <Sequence key={`sfx${i}`} from={fr(mapAt(s.at))}>
          <Audio src={staticFile(`sfx/${s.name}.wav`)} volume={vol} />
        </Sequence>
      ))}
      {hasEnd && plan.end
        ? Array.from(plan.end.line1).map((_, i) => (
            <Sequence key={`k${i}`} from={fr(endAt) + Math.round(i * FRAMES_PER_CHAR)}>
              <Audio src={staticFile('sfx/tick.wav')} volume={vol * 0.8} />
            </Sequence>
          ))
        : null}
      {hasEnd && plan.end ? (
        <Sequence from={fr(endAt) + Math.round(plan.end.line1.length * FRAMES_PER_CHAR) + 8}>
          <Audio src={staticFile('sfx/ding.wav')} volume={vol * 0.6} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
