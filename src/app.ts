import { tracks, type TrackId } from './data';
import { computeLayout, type Layout } from './layout';
import { decodeShareHash, encodeShareHash } from './share';
import { defaultSelection, loadProgress, saveProgress, type StorageLike } from './state';
import { activeTrack, effectiveDone, mountApp, promptFor, visibleConcepts, type App, type AppState, type Handlers } from './ui';

export function init(root: HTMLElement, storage: StorageLike, hash: string, shareBase: string): void {
  const layouts = new Map(
    tracks.map(t => [
      t.id,
      {
        all: computeLayout(t.concepts),
        core: computeLayout(t.concepts.filter(c => !c.bonus)),
      },
    ]),
  );
  const getLayout = (): Layout => {
    const pair = layouts.get(state.trackId)!;
    return state.bonusVisible ? pair.all : pair.core;
  };

  const progress = loadProgress(storage, tracks);
  const shared = decodeShareHash(hash, tracks);
  const state: AppState = {
    trackId: shared ? shared.track : progress.track,
    selected: '',
    query: '',
    done: progress.done,
    shared,
    confirmArm: null,
    bonusVisible: true,
  };
  state.selected = defaultSelection(visibleConcepts(state), effectiveDone(state));

  let app: App;
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  const disarmLater = (): void => {
    clearTimeout(disarmTimer);
    disarmTimer = setTimeout(() => {
      state.confirmArm = null;
      app.update();
    }, 4000);
  };

  const disarm = (): void => {
    clearTimeout(disarmTimer);
    state.confirmArm = null;
  };

  const clearHash = (): void => {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  if (!state.shared && hash.startsWith('#s=')) clearHash();

  const save = (): void => saveProgress(storage, { track: state.trackId, done: state.done });

  const doneFor = (track: TrackId): Set<string> => {
    let set = state.done.get(track);
    if (!set) {
      set = new Set();
      state.done.set(track, set);
    }
    return set;
  };

  const flashTimers = new Map<HTMLButtonElement, { timer: ReturnType<typeof setTimeout>; original: string }>();
  const flash = (button: HTMLButtonElement, text: string): void => {
    const pending = flashTimers.get(button);
    const original = pending?.original ?? button.textContent ?? '';
    if (pending) clearTimeout(pending.timer);
    button.textContent = text;
    const timer = setTimeout(() => {
      button.textContent = original;
      flashTimers.delete(button);
    }, 1400);
    flashTimers.set(button, { timer, original });
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
    onSelectTrack: id => {
      if (state.shared || state.trackId === id) return;
      state.trackId = id;
      state.query = '';
      disarm();
      state.selected = defaultSelection(visibleConcepts(state), effectiveDone(state));
      save();
      app.update();
    },
    onSelect: id => {
      state.selected = id;
      disarm();
      app.update();
    },
    onSearch: query => {
      state.query = query;
      disarm();
      app.update();
    },
    onResetView: () => {
      state.query = '';
      disarm();
      state.selected = defaultSelection(visibleConcepts(state), effectiveDone(state));
      app.update();
    },
    onToggleBonus: visible => {
      state.bonusVisible = visible;
      const vis = visibleConcepts(state);
      if (!vis.some(c => c.id === state.selected)) {
        state.selected = defaultSelection(vis, effectiveDone(state));
      }
      disarm();
      app.update();
    },
    onToggleDone: id => {
      if (state.shared) return;
      const done = doneFor(state.trackId);
      if (done.has(id)) done.delete(id);
      else done.add(id);
      save();
      app.update();
    },
    onShare: button => {
      void copyText(button, shareBase + encodeShareHash(state.trackId, doneFor(state.trackId)), 'Link copied');
    },
    onCopyPrompt: (concept, button) => {
      void copyText(button, promptFor(concept, activeTrack(state)), 'Copied');
    },
    onExitView: () => {
      state.shared = null;
      disarm();
      clearHash();
      state.selected = defaultSelection(visibleConcepts(state), effectiveDone(state));
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
      state.done.set(state.shared.track, new Set(state.shared.done));
      state.trackId = state.shared.track;
      state.shared = null;
      save();
      disarm();
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
      state.done.delete(state.trackId);
      save();
      disarm();
      app.update();
    },
  };

  app = mountApp(root, state, getLayout, handlers);
  app.update();
  if (state.shared && typeof window !== 'undefined') window.scrollTo(0, 0);
}
