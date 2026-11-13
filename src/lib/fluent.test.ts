import {describe, expect, test} from 'vitest';
import {buildFluentIndex, fluentRawUrl, FLUENT_SHA} from './fluent';

const tree = [
  'assets/Face screaming in fear/3D/face_screaming_in_fear_3d.png',
  'assets/Face screaming in fear/metadata.json',
  'assets/Thumbs up/Default/3D/thumbs_up_3d_default.png',
  'assets/Thumbs up/Dark/3D/thumbs_up_3d_dark.png',
  'assets/Red heart/3D/red_heart_3d.png',
  'assets/Flag Spain/3D/flag_spain_3d.png',
];
const emojiTest = [
  '# group: Smileys & Emotion',
  '1F631                                                  ; fully-qualified     # 😱 E0.6 face screaming in fear',
  '1F44D                                                  ; fully-qualified     # 👍 E0.6 thumbs up',
  '1F44D 1F3FB                                            ; fully-qualified     # 👍🏻 E1.0 thumbs up: light skin tone',
  '2764 FE0F                                              ; fully-qualified     # ❤️ E0.6 red heart',
  '2764                                                   ; unqualified         # ❤ E0.6 red heart',
  '1F1EA 1F1F8                                            ; fully-qualified     # 🇪🇸 E2.0 flag: Spain',
].join('\n');
const index = buildFluentIndex(tree, emojiTest);

describe('buildFluentIndex', () => {
  test('codigo -> png 3D', () => expect(index['1f631']).toBe('assets/Face screaming in fear/3D/face_screaming_in_fear_3d.png'));
  test('prefiere la variante Default', () => expect(index['1f44d']).toBe('assets/Thumbs up/Default/3D/thumbs_up_3d_default.png'));
  test('ignora skin tones y no fully-qualified', () => expect(Object.keys(index).sort()).toEqual(['1f1ea_1f1f8', '1f44d', '1f631', '2764']));
  test('quita fe0f del codigo', () => expect(index['2764']).toBe('assets/Red heart/3D/red_heart_3d.png'));
  test('nombre con dos puntos', () => expect(index['1f1ea_1f1f8']).toBe('assets/Flag Spain/3D/flag_spain_3d.png'));
  test('resolve devuelve null para codigo sin carpeta', () => expect(index['1f9e0']).toBeUndefined());
});

test('fluentRawUrl codifica espacios y fija el commit', () =>
  expect(fluentRawUrl('assets/Red heart/3D/red_heart_3d.png')).toBe(`https://raw.githubusercontent.com/microsoft/fluentui-emoji/${FLUENT_SHA}/assets/Red%20heart/3D/red_heart_3d.png`));
