import {describe, expect, it} from 'vitest';
import {emojiDirsOf, propAssetErrors} from './propAssets';

const ctx = {knownEmojis: ['1f409'], knownEmojis3d: ['2694']};

describe('propAssetErrors', () => {
  it('código que falta en props.emoji', () => {
    const e = propAssetErrors({emoji: '1f999'}, ctx, 'x');
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('x.emoji: emoji 1f999');
    expect(e[0]).toContain('no existe en public/emoji ni en public/emoji3d');
  });
  it('lista anidada con ruta exacta', () => {
    const e = propAssetErrors({comments: [{avatar: '1f409'}, {avatar: '1f998'}]}, ctx, 'x');
    expect(e).toEqual([expect.stringContaining('x.comments[1].avatar')]);
  });
  it('palabras se ignoran y el 3D existente vale', () => {
    expect(propAssetErrors({emojis: ['dragon', '2694']}, ctx, 'x')).toEqual([]);
  });
  it('lista bajo clave emoji con código que falta', () => {
    expect(propAssetErrors({emojis: ['dragon', '1f997']}, ctx, 'x')).toEqual([expect.stringContaining('x.emojis[1]')]);
  });
  it('claves que no son de emoji se ignoran', () => {
    expect(propAssetErrors({title: '1f999'}, ctx, 'x')).toEqual([]);
  });
  it('valores raros no rompen', () => {
    expect(propAssetErrors({emoji: 5, avatar: null, emojis: [{}]}, ctx, 'x')).toEqual([]);
    expect(propAssetErrors(undefined, ctx, 'x')).toEqual([]);
  });
  it('sin listas de emojis no revisa', () => {
    expect(propAssetErrors({emoji: '1f999'}, {knownEmojis: ['1f409']}, 'x')).toEqual([]);
  });
  it('códigos compuestos con guion', () => {
    expect(propAssetErrors({emoji: '1f469-1f3eb'}, ctx, 'x')).toHaveLength(1);
  });
});

describe('propAssetErrors: palabras hex', () => {
  it('palabras que parecen hex (cafe, face, decade) se ignoran', () => {
    expect(propAssetErrors({emojis: ['cafe', 'face', 'decade']}, ctx, 'x')).toEqual([]);
  });
});

describe('propAssetErrors: objetos dentro de listas de emojis', () => {
  it('revisa códigos bajo clave neutra dentro de una lista de emojis', () => {
    expect(propAssetErrors({emojis: [{code: '1f999'}]}, ctx, 'x')).toEqual([expect.stringContaining('x.emojis[0].code')]);
  });
});

describe('carpeta de emojis por componente', () => {
  it('emojiDirsOf lee qué carpeta usa el código', () => {
    expect(emojiDirsOf('<Img src={staticFile(`emoji3d/${e}.png`)} />')).toEqual(['emoji3d']);
    expect(emojiDirsOf('staticFile(`emoji/${a}.png`) staticFile(`emoji/${b}.png`)')).toEqual(['emoji']);
    expect(emojiDirsOf('staticFile(`emoji/${a}.png`) staticFile(`emoji3d/${b}.png`)')).toEqual(['emoji', 'emoji3d']);
    expect(emojiDirsOf('nada')).toEqual([]);
  });
  it('si el componente solo usa emoji3d, un código que solo está en emoji falla', () => {
    const e = propAssetErrors({emojis: ['1f409']}, ctx, 'x', ['emoji3d']);
    expect(e).toEqual([expect.stringContaining('no existe en public/emoji3d')]);
  });
  it('sin carpetas conocidas acepta cualquiera de las dos', () => {
    expect(propAssetErrors({emojis: ['1f409', '2694']}, ctx, 'x', [])).toEqual([]);
  });
});
