import { describe, expect, it } from 'vitest';
import { tracks } from './data';
import { STORAGE_KEY, defaultSelection, loadProgress, saveProgress, type StorageLike } from './state';

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

const da = tracks[0]!;

describe('progress storage v2', () => {
  it('round-trips per-track done sets and the active track', () => {
    const s = mem();
    saveProgress(s, { track: 'data-analyst', done: new Map([['data-analyst', new Set(['types', 'convert'])]]) });
    const loaded = loadProgress(s, tracks);
    expect(loaded.track).toBe('data-analyst');
    expect(loaded.done.get('data-analyst')).toEqual(new Set(['types', 'convert']));
  });

  it('empty storage loads the default track with no progress', () => {
    const loaded = loadProgress(mem(), tracks);
    expect(loaded.track).toBe('data-analyst');
    expect(loaded.done.size).toBe(0);
  });

  it('corrupt JSON loads empty progress', () => {
    expect(loadProgress(mem('{nope'), tracks).done.size).toBe(0);
  });

  it('unknown schema version loads empty progress', () => {
    expect(loadProgress(mem('{"v":9,"done":["types"]}'), tracks).done.size).toBe(0);
  });

  it('migrates a v1 payload to data-analyst progress', () => {
    const loaded = loadProgress(mem('{"v":1,"done":["types","ghost"]}'), tracks);
    expect(loaded.track).toBe('data-analyst');
    expect(loaded.done.get('data-analyst')).toEqual(new Set(['types']));
  });

  it('drops unknown track keys and unknown ids from a v2 payload', () => {
    const raw = JSON.stringify({
      v: 2,
      track: 'data-analyst',
      done: { 'data-analyst': ['types', 'ghost'], 'not-a-track': ['x'] },
    });
    const loaded = loadProgress(mem(raw), tracks);
    expect([...loaded.done.keys()]).toEqual(['data-analyst']);
    expect(loaded.done.get('data-analyst')).toEqual(new Set(['types']));
  });

  it('falls back to the default track when the active track is unknown', () => {
    const raw = JSON.stringify({ v: 2, track: 'zombie', done: {} });
    expect(loadProgress(mem(raw), tracks).track).toBe('data-analyst');
  });

  it('writes a v2 payload', () => {
    const s = mem();
    saveProgress(s, { track: 'data-analyst', done: new Map([['data-analyst', new Set(['types'])]]) });
    const raw = JSON.parse(s.getItem(STORAGE_KEY)!) as { v: number; track: string; done: Record<string, string[]> };
    expect(raw.v).toBe(2);
    expect(raw.track).toBe('data-analyst');
    expect(raw.done['data-analyst']).toEqual(['types']);
  });
});

describe('defaultSelection', () => {
  it('picks the first not-done concept in data order', () => {
    expect(defaultSelection(da.concepts, new Set(['types']))).toBe('missing');
  });

  it('falls back to the first concept when everything is done', () => {
    expect(defaultSelection(da.concepts, new Set(da.concepts.map(c => c.id)))).toBe('types');
  });
});
