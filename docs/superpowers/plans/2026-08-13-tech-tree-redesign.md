# DA Concept Tech Tree Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shipped concept-tree app into the dark "tech tree" design mock, expand the curriculum to ~34 concepts in hop-depth columns, add a bonus-tier toggle, and ship the new Copilot tutor prompt - preserving all progress/share machinery.

**Architecture:** Same module layout as the shipped app (data/graph/layout/share/state/ui/app/main). Depth (1 + longest prerequisite chain) replaces authored tier everywhere: layout columns, panel tier badge. Two layouts are precomputed (with and without bonus concepts) and selected by a `bonusVisible` flag. Rendering stays innerHTML + esc() with listeners re-bound per update.

**Tech Stack:** unchanged - Vite, TypeScript strict, Vitest + happy-dom, GitHub Pages CI.

**Spec:** docs/superpowers/specs/2026-08-13-tech-tree-redesign.md

## Global Constraints

- No runtime dependencies; no new devDependencies.
- TypeScript strict + noUncheckedIndexedAccess; suite green and `npm run build` clean at every commit.
- No em dash anywhere in code, copy, or commits. Plain dash only. (`→` and `·` are required copy characters, not dashes.)
- Conventional Commits, no co-author trailers.
- localStorage key `concept-tree-progress` and share prefix `#s=` unchanged; legacy ids types/missing/unique/convert/handle-missing/dedupe/aggregate/join/group/change/correlation must exist in the new curriculum.
- All share/view-mode/two-step-confirm behaviors from the previous round keep their tests green (selectors #search #share #reset #toggleDone #copy #resetProgress #importShared #exitView #banner survive).
- Exact copy strings: title "DA Concept Tech Tree" (CSS uppercases), subtitle "Click a node → its full prerequisite path lights up. That path is what you're verifying.", toggle label "show bonus tier (L3)", prompt-section heading "Tutor prompt (copy → paste into Copilot)", column labels "1 HOP" / "N HOPS".

## File Structure

```
src/data.ts        REWRITE: expanded curriculum; Concept loses tier, gains task?/bonus?
src/graph.ts       ADD depthOf(); withPrereqs unchanged
src/layout.ts      REWRITE: columns by computed depth; Layout gains depth map + columns
src/ui.ts          REWRITE: dark markup, bezier edges, path-dim, bonus toggle, new panel + prompt
src/app.ts         MODIFY: bonusVisible state, two precomputed layouts, onToggleBonus
src/style.css      REWRITE: dark theme
index.html         MODIFY: <title>
README.md          MODIFY: name + description lines
src/*.test.ts      UPDATE alongside their modules
```

share.ts, state.ts, main.ts: untouched.

---

### Task 1: depthOf in graph.ts

**Files:**
- Modify: `src/graph.ts`
- Test: `src/graph.test.ts`

**Interfaces:**
- Consumes: `Concept` (still with tier at this point - depthOf does not read tier).
- Produces: `function depthOf(byId: ReadonlyMap<string, Concept>): Map<string, number>` - 1 for roots, 1 + longest prerequisite chain otherwise; unknown prereqs and cycle back-edges contribute 0; every id in byId gets an entry.

- [ ] **Step 1: Append failing tests to `src/graph.test.ts`**

Add `depthOf` to the existing import from './graph', then append:

```ts
describe('depthOf', () => {
  it('assigns 1 to roots and 1 + longest chain otherwise', () => {
    const d = depthOf(g({ a: [], b: ['a'], c: ['a', 'b'] }));
    expect(d.get('a')).toBe(1);
    expect(d.get('b')).toBe(2);
    expect(d.get('c')).toBe(3);
  });

  it('takes the longest chain, not the shortest', () => {
    const d = depthOf(g({ a: [], b: ['a'], c: ['b'], deep: ['a', 'c'] }));
    expect(d.get('deep')).toBe(4);
  });

  it('terminates on cycles', () => {
    const d = depthOf(g({ a: ['b'], b: ['a'] }));
    expect(d.get('a')).toBeGreaterThanOrEqual(1);
    expect(d.get('b')).toBeGreaterThanOrEqual(1);
  });

  it('covers every id in the map', () => {
    const d = depthOf(g({ a: [], b: [] }));
    expect([...d.keys()].sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/graph.test.ts`
Expected: FAIL - depthOf is not exported.

- [ ] **Step 3: Append to `src/graph.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/graph.test.ts` then `npx vitest run`
Expected: PASS, whole suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/graph.ts src/graph.test.ts
git commit -m "feat: add hop-depth computation"
```

---

### Task 2: Data model switch - curriculum, layout, ui, app

One atomic commit: the Concept type change ripples through every module, so this task lands the expanded curriculum, the depth-based layout, the redesigned rendering, and the bonus toggle together, with all tests updated. The code below is complete; transcribe verbatim.

**Files:**
- Rewrite: `src/data.ts`, `src/layout.ts`, `src/ui.ts`
- Modify: `src/app.ts`
- Test: rewrite `src/data.test.ts`, `src/layout.test.ts`, `src/ui.test.ts`; update `src/graph.test.ts` helper and closure test; update `src/app.test.ts`

**Interfaces:**
- Consumes: `depthOf` from Task 1.
- Produces:
  - `interface Concept { id: string; title: string; cat: string; desc: string; task?: string; bonus?: true; pre: string[] }`
  - `Layout { pos; depth: ReadonlyMap<string, number>; columns: { depth: number; x: number; label: string }[]; width; height }`, constants `NODE_W 204, NODE_H 58, COL_X0 36, COL_GAP 280, ROW_Y0 96, ROW_GAP 76`
  - ui: `AppState` gains `bonusVisible: boolean`; `Handlers` gains `onToggleBonus(visible: boolean)`; `mountApp(root, state, getLayout: () => Layout, h)`; new exports `visibleConcepts(state)`, `catSlug(cat)`
  - app: precomputed `layoutAll`/`layoutCore`, `getLayout` closure, `onToggleBonus` handler.

- [ ] **Step 1: Rewrite `src/data.ts`**

```ts
export interface Concept {
  id: string;
  title: string;
  cat: string;
  desc: string;
  task?: string;
  bonus?: true;
  pre: string[];
}

export const concepts: Concept[] = [
  { id: 'types', title: 'Data types', cat: 'Foundations', desc: 'Recognize numbers, text, dates, booleans, and categorical values.', task: 'List each column in customer info and label it number, text, date, or category.', pre: [] },
  { id: 'missing', title: 'Missing values', cat: 'Foundations', desc: 'Identify blanks and understand how they affect analysis.', task: 'Count how many customers have a blank salary or career.', pre: [] },
  { id: 'unique', title: 'Unique values', cat: 'Foundations', desc: 'Inspect distinct values to spot categories, labels, and anomalies.', task: 'List the distinct career values and check for spelling variants.', pre: [] },
  { id: 'filter', title: 'Filter rows', cat: 'Tables', desc: 'Keep only the rows you care about with clear, testable conditions.', task: 'Keep only customers with salary above 30,000 and count them.', pre: [] },
  { id: 'sort', title: 'Sort', cat: 'Tables', desc: 'Order rows to surface the largest, smallest, and newest records.', task: 'Sort customers by salary and read off the top 10 earners.', pre: [] },
  { id: 'primary-key', title: 'Primary key', cat: 'Foundations', desc: 'Find the column that identifies one row and nothing else.', task: 'Prove DUMMY_ID identifies one row in customer info and not in balances.', pre: ['unique', 'missing'] },
  { id: 'convert', title: 'Convert types', cat: 'Wrangling', desc: 'Convert fields into types that support reliable calculations.', task: 'Turn birth date text into a real date and compute each customer age.', pre: ['types'] },
  { id: 'handle-missing', title: 'Handle missing data', cat: 'Wrangling', desc: 'Choose whether to remove, fill, or flag missing observations.', task: 'Decide what to do with blank salaries, then say how it changes the average.', pre: ['missing', 'filter'] },
  { id: 'dedupe', title: 'Deduplicate', cat: 'Wrangling', desc: 'Find repeated records before counting or aggregating data.', task: 'Check whether any DUMMY_ID appears twice in product holdings.', pre: ['unique', 'sort'] },
  { id: 'aggregate', title: 'Aggregate', cat: 'Tables', desc: 'Summarize rows using totals, averages, counts, or other measures.', task: 'Compute the total, average, and count of monthly average balances.', pre: ['types', 'unique'] },
  { id: 'distribution', title: 'Distribution', cat: 'Analysis', desc: 'See how values spread out: center, spread, and outliers.', task: 'Describe the spread of customer salaries: low, typical, and high.', pre: ['types', 'sort'] },
  { id: 'chart-basics', title: 'Chart basics (x/y)', cat: 'Viz · build', desc: 'Map fields to the x and y axes and pick the right chart shape.', task: 'Chart the number of customers per career with career on the x axis.', pre: ['types', 'unique'] },
  { id: 'verify', title: 'Verify the numbers', cat: 'Process', desc: 'Sanity-check results against row counts, totals, and known figures.', task: 'Confirm your customer count matches the row count in customer info.', pre: ['handle-missing', 'dedupe', 'aggregate'] },
  { id: 'join', title: 'Join tables', cat: 'Tables', desc: 'Combine related tables through a shared key.', task: 'Join customer info to monthly balances on DUMMY_ID and check the row count.', pre: ['primary-key', 'dedupe'] },
  { id: 'group', title: 'Group by', cat: 'Tables', desc: 'Split data into meaningful groups before calculating summaries.', task: 'Compute the average balance per career using group by.', pre: ['aggregate'] },
  { id: 'percentiles', title: 'Percentiles & median', cat: 'Analysis', desc: 'Use the median and percentiles when averages hide the real story.', task: 'Report the median salary and compare it with the mean.', pre: ['distribution', 'aggregate'] },
  { id: 'date-axis', title: 'Date axis', cat: 'Viz · build', desc: 'Put real dates on an axis and choose day, month, or year grain.', task: 'Put the balance months on a date axis in true calendar order.', pre: ['chart-basics', 'convert'] },
  { id: 'scatter', title: 'Scatter plot', cat: 'Viz · build', desc: 'Plot two numeric fields against each other to see their relationship.', task: 'Plot salary against average balance, one dot per customer.', pre: ['chart-basics', 'distribution'] },
  { id: 'color-category', title: 'Color by category', cat: 'Viz · build', desc: 'Use color to encode a category without overwhelming the reader.', task: 'Color the salary vs balance dots by marital status and read the pattern.', pre: ['chart-basics', 'unique'] },
  { id: 'histogram', title: 'Histogram', cat: 'Viz · build', desc: 'Bin numeric values into bars to reveal the shape of a distribution.', task: 'Bin customer salaries into a histogram and find where most people sit.', pre: ['chart-basics', 'distribution'] },
  { id: 'pivot', title: 'Pivot table', cat: 'Tables', desc: 'Reshape rows into a grid that summarizes two dimensions at once.', task: 'Build a grid of career by gender showing average balance in each cell.', pre: ['group', 'join'] },
  { id: 'segment', title: 'Segment', cat: 'Analysis', desc: 'Split the population into comparable slices and see how they differ.', task: 'Split customers into salary quartiles and compare their average balances.', pre: ['group', 'percentiles'] },
  { id: 'change', title: 'Change over time', cat: 'Analysis', desc: 'Compare periods: month-over-month, year-over-year, growth %.', task: 'Find which month had the biggest jump in average balance.', pre: ['group', 'convert'] },
  { id: 'correlation', title: 'Correlation', cat: 'Analysis', desc: 'Measure whether two variables move together and how strongly.', task: 'Measure how strongly salary and average balance move together.', pre: ['scatter', 'join'] },
  { id: 'line-chart', title: 'Line chart', cat: 'Viz · build', desc: 'Show a metric moving across time with an honest, readable axis.', task: 'Draw average balance by month as a line and mark the peak.', pre: ['date-axis', 'group'] },
  { id: 'small-multiples', title: 'Small multiples', cat: 'Viz · build', desc: 'Repeat one small chart per category instead of crowding a single chart.', task: 'Draw one small balance-by-month line per career and compare the shapes.', pre: ['color-category', 'date-axis'] },
  { id: 'stacked-grouped', title: 'Stacked vs grouped', cat: 'Viz · build', desc: 'Choose stacked bars for parts of a whole and grouped bars for comparisons.', task: 'Show product holdings per career as stacked, then grouped, and pick one.', pre: ['color-category', 'group'] },
  { id: 'treemap', title: 'Treemap & sunburst', cat: 'Viz · build', desc: 'Show nested parts of a whole when categories have a hierarchy.', task: 'Size a treemap by total balance, split by career then gender.', bonus: true, pre: ['color-category', 'group'] },
  { id: 'funnel', title: 'Funnel', cat: 'Viz · build', desc: 'Track how many records survive each step of a multi-stage process.', task: 'Count customers who hold 1, 2, then 3 or more products as a funnel.', bonus: true, pre: ['chart-basics', 'group'] },
  { id: 'cohort', title: 'Cohort analysis', cat: 'Analysis', desc: 'Follow groups that started together to see how they behave over time.', task: 'Group customers by the month they opened an account and track their balances.', pre: ['change', 'segment'] },
  { id: 'heatmap', title: 'Heatmap', cat: 'Viz · build', desc: 'Color a grid of two dimensions so patterns pop out at a glance.', task: 'Color a career by month grid by average balance and spot the hot cells.', pre: ['pivot', 'color-category'] },
  { id: 'sankey', title: 'Sankey', cat: 'Viz · build', desc: 'Draw flows between stages to show where volume moves and leaks.', task: 'Draw the flow from career into product held for the top five careers.', bonus: true, pre: ['pivot', 'funnel'] },
  { id: 'cross-filter', title: 'Cross-filtering', cat: 'Viz · build', desc: 'Link charts so selecting in one filters the rest of the view.', task: 'Click a career in one chart and make the balance chart follow the selection.', pre: ['small-multiples', 'segment'] },
  { id: 'animated-chart', title: 'Animated chart', cat: 'Viz · build', desc: 'Animate a chart across time only when motion adds real meaning.', task: 'Animate the salary vs balance scatter month by month and narrate the drift.', bonus: true, pre: ['line-chart', 'change'] },
];

export const conceptById: ReadonlyMap<string, Concept> = new Map(concepts.map(c => [c.id, c]));
```

- [ ] **Step 2: Rewrite `src/data.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';
import { depthOf } from './graph';

const depth = depthOf(conceptById);

describe('curriculum integrity', () => {
  it('has unique ids', () => {
    expect(new Set(concepts.map(c => c.id)).size).toBe(concepts.length);
  });

  it('every prerequisite exists', () => {
    for (const c of concepts) {
      for (const p of c.pre) {
        expect(conceptById.has(p), `${c.id} -> ${p}`).toBe(true);
      }
    }
  });

  it('no concept requires itself', () => {
    for (const c of concepts) {
      expect(c.pre).not.toContain(c.id);
    }
  });

  it('spans depths 1 through 5 with nothing deeper', () => {
    const depths = concepts.map(c => depth.get(c.id)!);
    expect(Math.min(...depths)).toBe(1);
    expect(Math.max(...depths)).toBe(5);
  });

  it('bonus concepts are never prerequisites of non-bonus concepts', () => {
    for (const c of concepts.filter(k => !k.bonus)) {
      for (const p of c.pre) {
        expect(conceptById.get(p)!.bonus, `${c.id} -> ${p}`).toBeUndefined();
      }
    }
  });

  it('keeps legacy ids so saved progress survives', () => {
    for (const id of ['types', 'missing', 'unique', 'convert', 'handle-missing', 'dedupe', 'aggregate', 'join', 'group', 'change', 'correlation']) {
      expect(conceptById.has(id), id).toBe(true);
    }
  });

  it('anchors mock concepts in their columns', () => {
    expect(depth.get('types')).toBe(1);
    expect(depth.get('convert')).toBe(2);
    expect(depth.get('aggregate')).toBe(2);
    expect(depth.get('group')).toBe(3);
    expect(depth.get('change')).toBe(4);
  });

  it('gives Change over time the mock prerequisites', () => {
    expect(conceptById.get('change')!.pre).toEqual(['group', 'convert']);
  });
});
```

- [ ] **Step 3: Update `src/graph.test.ts` for the new Concept shape**

The `g` helper drops `tier`; the closure expectation changes because Aggregate no longer requires Handle missing data. Replace the helper and the first test:

```ts
const g = (defs: Record<string, string[]>): ReadonlyMap<string, Concept> =>
  new Map(
    Object.entries(defs).map(([id, pre]) => [id, { id, title: id, cat: '', desc: '', pre }]),
  );
```

```ts
  it('includes the concept itself and all transitive prerequisites', () => {
    expect(withPrereqs('change', conceptById)).toEqual(
      new Set(['change', 'group', 'convert', 'aggregate', 'types', 'unique']),
    );
  });
```

(If the designed data gives `group` or `aggregate` different transitive roots, adjust this set to the actual closure - it must match `pre` chains in data.ts exactly; the anchor is that Missing values is NOT in the closure.)

- [ ] **Step 4: Rewrite `src/layout.ts`**

```ts
import type { Concept } from './data';
import { depthOf } from './graph';

export interface Point {
  x: number;
  y: number;
}

export interface Column {
  depth: number;
  x: number;
  label: string;
}

export interface Layout {
  pos: ReadonlyMap<string, Point>;
  depth: ReadonlyMap<string, number>;
  columns: Column[];
  width: number;
  height: number;
}

export const NODE_W = 204;
export const NODE_H = 58;
export const COL_X0 = 36;
export const COL_GAP = 280;
export const ROW_Y0 = 96;
export const ROW_GAP = 76;
const PAD_RIGHT = 40;
const PAD_BOTTOM = 48;

export function computeLayout(list: Concept[]): Layout {
  const byId: ReadonlyMap<string, Concept> = new Map(list.map(c => [c.id, c]));
  const depth = depthOf(byId);
  const depths = [...new Set(depth.values())].sort((a, b) => a - b);
  const colOf = new Map(depths.map((d, i) => [d, i]));
  const maxRows = Math.max(0, ...depths.map(d => list.filter(c => depth.get(c.id) === d).length));
  const pos = new Map<string, Point>();

  for (const d of depths) {
    const col = list.filter(c => depth.get(c.id) === d);
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
        x: COL_X0 + colOf.get(d)! * COL_GAP,
        y: ROW_Y0 + offset + row * ROW_GAP,
      });
    });
  }

  return {
    pos,
    depth,
    columns: depths.map(d => ({
      depth: d,
      x: COL_X0 + colOf.get(d)! * COL_GAP,
      label: d === 1 ? '1 HOP' : `${d} HOPS`,
    })),
    width: COL_X0 + Math.max(0, depths.length - 1) * COL_GAP + NODE_W + PAD_RIGHT,
    height: ROW_Y0 + Math.max(0, maxRows - 1) * ROW_GAP + NODE_H + PAD_BOTTOM,
  };
}
```

- [ ] **Step 5: Rewrite `src/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Concept } from './data';
import { concepts } from './data';
import { COL_GAP, COL_X0, ROW_GAP, ROW_Y0, computeLayout } from './layout';

const c = (id: string, pre: string[] = []): Concept => ({ id, title: id, cat: 'T', desc: '', pre });

describe('computeLayout', () => {
  it('positions every concept', () => {
    const { pos } = computeLayout(concepts);
    for (const k of concepts) expect(pos.get(k.id), k.id).toBeDefined();
  });

  it('x is determined by hop depth', () => {
    const { pos, depth } = computeLayout(concepts);
    for (const k of concepts) {
      expect(pos.get(k.id)!.x).toBe(COL_X0 + (depth.get(k.id)! - 1) * COL_GAP);
    }
  });

  it('labels hop columns', () => {
    const { columns } = computeLayout(concepts);
    expect(columns[0]!.label).toBe('1 HOP');
    expect(columns[1]!.label).toBe('2 HOPS');
    expect(columns).toHaveLength(5);
  });

  it('never overlaps nodes within a column', () => {
    const { pos, depth } = computeLayout(concepts);
    for (const d of new Set(depth.values())) {
      const ys = concepts.filter(k => depth.get(k.id) === d).map(k => pos.get(k.id)!.y);
      expect(new Set(ys).size).toBe(ys.length);
    }
  });

  it('orders children by prerequisite position (barycenter)', () => {
    const list = [c('a'), c('b'), c('childOfB', ['b']), c('childOfA', ['a'])];
    const { pos } = computeLayout(list);
    expect(pos.get('childOfA')!.y).toBeLessThan(pos.get('childOfB')!.y);
  });

  it('centers short columns', () => {
    const list = [c('a'), c('b'), c('c'), c('only', ['b'])];
    const { pos } = computeLayout(list);
    expect(pos.get('only')!.y).toBe(ROW_Y0 + ROW_GAP);
  });

  it('is deterministic', () => {
    const a = computeLayout(concepts);
    const b = computeLayout(concepts);
    expect([...a.pos.entries()]).toEqual([...b.pos.entries()]);
  });

  it('reports a canvas covering all nodes', () => {
    const { pos, width, height } = computeLayout(concepts);
    for (const p of pos.values()) {
      expect(p.x).toBeLessThan(width);
      expect(p.y).toBeLessThan(height);
    }
  });

  it('keeps non-bonus depths stable when bonus concepts are filtered out', () => {
    const all = computeLayout(concepts);
    const core = computeLayout(concepts.filter(k => !k.bonus));
    for (const k of concepts.filter(x => !x.bonus)) {
      expect(core.depth.get(k.id), k.id).toBe(all.depth.get(k.id));
    }
  });
});
```

- [ ] **Step 6: Rewrite `src/ui.ts`**

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
  bonusVisible: boolean;
}

export interface Handlers {
  onSelect(id: string): void;
  onSearch(query: string): void;
  onResetView(): void;
  onToggleBonus(visible: boolean): void;
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

export function visibleConcepts(state: AppState): Concept[] {
  return state.bonusVisible ? concepts : concepts.filter(c => !c.bonus);
}

export function matchesQuery(c: Concept, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${c.title} ${c.cat} ${c.desc}`.toLowerCase().includes(q);
}

export function catSlug(cat: string): string {
  return cat.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '');
}

const DATASET =
  'this bank dataset: 4 tables - customer info (birth date, gender, marital status, salary, career), product holdings, deposit accounts, and monthly average balances - all joinable on DUMMY_ID.';

export function promptFor(c: Concept): string {
  const task = c.task ? ` ${c.task}` : '';
  return `You are my patient data-analysis tutor. Teach me one concept: ${c.title} - ${c.desc} Explain it in plain language, then show a small worked example using ${DATASET}${task} Finish with one small exercise for me on this concept, wait for my answer, then check it.`;
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function mountApp(root: HTMLElement, state: AppState, getLayout: () => Layout, h: Handlers): App {
  root.innerHTML = `
<div class="app">
  <div id="banner"></div>
  <header class="topbar">
    <div class="brand">
      <h1>DA Concept Tech Tree</h1>
      <p>Click a node → its full prerequisite path lights up. That path is what you're verifying.</p>
    </div>
    <div class="top-actions">
      <input id="search" class="search" type="search" placeholder="Search concepts..." aria-label="Search concepts">
      <button id="share" class="btn">Share progress</button>
      <button id="reset" class="btn">Reset view</button>
      <label class="toggle"><input id="bonusToggle" type="checkbox" checked> show bonus tier (L3)</label>
    </div>
  </header>
  <main class="layout">
    <section class="workspace">
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
  const bonusToggle = root.querySelector<HTMLInputElement>('#bonusToggle')!;
  bonusToggle.addEventListener('change', () => h.onToggleBonus(bonusToggle.checked));

  const update = (): void => {
    const layout = getLayout();
    renderBanner(root.querySelector<HTMLElement>('#banner')!, state, h);
    shareBtn.hidden = state.shared !== null;
    bonusToggle.checked = state.bonusVisible;
    renderGraph(root.querySelector<HTMLElement>('#graph')!, state, layout, h);
    renderPanel(root.querySelector<HTMLElement>('#panel')!, state, layout, h);
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
    <button id="exitView" class="btn small accent">Exit view</button>
  </div>
</div>`;
  el.querySelector<HTMLButtonElement>('#importShared')!.addEventListener('click', () => h.onImportShared());
  el.querySelector<HTMLButtonElement>('#exitView')!.addEventListener('click', () => h.onExitView());
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(48, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function renderGraph(graph: HTMLElement, state: AppState, layout: Layout, h: Handlers): void {
  const done = effectiveDone(state);
  const path = withPrereqs(state.selected, conceptById);
  const filtering = state.query.trim().length > 0;
  const list = visibleConcepts(state);
  const matches = new Set(list.filter(c => matchesQuery(c, state.query)).map(c => c.id));

  graph.style.width = `${layout.width}px`;
  graph.style.height = `${layout.height}px`;

  const edges = list
    .flatMap(c =>
      c.pre.map(pid => {
        const p = layout.pos.get(pid);
        const n = layout.pos.get(c.id);
        if (!p || !n) return '';
        const cls = ['edge'];
        const onPath = path.has(c.id) && path.has(pid);
        if (onPath) cls.push('active');
        const dimmed = filtering ? !(matches.has(c.id) && matches.has(pid)) : !onPath;
        if (dimmed) cls.push('dim');
        return `<path class="${cls.join(' ')}" d="${edgePath(p.x + NODE_W, p.y + NODE_H / 2, n.x, n.y + NODE_H / 2)}"></path>`;
      }),
    )
    .join('');

  const labels = layout.columns
    .map(col => `<div class="col-label" style="left:${col.x}px">${col.label}</div>`)
    .join('');

  const nodes = list
    .map(c => {
      const p = layout.pos.get(c.id)!;
      const cls = ['node', `cat-${catSlug(c.cat)}`];
      if (c.bonus) cls.push('bonus');
      if (c.id === state.selected) cls.push('active');
      else if (path.has(c.id)) cls.push('path');
      if (done.has(c.id)) cls.push('done');
      const dimmed = filtering ? !matches.has(c.id) : !path.has(c.id);
      if (dimmed && c.id !== state.selected) cls.push('dim');
      return `<button class="${cls.join(' ')}" data-id="${esc(c.id)}" style="left:${p.x}px;top:${p.y}px">
  <div class="node-title">${esc(c.title)}</div>
  <div class="node-meta">${esc(c.cat)}${c.bonus ? ' · bonus' : ''}</div>
</button>`;
    })
    .join('');

  graph.innerHTML = `<svg class="edges" aria-hidden="true">${edges}</svg>${labels}${nodes}`;
  graph.querySelectorAll<HTMLButtonElement>('.node').forEach(btn => {
    btn.addEventListener('click', () => h.onSelect(btn.dataset.id!));
  });
}

function renderPanel(panel: HTMLElement, state: AppState, layout: Layout, h: Handlers): void {
  const c = conceptById.get(state.selected);
  if (!c) {
    panel.innerHTML = '<div class="empty">Select a concept.</div>';
    return;
  }
  const done = effectiveDone(state);
  const pathSet = withPrereqs(c.id, conceptById);
  const viewOnly = state.shared !== null;
  const resetArming = state.confirmArm === 'reset';
  const tier = layout.depth.get(c.id) ?? 1;
  const needsFirst = c.pre.length
    ? c.pre.map(p => esc(conceptById.get(p)!.title)).join(' · ')
    : 'No prerequisites';

  const progressSection = viewOnly
    ? ''
    : `
<div class="section">
  <h3>Progress</h3>
  <button id="toggleDone" class="btn accent">${done.has(c.id) ? 'Mark not done' : 'Mark done'}</button>
</div>`;

  const resetSection = viewOnly
    ? ''
    : `
<div class="section">
  <button id="resetProgress" class="btn small${resetArming ? ' danger' : ''}">${resetArming ? 'Really erase all progress?' : 'Reset all progress'}</button>
</div>`;

  panel.innerHTML = `
<div class="panel-kicker">${esc(c.cat.toUpperCase())} · TIER ${tier}</div>
<h2>${esc(c.title)}</h2>
<p class="desc">${esc(c.desc)}</p>
${done.has(c.id) ? '<div class="status">Completed</div>' : ''}
<div class="section">
  <h3>Needs first</h3>
  <p class="needs-first">${needsFirst}</p>
</div>${progressSection}
<div class="section">
  <h3>Tutor prompt (copy → paste into Copilot)</h3>
  <div class="prompt">${esc(promptFor(c))}</div>
  <button id="copy" class="btn accent">Copy prompt</button>
</div>
<div class="section">
  <h3>Path summary</h3>
  <p>${[...pathSet].reverse().map(id => esc(conceptById.get(id)!.title)).join(' → ')}</p>
</div>${resetSection}`;

  panel.querySelector<HTMLButtonElement>('#toggleDone')?.addEventListener('click', () => h.onToggleDone(c.id));
  const copyBtn = panel.querySelector<HTMLButtonElement>('#copy')!;
  copyBtn.addEventListener('click', () => h.onCopyPrompt(c, copyBtn));
  panel.querySelector<HTMLButtonElement>('#resetProgress')?.addEventListener('click', () => h.onResetProgress());
}
```

- [ ] **Step 7: Rewrite `src/ui.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { concepts, conceptById } from './data';
import { computeLayout } from './layout';
import { catSlug, matchesQuery, mountApp, promptFor, visibleConcepts, type AppState, type Handlers } from './ui';

const noop: Handlers = {
  onSelect() {},
  onSearch() {},
  onResetView() {},
  onToggleBonus() {},
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
    bonusVisible: true,
    ...partial,
  };
  const layoutAll = computeLayout(concepts);
  const layoutCore = computeLayout(concepts.filter(c => !c.bonus));
  mountApp(root, state, () => (state.bonusVisible ? layoutAll : layoutCore), noop).update();
  return root;
}

describe('matchesQuery and catSlug', () => {
  it('matches title case-insensitively', () => {
    expect(matchesQuery(conceptById.get('join')!, 'JOIN')).toBe(true);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery(conceptById.get('join')!, '')).toBe(true);
  });

  it('slugs the viz category', () => {
    expect(catSlug('Viz · build')).toBe('viz-build');
  });
});

describe('promptFor', () => {
  it('embeds title, desc, and the bank dataset', () => {
    const p = promptFor(conceptById.get('change')!);
    expect(p).toContain('Teach me one concept: Change over time');
    expect(p).toContain('DUMMY_ID');
  });

  it('includes the concept task when present', () => {
    expect(promptFor(conceptById.get('change')!)).toContain('biggest jump in average balance');
  });
});

describe('rendering', () => {
  it('renders every concept as a node when bonus is visible', () => {
    expect(render().querySelectorAll('.node')).toHaveLength(concepts.length);
  });

  it('hides bonus concepts when bonusVisible is false', () => {
    const root = render({ bonusVisible: false });
    expect(root.querySelectorAll('.node')).toHaveLength(concepts.filter(c => !c.bonus).length);
    expect(root.querySelectorAll('.node.bonus')).toHaveLength(0);
  });

  it('marks bonus nodes with the bonus class and suffix', () => {
    const root = render();
    const bonus = concepts.find(c => c.bonus)!;
    const el = root.querySelector(`[data-id="${bonus.id}"]`)!;
    expect(el.classList.contains('bonus')).toBe(true);
    expect(el.textContent).toContain('· bonus');
  });

  it('renders hop column labels', () => {
    const labels = [...render().querySelectorAll('.col-label')].map(l => l.textContent);
    expect(labels[0]).toBe('1 HOP');
    expect(labels).toHaveLength(5);
  });

  it('marks done nodes', () => {
    const root = render({ done: new Set(['types']) });
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });
});

describe('path dimming', () => {
  it('dims everything outside the selected prerequisite path', () => {
    const root = render({ selected: 'change' });
    const path = ['change', 'group', 'convert', 'aggregate', 'types', 'unique'];
    for (const id of path) {
      expect(root.querySelector(`[data-id="${id}"]`)!.classList.contains('dim'), id).toBe(false);
    }
    expect(root.querySelector('[data-id="missing"]')!.classList.contains('dim')).toBe(true);
  });

  it('search overrides path dimming', () => {
    const root = render({ selected: 'types', query: 'join' });
    expect(root.querySelector('[data-id="join"]')!.classList.contains('dim')).toBe(false);
    expect(root.querySelector('[data-id="types"]')!.classList.contains('dim')).toBe(false);
    expect(root.querySelectorAll('.node')).toHaveLength(concepts.length);
  });
});

describe('panel', () => {
  it('shows category and computed tier in the kicker', () => {
    const root = render({ selected: 'change' });
    expect(root.querySelector('.panel-kicker')!.textContent).toBe('ANALYSIS · TIER 4');
  });

  it('lists direct prerequisites as a needs-first line', () => {
    const root = render({ selected: 'change' });
    expect(root.querySelector('.needs-first')!.textContent).toBe('Group by · Convert types');
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

describe('visibleConcepts', () => {
  it('filters bonus concepts when hidden', () => {
    const base: AppState = { selected: '', query: '', done: new Set(), shared: null, confirmArm: null, bonusVisible: false };
    expect(visibleConcepts(base).every(c => !c.bonus)).toBe(true);
    expect(visibleConcepts({ ...base, bonusVisible: true })).toHaveLength(concepts.length);
  });
});
```

(If the designed closure of `change` differs from the six-id list above, use the actual closure from data.ts; the required property is that `missing` is outside it.)

- [ ] **Step 8: Modify `src/app.ts`**

Only these changes; everything else stays:

1. Imports: add `visibleConcepts` to the ./ui import and `type Layout` to the ./layout import line:

```ts
import { computeLayout, type Layout } from './layout';
import { effectiveDone, mountApp, promptFor, visibleConcepts, type App, type AppState, type Handlers } from './ui';
```

2. Replace `const layout = computeLayout(concepts);` with:

```ts
  const layoutAll = computeLayout(concepts);
  const layoutCore = computeLayout(concepts.filter(c => !c.bonus));
```

3. Add `bonusVisible: true,` to the state literal (after `confirmArm: null,`).

4. After the state literal's `state.selected = ...` line, replace the argument `concepts` with `visibleConcepts(state)` - and do the same in `onResetView` and `onExitView` (`defaultSelection(visibleConcepts(state), ...)`).

5. Add `const getLayout = (): Layout => (state.bonusVisible ? layoutAll : layoutCore);` right after the two layout constants.

6. Add the handler (after `onResetView`):

```ts
    onToggleBonus: visible => {
      state.bonusVisible = visible;
      const vis = visibleConcepts(state);
      if (!vis.some(c => c.id === state.selected)) {
        state.selected = defaultSelection(vis, effectiveDone(state));
      }
      disarm();
      app.update();
    },
```

7. Change the mount call to `app = mountApp(root, state, getLayout, handlers);`

- [ ] **Step 9: Update `src/app.test.ts`**

1. Import `concepts` from './data'.
2. In `renders all concepts...`: replace `toHaveLength(12)` with `toHaveLength(concepts.length)`.
3. Append inside the describe block:

```ts
  it('bonus toggle hides bonus concepts', () => {
    const { root } = mount();
    const bonusCount = concepts.filter(c => c.bonus).length;
    expect(bonusCount).toBeGreaterThan(0);
    expect(root.querySelectorAll('.node.bonus')).toHaveLength(bonusCount);
    const toggle = root.querySelector('#bonusToggle') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(root.querySelectorAll('.node.bonus')).toHaveLength(0);
    expect(root.querySelectorAll('.node')).toHaveLength(concepts.length - bonusCount);
  });

  it('hiding bonus reselects when a bonus concept was selected', () => {
    const { root } = mount();
    const bonusId = concepts.find(c => c.bonus)!.id;
    (root.querySelector(`[data-id="${bonusId}"]`) as HTMLButtonElement).click();
    const toggle = root.querySelector('#bonusToggle') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(root.querySelector('.node.active')!.getAttribute('data-id')).toBe('types');
  });
```

- [ ] **Step 10: Run the suite and build**

Run: `npx vitest run` then `npm run build`
Expected: all suites green, build clean.

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "feat: hop-depth tech tree with expanded curriculum and bonus toggle"
```

---

### Task 3: Dark theme, title, README

**Files:**
- Rewrite: `src/style.css`
- Modify: `index.html` (title only), `README.md` (name/description lines only)

**Interfaces:**
- Consumes: the class contract from Task 2's markup: `.app .banner .banner-actions .topbar .brand .top-actions .search .btn .btn.accent .btn.small .btn.danger .toggle .layout .workspace .graph-wrap .graph .col-label .edges .edge .edge.active .edge.dim .node .node.active .node.path .node.done .node.dim .node.bonus .node-title .node-meta .cat-foundations .cat-wrangling .cat-tables .cat-process .cat-analysis .cat-viz-build .panel .panel-kicker .desc .needs-first .section .prompt .status .empty`

- [ ] **Step 1: Rewrite `src/style.css`**

```css
:root {
  --bg: #0b101c;
  --panel: #0d1322;
  --card: #121a2d;
  --card-border: #243350;
  --ink: #e9eef8;
  --muted: #8e99af;
  --line: #1c2740;
  --accent: #f2b63d;
  --accent-ink: #191106;
  --green: #3ecf8e;
  --danger: #e0604f;
  --cat-foundations: #e0a63f;
  --cat-wrangling: #3ecf8e;
  --cat-tables: #6d9bff;
  --cat-process: #93a0b8;
  --cat-analysis: #f28a4a;
  --cat-viz-build: #ef6e5a;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, ui-sans-serif, sans-serif;
}

button, input { font: inherit; }

.app { min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; }

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 28px;
  background: #241c0c;
  border-bottom: 1px solid #59481c;
  color: #f2d98b;
  font-weight: 650;
}

.banner-actions { display: flex; gap: 8px; }

.topbar {
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.brand { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.brand h1 {
  margin: 0;
  font: 700 17px/1.2 var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.brand p { margin: 0; color: var(--muted); font-size: 13px; }

.top-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font: 12px var(--mono);
  color: var(--ink);
  white-space: nowrap;
  cursor: pointer;
}
.toggle input { accent-color: var(--accent); width: 15px; height: 15px; }

.search {
  background: #0f1626;
  border: 1px solid var(--card-border);
  border-radius: 9px;
  padding: 8px 11px;
  width: 200px;
  color: var(--ink);
  outline: none;
}
.search::placeholder { color: #5c6a85; }
.search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #f2b63d22; }

.btn {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--ink);
  border-radius: 9px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 650;
}
.btn:hover { border-color: #3a4d78; background: #131c31; }
.btn.accent { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.btn.accent:hover { background: #f8c45c; border-color: #f8c45c; }
.btn.small { padding: 6px 10px; font-size: 12px; }
.btn.danger { border-color: var(--danger); color: #ff9184; background: #2a1512; }
.btn.danger:hover { border-color: #ff9184; background: #341a16; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 400px; min-height: 0; }

.workspace { padding: 18px 20px; min-width: 0; }

.graph-wrap {
  background: #0c111e;
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: auto;
  min-height: 640px;
}

.graph { position: relative; }

.col-label {
  position: absolute;
  top: 26px;
  width: 204px;
  color: #5c6a85;
  font: 700 11px var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  border-bottom: 1px dashed #2a3752;
  padding-bottom: 7px;
}

.edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

.edge {
  stroke: #2c3b5c;
  stroke-width: 1.5;
  fill: none;
  opacity: 0.55;
  transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
}
.edge.active { stroke: var(--accent); stroke-width: 2.5; opacity: 1; }
.edge.dim { opacity: 0.12; }

.node {
  position: absolute;
  width: 204px;
  min-height: 58px;
  background: var(--card);
  border: 1.5px solid var(--card-border);
  border-radius: 10px;
  padding: 9px 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s, opacity 0.2s, transform 0.2s;
  z-index: 2;
}
.node:hover { transform: translateY(-1px); border-color: #3a4d78; }
.node.bonus { border-style: dashed; }
.node.path { border-color: var(--accent); }
.node.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px #f2b63d33, 0 0 22px #f2b63d1f;
}
.node.dim { opacity: 0.16; }
.node.done .node-title::after { content: " ✓"; color: var(--green); }

.node-title { font: 700 13px/1.35 var(--mono); color: var(--ink); }
.node-meta { font: 11px var(--mono); margin-top: 4px; color: var(--muted); }

.node.cat-foundations .node-meta { color: var(--cat-foundations); }
.node.cat-wrangling .node-meta { color: var(--cat-wrangling); }
.node.cat-tables .node-meta { color: var(--cat-tables); }
.node.cat-process .node-meta { color: var(--cat-process); }
.node.cat-analysis .node-meta { color: var(--cat-analysis); }
.node.cat-viz-build .node-meta { color: var(--cat-viz-build); }

.panel {
  background: var(--panel);
  border-left: 1px solid var(--line);
  padding: 26px 24px;
  overflow: auto;
}

.panel-kicker {
  color: #a78bfa;
  font: 700 11px var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
.panel h2 { font-size: 24px; line-height: 1.15; margin: 8px 0 8px; font-family: var(--mono); }
.panel .desc { color: var(--muted); margin: 0 0 16px; }

.section { border-top: 1px solid var(--line); padding: 16px 0; }
.section h3 {
  font: 700 11px var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 9px;
  color: var(--muted);
}
.needs-first { margin: 0; font-family: var(--mono); font-size: 13px; }
.section p { color: var(--muted); }
.section .needs-first { color: var(--ink); }

.prompt {
  background: #0f1626;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px;
  font-size: 12.5px;
  color: #c2cde2;
  white-space: pre-wrap;
  max-height: 240px;
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
  margin-bottom: 4px;
}
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--green); }

.empty { padding: 50px; text-align: center; color: var(--muted); }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .panel { border-left: 0; border-top: 1px solid var(--line); }
  .topbar { align-items: flex-start; flex-direction: column; }
  .top-actions { width: 100%; justify-content: flex-start; }
  .search { flex: 1; width: auto; }
  .banner { flex-direction: column; align-items: flex-start; }
  .graph-wrap { min-height: 520px; }
}
```

- [ ] **Step 2: index.html title**

Change `<title>Data Analysis Concept Tree</title>` to `<title>DA Concept Tech Tree</title>`.

- [ ] **Step 3: README heading**

Change the first line to `# DA Concept Tech Tree` and the first paragraph to:

```
A dark tech-tree learning map for data-analysis concepts: hop-depth columns, prerequisite paths that light up, learner-owned progress, and a copy-to-Copilot tutor prompt per concept.
```

- [ ] **Step 4: Verify**

Run: `npx vitest run` and `npm run build`
Expected: green, clean.

- [ ] **Step 5: Commit**

```bash
git add src/style.css index.html README.md
git commit -m "feat: dark tech-tree theme"
```

---

### Task 4: Lead E2E verification vs mock (performed by the lead)

- [ ] Preview build in Chrome; compare against the mock: column labels with dashed underline, node card styling per category, bonus dashed borders, path lighting + heavy dim, bezier edges, panel layout, amber Copy prompt.
- [ ] Verify all preserved machinery still works on dark theme: done toggle + persist, share view-mode no-clobber, two-step confirms, search override dim, reset view.
- [ ] Bonus toggle: uncheck hides dashed nodes and reflows nothing else (depths stable); bonus-selected reselect works.
- [ ] Mobile 390 px: no horizontal page scroll; graph scrolls internally.
- [ ] Pixel pickiness: spacing, letter-spacing on mono labels, edge curve quality, dim levels legible.

### Task 5: Fresh-perspective review (Codex) + final whole-branch review + one fix wave

- [ ] Codex over the redesign diff; final code-reviewer (most capable model) over the branch; one fix dispatch, one scoped re-review.

### Task 6: Deploy

- [ ] Merge branch to main, push (CI deploys), verify live URL serves the new title and assets.
