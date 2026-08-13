import type { Concept } from './data';

export const STORAGE_KEY = 'concept-tree-progress';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Stored {
  v: 1;
  done: string[];
}

export function loadDone(storage: StorageLike, validIds: ReadonlySet<string>): Set<string> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || !Array.isArray(parsed.done)) return new Set();
    return new Set(parsed.done.filter((d): d is string => typeof d === 'string' && validIds.has(d)));
  } catch {
    return new Set();
  }
}

export function saveDone(storage: StorageLike, done: ReadonlySet<string>): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, done: [...done].sort() }));
}

export function defaultSelection(list: Concept[], done: ReadonlySet<string>): string {
  return (list.find(c => !done.has(c.id)) ?? list[0]!).id;
}
