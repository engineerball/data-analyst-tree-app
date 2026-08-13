import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { concepts } from './data';
import { COL_GAP, COL_X0, ROW_GAP, ROW_Y0, computeLayout } from './layout';

const c = (id: string, pre: string[] = []): Concept => ({ id, title: id, cat: 'T', desc: '', pre });

describe('computeLayout', () => {
  it('positions every concept', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id), k.id).toBeDefined();
  });

  it('x is determined by hop depth', () => {
    const { pos, depth } = computeLayout(concepts);
    for (const k of concepts) {
      expect(pos.get(k.id)!.x).toBe(COL_X0 + (depth.get(k.id)! - 1) * COL_GAP);
    }
  });

  it('labels hop columns', () => {
    const { columns } = computeLayout(concepts);
    expect(columns[0]!.label).toBe('1 HOP');
    expect(columns[1]!.label).toBe('2 HOPS');
    expect(columns).toHaveLength(5);
  });

  it('never overlaps nodes within a column', () => {
    const { pos, depth } = computeLayout(concepts);
    for (const d of new Set(depth.values())) {
      const ys = concepts.filter(k => depth.get(k.id) === d).map(k => pos.get(k.id)!.y);
      expect(new Set(ys).size).toBe(ys.length);
    }
  });

  it('orders children by prerequisite position (barycenter)', () => {
    const list = [c('a'), c('b'), c('childOfB', ['b']), c('childOfA', ['a'])];
    const { pos } = computeLayout(list);
    expect(pos.get('childOfA')!.y).toBeLessThan(pos.get('childOfB')!.y);
  });

  it('centers short columns', () => {
    const list = [c('a'), c('b'), c('c'), c('only', ['b'])];
    const { pos } = computeLayout(list);
    expect(pos.get('only')!.y).toBe(ROW_Y0 + ROW_GAP);
  });

  it('is deterministic', () => {
    const a = computeLayout(concepts);
    const b = computeLayout(concepts);
    expect([...a.pos.entries()]).toEqual([...b.pos.entries()]);
  });

  it('reports a canvas covering all nodes', () => {
    const { pos, width, height } = computeLayout(concepts);
    for (const p of pos.values()) {
      expect(p.x).toBeLessThan(width);
      expect(p.y).toBeLessThan(height);
    }
  });

  it('keeps non-bonus depths stable when bonus concepts are filtered out', () => {
    const all = computeLayout(concepts);
    const core = computeLayout(concepts.filter(k => !k.bonus));
    for (const k of concepts.filter(x => !x.bonus)) {
      expect(core.depth.get(k.id), k.id).toBe(all.depth.get(k.id));
    }
  });
});
