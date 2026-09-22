import { STORAGE_KEYS } from '@navet/app/constants/storage-keys';
import { useI18n, usePersistedState, useProviderCalendarDevicesCollection } from '@navet/app/hooks';
import { parseProviderScopedId } from '@navet/app/utils/provider-ids';
import { subscribeVisibilityAwareTask } from '@navet/app/utils/visibility-aware-scheduler';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCalendarEventSortValue,
  isCalendarEventVisibleInWindow,
} from './calendar-event-visibility';
import { resolveCalendarSourceColor } from './calendar-source-colors';
import type { CalendarEvent } from './types';

type PersistedCalendarSources = Record<string, string[]>;
type CalendarViewMode = 'day' | 'week' | 'month';
type PersistedCalendarViewModes = Record<string, CalendarViewMode>;
type PersistedCalendarTintColors = Record<string, string>;

const CALENDAR_TIME_WINDOW_REFRESH_MS = 60 * 1000;
const EVENT_LIMIT_BY_VIEW_MODE: Record<CalendarViewMode, number> = { day: 12, week: 7, month: 12 };

// Day means the rest of today, so the card empties as the evening ends rather than rolling into
// tomorrow. Week and month stay rolling windows, which is how they already behaved.
function resolveWindowEnd(now: Date, viewMode: CalendarViewMode): Date {
  if (viewMode === 'day') {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }

  const endDate = new Date(now);
  endDate.setDate(now.getDate() + (viewMode === 'week' ? 7 : 31));
  return endDate;
}

export function useCalendarCardSources(cardId?: string, fallbackEvents: CalendarEvent[] = []) {
  const { t } = useI18n();
  // The card's own id names the provider that owns it. Resolving from that rather than from the
  // current provider is what lets a calendar-only provider - one that is never the current
  // session, such as iCloud next to a Homey hub - still populate the source picker.
  const cardProviderId = cardId ? parseProviderScopedId(cardId)?.providerId : undefined;
  const calendars = useProviderCalendarDevicesCollection(cardProviderId);
  const [timeWindowTick, setTimeWindowTick] = useState(() => Date.now());
  const [calendarSources, setCalendarSources] = usePersistedState<PersistedCalendarSources>(
    STORAGE_KEYS.calendarCardSources,
    {}
  );
  const [calendarViewModes, setCalendarViewModes] = usePersistedState<PersistedCalendarViewModes>(
    STORAGE_KEYS.calendarCardViewModes,
    {}
  );
  const [calendarTintColors, setCalendarTintColors] =
    usePersistedState<PersistedCalendarTintColors>(STORAGE_KEYS.calendarCardTintColors, {});
  const lastResolvedSelectedEventsRef = useRef<CalendarEvent[]>(fallbackEvents);

  useEffect(() => {
    return subscribeVisibilityAwareTask(
      () => setTimeWindowTick(Date.now()),
      CALENDAR_TIME_WINDOW_REFRESH_MS
    );
  }, []);

  const availableCalendars = useMemo(
    () =>
      calendars.flatMap((calendar) => {
        const sources =
          Array.isArray(calendar.sources) && calendar.sources.length > 0
            ? calendar.sources
            : [calendar];

        return sources.map((source, index) => ({
          ...source,
          color: resolveCalendarSourceColor(source.accentColor, index),
        }));
      }),
    [calendars]
  );

  const selectedCalendarIds = useMemo(() => {
    if (!cardId) {
      return [];
    }

    const stored = calendarSources[cardId];
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }

    const aggregateCard = calendars.find((calendar) => calendar.id === cardId);
    if (aggregateCard?.sourceIds?.length) {
      return aggregateCard.sourceIds;
    }

    return [cardId];
  }, [calendarSources, calendars, cardId]);
  const viewMode = useMemo<CalendarViewMode>(() => {
    if (!cardId) {
      return 'week';
    }

    return calendarViewModes[cardId] ?? 'week';
  }, [calendarViewModes, cardId]);
  const tintColor = useMemo(() => {
    if (!cardId) {
      return undefined;
    }

    return calendarTintColors[cardId];
  }, [calendarTintColors, cardId]);

  const selectedEvents = useMemo(() => {
    if (!cardId) {
      return fallbackEvents;
    }

    const selectedIdSet = new Set(selectedCalendarIds);
    const matchedCalendars = availableCalendars.filter((calendar) =>
      selectedIdSet.has(calendar.id)
    );
    if (matchedCalendars.length === 0) {
      if (fallbackEvents.length > 0) {
        return fallbackEvents;
      }

      return lastResolvedSelectedEventsRef.current;
    }

    const now = new Date(timeWindowTick);
    const endDate = resolveWindowEnd(now, viewMode);

    return matchedCalendars
      .flatMap((calendar) =>
        calendar.events.map((event) => ({
          ...event,
          color: calendar.color,
        }))
      )
      .filter((event) => isCalendarEventVisibleInWindow(event, now, endDate))
      .sort((left, right) => {
        const leftKey = getCalendarEventSortValue(left);
        const rightKey = getCalendarEventSortValue(right);
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, EVENT_LIMIT_BY_VIEW_MODE[viewMode]);
  }, [availableCalendars, cardId, fallbackEvents, selectedCalendarIds, timeWindowTick, viewMode]);

  useEffect(() => {
    if (selectedEvents.length > 0 || fallbackEvents.length === 0) {
      lastResolvedSelectedEventsRef.current = selectedEvents;
    }
  }, [fallbackEvents.length, selectedEvents]);

  const selectedCalendarLabel = useMemo(() => {
    const matchedCalendars = availableCalendars.filter((calendar) =>
      selectedCalendarIds.includes(calendar.id)
    );

    if (matchedCalendars.length === 1) {
      return matchedCalendars[0].name;
    }

    if (matchedCalendars.length > 1) {
      return t('calendar.selectedCalendars', { count: matchedCalendars.length });
    }

    return t('calendar.defaultSourceName');
  }, [availableCalendars, selectedCalendarIds, t]);

  const setSelectedCalendarIds = (nextIds: string[]) => {
    if (!cardId) {
      return;
    }

    setCalendarSources((current) => ({
      ...current,
      [cardId]: nextIds,
    }));
  };

  const setViewMode = (nextViewMode: CalendarViewMode) => {
    if (!cardId) {
      return;
    }

    setCalendarViewModes((current) => ({
      ...current,
      [cardId]: nextViewMode,
    }));
  };

  const setTintColor = (nextTintColor?: string) => {
    if (!cardId) {
      return;
    }

    setCalendarTintColors((current) => {
      if (!nextTintColor) {
        const { [cardId]: _removedTintColor, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [cardId]: nextTintColor,
      };
    });
  };

  return {
    availableCalendars,
    selectedCalendarIds,
    selectedCalendarLabel,
    selectedEvents,
    setSelectedCalendarIds,
    setTintColor,
    setViewMode,
    tintColor,
    viewMode,
  };
}
