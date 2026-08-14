# AI Learning Tree design

Date: 2026-08-14
Status: approved (chat review)

## Goal

Turn the single-curriculum data-analyst tech tree into "AI Learning Tree", a multi-track learning app.
Tracks in this change: Data Analyst, DevOps, System Design.
Adding a future track must be a data-file-only change.

## Decisions (user-approved)

- UI: track switcher (tabs). Each track renders its own independent tree.
- Tracks: exactly three for now. No cross-track prerequisite edges.
- Migration: existing data-analyst progress and old v1 share links keep working.

## Data model

- `src/tracks/data-analyst.ts`, `src/tracks/devops.ts`, `src/tracks/system-design.ts` each export a `Concept[]`.
  Data-analyst concept ids stay exactly as today (migration depends on it).
- `src/data.ts` keeps the `Concept` interface and becomes the track registry:

```ts
export type TrackId = 'data-analyst' | 'devops' | 'system-design';

export interface Track {
  id: TrackId;
  title: string;        // tab label, e.g. "Data Analyst"
  tagline: string;      // one-line subtitle shown in the header
  tutorRole: string;    // e.g. "patient data-analysis tutor"
  tutorContext: string; // the worked-example setting used in the tutor prompt
  concepts: Concept[];
  byId: ReadonlyMap<string, Concept>;
}

export const tracks: Track[];
export const trackById: ReadonlyMap<TrackId, Track>;
```

- Track files use `import type { Concept } from '../data'` (type-only, no runtime cycle).
- Concept ids are unique within a track; `pre` resolves within the same track only.

## Curriculum requirements (DevOps, System Design)

Each new track must match the data-analyst quality bar:

- 32 to 38 concepts, 3 to 5 of them `bonus`.
- Kebab-case ids, unique within the track.
- Array is in topological and pedagogical order: every prerequisite appears earlier in the array.
  This is also the "next unfinished concept" default-selection order.
- 3 to 5 root concepts (`pre: []`); max hop depth 5 to 7; 3 to 8 concepts per depth so columns stay readable.
- 4 to 6 `cat` labels per track (hard max 8, palette limit).
- `desc`: one plain-language sentence.
- `task`: one concrete, self-contained, checkable hands-on exercise grounded in the track's running example (`tutorContext`).
- Titles short enough for a 204 px node (about 24 characters).

Running examples:

- Data analyst (existing): bank dataset, 4 tables joinable on DUMMY_ID.
- DevOps: a small Node.js web service the learner ships to production.
- System design: a growing photo-sharing web app.

## Persistence: localStorage v1 to v2

Same storage key. New payload:

```ts
interface StoredV2 {
  v: 2;
  track: TrackId;                    // last active track
  done: Partial<Record<TrackId, string[]>>;
}
```

- `loadProgress` accepts v1 (`{v:1, done}`) and migrates it to `{track: 'data-analyst', done: {'data-analyst': done}}`.
- Unknown track keys and unknown concept ids are dropped silently; anything else invalid resets to empty, as today.
- `saveProgress` always writes v2 and persists the active track.

## Share links: v1 to v2

- Encode: `{v: 2, t: TrackId, done: string[]}` under the same `#s=` prefix.
- Decode: v2 validated against the named track; v1 payloads decode as data-analyst.
  Invalid version, track, or shape returns `null`, as today.
- Shared view is locked to the shared link's track: track tabs are hidden while viewing.

## UI

- Header: "AI Learning Tree" brand plus the active track's tagline.
- Track tabs rendered each `update()`; active tab highlighted; hidden in shared view.
- Switching tracks resets query and selection (default selection for the new track), disarms confirms, and persists the active track.
- Category colors move from per-name CSS vars to an index palette:
  class `cat-c<i>` where `i` is the order of first appearance of the category in the track's concept list, palette vars `--cat-c0` to `--cat-c7`.
  Palette order is chosen so the data-analyst track renders in exactly today's colors.
- Layouts precomputed in `init` per track and bonus visibility (6 layouts), same pattern as today.
- `promptFor(concept, track)` uses `track.tutorRole` and `track.tutorContext` instead of the hardcoded dataset string.
- `index.html` title becomes "AI Learning Tree".

## Testing

- New `tracks.test.ts` validates every registered track: unique ids, prerequisites exist and appear earlier in the array, category count at most 8, non-empty title, desc, and task.
- `state.test.ts`: v2 round-trip, v1 migration, invalid payload and unknown-id dropping.
- `share.test.ts`: v2 round-trip with track, v1 decodes as data-analyst, invalid track rejected.
- `app.test.ts`: track switching resets selection and query, per-track done sets are independent, shared view locks the track.
- `ui.test.ts`: tabs render, active tab class, tabs hidden in shared view, prompt uses track context.

## Out of scope

- Repo rename and `BASE_PATH` change; deploy workflow untouched.
- Cross-track prerequisites, per-track routing beyond the share hash.
