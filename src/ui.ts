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
