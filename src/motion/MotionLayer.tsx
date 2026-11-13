import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import type {Keep} from '../lib/cuts';
import type {Block, MotionPlan} from '../lib/motion';
import type {Word} from '../lib/types';
import type {Theme} from '../styles/themes';
import {Background} from './Background';
import {LAYOUT_UI} from './layouts';
import {leadDelays} from './leadTiming';
import {palette} from './palette';
import {beatFrames, blockFrames, cameraScale, tickFrames} from './timing';
import {beatSpans} from '../lib/motion';

const WIPE_FRAMES = 8;
const BLUR_FRAMES = 8;

/** Emojis del bloque para el fondo (los mismos que usan sus beats; nunca recursos ajenos al contenido). */
const blockProps = (b: Block): string[] => [...new Set(b.beats.map((x) => x.emoji).filter((e): e is string => !!e))].slice(0, 2);

const BeatView: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  return f < BLUR_FRAMES ? (
    <CameraMotionBlur samples={6} shutterAngle={120}>
      <AbsoluteFill>{children}</AbsoluteFill>
    </CameraMotionBlur>
  ) : (
    <AbsoluteFill>{children}</AbsoluteFill>
  );
};

const BlockView: React.FC<{block: Block; keeps: Keep[]; words: Word[]; theme: Theme; fps: number; duration: number}> = ({block, keeps, words, theme, fps, duration}) => {
  const f = useCurrentFrame();
  const beats = beatFrames(block, keeps, fps);
  const spans = beatSpans(block);
  const froms = beats.map((b) => b.from);
  const wipe = interpolate(f, [0, WIPE_FRAMES], [0, 75], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const pal = palette(block.bg);
  return (
    <AbsoluteFill style={{clipPath: `circle(${wipe}% at 50% 50%)`}}>
      <Background bg={block.bg} props={blockProps(block)} durationInFrames={duration} />
      <AbsoluteFill style={{transform: `scale(${cameraScale(f, duration, froms)})`}}>
        {beats.map((b, i) => {
          if (b.duration <= 0) return null;
          const Layout = LAYOUT_UI[b.beat.layout];
          const text = b.beat.lead ?? b.beat.title ?? '';
          return (
            <Sequence key={i} from={b.from} durationInFrames={b.duration}>
              <BeatView>
                <Layout beat={b.beat} theme={theme} pal={pal} dark={block.bg === 'dark'} durationInFrames={b.duration} leadDelays={leadDelays(text, words, spans[i].start, spans[i].end)} />
              </BeatView>
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Audio src={staticFile('sfx/swoosh.wav')} volume={theme.sfxVolume} />
      {tickFrames(froms, fps).map((t) => (
        <Sequence key={`t${t}`} from={t}>
          <Audio src={staticFile('sfx/tick.wav')} volume={theme.sfxVolume * 0.4} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Bloques de motion a pantalla completa sobre el video (la voz sigue debajo). Entran con wipe circular, salen con corte seco. */
export const MotionLayer: React.FC<{motion: MotionPlan; keeps: Keep[]; words: Word[]; theme: Theme; fps: number}> = ({motion, keeps, words, theme, fps}) => (
  <>
    {motion.blocks.map((b, i) => {
      const fr = blockFrames(b, keeps, fps);
      if (!fr) return null;
      return (
        <Sequence key={i} from={fr.from} durationInFrames={fr.duration}>
          <BlockView block={b} keeps={keeps} words={words} theme={theme} fps={fps} duration={fr.duration} />
        </Sequence>
      );
    })}
  </>
);
