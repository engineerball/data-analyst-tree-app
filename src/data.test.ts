import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';

describe('curriculum integrity', () => {
  it('has 12 concepts with unique ids', () => {
    expect(concepts).toHaveLength(12);
    expect(new Set(concepts.map(c => c.id)).size).toBe(concepts.length);
  });

  it('every prerequisite exists', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.has(p), `${c.id} -> ${p}`).toBe(true);
      }
    }
  });

  it('prerequisites never come from a later tier', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.get(p)!.tier).toBeLessThanOrEqual(c.tier);
      }
    }
  });

  it('no concept requires itself', () => {
    for (const c of concepts) {
      expect(c.pre).not.toContain(c.id);
    }
  });
});
