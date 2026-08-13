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

  it('matches on the task field', () => {
    expect(matchesQuery(conceptById.get('segment')!, 'quartiles')).toBe(true);
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
    expect(root.querySelector('[data-id="missing"]')!.classList.contains('dim')).toBe(true);
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

  it('orders the path summary by depth', () => {
    const root = render({ selected: 'change' });
    expect(root.querySelector('.path-summary')!.textContent).toBe(
      'Data types → Unique values → Aggregate → Convert types → Group by → Change over time',
    );
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

describe('edges', () => {
  const edgeCount = (list: { pre: string[] }[]): number => list.reduce((n, c) => n + c.pre.length, 0);

  it('renders one bezier path per visible prerequisite', () => {
    const root = render();
    const paths = root.querySelectorAll('.edge');
    expect(paths).toHaveLength(edgeCount(concepts));
    for (const p of paths) {
      const d = p.getAttribute('d') ?? '';
      expect(d.startsWith('M ')).toBe(true);
      expect(d).toContain(' C ');
    }
  });

  it('drops bonus edges when bonus is hidden', () => {
    const root = render({ bonusVisible: false });
    expect(root.querySelectorAll('.edge')).toHaveLength(edgeCount(concepts.filter(c => !c.bonus)));
  });

  it('marks exactly the on-path edges active and dims the rest', () => {
    const root = render({ selected: 'change' });
    expect(root.querySelectorAll('.edge.active')).toHaveLength(6);
    expect(root.querySelectorAll('.edge.active.dim')).toHaveLength(0);
    expect(root.querySelectorAll('.edge:not(.active):not(.dim)')).toHaveLength(0);
  });
});
