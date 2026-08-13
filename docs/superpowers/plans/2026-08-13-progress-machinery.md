# Learner-Owned Progress Machinery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the concept-tree MVP as a Vite + TypeScript app with learner-owned persisted progress, a no-backend share-link for coach review, computed graph layout, and GitHub Pages deployment.

**Architecture:** Pure static SPA, no framework. Small modules with one responsibility each (data, graph closure, layout, share codec, storage, DOM rendering, wiring). State is a plain mutated object; every change triggers a cheap full re-render of the dynamic regions (graph, panel, banner) while the shell (topbar, search input) mounts once.

**Tech Stack:** Vite, TypeScript (strict), Vitest with happy-dom, GitHub Actions + GitHub Pages.

**Spec:** docs/superpowers/specs/2026-08-13-progress-machinery.md

## Global Constraints

- No runtime dependencies. devDependencies only: `vite`, `typescript`, `vitest`, `happy-dom`, `@types/node`.
- TypeScript strict mode plus `noUncheckedIndexedAccess`.
- No em dash anywhere in code, copy, or commits. Plain dash only. (The `→` arrow in path summary and `·` in labels are fine; they are not dashes.)
- Commit messages: Conventional Commits, no co-author trailers of any kind.
- localStorage key: `concept-tree-progress`. Share fragment prefix: `#s=`.
- Node 24 locally; workflow uses Node 22 LTS.
- All test commands run non-interactive: `npx vitest run`.
- The 12 concepts keep exactly the ids, titles, tiers, cats, descs, and pre arrays listed in Task 2. Curriculum content must not change.

## File Structure

```
index.html                  Vite entry shell (replaces old single-file app)
package.json                scripts: dev/build/preview/test
tsconfig.json               strict TS config
vite.config.ts              base path from BASE_PATH env, vitest happy-dom
.gitignore                  node_modules, dist
.github/workflows/deploy.yml  test + build + deploy Pages on push to main
src/main.ts                 browser bootstrap only (globals live here)
src/app.ts                  init(): state + handlers wiring, testable
src/data.ts                 Concept type + curriculum array + conceptById
src/graph.ts                withPrereqs() transitive closure
src/layout.ts               computeLayout(): tier columns, barycenter rows
src/share.ts                encodeShareHash()/decodeShareHash()
src/state.ts                loadDone()/saveDone()/defaultSelection()
src/ui.ts                   mountApp() DOM rendering, promptFor, matchesQuery
src/style.css               ported styles + banner/dim/danger additions
src/*.test.ts               colocated Vitest suites
README.md                   live URL + dev commands (Task 9)
```

---

### Task 1: Scaffold Vite + TypeScript + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`
- Replace: `index.html` (the old single-file app stays in git history; the app is intentionally broken until Task 8 wires it back up)
- Create: `src/main.ts` (stub), `src/style.css`

**Interfaces:**
- Produces: working `npm run build` and `npm test` commands every later task relies on. CSS class contract used by Task 7: `.app .topbar .brand .top-actions .search .btn .btn.primary .btn.small .btn.danger .layout .workspace .toolbar .legend .dot .graph-wrap .graph .tier-label .edges .edge .edge.active .edge.future .edge.dim .node .node.active .node.path .node.done .node.dim .node-title .node-meta .panel .panel-kicker .chips .chip .section .prereqs .prereq .prompt .status .empty .banner .banner-actions`.

- [ ] **Step 1: Install toolchain**

```bash
cd /Users/tk/Projects/tk/data-analyst-tree-app
npm init -y
npm i -D vite typescript vitest happy-dom @types/node
```

- [ ] **Step 2: Write package.json fields**

Edit `package.json` so it contains exactly these fields (keep the devDependencies npm wrote):

```json
{
  "name": "data-analyst-tree-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Write vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  test: { environment: 'happy-dom' },
});
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 6: Replace index.html with the Vite entry**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Data Analysis Concept Tree</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Write src/main.ts stub**

```ts
import './style.css';

document.querySelector('#app')!.textContent = 'Loading...';
```

- [ ] **Step 8: Write src/style.css**

Ported from the old inline styles, un-minified, plus `.banner`, `.banner-actions`, `.btn.small`, `.btn.danger`, `.node.dim`, `.edge.dim`, and a third grid row for the banner:

```css
:root {
  --bg: #f6f7fb;
  --panel: #fff;
  --ink: #172033;
  --muted: #68738a;
  --line: #dfe5ef;
  --accent: #f5b82e;
  --accent-dark: #b77600;
  --blue: #4776e6;
  --green: #2aa876;
  --shadow: 0 14px 40px rgba(28, 43, 75, 0.09);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button, input { font: inherit; }

.app { min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; }

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 28px;
  background: #fff7e0;
  border-bottom: 1px solid #eeda9e;
  font-weight: 650;
}

.banner-actions { display: flex; gap: 8px; }

.topbar {
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: 20px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand h1 { font-size: 21px; margin: 0 0 3px; letter-spacing: -0.02em; }
.brand p { margin: 0; color: var(--muted); }

.top-actions { display: flex; align-items: center; gap: 10px; }

.search {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  width: 230px;
  outline: none;
}
.search:focus { border-color: var(--blue); box-shadow: 0 0 0 3px #4776e622; }

.btn {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 9px;
  padding: 10px 13px;
  cursor: pointer;
  font-weight: 650;
}
.btn:hover { border-color: #b9c5d8; background: #f9fbff; }
.btn.primary { background: var(--ink); border-color: var(--ink); color: #fff; }
.btn.small { padding: 6px 10px; font-size: 12px; }
.btn.danger { border-color: #d24b4b; color: #b02a2a; background: #fff5f5; }
.btn.danger:hover { border-color: #b02a2a; background: #ffecec; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 390px; min-height: 0; }

.workspace { padding: 24px 28px; min-width: 0; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}
.toolbar h2 { font-size: 16px; margin: 0; }

.legend { display: flex; gap: 12px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
.legend span { display: flex; align-items: center; gap: 5px; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

.graph-wrap {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: auto;
  min-height: 560px;
}

.graph { position: relative; }

.tier-label {
  position: absolute;
  top: 16px;
  color: #a0a9b8;
  font-weight: 750;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

.edge {
  stroke: #cbd4e3;
  stroke-width: 2;
  fill: none;
  transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
}
.edge.active { stroke: var(--accent-dark); stroke-width: 4; }
.edge.future { stroke: #e8c66f; stroke-dasharray: 6 5; }
.edge.dim { opacity: 0.18; }

.node {
  position: absolute;
  width: 150px;
  min-height: 72px;
  background: #fff;
  border: 1.5px solid #d7dfeb;
  border-radius: 12px;
  padding: 11px 12px;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(40, 56, 88, 0.06);
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s, opacity 0.2s;
  z-index: 2;
  text-align: left;
}
.node:hover { transform: translateY(-2px); border-color: #9cb5ee; }
.node.active {
  border-color: var(--accent-dark);
  box-shadow: 0 0 0 4px #f5b82e33, 0 8px 18px rgba(40, 56, 88, 0.12);
}
.node.path { border-color: #e1b13d; background: #fffaf0; }
.node.done { border-color: #84ccb0; }
.node.dim { opacity: 0.22; }

.node-title { font-weight: 750; font-size: 13px; }
.node-meta { color: var(--muted); font-size: 11px; margin-top: 5px; }

.panel { background: #fff; border-left: 1px solid var(--line); padding: 26px 24px; overflow: auto; }

.panel-kicker {
  color: var(--blue);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.panel h2 { font-size: 25px; line-height: 1.1; margin: 7px 0 9px; }
.panel p { color: var(--muted); margin: 0 0 20px; }

.chips { display: flex; gap: 7px; flex-wrap: wrap; margin: 10px 0 22px; }
.chip {
  background: #eef3ff;
  color: #3558ad;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
}

.section { border-top: 1px solid var(--line); padding: 18px 0; }
.section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; }

.prereqs { display: flex; flex-wrap: wrap; gap: 7px; }
.prereq {
  border: 1px solid #e7d08d;
  background: #fffaf0;
  border-radius: 7px;
  padding: 7px 9px;
  font-size: 12px;
}

.prompt {
  background: #f7f9fd;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  color: #39465d;
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
}

.panel .btn { width: 100%; margin-top: 10px; }

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--green);
  font-size: 12px;
  font-weight: 750;
}
.status::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

.empty { padding: 50px; text-align: center; color: var(--muted); }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .panel { border-left: 0; border-top: 1px solid var(--line); }
  .topbar { align-items: flex-start; flex-direction: column; }
  .top-actions { width: 100%; flex-wrap: wrap; }
  .search { flex: 1; width: auto; }
  .banner { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 9: Verify build and test commands**

Run: `npm run build`
Expected: tsc passes, vite build emits `dist/`.

Run: `npx vitest run --passWithNoTests`
Expected: passes with no tests found.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore index.html src docs
git commit -m "chore: scaffold Vite + TypeScript + Vitest"
```

---

### Task 2: Curriculum data module

**Files:**
- Create: `src/data.ts`
- Test: `src/data.test.ts`

**Interfaces:**
- Produces: `interface Concept { id: string; title: string; tier: number; cat: string; desc: string; pre: string[] }`, `const concepts: Concept[]`, `const conceptById: ReadonlyMap<string, Concept>`.
- Note: no x/y and no done fields. Layout is computed (Task 4); progress is state (Task 6).

- [ ] **Step 1: Write the failing test `src/data.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';

describe('curriculum integrity', () => {
  it('has 12 concepts with unique ids', () => {
    expect(concepts).toHaveLength(12);
    expect(new Set(concepts.map(c => c.id)).size).toBe(concepts.length);
  });

  it('every prerequisite exists', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.has(p), `${c.id} -> ${p}`).toBe(true);
      }
    }
  });

  it('prerequisites never come from a later tier', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.get(p)!.tier).toBeLessThanOrEqual(c.tier);
      }
    }
  });

  it('no concept requires itself', () => {
    for (const c of concepts) {
      expect(c.pre).not.toContain(c.id);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data.test.ts`
Expected: FAIL, cannot resolve `./data`.

- [ ] **Step 3: Write `src/data.ts`**

```ts
export interface Concept {
  id: string;
  title: string;
  tier: number;
  cat: string;
  desc: string;
  pre: string[];
}

export const concepts: Concept[] = [
  { id: 'types', title: 'Data types', tier: 1, cat: 'Foundations', desc: 'Recognize numbers, text, dates, booleans, and categorical values.', pre: [] },
  { id: 'missing', title: 'Missing values', tier: 1, cat: 'Foundations', desc: 'Identify blanks and understand how they affect analysis.', pre: [] },
  { id: 'unique', title: 'Unique values', tier: 1, cat: 'Foundations', desc: 'Inspect distinct values to spot categories, labels, and anomalies.', pre: [] },
  { id: 'convert', title: 'Convert types', tier: 2, cat: 'Cleaning', desc: 'Convert fields into types that support reliable calculations.', pre: ['types'] },
  { id: 'handle-missing', title: 'Handle missing data', tier: 2, cat: 'Cleaning', desc: 'Choose whether to remove, fill, or flag missing observations.', pre: ['missing'] },
  { id: 'dedupe', title: 'Deduplicate', tier: 2, cat: 'Cleaning', desc: 'Find repeated records before counting or aggregating data.', pre: ['unique'] },
  { id: 'aggregate', title: 'Aggregate', tier: 3, cat: 'Operations', desc: 'Summarize rows using totals, averages, counts, or other measures.', pre: ['convert', 'handle-missing'] },
  { id: 'join', title: 'Join tables', tier: 3, cat: 'Operations', desc: 'Combine related tables through a shared key.', pre: ['unique', 'dedupe'] },
  { id: 'group', title: 'Group by', tier: 3, cat: 'Operations', desc: 'Split data into meaningful groups before calculating summaries.', pre: ['aggregate', 'join'] },
  { id: 'change', title: 'Change over time', tier: 4, cat: 'Analysis', desc: 'Compare how a metric changes across time periods, such as month-over-month, year-over-year, or growth percentage.', pre: ['group', 'convert'] },
  { id: 'correlation', title: 'Correlation', tier: 4, cat: 'Analysis', desc: 'Measure whether two variables move together and how strongly.', pre: ['aggregate', 'group'] },
  { id: 'trend', title: 'Trend story', tier: 5, cat: 'Insight', desc: 'Turn time-based analysis into a clear explanation of what changed and why.', pre: ['change', 'correlation'] },
];

export const conceptById: ReadonlyMap<string, Concept> = new Map(concepts.map(c => [c.id, c]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/data.test.ts
git commit -m "feat: extract curriculum data with integrity tests"
```

---

### Task 3: Prerequisite closure helper

**Files:**
- Create: `src/graph.ts`
- Test: `src/graph.test.ts`

**Interfaces:**
- Consumes: `Concept`, `conceptById` from Task 2.
- Produces: `function withPrereqs(id: string, byId: ReadonlyMap<string, Concept>): Set<string>` returning the id plus all transitive prerequisites; cycle-safe; unknown id returns empty set.

- [ ] **Step 1: Write the failing test `src/graph.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { conceptById } from './data';
import { withPrereqs } from './graph';

const g = (defs: Record<string, string[]>): ReadonlyMap<string, Concept> =>
  new Map(
    Object.entries(defs).map(([id, pre]) => [id, { id, title: id, tier: 1, cat: '', desc: '', pre }]),
  );

describe('withPrereqs', () => {
  it('includes the concept itself and all transitive prerequisites', () => {
    expect(withPrereqs('change', conceptById)).toEqual(
      new Set(['change', 'group', 'convert', 'aggregate', 'join', 'handle-missing', 'missing', 'types', 'unique', 'dedupe']),
    );
  });

  it('returns only the concept for roots', () => {
    expect(withPrereqs('types', conceptById)).toEqual(new Set(['types']));
  });

  it('ignores unknown ids', () => {
    expect(withPrereqs('nope', conceptById)).toEqual(new Set());
  });

  it('terminates on cycles', () => {
    expect(withPrereqs('a', g({ a: ['b'], b: ['a'] }))).toEqual(new Set(['a', 'b']));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph.test.ts`
Expected: FAIL, cannot resolve `./graph`.

- [ ] **Step 3: Write `src/graph.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph.ts src/graph.test.ts
git commit -m "feat: add prerequisite closure helper"
```

---

### Task 4: Computed layout

**Files:**
- Create: `src/layout.ts`
- Test: `src/layout.test.ts`

**Interfaces:**
- Consumes: `Concept` from Task 2.
- Produces:
  - `interface Point { x: number; y: number }`
  - `interface Layout { pos: ReadonlyMap<string, Point>; width: number; height: number; tiers: number[] }`
  - `function computeLayout(list: Concept[]): Layout`
  - constants `NODE_W = 150`, `NODE_H = 72`, `COL_X0 = 45`, `COL_GAP = 235`, `ROW_Y0 = 105`, `ROW_GAP = 155`.
- Algorithm: columns are distinct tiers in ascending order. Within a column, sort by barycenter key = mean y of already-placed prerequisites; nodes with no placed prerequisites use `ROW_Y0 + dataIndex * ROW_GAP` as key; ties break by data order. Columns shorter than the tallest are vertically centered by offsetting `(maxRows - colRows) * ROW_GAP / 2`.

- [ ] **Step 1: Write the failing test `src/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { concepts } from './data';
import { COL_GAP, COL_X0, ROW_GAP, ROW_Y0, computeLayout } from './layout';

const c = (id: string, tier: number, pre: string[] = []): Concept =>
  ({ id, title: id, tier, cat: 'T', desc: '', pre });

describe('computeLayout', () => {
  it('positions every concept', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id), k.id).toBeDefined();
  });

  it('x depends only on tier', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id)!.x).toBe(COL_X0 + (k.tier - 1) * COL_GAP);
  });

  it('never overlaps nodes within a tier', () => {
    const { pos } = computeLayout(concepts);
    for (const t of new Set(concepts.map(k => k.tier))) {
      const ys = concepts.filter(k => k.tier === t).map(k => pos.get(k.id)!.y);
      expect(new Set(ys).size).toBe(ys.length);
    }
  });

  it('orders children by prerequisite position (barycenter)', () => {
    const list = [c('a', 1), c('b', 1), c('childOfB', 2, ['b']), c('childOfA', 2, ['a'])];
    const { pos } = computeLayout(list);
    expect(pos.get('childOfA')!.y).toBeLessThan(pos.get('childOfB')!.y);
  });

  it('centers short columns', () => {
    const list = [c('a', 1), c('b', 1), c('c', 1), c('only', 2, ['b'])];
    const { pos } = computeLayout(list);
    expect(pos.get('only')!.y).toBe(ROW_Y0 + ROW_GAP);
  });

  it('is deterministic', () => {
    const a = computeLayout(concepts);
    const b = computeLayout(concepts);
    expect([...a.pos.entries()]).toEqual([...b.pos.entries()]);
  });

  it('reports a canvas size covering all nodes', () => {
    const { pos, width, height } = computeLayout(concepts);
    for (const p of pos.values()) {
      expect(p.x).toBeLessThan(width);
      expect(p.y).toBeLessThan(height);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/layout.test.ts`
Expected: FAIL, cannot resolve `./layout`.

- [ ] **Step 3: Write `src/layout.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/layout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/layout.ts src/layout.test.ts
git commit -m "feat: compute graph layout from tiers and prerequisites"
```

---

### Task 5: Share-link codec

**Files:**
- Create: `src/share.ts`
- Test: `src/share.test.ts`

**Interfaces:**
- Produces:
  - `function encodeShareHash(done: ReadonlySet<string>): string` returning `#s=<base64url of {"v":1,"done":[...sorted]}>`
  - `function decodeShareHash(hash: string, validIds: ReadonlySet<string>): Set<string> | null` returning null for anything that is not a valid v1 payload; unknown ids silently dropped.

- [ ] **Step 1: Write the failing test `src/share.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { decodeShareHash, encodeShareHash } from './share';

const ids: ReadonlySet<string> = new Set(['a', 'b', 'c']);

describe('share codec', () => {
  it('round-trips a done set', () => {
    const hash = encodeShareHash(new Set(['b', 'a']));
    expect(decodeShareHash(hash, ids)).toEqual(new Set(['a', 'b']));
  });

  it('round-trips the empty set', () => {
    expect(decodeShareHash(encodeShareHash(new Set()), ids)).toEqual(new Set());
  });

  it('produces a URL-fragment-safe string', () => {
    expect(encodeShareHash(new Set(['a', 'b', 'c']))).toMatch(/^#s=[A-Za-z0-9_-]+$/);
  });

  it('drops ids not in the curriculum', () => {
    const hash = encodeShareHash(new Set(['a', 'zombie']));
    expect(decodeShareHash(hash, ids)).toEqual(new Set(['a']));
  });

  it('rejects other hashes', () => {
    expect(decodeShareHash('', ids)).toBeNull();
    expect(decodeShareHash('#other', ids)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(decodeShareHash('#s=!!!not-base64!!!', ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('{"v":2,"done":[]}'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('{"v":1,"done":"x"}'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('[1,2,3]'), ids)).toBeNull();
    expect(decodeShareHash('#s=' + btoa('null'), ids)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/share.test.ts`
Expected: FAIL, cannot resolve `./share`.

- [ ] **Step 3: Write `src/share.ts`**

```ts
const PREFIX = '#s=';

interface SharePayload {
  v: 1;
  done: string[];
}

export function encodeShareHash(done: ReadonlySet<string>): string {
  const payload: SharePayload = { v: 1, done: [...done].sort() };
  return PREFIX + base64UrlEncode(JSON.stringify(payload));
}

export function decodeShareHash(hash: string, validIds: ReadonlySet<string>): Set<string> | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(hash.slice(PREFIX.length))) as Partial<SharePayload> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || !Array.isArray(parsed.done)) return null;
    return new Set(parsed.done.filter((d): d is string => typeof d === 'string' && validIds.has(d)));
  } catch {
    return null;
  }
}

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/share.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/share.ts src/share.test.ts
git commit -m "feat: add no-backend share-link codec"
```

---

### Task 6: Progress persistence

**Files:**
- Create: `src/state.ts`
- Test: `src/state.test.ts`

**Interfaces:**
- Consumes: `Concept`, `concepts` from Task 2.
- Produces:
  - `const STORAGE_KEY = 'concept-tree-progress'`
  - `interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `function loadDone(storage: StorageLike, validIds: ReadonlySet<string>): Set<string>` (corrupt or wrong-schema data loads as empty set; unknown ids filtered)
  - `function saveDone(storage: StorageLike, done: ReadonlySet<string>): void` (stores `{"v":1,"done":[...sorted]}`)
  - `function defaultSelection(list: Concept[], done: ReadonlySet<string>): string` (first not-done in data order, else first concept).

- [ ] **Step 1: Write the failing test `src/state.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { concepts } from './data';
import { STORAGE_KEY, defaultSelection, loadDone, saveDone, type StorageLike } from './state';

function mem(initial?: string): StorageLike {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const ids: ReadonlySet<string> = new Set(concepts.map(c => c.id));

describe('progress storage', () => {
  it('round-trips', () => {
    const s = mem();
    saveDone(s, new Set(['types', 'convert']));
    expect(loadDone(s, ids)).toEqual(new Set(['types', 'convert']));
  });

  it('empty storage loads an empty set', () => {
    expect(loadDone(mem(), ids)).toEqual(new Set());
  });

  it('corrupt JSON loads an empty set', () => {
    expect(loadDone(mem('{nope'), ids)).toEqual(new Set());
  });

  it('wrong schema version loads an empty set', () => {
    expect(loadDone(mem('{"v":9,"done":["types"]}'), ids)).toEqual(new Set());
  });

  it('filters unknown ids', () => {
    expect(loadDone(mem('{"v":1,"done":["types","ghost"]}'), ids)).toEqual(new Set(['types']));
  });
});

describe('defaultSelection', () => {
  it('picks the first not-done concept in data order', () => {
    expect(defaultSelection(concepts, new Set(['types']))).toBe('missing');
  });

  it('falls back to the first concept when everything is done', () => {
    expect(defaultSelection(concepts, new Set(concepts.map(c => c.id)))).toBe('types');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state.test.ts`
Expected: FAIL, cannot resolve `./state`.

- [ ] **Step 3: Write `src/state.ts`**

```ts
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
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.done)) return new Set();
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state.ts src/state.test.ts
git commit -m "feat: add learner progress persistence"
```

---

### Task 7: DOM rendering

**Files:**
- Create: `src/ui.ts`
- Test: `src/ui.test.ts`

**Interfaces:**
- Consumes: Task 2 (`concepts`, `conceptById`, `Concept`), Task 3 (`withPrereqs`), Task 4 (`Layout`, `NODE_W`, `NODE_H`).
- Produces:
  - `interface AppState { selected: string; query: string; done: Set<string>; shared: ReadonlySet<string> | null; confirmArm: 'import' | 'reset' | null }`
  - `interface Handlers` (see code below for the nine exact callbacks)
  - `interface App { update(): void }`
  - `function mountApp(root: HTMLElement, state: AppState, layout: Layout, h: Handlers): App` (mounts static shell once; `update()` re-renders banner, graph, panel; search input element persists so focus survives re-renders)
  - `function effectiveDone(state: AppState): ReadonlySet<string>` (shared set wins in view mode)
  - `function matchesQuery(c: Concept, query: string): boolean`
  - `function promptFor(c: Concept): string`
- Behavior rules: while a query is active every node and edge stays in the DOM; non-matching nodes get `.dim` except the selected node; edges get `.dim` unless both endpoints match. In view mode (`state.shared !== null`) the Share button, Mark done button, and Reset progress button do not render, and the banner does. Confirm-arm renders `Really replace my progress?` / `Really erase all progress?` with `.danger`.

- [ ] **Step 1: Write the failing test `src/ui.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';
import { computeLayout } from './layout';
import { matchesQuery, mountApp, promptFor, type AppState, type Handlers } from './ui';

const noop: Handlers = {
  onSelect() {},
  onSearch() {},
  onResetView() {},
  onToggleDone() {},
  onShare() {},
  onCopyPrompt() {},
  onExitView() {},
  onImportShared() {},
  onResetProgress() {},
};

function render(partial: Partial<AppState> = {}): HTMLElement {
  const root = document.createElement('div');
  const state: AppState = {
    selected: 'types',
    query: '',
    done: new Set(),
    shared: null,
    confirmArm: null,
    ...partial,
  };
  mountApp(root, state, computeLayout(concepts), noop).update();
  return root;
}

describe('matchesQuery', () => {
  it('matches title case-insensitively', () => {
    expect(matchesQuery(conceptById.get('join')!, 'JOIN')).toBe(true);
  });

  it('matches description text', () => {
    expect(matchesQuery(conceptById.get('join')!, 'shared key')).toBe(true);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery(conceptById.get('join')!, '')).toBe(true);
  });
});

describe('promptFor', () => {
  it('lists prerequisite titles', () => {
    expect(promptFor(conceptById.get('aggregate')!)).toContain('Convert types, Handle missing data');
  });

  it('says none for roots', () => {
    expect(promptFor(conceptById.get('types')!)).toContain('prerequisites: none');
  });
});

describe('rendering', () => {
  it('renders every concept as a node', () => {
    expect(render().querySelectorAll('.node')).toHaveLength(concepts.length);
  });

  it('renders every prerequisite as an edge', () => {
    const edgeCount = concepts.reduce((n, c) => n + c.pre.length, 0);
    expect(render().querySelectorAll('.edge')).toHaveLength(edgeCount);
  });

  it('marks done nodes', () => {
    const root = render({ done: new Set(['types']) });
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });
});

describe('search dimming', () => {
  it('dims non-matching nodes but never the selected one', () => {
    const root = render({ query: 'join', selected: 'types' });
    const dimmed = [...root.querySelectorAll('.node.dim')].map(n => (n as HTMLElement).dataset.id);
    expect(dimmed.length).toBeGreaterThan(0);
    expect(dimmed).not.toContain('join');
    expect(dimmed).not.toContain('types');
  });

  it('keeps all nodes and edges in the DOM while searching', () => {
    const root = render({ query: 'join' });
    const edgeCount = concepts.reduce((n, c) => n + c.pre.length, 0);
    expect(root.querySelectorAll('.node')).toHaveLength(concepts.length);
    expect(root.querySelectorAll('.edge')).toHaveLength(edgeCount);
  });
});

describe('view mode', () => {
  it('shows the banner and hides progress controls', () => {
    const root = render({ shared: new Set(['types']) });
    expect(root.querySelector('.banner')).not.toBeNull();
    expect(root.querySelector('#toggleDone')).toBeNull();
    expect(root.querySelector('#resetProgress')).toBeNull();
    expect((root.querySelector('#share') as HTMLButtonElement).hidden).toBe(true);
  });

  it('renders shared done markers instead of local ones', () => {
    const root = render({ shared: new Set(['missing']), done: new Set(['types']) });
    expect(root.querySelector('[data-id="missing"]')!.classList.contains('done')).toBe(true);
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui.test.ts`
Expected: FAIL, cannot resolve `./ui`.

- [ ] **Step 3: Write `src/ui.ts`**

```ts
import type { Concept } from './data';
import { conceptById, concepts } from './data';
import { withPrereqs } from './graph';
import type { Layout } from './layout';
import { NODE_H, NODE_W } from './layout';

export interface AppState {
  selected: string;
  query: string;
  done: Set<string>;
  shared: ReadonlySet<string> | null;
  confirmArm: 'import' | 'reset' | null;
}

export interface Handlers {
  onSelect(id: string): void;
  onSearch(query: string): void;
  onResetView(): void;
  onToggleDone(id: string): void;
  onShare(button: HTMLButtonElement): void;
  onCopyPrompt(concept: Concept, button: HTMLButtonElement): void;
  onExitView(): void;
  onImportShared(): void;
  onResetProgress(): void;
}

export interface App {
  update(): void;
}

export function effectiveDone(state: AppState): ReadonlySet<string> {
  return state.shared ?? state.done;
}

export function matchesQuery(c: Concept, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${c.title} ${c.cat} ${c.desc}`.toLowerCase().includes(q);
}

export function promptFor(c: Concept): string {
  const pre = c.pre.length ? c.pre.map(p => conceptById.get(p)!.title).join(', ') : 'none';
  return [
    `You are a patient data-analysis tutor. Teach me "${c.title}" in simple language.`,
    '',
    'Explain:',
    '- What it means and when to use it',
    '- A practical example with a small dataset',
    '- Common mistakes to avoid',
    `- How it connects to these prerequisites: ${pre}`,
    '',
    'End with a short exercise, then wait for my answer before grading it.',
  ].join('\n');
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function mountApp(root: HTMLElement, state: AppState, layout: Layout, h: Handlers): App {
  root.innerHTML = `
<div class="app">
  <div id="banner"></div>
  <header class="topbar">
    <div class="brand">
      <h1>Data Analysis Concept Tree</h1>
      <p>Click a concept to reveal the prerequisite path.</p>
    </div>
    <div class="top-actions">
      <input id="search" class="search" type="search" placeholder="Search concepts..." aria-label="Search concepts">
      <button id="share" class="btn">Share progress</button>
      <button id="reset" class="btn">Reset view</button>
    </div>
  </header>
  <main class="layout">
    <section class="workspace">
      <div class="toolbar">
        <h2>Learning map</h2>
        <div class="legend">
          <span><i class="dot" style="background:#4776e6"></i>Concept</span>
          <span><i class="dot" style="background:#f5b82e"></i>Selected path</span>
          <span><i class="dot" style="background:#2aa876"></i>Completed</span>
        </div>
      </div>
      <div id="graphWrap" class="graph-wrap"><div id="graph" class="graph"></div></div>
    </section>
    <aside id="panel" class="panel" aria-live="polite"></aside>
  </main>
</div>`;

  const search = root.querySelector<HTMLInputElement>('#search')!;
  search.addEventListener('input', () => h.onSearch(search.value));
  const shareBtn = root.querySelector<HTMLButtonElement>('#share')!;
  shareBtn.addEventListener('click', () => h.onShare(shareBtn));
  root.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => {
    search.value = '';
    h.onResetView();
  });

  const update = (): void => {
    renderBanner(root.querySelector<HTMLElement>('#banner')!, state, h);
    shareBtn.hidden = state.shared !== null;
    renderGraph(root.querySelector<HTMLElement>('#graph')!, state, layout, h);
    renderPanel(root.querySelector<HTMLElement>('#panel')!, state, h);
  };
  return { update };
}

function renderBanner(el: HTMLElement, state: AppState, h: Handlers): void {
  if (!state.shared) {
    el.innerHTML = '';
    return;
  }
  const arming = state.confirmArm === 'import';
  el.innerHTML = `
<div class="banner">
  <span>Viewing shared progress. Your local progress is untouched.</span>
  <div class="banner-actions">
    <button id="importShared" class="btn small${arming ? ' danger' : ''}">${arming ? 'Really replace my progress?' : 'Import to my progress'}</button>
    <button id="exitView" class="btn small primary">Exit view</button>
  </div>
</div>`;
  el.querySelector<HTMLButtonElement>('#importShared')!.addEventListener('click', () => h.onImportShared());
  el.querySelector<HTMLButtonElement>('#exitView')!.addEventListener('click', () => h.onExitView());
}

function renderGraph(graph: HTMLElement, state: AppState, layout: Layout, h: Handlers): void {
  const done = effectiveDone(state);
  const path = withPrereqs(state.selected, conceptById);
  const filtering = state.query.trim().length > 0;
  const matches = new Set(concepts.filter(c => matchesQuery(c, state.query)).map(c => c.id));

  graph.style.width = `${layout.width}px`;
  graph.style.height = `${layout.height}px`;

  const edges = concepts
    .flatMap(c =>
      c.pre.map(pid => {
        const p = layout.pos.get(pid)!;
        const n = layout.pos.get(c.id)!;
        const cls = ['edge'];
        if (path.has(c.id) && path.has(pid)) cls.push('active');
        else if (path.has(c.id) || path.has(pid)) cls.push('future');
        if (filtering && !(matches.has(c.id) && matches.has(pid))) cls.push('dim');
        return `<line class="${cls.join(' ')}" x1="${p.x + NODE_W}" y1="${p.y + NODE_H / 2}" x2="${n.x}" y2="${n.y + NODE_H / 2}"></line>`;
      }),
    )
    .join('');

  const labels = layout.tiers
    .map(t => {
      const first = concepts.find(c => c.tier === t)!;
      const x = layout.pos.get(first.id)!.x;
      return `<div class="tier-label" style="left:${x}px">Tier ${t} · ${esc(first.cat)}</div>`;
    })
    .join('');

  const nodes = concepts
    .map(c => {
      const p = layout.pos.get(c.id)!;
      const cls = ['node'];
      if (c.id === state.selected) cls.push('active');
      else if (path.has(c.id)) cls.push('path');
      if (done.has(c.id)) cls.push('done');
      if (filtering && !matches.has(c.id) && c.id !== state.selected) cls.push('dim');
      return `<button class="${cls.join(' ')}" data-id="${esc(c.id)}" style="left:${p.x}px;top:${p.y}px">
  <div class="node-title">${esc(c.title)}</div>
  <div class="node-meta">${esc(c.cat)} · Tier ${c.tier}</div>
</button>`;
    })
    .join('');

  graph.innerHTML = `<svg class="edges" aria-hidden="true">${edges}</svg>${labels}${nodes}`;
  graph.querySelectorAll<HTMLButtonElement>('.node').forEach(btn => {
    btn.addEventListener('click', () => h.onSelect(btn.dataset.id!));
  });
}

function renderPanel(panel: HTMLElement, state: AppState, h: Handlers): void {
  const c = conceptById.get(state.selected);
  if (!c) {
    panel.innerHTML = '<div class="empty">Select a concept.</div>';
    return;
  }
  const done = effectiveDone(state);
  const path = withPrereqs(c.id, conceptById);
  const viewOnly = state.shared !== null;
  const resetArming = state.confirmArm === 'reset';

  const progressSection = viewOnly
    ? ''
    : `
<div class="section">
  <h3>Progress</h3>
  <button id="toggleDone" class="btn primary">${done.has(c.id) ? 'Mark not done' : 'Mark done'}</button>
</div>`;

  const resetSection = viewOnly
    ? ''
    : `
<div class="section">
  <button id="resetProgress" class="btn small${resetArming ? ' danger' : ''}">${resetArming ? 'Really erase all progress?' : 'Reset all progress'}</button>
</div>`;

  panel.innerHTML = `
<div class="panel-kicker">Selected concept</div>
<h2>${esc(c.title)}</h2>
<p>${esc(c.desc)}</p>
<div class="chips">
  <span class="chip">${esc(c.cat)}</span>
  <span class="chip">Tier ${c.tier}</span>
  ${done.has(c.id) ? '<span class="status">Completed</span>' : ''}
</div>
<div class="section">
  <h3>Needs first</h3>
  <div class="prereqs">${
    c.pre.length
      ? c.pre.map(p => `<span class="prereq">${esc(conceptById.get(p)!.title)}</span>`).join('')
      : '<span class="prereq">No prerequisites</span>'
  }</div>
</div>${progressSection}
<div class="section">
  <h3>Tutor prompt</h3>
  <div class="prompt">${esc(promptFor(c))}</div>
  <button id="copy" class="btn primary">Copy prompt</button>
</div>
<div class="section">
  <h3>Path summary</h3>
  <p>${[...path].reverse().map(id => esc(conceptById.get(id)!.title)).join(' → ')}</p>
</div>${resetSection}`;

  panel.querySelector<HTMLButtonElement>('#toggleDone')?.addEventListener('click', () => h.onToggleDone(c.id));
  const copyBtn = panel.querySelector<HTMLButtonElement>('#copy')!;
  copyBtn.addEventListener('click', () => h.onCopyPrompt(c, copyBtn));
  panel.querySelector<HTMLButtonElement>('#resetProgress')?.addEventListener('click', () => h.onResetProgress());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui.ts src/ui.test.ts
git commit -m "feat: render graph, panel, and view-mode banner from state"
```

---

### Task 8: App wiring and bootstrap

**Files:**
- Create: `src/app.ts`
- Replace: `src/main.ts` (drop the Task 1 stub)
- Test: `src/app.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2-7 plus `STORAGE_KEY`, `StorageLike` from Task 6.
- Produces: `function init(root: HTMLElement, storage: StorageLike, hash: string, shareBase: string): void`.
- Behavior: share hash in `hash` opens view mode without touching storage. Import is two-step (first click arms for 4 s, second click within that window replaces local progress, saves, exits view mode, clears the hash). Reset progress is the same two-step pattern. Exit view leaves storage alone and clears the hash. Toggle done saves immediately. Share button copies `shareBase + encodeShareHash(done)` and flashes `Link copied`. Copy prompt flashes `Copied`.

- [ ] **Step 1: Write the failing test `src/app.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { init } from './app';
import { encodeShareHash } from './share';
import { STORAGE_KEY, type StorageLike } from './state';

interface MemStorage extends StorageLike {
  data: Map<string, string>;
}

function memStorage(): MemStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

function mount(hash = '', storage: MemStorage = memStorage()): { root: HTMLElement; storage: MemStorage } {
  const root = document.createElement('div');
  document.body.append(root);
  init(root, storage, hash, 'https://example.test/app/');
  return { root, storage };
}

const btn = (root: HTMLElement, sel: string): HTMLButtonElement => {
  const el = root.querySelector<HTMLButtonElement>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

describe('app integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders all concepts and selects the first not-done concept', () => {
    const { root } = mount();
    expect(root.querySelectorAll('.node')).toHaveLength(12);
    expect(root.querySelector('.node.active')!.getAttribute('data-id')).toBe('types');
  });

  it('toggling done persists to storage and updates the map', () => {
    const { root, storage } = mount();
    btn(root, '#toggleDone').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('types');
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });

  it('share hash opens read-only view without touching storage', () => {
    const { root, storage } = mount(encodeShareHash(new Set(['types'])));
    expect(root.querySelector('.banner')).not.toBeNull();
    expect(root.querySelector('#toggleDone')).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('import requires two clicks and then replaces local progress', () => {
    const { root, storage } = mount(encodeShareHash(new Set(['types', 'missing'])));
    btn(root, '#importShared').click();
    expect(storage.data.size).toBe(0);
    btn(root, '#importShared').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('missing');
    expect(root.querySelector('.banner')).toBeNull();
  });

  it('exit view leaves local progress alone', () => {
    const { root, storage } = mount(encodeShareHash(new Set(['types'])));
    btn(root, '#exitView').click();
    expect(root.querySelector('.banner')).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('reset progress requires two clicks', () => {
    const { root, storage } = mount();
    btn(root, '#toggleDone').click();
    btn(root, '#resetProgress').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('types');
    btn(root, '#resetProgress').click();
    expect(storage.getItem(STORAGE_KEY)).not.toContain('types');
  });

  it('selecting a node disarms a pending confirm', () => {
    const { root, storage } = mount();
    btn(root, '#toggleDone').click();
    btn(root, '#resetProgress').click();
    (root.querySelector('[data-id="join"]') as HTMLButtonElement).click();
    btn(root, '#resetProgress').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('types');
  });

  it('selecting a node updates the panel', () => {
    const { root } = mount();
    (root.querySelector('[data-id="join"]') as HTMLButtonElement).click();
    expect(root.querySelector('.panel h2')!.textContent).toBe('Join tables');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app.test.ts`
Expected: FAIL, cannot resolve `./app`.

- [ ] **Step 3: Write `src/app.ts`**

```ts
import { concepts } from './data';
import { computeLayout } from './layout';
import { decodeShareHash, encodeShareHash } from './share';
import { defaultSelection, loadDone, saveDone, type StorageLike } from './state';
import { effectiveDone, mountApp, promptFor, type App, type AppState, type Handlers } from './ui';

export function init(root: HTMLElement, storage: StorageLike, hash: string, shareBase: string): void {
  const validIds: ReadonlySet<string> = new Set(concepts.map(c => c.id));
  const layout = computeLayout(concepts);
  const state: AppState = {
    selected: '',
    query: '',
    done: loadDone(storage, validIds),
    shared: decodeShareHash(hash, validIds),
    confirmArm: null,
  };
  state.selected = defaultSelection(concepts, effectiveDone(state));

  let app: App;
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  const disarmLater = (): void => {
    clearTimeout(disarmTimer);
    disarmTimer = setTimeout(() => {
      state.confirmArm = null;
      app.update();
    }, 4000);
  };

  const clearHash = (): void => {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  const flash = (button: HTMLButtonElement, text: string): void => {
    const prev = button.textContent;
    button.textContent = text;
    setTimeout(() => {
      button.textContent = prev;
    }, 1400);
  };

  const copyText = async (button: HTMLButtonElement, text: string, doneLabel: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      flash(button, doneLabel);
    } catch {
      flash(button, 'Copy failed');
    }
  };

  const handlers: Handlers = {
    onSelect: id => {
      state.selected = id;
      state.confirmArm = null;
      app.update();
    },
    onSearch: query => {
      state.query = query;
      state.confirmArm = null;
      app.update();
    },
    onResetView: () => {
      state.query = '';
      state.confirmArm = null;
      state.selected = defaultSelection(concepts, effectiveDone(state));
      app.update();
    },
    onToggleDone: id => {
      if (state.shared) return;
      if (state.done.has(id)) state.done.delete(id);
      else state.done.add(id);
      saveDone(storage, state.done);
      app.update();
    },
    onShare: button => {
      void copyText(button, shareBase + encodeShareHash(state.done), 'Link copied');
    },
    onCopyPrompt: (concept, button) => {
      void copyText(button, promptFor(concept), 'Copied');
    },
    onExitView: () => {
      state.shared = null;
      state.confirmArm = null;
      clearHash();
      state.selected = defaultSelection(concepts, state.done);
      app.update();
    },
    onImportShared: () => {
      if (!state.shared) return;
      if (state.confirmArm !== 'import') {
        state.confirmArm = 'import';
        app.update();
        disarmLater();
        return;
      }
      state.done = new Set(state.shared);
      saveDone(storage, state.done);
      state.shared = null;
      state.confirmArm = null;
      clearHash();
      app.update();
    },
    onResetProgress: () => {
      if (state.shared) return;
      if (state.confirmArm !== 'reset') {
        state.confirmArm = 'reset';
        app.update();
        disarmLater();
        return;
      }
      state.done = new Set();
      saveDone(storage, state.done);
      state.confirmArm = null;
      app.update();
    },
  };

  app = mountApp(root, state, layout, handlers);
  app.update();
}
```

- [ ] **Step 4: Replace `src/main.ts`**

```ts
import './style.css';
import { init } from './app';
import type { StorageLike } from './state';

function safeStorage(): StorageLike {
  try {
    const probe = '__concept-tree-probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: k => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
  }
}

init(
  document.querySelector<HTMLElement>('#app')!,
  safeStorage(),
  location.hash,
  location.origin + location.pathname + location.search,
);

window.addEventListener('hashchange', () => location.reload());
```

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run`
Expected: PASS, all suites (data, graph, layout, share, state, ui, app).

Run: `npm run build`
Expected: tsc + vite build succeed.

- [ ] **Step 6: Non-interactive bundle smoke**

```bash
npm run preview -- --port 4173 &
sleep 2
curl -s http://localhost:4173/ | grep -q 'id="app"' && echo BUNDLE_OK
kill %1
```

Expected: `BUNDLE_OK`.
The lead performs the full E2E pass in Task 10; this step only catches bundling mistakes.

- [ ] **Step 7: Commit**

```bash
git add src/app.ts src/app.test.ts src/main.ts
git commit -m "feat: wire learner progress, share view mode, and search dimming"
```

---

### Task 9: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `npm test` and `npm run build` from earlier tasks; `BASE_PATH` env read by `vite.config.ts` (Task 1).
- Produces: live site at `https://engineerball.github.io/data-analyst-tree-app/`.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - uses: actions/configure-pages@v6
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /data-analyst-tree-app/
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Write `README.md`**

````markdown
# Data Analysis Concept Tree

A learning map for data-analysis concepts with prerequisite paths, learner-owned progress, and a copy-to-LLM tutor prompt per concept.

Live: https://engineerball.github.io/data-analyst-tree-app/

## How progress works

- Progress is stored in your browser (localStorage). Nothing leaves your machine.
- "Share progress" copies a link whose fragment encodes your done-set.
- Opening a shared link shows a read-only view. Your own progress is untouched unless you explicitly import.

## Development

```
npm install
npm run dev       # dev server
npm test          # vitest
npm run build     # type-check + production build
npm run preview   # serve the production build
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to main.
````

- [ ] **Step 3: Enable Pages with workflow build type**

```bash
gh api -X POST repos/engineerball/data-analyst-tree-app/pages -f 'build_type=workflow' || gh api -X PUT repos/engineerball/data-analyst-tree-app/pages -f 'build_type=workflow'
```

Expected: 201 (created) from POST, or POST fails because Pages already exists and PUT returns 204.

- [ ] **Step 4: Commit, merge to main, push**

The work so far lives on `feat/progress-machinery`; the workflow only triggers on pushes to `main`.

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: deploy to GitHub Pages"
git switch main
git merge --ff-only feat/progress-machinery
git push origin main
```

- [ ] **Step 5: Watch the run and verify the live site**

```bash
gh run watch --exit-status
curl -sI https://engineerball.github.io/data-analyst-tree-app/ | head -1
```

Expected: workflow succeeds; curl returns `HTTP/2 200`.

---

### Task 10: Lead E2E verification (performed by the lead, not a subagent)

- [ ] Open the local preview and the live URL in Chrome.
- [ ] Verify: graph renders 12 nodes in 5 tier columns, no overlaps, edges connect correct nodes, tier labels sit above their columns.
- [ ] Verify: clicking nodes moves selection, path highlighting matches the old app's semantics.
- [ ] Verify: mark done persists across reload; done nodes render green; Completed chip shows.
- [ ] Verify: search dims non-matches, keeps structure, never dims selected; reset view clears search.
- [ ] Verify: Share progress copies a link; opening it in a fresh profile/incognito shows the banner, hides edit controls, and leaves that profile's storage untouched; import works only after two clicks; exit view restores.
- [ ] Verify: copy prompt puts the tutor prompt on the clipboard.
- [ ] Verify mobile layout at 390 px width: single column, no horizontal page scroll (graph scrolls inside its container).
- [ ] Be picky about pixels: spacing, alignment, focus rings, hover states. Fix anything that looks off.

### Task 11: Fresh-perspective review (Codex) and fixes

- [ ] Dispatch Codex over the full diff (`git diff 041d394..HEAD`) asking for correctness, edge-case, and UX findings.
- [ ] Triage findings; fix real issues via fast-worker tasks with tests first; re-run `npx vitest run` and `npm run build`.
- [ ] Commit fixes with conventional messages.
