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
