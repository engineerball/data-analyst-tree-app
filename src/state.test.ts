import { describe, expect, it } from 'vitest';
import { concepts } from './data';
import { STORAGE_KEY, defaultSelection, loadDone, saveDone, type StorageLike } from './state';

function mem(initial?: string): StorageLike {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const ids: ReadonlySet<string> = new Set(concepts.map(c => c.id));

describe('progress storage', () => {
  it('round-trips', () => {
    const s = mem();
    saveDone(s, new Set(['types', 'convert']));
    expect(loadDone(s, ids)).toEqual(new Set(['types', 'convert']));
  });

  it('empty storage loads an empty set', () => {
    expect(loadDone(mem(), ids)).toEqual(new Set());
  });

  it('corrupt JSON loads an empty set', () => {
    expect(loadDone(mem('{nope'), ids)).toEqual(new Set());
  });

  it('wrong schema version loads an empty set', () => {
    expect(loadDone(mem('{"v":9,"done":["types"]}'), ids)).toEqual(new Set());
  });

  it('filters unknown ids', () => {
    expect(loadDone(mem('{"v":1,"done":["types","ghost"]}'), ids)).toEqual(new Set(['types']));
  });
});

describe('defaultSelection', () => {
  it('picks the first not-done concept in data order', () => {
    expect(defaultSelection(concepts, new Set(['types']))).toBe('missing');
  });

  it('falls back to the first concept when everything is done', () => {
    expect(defaultSelection(concepts, new Set(concepts.map(c => c.id)))).toBe('types');
  });
});
