import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { concepts } from './data';
import { COL_GAP, COL_X0, ROW_GAP, ROW_Y0, computeLayout } from './layout';

const c = (id: string, tier: number, pre: string[] = []): Concept =>
  ({ id, title: id, tier, cat: 'T', desc: '', pre });

describe('computeLayout', () => {
  it('positions every concept', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id), k.id).toBeDefined();
  });

  it('x depends only on tier', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id)!.x).toBe(COL_X0 + (k.tier - 1) * COL_GAP);
  });

  it('never overlaps nodes within a tier', () => {
    const { pos } = computeLayout(concepts);
    for (const t of new Set(concepts.map(k => k.tier))) {
      const ys = concepts.filter(k => k.tier === t).map(k => pos.get(k.id)!.y);
      expect(new Set(ys).size).toBe(ys.length);
    }
  });

  it('orders children by prerequisite position (barycenter)', () => {
    const list = [c('a', 1), c('b', 1), c('childOfB', 2, ['b']), c('childOfA', 2, ['a'])];
    const { pos } = computeLayout(list);
    expect(pos.get('childOfA')!.y).toBeLessThan(pos.get('childOfB')!.y);
  });

  it('centers short columns', () => {
    const list = [c('a', 1), c('b', 1), c('c', 1), c('only', 2, ['b'])];
    const { pos } = computeLayout(list);
    expect(pos.get('only')!.y).toBe(ROW_Y0 + ROW_GAP);
  });

  it('is deterministic', () => {
    const a = computeLayout(concepts);
    const b = computeLayout(concepts);
    expect([...a.pos.entries()]).toEqual([...b.pos.entries()]);
  });

  it('reports a canvas size covering all nodes', () => {
    const { pos, width, height } = computeLayout(concepts);
    for (const p of pos.values()) {
      expect(p.x).toBeLessThan(width);
      expect(p.y).toBeLessThan(height);
    }
  });
});
