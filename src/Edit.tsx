import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {getTheme} from './styles/themes';
import {Chat, Emoji, EndCard, FRAMES_PER_CHAR, Item, ITEM_DEFAULT_Y, Label, Title} from './overlays';
import {BEHIND_ITEM_Y, BEHIND_TITLE_Y, captionsVisible, chatTimes} from './lib/overlayTiming';
import {CutVideo} from './lib/CutVideo';
import {cutPoints, mapTimeNext, remapWords, type Keep} from './lib/cuts';
import {buildPages} from './lib/captions';
import {keywordEvents, zoomScale} from './lib/dynamics';
import {TikTokCaptions} from './lib/TikTokCaptions';
import {SceneLayer} from './lib/SceneLayer';
import {matteFile, type EditPlan, type ItemOverlay, type Overlay} from './lib/plan';
import {autoBehindY, type MatteInfo} from './lib/matte';
import {MotionLayer} from './motion/MotionLayer';
import {insideBlocks} from './motion/timing';
import {MUSIC_DEFAULTS, musicVolume, speechSpans} from './lib/music';
import type {Transcript} from './lib/types';

/** matte: public/<video>.matte.json (solo si el plan usa `behind`); da la altura automatica del texto. */
export type EditProps = {videoSrc: string; transcript: Transcript | null; keeps: Keep[]; plan: EditPlan; matte?: MatteInfo | null};

type Span = {start: number; end: number};

/** Composicion generica: renderiza cualquier EditPlan. Los tiempos del plan son del video original. */
export const Edit: React.FC<EditProps> = ({videoSrc, transcript, keeps, plan, matte = null}) => {
  const {fps, durationInFrames} = useVideoConfig();
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
  const spans = useMemo(() => speechSpans(newWords), [newWords]);
  const pages = useMemo(() => buildPages(newWords, plan.captions.maxWords), [newWords, plan.captions.maxWords]);
  const zoomEvents = useMemo(() => [...cutPoints(keeps), ...keywordEvents(newWords, plan.zoom.keywords)], [keeps, newWords, plan.zoom.keywords]);
  const zoom = zoomScale(frame / fps, zoomEvents, plan.zoom.peak, plan.zoom.duration);

  const subFrom = mapAt(plan.captions.from ?? 0);
  const endAt = plan.end ? mapAt(plan.end.start) : Infinity;
  const subUntil = Math.min(plan.captions.until !== undefined ? mapAt(plan.captions.until) : Infinity, endAt);
  // Dentro de bloques de motion no hay subtitulos: el texto cinetico los reemplaza
  // Ninguna pagina invade el titulo ni el cierre: se recortan a [subFrom, subUntil] y las que casi no quedan se descartan
  const visiblePages = pages
    .filter((p) => p.end > subFrom + 0.05 && p.start < subUntil - 0.05 && !insideBlocks(p.start, plan.motion, keeps))
    .map((p) => ({...p, start: Math.max(p.start, subFrom), end: Math.min(p.end, subUntil)}));

  const title = plan.title ? mapSpan(plan.title) : null;
  const mapOverlay = (o: Overlay): Overlay | null => {
    const m = mapSpan(o);
    return m && m.kind === 'chat' ? {...m, messages: m.messages.map((x) => (x.at === undefined ? x : {...x, at: mapAt(x.at)}))} : m;
  };
  // behind sin y: altura automatica segun la cabeza (matte.json), con los tiempos originales
  const autoY = (o: Overlay): Overlay =>
    o.kind === 'item' && o.behind && o.y === undefined ? {...o, y: autoBehindY('item', matte, o.start, o.end)} : o;
  const overlays = plan.overlays.map(autoY).map(mapOverlay).filter((x): x is Overlay => x !== null);
  const titleY = plan.title
    ? plan.title.y ?? (plan.title.behind ? autoBehindY('title', matte, plan.title.start, plan.title.end) ?? BEHIND_TITLE_Y : undefined)
    : undefined;
  const vol = theme.sfxVolume;
  const hasEnd = plan.end !== undefined && Number.isFinite(endAt);
  const t = frame / fps;
  const isOn = (s: Span) => t >= s.start && t < s.end;

  const itemY = (o: ItemOverlay) => o.y ?? (o.behind ? BEHIND_ITEM_Y : ITEM_DEFAULT_Y);
  // Un item arriba ocupa la franja de subtitulos: se esconden mientras esta (como hace Ela).
  const captionsBlocked = !captionsVisible(t, {
    from: subFrom,
    until: subUntil,
    items: overlays.flatMap((o) => (o.kind === 'item' ? [{start: o.start, end: o.end, top: itemY(o) < 420}] : [])),
  });
  // behind: persona recortada (matte) por encima del texto; solo se monta mientras hace falta.
  const behindTitle = Boolean(title && plan.title?.behind);
  const behindOn = (behindTitle && isOn(title!)) || overlays.some((o) => o.kind === 'item' && o.behind && isOn(o));

  const renderOverlay = (o: Overlay, i: number) => (
    <Sequence key={i} from={fr(o.start)} durationInFrames={fr(o.end - o.start)}>
      {o.kind === 'label' ? <Label text={o.text} x={o.x} y={o.y} dir={o.dir} theme={theme} />
        : o.kind === 'emoji' ? <Emoji file={o.file} x={o.x} y={o.y} size={o.size} />
        : o.kind === 'item' ? <Item n={o.n} text={o.text} y={itemY(o)} theme={theme} />
        : <Chat messages={o.messages} y={o.y} theme={theme} appearAt={chatTimes(o).map((s) => fr(s) - fr(o.start))} />}
    </Sequence>
  );
  const titleEl = title && plan.title ? (
    <Sequence from={fr(title.start)} durationInFrames={fr(title.end - title.start)}>
      <Title line1={plan.title.line1} line2={plan.title.line2} theme={theme} y={titleY} />
    </Sequence>
  ) : null;
  const isBehind = (o: Overlay) => o.kind === 'item' && Boolean(o.behind);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <CutVideo src={videoSrc} keeps={keeps} fps={fps} />
      </AbsoluteFill>

      <SceneLayer scenes={plan.scenes} keeps={keeps} theme={theme} fps={fps} />

      {/* texto detras de la persona */}
      {behindTitle ? titleEl : null}
      {overlays.map((o, i) => (isBehind(o) ? renderOverlay(o, i) : null))}
      {behindOn ? (
        <AbsoluteFill style={{transform: `scale(${zoom})`}}>
          <CutVideo src={matteFile(videoSrc)} keeps={keeps} fps={fps} cutSfx={null} transparent />
        </AbsoluteFill>
      ) : null}

      {behindTitle ? null : titleEl}

      {captionsBlocked ? null : (
        <TikTokCaptions pages={visiblePages} highlight={theme.highlight} fontFamily={theme.fonts.sans} fontSize={theme.captionFontSize} top={theme.captionTop} karaoke={theme.captionKaraoke} />
      )}

      {overlays.map((o, i) => (isBehind(o) ? null : renderOverlay(o, i)))}

      {/* Motion encima de subtitulos y overlays: un bloque tapa todo menos el cierre */}
      {plan.motion ? <MotionLayer motion={plan.motion} keeps={keeps} words={transcript?.words ?? []} theme={theme} fps={fps} /> : null}

      {hasEnd && plan.end ? (
        <Sequence from={fr(endAt)}>
          <EndCard line1={plan.end.line1} line2={plan.end.line2} theme={theme} />
        </Sequence>
      ) : null}

      {/* Musica de fondo (copiada a public/music por render.js) con ducking bajo la voz */}
      {plan.music ? (
        <Audio
          src={staticFile(`music/${plan.music.file}`)}
          loop
          volume={(f) => musicVolume(f / fps, spans, durationInFrames / fps, {volume: plan.music?.volume ?? MUSIC_DEFAULTS.volume, duck: plan.music?.duck ?? MUSIC_DEFAULTS.duck})}
        />
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
