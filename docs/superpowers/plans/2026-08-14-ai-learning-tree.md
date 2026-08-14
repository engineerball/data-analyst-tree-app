# AI Learning Tree implementation plan

Spec: `docs/superpowers/specs/2026-08-14-ai-learning-tree-design.md`

## Phases

1. Curriculum content (parallel, delegated)
   - DevOps curriculum: deep-reasoner agent designs the 32-38 concept DAG per the spec schema.
   - System Design curriculum: Codex designs its DAG independently, same schema, no cross-pollination.
   - Orchestrator reviews both against the curriculum requirements before integration.
2. Core refactor (TDD, runs while phase 1 agents work)
   - Move current concepts to `src/tracks/data-analyst.ts`; turn `data.ts` into the track registry.
   - `state.ts`: v2 payload with per-track done sets and active track; v1 migration.
   - `share.ts`: v2 payload with track id; v1 decodes as data-analyst.
   - `app.ts` and `ui.ts`: track tabs, per-track layouts, track-aware prompt, index palette classes.
   - `style.css`: palette vars `--cat-c0..c7` ordered to keep data-analyst colors identical.
3. Integration
   - Wire both new curricula into the registry; `tracks.test.ts` validates every track.
   - Fix any curriculum rejects (bad prereqs, order, category overflow).
4. Verification
   - Full vitest run, `npm run build` (strict tsc), browser E2E pass over all three tracks,
     v1 localStorage and v1 share-link migration checks, pixel check on tabs and palette.

## Delegation map

| Work | Owner |
|---|---|
| DevOps curriculum | deep-reasoner |
| System Design curriculum | Codex |
| state/share versioning + migration | orchestrator |
| Mechanical ports, test boilerplate | fast-worker |
| Curriculum review, integration, E2E | orchestrator |
