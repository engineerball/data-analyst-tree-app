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
