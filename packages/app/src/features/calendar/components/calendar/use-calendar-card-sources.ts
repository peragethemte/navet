import { STORAGE_KEYS } from '@navet/app/constants/storage-keys';
import { useI18n, usePersistedState, useProviderCalendarDevicesCollection } from '@navet/app/hooks';
import { parseProviderScopedId } from '@navet/app/utils/provider-ids';
import { subscribeVisibilityAwareTask } from '@navet/app/utils/visibility-aware-scheduler';
import { getFirstDayOfWeek } from '@navet/core/calendar-dates';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCalendarEventSortValue,
  isCalendarEventVisibleInWindow,
} from './calendar-event-visibility';
import { resolveCalendarSourceColor } from './calendar-source-colors';
import {
  type CalendarViewMode,
  clampCalendarDayCount,
  normalizeCalendarViewMode,
  resolveCalendarCardWindow,
} from './calendar-view-mode';
import type { CalendarEvent } from './types';

type PersistedCalendarSources = Record<string, string[]>;
// Stored loosely: profiles written before the day count existed hold the retired `week` value.
type PersistedCalendarViewModes = Record<string, string>;
type PersistedCalendarDayCounts = Record<string, number>;
type PersistedCalendarTintColors = Record<string, string>;

const CALENDAR_TIME_WINDOW_REFRESH_MS = 60 * 1000;

/**
 * Render ceiling for one card. A month of a busy household sits well inside this; it exists so a
 * misconfigured calendar cannot hand the view an unbounded list.
 */
const MAX_CALENDAR_CARD_EVENTS = 400;

export function useCalendarCardSources(cardId?: string, fallbackEvents: CalendarEvent[] = []) {
  const { locale, t } = useI18n();
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
  const [calendarDayCounts, setCalendarDayCounts] = usePersistedState<PersistedCalendarDayCounts>(
    STORAGE_KEYS.calendarCardDayCounts,
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
  const viewMode = useMemo<CalendarViewMode>(
    () => normalizeCalendarViewMode(cardId ? calendarViewModes[cardId] : undefined),
    [calendarViewModes, cardId]
  );
  const dayCount = useMemo(
    () => clampCalendarDayCount(cardId ? calendarDayCounts[cardId] : undefined),
    [calendarDayCounts, cardId]
  );
  const tintColor = useMemo(() => {
    if (!cardId) {
      return undefined;
    }

    return calendarTintColors[cardId];
  }, [calendarTintColors, cardId]);
  const firstDayOfWeek = useMemo(() => getFirstDayOfWeek(locale), [locale]);
  // Re-resolved on the minute tick so the window rolls over midnight without a reload.
  const calendarWindow = useMemo(
    () => resolveCalendarCardWindow(new Date(timeWindowTick), viewMode, dayCount, firstDayOfWeek),
    [dayCount, firstDayOfWeek, timeWindowTick, viewMode]
  );

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

    return matchedCalendars
      .flatMap((calendar) =>
        calendar.events.map((event) => ({
          ...event,
          color: calendar.color,
        }))
      )
      .filter((event) =>
        isCalendarEventVisibleInWindow(event, calendarWindow.start, calendarWindow.end)
      )
      .sort((left, right) => {
        const leftKey = getCalendarEventSortValue(left);
        const rightKey = getCalendarEventSortValue(right);
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, MAX_CALENDAR_CARD_EVENTS);
  }, [availableCalendars, calendarWindow, cardId, fallbackEvents, selectedCalendarIds]);

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

  const setDayCount = (nextDayCount: number) => {
    if (!cardId) {
      return;
    }

    setCalendarDayCounts((current) => ({
      ...current,
      [cardId]: clampCalendarDayCount(nextDayCount),
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
    calendarWindow,
    dayCount,
    firstDayOfWeek,
    selectedCalendarIds,
    selectedCalendarLabel,
    selectedEvents,
    setDayCount,
    setSelectedCalendarIds,
    setTintColor,
    setViewMode,
    tintColor,
    viewMode,
  };
}
