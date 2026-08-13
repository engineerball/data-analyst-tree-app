# Spec: DA Concept Tech Tree Redesign

Source of truth: TK's design mock (dark tech-tree screenshot, 2026-08-13).
Builds on the shipped progress machinery (spec 2026-08-13-progress-machinery.md); all of it survives unless contradicted here.

## Visual and structural requirements (from mock)

- Full dark theme: near-black navy background, dark cards, light mono headings.
- Header: title "DA CONCEPT TECH TREE", subtitle "Click a node → its full prerequisite path lights up. That path is what you're verifying."
- Top-right: checkbox "show bonus tier (L3)", checked by default.
- Columns are computed hop depth (1 + longest prerequisite chain), labeled "1 HOP", "2 HOPS", ... with dashed underline.
  Authored tier is removed from data; the panel's "TIER N" equals the computed depth.
- Node card: title + category line, category text colored per category
  (Foundations amber, Wrangling green, Tables blue, Process grey, Analysis orange, "Viz · build" red-orange).
- Bonus concepts: dashed border, "· bonus" suffix in the category line, hidden when the toggle is off.
  Bonus concepts are never prerequisites of non-bonus concepts, so hiding them never breaks a path.
- Selecting a node lights its full prerequisite closure (amber borders, amber bezier edges) and dims everything else heavily.
  This replaces the old "everything full brightness" default.
- Edges are smooth cubic bezier curves; non-path edges are near-invisible.
- Panel: kicker "CATEGORY · TIER N", title, desc, "NEEDS FIRST" as a plain "A · B" text line,
  label "TUTOR PROMPT (COPY → PASTE INTO COPILOT)", prompt box, amber "Copy prompt" button.
- New tutor prompt template (learner uses Copilot; their real training dataset is baked in):
  "You are my patient data-analysis tutor. Teach me one concept: {title} - {desc} Explain it in plain language, then show a small worked example using this bank dataset: 4 tables - customer info (birth date, gender, marital status, salary, career), product holdings, deposit accounts, and monthly average balances - all joinable on DUMMY_ID. {task} Finish with one small exercise for me on this concept, wait for my answer, then check it."
  {task} is an optional per-concept worked-example instruction (mock example for Change over time: "Find which month had the biggest jump in average balance.").

## Curriculum

- Expanded to the mock's ~34 concepts across 5 hop columns (designed by deep-reasoner from the mock's visible columns, edges, and panel).
- Existing 11 surviving ids are reused verbatim so learner localStorage progress carries over; "trend" is dropped (unknown-id filtering handles it).
- Every concept's computed depth must land in the mock's column.

## Preserved machinery (restyled, not removed)

- Learner done-set in localStorage, Mark done / Completed, share-link view mode with two-step import, reset-view and two-step reset-progress, search.
- Search interaction: while a query is active, dim non-matches (overrides the path-dim rule); selected node never dims.
- Bonus toggle with a hidden-but-selected bonus concept reselects the default concept.

## Rulings (lead decisions on mock ambiguities)

- Em dashes in the mock's copy are rendered as plain dashes (TK's global no-em-dash rule outranks mock typography).
- Search/Share/Reset controls stay in the topbar even though the mock omits them; the mock is a comp of tree + panel, not a feature-removal order. Cost if wrong: hide them later, cosmetic.
- "L3" in the toggle label is kept verbatim as copy; internally bonus is a boolean flag.
- Tier = computed hop depth (single source of truth, no authored tier to drift).
- Path summary and Reset all progress stay at the bottom of the panel (mock crops below the Copy prompt button).
- Node meta shows category only (no tier text), matching the mock.
