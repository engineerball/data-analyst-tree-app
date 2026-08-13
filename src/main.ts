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
