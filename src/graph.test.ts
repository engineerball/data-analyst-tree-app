import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { conceptById } from './data';
import { withPrereqs } from './graph';

const g = (defs: Record<string, string[]>): ReadonlyMap<string, Concept> =>
  new Map(
    Object.entries(defs).map(([id, pre]) => [id, { id, title: id, tier: 1, cat: '', desc: '', pre }]),
  );

describe('withPrereqs', () => {
  it('includes the concept itself and all transitive prerequisites', () => {
    expect(withPrereqs('change', conceptById)).toEqual(
      new Set(['change', 'group', 'convert', 'aggregate', 'join', 'handle-missing', 'missing', 'types', 'unique', 'dedupe']),
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
