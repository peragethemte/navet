import type { PlatformCalendarEvent } from '@navet/app/platform/provider-feature-models';
import { integrationCalendarFeatureService } from '@navet/app/services/integration-calendar-feature.service';

/**
 * A month grid can start up to six days before the first of the month, so a week of padding covers
 * every locale's first weekday without the fetch having to know which one is in use.
 */
const CALENDAR_FETCH_PAST_PADDING_DAYS = 7;

/** Covers the longest agenda (14 days) and the tail of a month grid from any day of the month. */
const CALENDAR_FETCH_FORWARD_DAYS = 45;

export interface CalendarFetchWindow {
  startDateTime: string;
  endDateTime: string;
}

/**
 * The span the card may need to render, resolved on the local clock.
 *
 * Deliberately not memoised by the caller: it is recomputed on each refresh so a panel left running
 * for weeks rolls into the new month on its own.
 */
export function resolveCalendarFetchWindow(now: Date): CalendarFetchWindow {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1 - CALENDAR_FETCH_PAST_PADDING_DAYS,
    0,
    0,
    0,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + CALENDAR_FETCH_FORWARD_DAYS,
    23,
    59,
    59,
    999
  );

  return { startDateTime: start.toISOString(), endDateTime: end.toISOString() };
}

interface CacheEntry {
  expiresAt: number;
  events: Promise<PlatformCalendarEvent[]>;
}

const requestCache = new Map<string, CacheEntry>();

function pruneExpired(now: number) {
  for (const [key, entry] of requestCache) {
    if (entry.expiresAt <= now) {
      requestCache.delete(key);
    }
  }
}

/**
 * One request per calendar and window, shared by every mounted consumer.
 *
 * `useProviderCollectionData` keeps per-instance state, so the dashboard's collection hook and each
 * mounted calendar card otherwise fetch the same calendars separately, and all of them fire at once
 * when the tab regains focus. That was affordable while the window was a week; it is not once the
 * window covers a month grid. Failures are not cached, so a dropped connection retries on the next
 * refresh instead of leaving the card empty for a full interval.
 */
export function requestCalendarEvents(
  scopedEntityId: string,
  window: CalendarFetchWindow,
  ttlMs: number
): Promise<PlatformCalendarEvent[]> {
  const now = Date.now();
  pruneExpired(now);

  const key = `${scopedEntityId}|${window.startDateTime}|${window.endDateTime}`;
  const cached = requestCache.get(key);
  if (cached) {
    return cached.events;
  }

  const events = integrationCalendarFeatureService.getEvents(scopedEntityId, window).then(
    (result) => result,
    () => {
      requestCache.delete(key);
      return [] as PlatformCalendarEvent[];
    }
  );

  requestCache.set(key, { expiresAt: now + ttlMs, events });
  return events;
}

export function clearCalendarEventsRequestCache() {
  requestCache.clear();
}
