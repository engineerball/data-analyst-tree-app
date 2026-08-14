import type { Concept, Track, TrackId } from './data';
import { trackById, tracks } from './data';
import { withPrereqs } from './graph';
import type { Layout } from './layout';
import { NODE_H, NODE_W } from './layout';
import type { ShareData } from './share';

export interface AppState {
  trackId: TrackId;
  selected: string;
  query: string;
  done: Map<TrackId, Set<string>>;
  shared: ShareData | null;
  confirmArm: 'import' | 'reset' | null;
  bonusVisible: boolean;
}

export interface Handlers {
  onSelectTrack(id: TrackId): void;
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

const EMPTY: ReadonlySet<string> = new Set();

export function activeTrack(state: AppState): Track {
  return trackById.get(state.trackId)!;
}

export function effectiveDone(state: AppState): ReadonlySet<string> {
  return state.shared ? state.shared.done : (state.done.get(state.trackId) ?? EMPTY);
}

export function visibleConcepts(state: AppState): Concept[] {
  const list = activeTrack(state).concepts;
  return state.bonusVisible ? list : list.filter(c => !c.bonus);
}

export function matchesQuery(c: Concept, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${c.title} ${c.cat} ${c.desc} ${c.task ?? ''}`.toLowerCase().includes(q);
}

export function promptFor(c: Concept, track: Track): string {
  const task = c.task ? ` ${c.task}` : '';
  return `You are my ${track.tutorRole}. Teach me one concept: ${c.title} - ${c.desc} Explain it in plain language, then show a small worked example using ${track.tutorContext}${task} Finish with one small exercise for me on this concept, wait for my answer, then check it.`;
}

function catIndex(track: Track): Map<string, number> {
  const index = new Map<string, number>();
  for (const c of track.concepts) {
    if (!index.has(c.cat)) index.set(c.cat, index.size);
  }
  return index;
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
      <h1>AI Learning Tree</h1>
      <p id="tagline"></p>
    </div>
    <nav id="trackTabs" class="track-tabs" aria-label="Learning tracks"></nav>
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
    root.querySelector<HTMLElement>('#tagline')!.textContent = activeTrack(state).tagline;
    renderTabs(root.querySelector<HTMLElement>('#trackTabs')!, state, h);
    shareBtn.hidden = state.shared !== null;
    bonusToggle.checked = state.bonusVisible;
    if (search.value !== state.query) search.value = state.query;
    renderGraph(root.querySelector<HTMLElement>('#graph')!, state, layout, h);
    renderPanel(root.querySelector<HTMLElement>('#panel')!, state, layout, h);
  };
  return { update };
}

function renderTabs(nav: HTMLElement, state: AppState, h: Handlers): void {
  nav.hidden = state.shared !== null;
  nav.innerHTML = tracks
    .map(
      t =>
        `<button class="track-tab${t.id === state.trackId ? ' active' : ''}" data-track="${esc(t.id)}">${esc(t.title)}</button>`,
    )
    .join('');
  nav.querySelectorAll<HTMLButtonElement>('.track-tab').forEach(btn => {
    btn.addEventListener('click', () => h.onSelectTrack(btn.dataset.track as TrackId));
  });
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
  const track = activeTrack(state);
  const path = withPrereqs(state.selected, track.byId);
  const filtering = state.query.trim().length > 0;
  const list = visibleConcepts(state);
  const cats = catIndex(track);
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
      const cls = ['node', `cat-c${cats.get(c.cat)!}`];
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
  const track = activeTrack(state);
  const c = track.byId.get(state.selected);
  if (!c) {
    panel.innerHTML = '<div class="empty">Select a concept.</div>';
    return;
  }
  const done = effectiveDone(state);
  const pathSet = withPrereqs(c.id, track.byId);
  const viewOnly = state.shared !== null;
  const resetArming = state.confirmArm === 'reset';
  const tier = layout.depth.get(c.id) ?? 1;
  const needsFirst = c.pre.length
    ? c.pre.map(p => esc(track.byId.get(p)!.title)).join(' · ')
    : 'No prerequisites';
  const orderedPath = [...pathSet].sort(
    (a, b) => (layout.depth.get(a) ?? 0) - (layout.depth.get(b) ?? 0),
  );

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
  <button id="resetProgress" class="btn small${resetArming ? ' danger' : ''}">${resetArming ? 'Really erase this track&#39;s progress?' : 'Reset track progress'}</button>
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
  <div class="prompt">${esc(promptFor(c, track))}</div>
  <button id="copy" class="btn accent">Copy prompt</button>
</div>
<div class="section">
  <h3>Path summary</h3>
  <p class="path-summary">${orderedPath.map(id => esc(track.byId.get(id)!.title)).join(' → ')}</p>
</div>${resetSection}`;

  panel.querySelector<HTMLButtonElement>('#toggleDone')?.addEventListener('click', () => h.onToggleDone(c.id));
  const copyBtn = panel.querySelector<HTMLButtonElement>('#copy')!;
  copyBtn.addEventListener('click', () => h.onCopyPrompt(c, copyBtn));
  panel.querySelector<HTMLButtonElement>('#resetProgress')?.addEventListener('click', () => h.onResetProgress());
}
