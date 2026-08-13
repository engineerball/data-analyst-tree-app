import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';
import { depthOf } from './graph';

const depth = depthOf(conceptById);

describe('curriculum integrity', () => {
  it('has unique ids', () => {
    expect(new Set(concepts.map(c => c.id)).size).toBe(concepts.length);
  });

  it('every prerequisite exists', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.has(p), `${c.id} -> ${p}`).toBe(true);
      }
    }
  });

  it('no concept requires itself', () => {
    for (const c of concepts) {
      expect(c.pre).not.toContain(c.id);
    }
  });

  it('spans depths 1 through 5 with nothing deeper', () => {
    const depths = concepts.map(c => depth.get(c.id)!);
    expect(Math.min(...depths)).toBe(1);
    expect(Math.max(...depths)).toBe(5);
  });

  it('bonus concepts are never prerequisites of non-bonus concepts', () => {
    for (const c of concepts.filter(k => !k.bonus)) {
      for (const p of c.pre) {
        expect(conceptById.get(p)!.bonus, `${c.id} -> ${p}`).toBeUndefined();
      }
    }
  });

  it('keeps legacy ids so saved progress survives', () => {
    for (const id of ['types', 'missing', 'unique', 'convert', 'handle-missing', 'dedupe', 'aggregate', 'join', 'group', 'change', 'correlation']) {
      expect(conceptById.has(id), id).toBe(true);
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
    expect(conceptById.get('change')!.pre).toEqual(['group', 'convert']);
  });
});
