import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { conceptById } from './data';
import { depthOf, withPrereqs } from './graph';

const g = (defs: Record<string, string[]>): ReadonlyMap<string, Concept> =>
  new Map(
    Object.entries(defs).map(([id, pre]) => [id, { id, title: id, cat: '', desc: '', pre }]),
  );

describe('withPrereqs', () => {
  it('includes the concept itself and all transitive prerequisites', () => {
    expect(withPrereqs('change', conceptById)).toEqual(
      new Set(['change', 'group', 'convert', 'aggregate', 'types', 'unique']),
    );
  });

  it('returns only the concept for roots', () => {
    expect(withPrereqs('types', conceptById)).toEqual(new Set(['types']));
  });

  it('ignores unknown ids', () => {
    expect(withPrereqs('nope', conceptById)).toEqual(new Set());
  });

  it('terminates on cycles', () => {
    expect(withPrereqs('a', g({ a: ['b'], b: ['a'] }))).toEqual(new Set(['a', 'b']));
  });
});

describe('depthOf', () => {
  it('assigns 1 to roots and 1 + longest chain otherwise', () => {
    const d = depthOf(g({ a: [], b: ['a'], c: ['a', 'b'] }));
    expect(d.get('a')).toBe(1);
    expect(d.get('b')).toBe(2);
    expect(d.get('c')).toBe(3);
  });

  it('takes the longest chain, not the shortest', () => {
    const d = depthOf(g({ a: [], b: ['a'], c: ['b'], deep: ['a', 'c'] }));
    expect(d.get('deep')).toBe(4);
  });

  it('terminates on cycles', () => {
    const d = depthOf(g({ a: ['b'], b: ['a'] }));
    expect(d.get('a')).toBeGreaterThanOrEqual(1);
    expect(d.get('b')).toBeGreaterThanOrEqual(1);
  });

  it('covers every id in the map', () => {
    const d = depthOf(g({ a: [], b: [] }));
    expect([...d.keys()].sort()).toEqual(['a', 'b']);
  });
});
