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
