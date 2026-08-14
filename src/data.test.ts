import { describe, expect, it } from 'vitest';
import { trackById } from './data';
import { depthOf } from './graph';

const da = trackById.get('data-analyst')!;
const depth = depthOf(da.byId);

describe('data-analyst curriculum anchors', () => {
  it('spans depths 1 through 5 with nothing deeper', () => {
    const depths = da.concepts.map(c => depth.get(c.id)!);
    expect(Math.min(...depths)).toBe(1);
    expect(Math.max(...depths)).toBe(5);
  });

  it('keeps legacy ids so saved progress survives', () => {
    for (const id of ['types', 'missing', 'unique', 'convert', 'handle-missing', 'dedupe', 'aggregate', 'join', 'group', 'change', 'correlation']) {
      expect(da.byId.has(id), id).toBe(true);
    }
  });

  it('anchors mock concepts in their columns', () => {
    expect(depth.get('types')).toBe(1);
    expect(depth.get('convert')).toBe(2);
    expect(depth.get('aggregate')).toBe(2);
    expect(depth.get('group')).toBe(3);
    expect(depth.get('change')).toBe(4);
  });

  it('gives Change over time the mock prerequisites', () => {
    expect(da.byId.get('change')!.pre).toEqual(['group', 'convert']);
  });
});
