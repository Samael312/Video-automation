import {describe, expect, test} from 'vitest';
import {audioToVideoArgs, isAudioInput} from './audioInput';

describe('isAudioInput', () => {
  test('reconoce audio sin importar mayusculas', () => expect(isAudioInput('media/input/X.M4A')).toBe(true));
  test.each(['a.mp3', 'a.ogg', 'a.opus', 'a.wav'])('%s es audio', (f) => expect(isAudioInput(f)).toBe(true));
  test('video no', () => expect(isAudioInput('X.mov')).toBe(false));
});

describe('audioToVideoArgs', () => {
  const a = audioToVideoArgs('a.m4a', 'o.mp4', '#F4F1EA', 28.6667);
  test('fondo de color 720x1280 a 30 fps', () => {
    expect(a.slice(a.indexOf('-f'), a.indexOf('-f') + 4)).toEqual(['-f', 'lavfi', '-i', 'color=c=#F4F1EA:s=720x1280:r=30']);
  });
  test.each([['-pix_fmt', 'yuv420p'], ['-c:a', 'aac'], ['-ar', '48000']])('%s %s', (k, v) => expect(a[a.indexOf(k) + 1]).toBe(v));
  test('dura lo que el audio (-t; -shortest no corta el color de lavfi)', () => expect(a[a.indexOf('-t') + 1]).toBe('28.667'));
  test('el video cubre todo el audio: -t sube al frame siguiente (29.814 s -> 895 frames)', () => {
    const b = audioToVideoArgs('a.mp3', 'o.mp4', '#fff', 29.814);
    expect(b[b.indexOf('-t') + 1]).toBe('29.833');
  });
  test('termina en la salida', () => expect(a[a.length - 1]).toBe('o.mp4'));
});
