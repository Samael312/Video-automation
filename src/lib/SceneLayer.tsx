import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import type {Keep} from './cuts';
import type {Scene} from './plan';
import {sceneEnvelope, sceneFrames} from './scenes';
import type {Theme} from '../styles/themes';
import {TEMPLATES} from '../templates';
import {GENERATED} from '../scenes/generated';

const IN_FRAMES = 8;
const OUT_FRAMES = 8;

const SceneFrame: React.FC<{scene: Scene; duration: number; theme: Theme}> = ({scene, duration, theme}) => {
  const f = useCurrentFrame();
  const env = sceneEnvelope(f, duration, IN_FRAMES, OUT_FRAMES);
  const Template = scene.type === 'generated' ? undefined : TEMPLATES[scene.type];
  const Generated = scene.type === 'generated' ? GENERATED[String(scene.data.component)] : undefined;
  const props = (scene.data.props ?? {}) as Record<string, unknown>;
  return (
    <AbsoluteFill style={{backgroundColor: theme.sceneBg, opacity: env, transform: `translateY(${(1 - env) * 60}px)`}}>
      {Template ? <Template data={scene.data} theme={theme} durationInFrames={duration} /> : null}
      {Generated ? <Generated props={props} theme={theme} durationInFrames={duration} /> : null}
    </AbsoluteFill>
  );
};

/** Escenas a pantalla completa sobre el video (que sigue montado debajo: la voz no se interrumpe). */
export const SceneLayer: React.FC<{scenes: Scene[]; keeps: Keep[]; theme: Theme; fps: number}> = ({scenes, keeps, theme, fps}) => (
  <>
    {scenes.map((s, i) => {
      const fr = sceneFrames(s.start, s.end, keeps, fps);
      if (!fr) return null;
      return (
        <Sequence key={i} from={fr.from} durationInFrames={fr.duration}>
          <SceneFrame scene={s} duration={fr.duration} theme={theme} />
          <Audio src={staticFile('sfx/swoosh.wav')} volume={theme.sfxVolume} />
        </Sequence>
      );
    })}
  </>
);
