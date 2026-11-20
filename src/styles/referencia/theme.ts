import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';

const playfair = loadPlayfair('normal', {weights: ['800']});
const playfairI = loadPlayfair('italic', {weights: ['500']});
const poppins = loadPoppins('normal', {weights: ['700']});

/** Apariencia de un estilo. El contenido (textos, tiempos) vive en el plan, no aqui. */
export type Theme = {
  name: string;
  cream: string; // color medido en Referencia.mp4
  highlight: string; // palabra activa en subtitulos
  fonts: {serif: string; serifItalic: string; sans: string};
  captionTop: number;
  captionFontSize: number;
  captionKaraoke: boolean; // true: la palabra que se dice va en `highlight`
  keycap: string; // color del cuadrito con numero del overlay `item`
  sceneBg: string;
  sfxVolume: number;
};

export const referencia: Theme = {
  name: 'referencia',
  cream: '#FCF4B0',
  highlight: '#FCF4B0',
  fonts: {serif: playfair.fontFamily, serifItalic: playfairI.fontFamily, sans: poppins.fontFamily},
  captionTop: 285,
  captionFontSize: 32, // antes 25: muy chico para TikTok en movil
  captionKaraoke: false, // Ela: frase entera en blanco (ela_1, ela_2, ela_3)
  keycap: '#4A90E2', // Ela: 1️⃣ 2️⃣ 3️⃣ azul (ela_2 4 s, ela_3 6 s)
  sceneBg: '#1c1712',
  sfxVolume: 0.5,
};
