import {describe, expect, test} from 'vitest';
import {captionsVisible, chatTimes, CHAT_STAGGER} from './overlayTiming';

const chat = (messages: {text: string; side: 'left' | 'right'; at?: number}[], start = 2, end = 8) => ({kind: 'chat' as const, messages, start, end});

describe('chatTimes', () => {
  test('sin at: escalonados cada CHAT_STAGGER desde start', () => {
    expect(chatTimes(chat([{text: 'a', side: 'left'}, {text: 'b', side: 'right'}, {text: 'c', side: 'left'}]))).toEqual([2, 2 + CHAT_STAGGER, 2 + 2 * CHAT_STAGGER]);
  });
  test('respeta at cuando viene', () => {
    expect(chatTimes(chat([{text: 'a', side: 'left'}, {text: 'b', side: 'right', at: 5}]))).toEqual([2, 5]);
  });
  test('en un overlay corto el escalonado se comprime para que entren todos', () => {
    const t = chatTimes(chat([{text: 'a', side: 'left'}, {text: 'b', side: 'right'}, {text: 'c', side: 'left'}, {text: 'd', side: 'right'}], 2, 3));
    expect(t[3]).toBeLessThan(3);
    expect(t).toEqual([...t].sort((x, y) => x - y));
  });
});

describe('captionsVisible', () => {
  const items = [{start: 5, end: 6, top: true}, {start: 8, end: 9, top: false}];
  test('nada antes de from aunque la pagina haya empezado antes', () => expect(captionsVisible(0.9, {from: 1.5, until: 20, items})).toBe(false));
  test('visible entre from y until', () => expect(captionsVisible(2, {from: 1.5, until: 20, items})).toBe(true));
  test('nada desde until (cierre)', () => expect(captionsVisible(20, {from: 1.5, until: 20, items})).toBe(false));
  test('se esconden con un item arriba, no con uno abajo', () => {
    expect(captionsVisible(5.5, {from: 0, until: 20, items})).toBe(false);
    expect(captionsVisible(8.5, {from: 0, until: 20, items})).toBe(true);
  });
});
