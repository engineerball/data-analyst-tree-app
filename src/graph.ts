import type { Concept } from './data';

export function withPrereqs(id: string, byId: ReadonlyMap<string, Concept>): Set<string> {
  const acc = new Set<string>();
  const visit = (cur: string): void => {
    if (acc.has(cur) || !byId.has(cur)) return;
    acc.add(cur);
    for (const p of byId.get(cur)!.pre) visit(p);
  };
  visit(id);
  return acc;
}

export function depthOf(byId: ReadonlyMap<string, Concept>): Map<string, number> {
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const c = byId.get(id);
    if (!c || visiting.has(id)) return 0;
    visiting.add(id);
    const d = 1 + c.pre.reduce((m, p) => Math.max(m, visit(p)), 0);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of byId.keys()) visit(id);
  return depth;
}
