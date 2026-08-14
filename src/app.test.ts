import { beforeEach, describe, expect, it, vi } from 'vitest';
import { init } from './app';
import { trackById } from './data';
import { encodeShareHash } from './share';
import { STORAGE_KEY, type StorageLike } from './state';

const da = trackById.get('data-analyst')!;
const sd = trackById.get('system-design')!;

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

  it('renders the data-analyst track by default and selects the first not-done concept', () => {
    const { root } = mount();
    expect(root.querySelectorAll('.node')).toHaveLength(da.concepts.length);
    expect(root.querySelector('.node.active')!.getAttribute('data-id')).toBe('types');
  });

  it('switches tracks from the tabs and selects that track first concept', () => {
    const { root } = mount();
    btn(root, '[data-track="system-design"]').click();
    expect(root.querySelectorAll('.node')).toHaveLength(sd.concepts.length);
    expect(root.querySelector('.node.active')!.getAttribute('data-id')).toBe('client-server');
    expect(root.querySelector('.track-tab.active')!.getAttribute('data-track')).toBe('system-design');
  });

  it('persists the active track and restores it on reload', () => {
    const { root, storage } = mount();
    btn(root, '[data-track="system-design"]').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('"track":"system-design"');
    document.body.innerHTML = '';
    const again = mount('', storage);
    expect(again.root.querySelector('.track-tab.active')!.getAttribute('data-track')).toBe('system-design');
  });

  it('keeps per-track progress independent', () => {
    const { root } = mount();
    btn(root, '#toggleDone').click();
    btn(root, '[data-track="system-design"]').click();
    expect(root.querySelectorAll('.node.done')).toHaveLength(0);
    btn(root, '#toggleDone').click();
    btn(root, '[data-track="data-analyst"]').click();
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });

  it('clears the search box when switching tracks', () => {
    const { root } = mount();
    const search = root.querySelector('#search') as HTMLInputElement;
    search.value = 'join';
    search.dispatchEvent(new Event('input'));
    btn(root, '[data-track="system-design"]').click();
    expect((root.querySelector('#search') as HTMLInputElement).value).toBe('');
  });

  it('migrates a v1 storage payload to data-analyst progress', () => {
    const storage = memStorage();
    storage.setItem(STORAGE_KEY, '{"v":1,"done":["types"]}');
    const { root } = mount('', storage);
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });

  it('toggling done persists to storage and updates the map', () => {
    const { root, storage } = mount();
    btn(root, '#toggleDone').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('types');
    expect(root.querySelector('[data-id="types"]')!.classList.contains('done')).toBe(true);
  });

  it('share hash opens read-only view without touching storage', () => {
    const { root, storage } = mount(encodeShareHash('data-analyst', new Set(['types'])));
    expect(root.querySelector('.banner')).not.toBeNull();
    expect(root.querySelector('#toggleDone')).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('opens a shared link on the track it was shared from', () => {
    const { root } = mount(encodeShareHash('system-design', new Set(['client-server'])));
    expect(root.querySelectorAll('.node')).toHaveLength(sd.concepts.length);
    expect(root.querySelector('[data-id="client-server"]')!.classList.contains('done')).toBe(true);
    expect(root.querySelector<HTMLElement>('#trackTabs')!.hidden).toBe(true);
  });

  it('import requires two clicks and then replaces progress on the shared track', () => {
    const { root, storage } = mount(encodeShareHash('system-design', new Set(['client-server'])));
    btn(root, '#importShared').click();
    expect(storage.data.size).toBe(0);
    btn(root, '#importShared').click();
    const raw = storage.getItem(STORAGE_KEY)!;
    expect(raw).toContain('client-server');
    expect(raw).toContain('"track":"system-design"');
    expect(root.querySelector('.banner')).toBeNull();
    expect(root.querySelector('.track-tab.active')!.getAttribute('data-track')).toBe('system-design');
  });

  it('exit view leaves local progress alone', () => {
    const { root, storage } = mount(encodeShareHash('data-analyst', new Set(['types'])));
    btn(root, '#exitView').click();
    expect(root.querySelector('.banner')).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('reset progress requires two clicks and only clears the active track', () => {
    const { root, storage } = mount();
    btn(root, '#toggleDone').click();
    btn(root, '[data-track="system-design"]').click();
    btn(root, '#toggleDone').click();
    btn(root, '#resetProgress').click();
    expect(storage.getItem(STORAGE_KEY)).toContain('client-server');
    btn(root, '#resetProgress').click();
    expect(storage.getItem(STORAGE_KEY)).not.toContain('client-server');
    expect(storage.getItem(STORAGE_KEY)).toContain('types');
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

  it('auto-disarms a pending confirm after 4 seconds', () => {
    vi.useFakeTimers();
    try {
      const { root, storage } = mount();
      btn(root, '#toggleDone').click();
      btn(root, '#resetProgress').click();
      vi.advanceTimersByTime(4100);
      btn(root, '#resetProgress').click();
      expect(storage.getItem(STORAGE_KEY)).toContain('types');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders armed confirm label with danger styling', () => {
    const { root } = mount();
    btn(root, '#toggleDone').click();
    btn(root, '#resetProgress').click();
    const armed = btn(root, '#resetProgress');
    expect(armed.textContent).toBe("Really erase this track's progress?");
    expect(armed.classList.contains('danger')).toBe(true);
  });

  it('bonus toggle hides bonus concepts', () => {
    const { root } = mount();
    const bonusCount = da.concepts.filter(c => c.bonus).length;
    expect(bonusCount).toBeGreaterThan(0);
    expect(root.querySelectorAll('.node.bonus')).toHaveLength(bonusCount);
    const toggle = root.querySelector('#bonusToggle') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(root.querySelectorAll('.node.bonus')).toHaveLength(0);
    expect(root.querySelectorAll('.node')).toHaveLength(da.concepts.length - bonusCount);
  });

  it('hiding bonus reselects when a bonus concept was selected', () => {
    const { root } = mount();
    const bonusId = da.concepts.find(c => c.bonus)!.id;
    (root.querySelector(`[data-id="${bonusId}"]`) as HTMLButtonElement).click();
    const toggle = root.querySelector('#bonusToggle') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(root.querySelector('.node.active')!.getAttribute('data-id')).toBe('types');
  });

  it('clears a malformed share hash from the URL', () => {
    const spy = vi.spyOn(history, 'replaceState');
    mount('#s=!!!garbage!!!');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('share button label survives a double click', async () => {
    vi.useFakeTimers();
    try {
      const { root } = mount();
      const share = btn(root, '#share');
      share.click();
      await vi.advanceTimersByTimeAsync(200);
      share.click();
      await vi.advanceTimersByTimeAsync(5000);
      expect(share.textContent).toBe('Share progress');
    } finally {
      vi.useRealTimers();
    }
  });
});
