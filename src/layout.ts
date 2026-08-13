import type { Concept } from './data';
import { depthOf } from './graph';

export interface Point {
  x: number;
  y: number;
}

export interface Column {
  depth: number;
  x: number;
  label: string;
}

export interface Layout {
  pos: ReadonlyMap<string, Point>;
  depth: ReadonlyMap<string, number>;
  columns: Column[];
  width: number;
  height: number;
}

export const NODE_W = 204;
export const NODE_H = 58;
export const COL_X0 = 36;
export const COL_GAP = 280;
export const ROW_Y0 = 96;
export const ROW_GAP = 76;
const PAD_RIGHT = 40;
const PAD_BOTTOM = 48;

export function computeLayout(list: Concept[]): Layout {
  const byId: ReadonlyMap<string, Concept> = new Map(list.map(c => [c.id, c]));
  const depth = depthOf(byId);
  const depths = [...new Set(depth.values())].sort((a, b) => a - b);
  const colOf = new Map(depths.map((d, i) => [d, i]));
  const maxRows = Math.max(0, ...depths.map(d => list.filter(c => depth.get(c.id) === d).length));
  const pos = new Map<string, Point>();

  for (const d of depths) {
    const col = list.filter(c => depth.get(c.id) === d);
    const keyed = col.map((c, i) => {
      const ys = c.pre
        .map(p => pos.get(p)?.y)
        .filter((y): y is number => y !== undefined);
      const key = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : ROW_Y0 + i * ROW_GAP;
      return { c, i, key };
    });
    keyed.sort((a, b) => a.key - b.key || a.i - b.i);
    const offset = ((maxRows - col.length) * ROW_GAP) / 2;
    keyed.forEach(({ c }, row) => {
      pos.set(c.id, {
        x: COL_X0 + colOf.get(d)! * COL_GAP,
        y: ROW_Y0 + offset + row * ROW_GAP,
      });
    });
  }

  return {
    pos,
    depth,
    columns: depths.map(d => ({
      depth: d,
      x: COL_X0 + colOf.get(d)! * COL_GAP,
      label: d === 1 ? '1 HOP' : `${d} HOPS`,
    })),
    width: COL_X0 + Math.max(0, depths.length - 1) * COL_GAP + NODE_W + PAD_RIGHT,
    height: ROW_Y0 + Math.max(0, maxRows - 1) * ROW_GAP + NODE_H + PAD_BOTTOM,
  };
}
