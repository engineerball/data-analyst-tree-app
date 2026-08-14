import { describe, expect, it } from 'vitest';
import { tracks } from './data';
import { decodeShareHash, encodeShareHash } from './share';

const raw = (payload: unknown): string => '#s=' + btoa(JSON.stringify(payload));

describe('share codec v2', () => {
  it('round-trips a done set with its track', () => {
    const hash = encodeShareHash('data-analyst', new Set(['unique', 'types']));
    expect(decodeShareHash(hash, tracks)).toEqual({ track: 'data-analyst', done: new Set(['types', 'unique']) });
  });

  it('round-trips the empty set', () => {
    expect(decodeShareHash(encodeShareHash('data-analyst', new Set()), tracks)).toEqual({
      track: 'data-analyst',
      done: new Set(),
    });
  });

  it('produces a URL-fragment-safe string', () => {
    expect(encodeShareHash('data-analyst', new Set(['types', 'missing']))).toMatch(/^#s=[A-Za-z0-9_-]+$/);
  });

  it('drops ids the named track does not know', () => {
    const hash = encodeShareHash('data-analyst', new Set(['types', 'zombie']));
    expect(decodeShareHash(hash, tracks)?.done).toEqual(new Set(['types']));
  });

  it('decodes a v1 payload as data-analyst progress', () => {
    const decoded = decodeShareHash(raw({ v: 1, done: ['types', 'ghost'] }), tracks);
    expect(decoded).toEqual({ track: 'data-analyst', done: new Set(['types']) });
  });

  it('rejects an unknown track', () => {
    expect(decodeShareHash(raw({ v: 2, t: 'zombie', done: ['types'] }), tracks)).toBeNull();
  });

  it('rejects other hashes', () => {
    expect(decodeShareHash('', tracks)).toBeNull();
    expect(decodeShareHash('#other', tracks)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(decodeShareHash('#s=!!!not-base64!!!', tracks)).toBeNull();
    expect(decodeShareHash(raw({ v: 2, done: [] }), tracks)).toBeNull();
    expect(decodeShareHash(raw({ v: 2, t: 'data-analyst', done: 'x' }), tracks)).toBeNull();
    expect(decodeShareHash(raw({ v: 1, done: 'x' }), tracks)).toBeNull();
    expect(decodeShareHash(raw([1, 2, 3]), tracks)).toBeNull();
    expect(decodeShareHash(raw(null), tracks)).toBeNull();
  });
});
