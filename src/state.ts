import type { Concept, Track, TrackId } from './data';

export const STORAGE_KEY = 'concept-tree-progress';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Progress {
  track: TrackId;
  done: Map<TrackId, Set<string>>;
}

interface StoredV1 {
  v: 1;
  done: string[];
}

interface StoredV2 {
  v: 2;
  track: TrackId;
  done: Partial<Record<TrackId, string[]>>;
}

function validDone(raw: unknown, track: Track): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((d): d is string => typeof d === 'string' && track.byId.has(d)));
}

export function loadProgress(storage: StorageLike, tracks: readonly Track[]): Progress {
  const fallback: TrackId = tracks[0]!.id;
  const empty: Progress = { track: fallback, done: new Map() };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StoredV1 | StoredV2> | null;
    if (!parsed || typeof parsed !== 'object') return empty;
    if (parsed.v === 1) {
      const da = tracks.find(t => t.id === 'data-analyst');
      if (!da) return empty;
      const done = validDone((parsed as Partial<StoredV1>).done, da);
      return { track: fallback, done: done.size ? new Map([[da.id, done]]) : new Map() };
    }
    if (parsed.v === 2) {
      const v2 = parsed as Partial<StoredV2>;
      const done = new Map<TrackId, Set<string>>();
      if (v2.done && typeof v2.done === 'object' && !Array.isArray(v2.done)) {
        for (const track of tracks) {
          const ids = validDone((v2.done as Record<string, unknown>)[track.id], track);
          if (ids.size) done.set(track.id, ids);
        }
      }
      const track = tracks.find(t => t.id === v2.track)?.id ?? fallback;
      return { track, done };
    }
    return empty;
  } catch {
    return empty;
  }
}

export function saveProgress(storage: StorageLike, progress: Progress): void {
  const done: Partial<Record<TrackId, string[]>> = {};
  for (const [track, ids] of progress.done) {
    if (ids.size) done[track] = [...ids].sort();
  }
  const payload: StoredV2 = { v: 2, track: progress.track, done };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function defaultSelection(list: Concept[], done: ReadonlySet<string>): string {
  return (list.find(c => !done.has(c.id)) ?? list[0]!).id;
}
