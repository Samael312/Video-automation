import {describe, expect, test} from 'vitest';
import {normalizeEmoji, notoUrl} from './emoji';

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
