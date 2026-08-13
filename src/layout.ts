import type { Concept } from './data';

export interface Point {
  x: number;
  y: number;
}

export interface Layout {
  pos: ReadonlyMap<string, Point>;
  width: number;
  height: number;
  tiers: number[];
}

export const NODE_W = 150;
export const NODE_H = 72;
export const COL_X0 = 45;
export const COL_GAP = 235;
export const ROW_Y0 = 105;
export const ROW_GAP = 155;
const PAD_RIGHT = 36;
const PAD_BOTTOM = 54;

export function computeLayout(list: Concept[]): Layout {
  const tiers = [...new Set(list.map(c => c.tier))].sort((a, b) => a - b);
  const colOf = new Map(tiers.map((t, i) => [t, i]));
  const maxRows = Math.max(0, ...tiers.map(t => list.filter(c => c.tier === t).length));
  const pos = new Map<string, Point>();

  for (const t of tiers) {
    const col = list.filter(c => c.tier === t);
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
        x: COL_X0 + colOf.get(t)! * COL_GAP,
        y: ROW_Y0 + offset + row * ROW_GAP,
      });
    });
  }

  return {
    pos,
    width: COL_X0 + Math.max(0, tiers.length - 1) * COL_GAP + NODE_W + PAD_RIGHT,
    height: ROW_Y0 + Math.max(0, maxRows - 1) * ROW_GAP + NODE_H + PAD_BOTTOM,
    tiers,
  };
}
