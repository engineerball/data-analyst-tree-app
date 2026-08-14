# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev                       # Vite dev server
npm test                          # vitest run (all tests)
npm run test:watch                # vitest watch mode
npx vitest run src/graph.test.ts  # single test file
npx vitest run -t "pattern"       # tests matching a name pattern
npm run build                     # tsc type-check + vite build
npm run preview                   # serve the production build
```

There is no lint script; `tsc` (strict, `noUncheckedIndexedAccess`) is the only static check and runs as part of `npm run build`.

## What this is

A framework-free TypeScript + Vite single-page app: "AI Learning Tree", a dark tech-tree learning map with three tracks (Data Analyst, DevOps, System Design) switched by header tabs.
Live at https://engineerball.github.io/data-analyst-tree-app/, deployed by `.github/workflows/deploy.yml` on push to main (runs tests, then builds with `BASE_PATH=/data-analyst-tree-app/`).
Total source is ~1.6k lines in `src/`; tests are colocated `*.test.ts` files running under vitest with the happy-dom environment.

## Architecture

Data flows one way: `tracks/*.ts` (static curricula) → `data.ts` (track registry) → `graph.ts` (pure graph math) → `layout.ts` (pixel positions) → `ui.ts` (rendering) → `app.ts` (wiring/state) → `main.ts` (browser entry).

- `src/tracks/` — one curriculum file per track (`data-analyst.ts`, `devops.ts`, `system-design.ts`), each a flat `Concept[]` where each `Concept` has `pre: string[]` (prerequisite ids, resolved within the same track) and an optional `bonus` flag. These are the files to edit when adding or changing concepts.
- `data.ts` — the `Concept`/`Track` types and the track registry: each `Track` carries `title`, `tagline`, tutor framing (`tutorRole`, `tutorContext`), its concepts, and a `byId` map. Adding a track = adding a curriculum file and one `makeTrack` entry; `tracks.test.ts` validates every registered track (unique ids, prereqs defined earlier in the array, category/bonus/depth bounds).
- `graph.ts` — pure functions: `withPrereqs` (transitive prerequisite closure of a node) and `depthOf` (hop depth = longest prerequisite chain, cycle-safe).
- `layout.ts` — `computeLayout` maps depth → columns and orders rows by the mean y of prerequisites (barycenter) to reduce edge crossings. All geometry is fixed pixel constants (`NODE_W`, `COL_GAP`, etc.) exported for use by `ui.ts` and tests.
- `state.ts` — localStorage persistence as a versioned payload `{v: 2, track, done: {trackId: string[]}}` (per-track done-sets plus the active track). v1 payloads (`{v: 1, done}`) migrate on load as data-analyst progress. `StorageLike` is the seam that lets tests inject a fake storage.
- `share.ts` — encodes one track's done-set into a URL fragment `#s=<base64url JSON>` as `{v: 2, t: trackId, done}`. v1 share links decode as data-analyst. Decoding validates ids against the named track and returns `null` on anything invalid.
- `ui.ts` — `mountApp` builds the static shell once; `update()` re-renders banner, graph (SVG bezier edges + absolutely positioned node buttons via `innerHTML`), and detail panel from scratch on every state change. Also home to `AppState`, `Handlers`, and the tutor-prompt builder `promptFor`.
- `app.ts` — `init(root, storage, hash, shareBase)` owns all mutable state and the `Handlers` implementations. Everything is injected, so the whole app is exercised in tests (`app.test.ts`) without a real browser.
- `main.ts` — the only file that touches real browser globals: wraps localStorage in a fallback (`safeStorage`), passes `location` pieces to `init`, and reloads on `hashchange`.

## Conventions and invariants

- No framework and no runtime dependencies; rendering is string templates + `innerHTML` + re-attached listeners, re-run wholesale on each `update()`.
- Two view modes: normal, and read-only "shared view" when the URL fragment decodes (`state.shared` non-null). Shared view locks to the shared link's track and hides the track tabs. `effectiveDone` picks the shared set over local progress; mutating handlers guard on `state.shared`.
- Destructive actions (import shared progress, reset progress) use a two-click confirm: first click arms `state.confirmArm`, auto-disarmed after 4 seconds; second click executes.
- Layouts are precomputed in `init` per track and bonus visibility (two per track) and switched by the track tabs and bonus toggle rather than recomputed.
- Node category colors come from an 8-slot palette (`--cat-c0..c7`), assigned per track by order of first category appearance in the concept list; a track therefore supports at most 8 categories.
- All external input (localStorage payload, share fragment) is treated as untrusted: version-checked, id-validated, and dropped silently on mismatch.
- All user-visible strings pass through `esc()` in `ui.ts` before interpolation into HTML.

## Superpowers workflow docs

`docs/superpowers/plans/` and `docs/superpowers/specs/` hold implementation plans and specs from prior feature work; consult them for design rationale before reworking those features.
