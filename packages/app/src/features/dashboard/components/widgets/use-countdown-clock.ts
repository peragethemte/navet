import { subscribeVisibilityAwareTask } from '@navet/app/utils/visibility-aware-scheduler';
import { useEffect, useState } from 'react';

/**
 * Ticks through the shared deadline timer rather than an interval of its own, so a wall display
 * running several countdowns keeps one timer and stops it entirely while the document is hidden.
 * Keep the subscriber small: whatever renders this hook re-renders on every tick.
 */
export function useCountdownClock(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => subscribeVisibilityAwareTask(() => setNow(new Date()), intervalMs), [intervalMs]);

  return now;
}
