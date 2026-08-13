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
