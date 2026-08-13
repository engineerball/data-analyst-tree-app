import { describe, expect, it } from 'vitest';
import { decodeShareHash, encodeShareHash } from './share';

const ids: ReadonlySet<string> = new Set(['a', 'b', 'c']);

describe('share codec', () => {
  it('round-trips a done set', () => {
    const hash = encodeShareHash(new Set(['b', 'a']));
    expect(decodeShareHash(hash, ids)).toEqual(new Set(['a', 'b']));
  });

  it('round-trips the empty set', () => {
    expect(decodeShareHash(encodeShareHash(new Set()), ids)).toEqual(new Set());
  });

  it('produces a URL-fragment-safe string', () => {
    expect(encodeShareHash(new Set(['a', 'b', 'c']))).toMatch(/^#s=[A-Za-z0-9_-]+$/);
  });

  it('drops ids not in the curriculum', () => {
    const hash = encodeShareHash(new Set(['a', 'zombie']));
    expect(decodeShareHash(hash, ids)).toEqual(new Set(['a']));
  });

  it('rejects other hashes', () => {
    expect(decodeShareHash('', ids)).toBeNull();
    expect(decodeShareHash('#other', ids)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(decodeShareHash('#s=!!!not-base64!!!', ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('{"v":2,"done":[]}'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('{"v":1,"done":"x"}'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('[1,2,3]'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('null'), ids)).toBeNull();
  });
});
