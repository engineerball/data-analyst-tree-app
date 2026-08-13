import './style.css';
import { init } from './app';
import type { StorageLike } from './state';

function safeStorage(): StorageLike {
  const memory = new Map<string, string>();
  let broken = false;
  return {
    getItem(key) {
      if (!broken) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          broken = true;
        }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      if (!broken) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch {
          broken = true;
        }
      }
      memory.set(key, value);
    },
  };
}

init(
  document.querySelector<HTMLElement>('#app')!,
  safeStorage(),
  location.hash,
  location.origin + location.pathname + location.search,
);

window.addEventListener('hashchange', () => location.reload());
