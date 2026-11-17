/** Colores de un bloque de motion. Medidos a ojo de m_1: gris claro con texto negro, o casi negro con texto hueso. */
export type Palette = {bg: string; fg: string; dim: string; dot: string; pill: string; vignette: string};

export const palette = (bg: 'light' | 'dark'): Palette =>
  bg === 'light'
    ? {bg: '#EEEDF0', fg: '#111111', dim: 'rgba(17,17,17,.38)', dot: 'rgba(17,17,17,.13)', pill: 'rgba(17,17,17,.07)', vignette: 'rgba(0,0,0,.13)'}
    : {bg: '#111111', fg: '#F4F2EE', dim: 'rgba(244,242,238,.38)', dot: 'rgba(244,242,238,.07)', pill: 'rgba(244,242,238,.10)', vignette: 'rgba(0,0,0,.55)'};
