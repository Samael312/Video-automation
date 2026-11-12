import {referencia, type Theme} from './referencia/theme';

export type {Theme};
export const themes: Record<string, Theme> = {referencia};

export const getTheme = (name: string): Theme => {
  const t = themes[name];
  if (!t) throw new Error(`Estilo desconocido "${name}" (conocidos: ${Object.keys(themes).join(', ')})`);
  return t;
};
