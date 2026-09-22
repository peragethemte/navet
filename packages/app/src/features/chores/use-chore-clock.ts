import { useSyncExternalStore } from 'react';

const TICK_INTERVAL_MS = 30_000;

let current = new Date();
let interval: number | undefined;
const listeners = new Set<() => void>();

function tick() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  current = new Date();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (interval === undefined) {
    // Catch up immediately: the shared date may be minutes old if nothing was subscribed.
    current = new Date();
    interval = window.setInterval(tick, TICK_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval !== undefined) {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      interval = undefined;
    }
  };
}

/**
 * One 30-second clock for every chore surface. Several cards on the same dashboard would otherwise
 * each run a timer and each produce a distinct `Date`, defeating every downstream `useMemo`.
 */
export function useChoreClock() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current
  );
}
