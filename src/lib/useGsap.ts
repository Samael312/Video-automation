import {useLayoutEffect, useRef, type RefObject} from 'react';
import {gsap} from 'gsap';
import {useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * GSAP atado al frame de Remotion. `build` arma un timeline pausado (tiempos en segundos)
 * sobre los nodos de `scope`; en cada frame se hace `seek(frame / fps)`, asi el render es
 * deterministico (cada frame se puede pintar en cualquier orden, como exige Remotion).
 * Nada de gsap.utils.random ni Math.random: usar `random(seed)` de Remotion (render en varias pestañas).
 */
export const useGsap = <T extends HTMLElement>(build: (tl: gsap.core.Timeline, root: T) => void, deps: unknown[] = []): RefObject<T | null> => {
  const scope = useRef<T>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  useLayoutEffect(() => {
    if (!scope.current) return;
    const root = scope.current;
    const ctx = gsap.context(() => {
      tl.current = gsap.timeline({paused: true});
      build(tl.current, root);
    }, root);
    return () => {
      ctx.revert();
      tl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Se declara despues: corre tras construir el timeline, tambien en el primer frame
  useLayoutEffect(() => {
    tl.current?.seek(frame / fps, false);
  }, [frame, fps, ...deps]);

  return scope;
};
