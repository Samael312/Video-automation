import {describe, expect, test} from 'vitest';
import {emojisIn, normalizeEmoji, notoUrl, splitEmoji} from './emoji';

describe('normalizeEmoji', () => {
  test.each([
    ['😀', '1f600'],
    ['U+1F600', '1f600'],
    ['u+1f600', '1f600'],
    ['1F600', '1f600'],
    ['1f600', '1f600'],
    ['👍🏻', '1f44d_1f3fb'],
    ['1f44d-1f3fb', '1f44d_1f3fb'],
    ['1F44D_1F3FB', '1f44d_1f3fb'],
    ['❤️', '2764'],
    ['2764-fe0f', '2764'],
  ])('%s -> %s', (input, code) => expect(normalizeEmoji(input)).toBe(code));

  test.each([['U+ZZZ'], [''], ['hola'], ['12'], ['1f600_zz']])('inválido: "%s" -> null', (input) => expect(normalizeEmoji(input)).toBeNull());
});

test('notoUrl usa el tag fijado', () =>
  expect(notoUrl('1f600')).toBe('https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/png/512/emoji_u1f600.png'));

describe('splitEmoji', () => {
  test('texto con emojis -> partes', () => {
    expect(splitEmoji('Hi 😀 ok 👍🏻')).toEqual([
      {text: 'Hi '},
      {emoji: '1f600', raw: '😀'},
      {text: ' ok '},
      {emoji: '1f44d_1f3fb', raw: '👍🏻'},
    ]);
  });
  test('quita el selector de variación', () => expect(splitEmoji('❤️')).toEqual([{emoji: '2764', raw: '❤️'}]));
  test('sin emojis: un solo texto', () => expect(splitEmoji("I'm fine 123 #1")).toEqual([{text: "I'm fine 123 #1"}]));
  test('emojisIn lista los códigos', () => expect(emojisIn('a 😀 b 😀 🔥')).toEqual(['1f600', '1f600', '1f525']));
});
