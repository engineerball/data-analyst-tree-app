# Spec: Learner-Owned Progress Machinery

Decisions resolved in grill session on 2026-08-13.

## Product decisions

- Audience: one learner coached by TK.
  The copy-to-LLM tutor prompt flow is their core workflow and stays unchanged.
- This round ships machinery only.
  The 12-concept curriculum is untouched.
- Progress model: binary done-set per concept, toggled by the learner in the panel, persisted in localStorage under a versioned schema.
- Coach visibility: share-link only, no backend.
  The learner copies a URL whose fragment encodes their done-set and sends it to the coach.
- Share-link semantics: opening a share-link shows a read-only "Viewing shared progress" banner.
  Local progress is never clobbered.
  Explicit two-step import replaces local progress; exit returns to own state.
- Search dims non-matches instead of removing them.
  Graph structure (all nodes and all edges) never disappears.
  The selected node is never dimmed.
- Reset button clears search and selection only.
  Progress reset is a separate control behind a two-step confirm.
- Default selection: first not-done concept in data order.

## Technical decisions

- Architecture: Vite + TypeScript, no framework.
  Modules: data, graph, layout, share, state, ui, app, main.
  Vitest (happy-dom) covers logic and rendering.
- Layout is computed: column = tier, row order = barycenter of prerequisite positions, short columns vertically centered.
  Hand-authored x/y coordinates are removed from data forever.
- Hosting: GitHub Pages deployed by GitHub Actions on push to main.
  Repo `engineerball/data-analyst-tree-app` is public; Pages gets enabled with build_type=workflow.
- Share payload: `#s=` + base64url of `{"v":1,"done":[...]}`.
  Unknown ids are dropped on decode; malformed payloads fall back to normal mode.
- The hardcoded `done:true` flags in the old data are dropped.
  Progress starts empty and is learner-owned.
