import { useI18n } from '@navet/app/hooks';
import { getLocaleForLanguage } from '@navet/app/i18n';
import {
  type CalendarDayOccurrence,
  expandCalendarEventsByDay,
  getCalendarEventDayRange,
} from '@navet/core/calendar-agenda';
import { parseLocalDateKey } from '@navet/core/calendar-dates';
import { useMemo } from 'react';
import type { CalendarEvent, CalendarEventGroup } from './types';

function toIsoDate(baseDate: Date, dayOffset: number, hours: number, minutes = 0) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() + dayOffset);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

function formatMockTime(locale: string, hours: number, minutes = 0) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hours, minutes)
  );
}

/**
 * Group events under the day the household reads them on.
 *
 * The day comes from `getCalendarEventDayRange`, which reads timed events on the local clock and
 * all-day events in UTC. Deriving the key from the event's own instant instead - as this did while
 * it used `toISOString()` - filed anything between midnight and the UTC offset under the day before.
 */
function groupEventsByDay(events: CalendarEvent[]): CalendarEventGroup[] {
  const groups = new Map<string, CalendarEventGroup>();

  for (const event of events) {
    const range = getCalendarEventDayRange(event);
    const key = range ? range.firstDateKey : `unknown-${event.id}`;

    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
      continue;
    }

    groups.set(key, {
      key,
      date: range ? parseLocalDateKey(range.firstDateKey) : null,
      events: [event],
    });
  }

  return Array.from(groups.values());
}

/**
 * Events spread across every day they cover, for the views that render a day at a time.
 *
 * Kept apart from `useCalendarData` because the range depends on the card's own view mode, which
 * `useCalendarCardSources` owns.
 */
export function useCalendarDayOccurrences(
  events: CalendarEvent[],
  rangeStartDateKey: string,
  rangeEndDateKey: string
): Map<string, CalendarDayOccurrence<CalendarEvent>[]> {
  return useMemo(
    () => expandCalendarEventsByDay(events, rangeStartDateKey, rangeEndDateKey),
    [events, rangeEndDateKey, rangeStartDateKey]
  );
}

export function useCalendarData(events?: CalendarEvent[]) {
  const { language, t } = useI18n();
  const currentDate = useMemo(() => new Date(), []);
  const locale = getLocaleForLanguage(language);

  const mockEvents = useMemo<CalendarEvent[]>(
    () => [
      {
        id: '1',
        title: t('calendar.mock.fridayPlanning'),
        startTime: formatMockTime(locale, 9),
        endTime: formatMockTime(locale, 9, 30),
        timeDisplay: formatMockTime(locale, 9),
        startDateTime: toIsoDate(currentDate, 0, 9, 0),
        endDateTime: toIsoDate(currentDate, 0, 9, 30),
        type: 'event',
        color: 'bg-blue-500',
        attendees: 8,
        sortKey: toIsoDate(currentDate, 0, 9, 0),
      },
      {
        id: '2',
        title: t('calendar.mock.groceriesPickup'),
        startTime: formatMockTime(locale, 13),
        endTime: formatMockTime(locale, 13, 30),
        timeDisplay: formatMockTime(locale, 13),
        startDateTime: toIsoDate(currentDate, 0, 13, 0),
        endDateTime: toIsoDate(currentDate, 0, 13, 30),
        location: t('calendar.mock.marketHall'),
        type: 'event',
        color: 'bg-purple-500',
        sortKey: toIsoDate(currentDate, 0, 13, 0),
      },
      {
        id: '3',
        title: t('calendar.mock.foodWastePickup'),
        startTime: '--',
        endTime: '--',
        timeDisplay: '--',
        startDateTime: toIsoDate(currentDate, 1, 0, 0),
        isAllDay: true,
        location: t('calendar.mock.home'),
        type: 'event',
        color: 'bg-green-500',
        sortKey: toIsoDate(currentDate, 1, 0, 0),
      },
      {
        id: '4',
        title: t('calendar.mock.drivingCourse'),
        startTime: formatMockTime(locale, 17),
        endTime: formatMockTime(locale, 20, 10),
        timeDisplay: formatMockTime(locale, 17),
        startDateTime: toIsoDate(currentDate, 3, 17, 0),
        endDateTime: toIsoDate(currentDate, 3, 20, 10),
        location: 'LBS Kreativa Gymnasiet Bredgatan 10, 222 21 Lund',
        type: 'event',
        color: 'bg-orange-500',
        sortKey: toIsoDate(currentDate, 3, 17, 0),
      },
      {
        id: '5',
        title: t('calendar.mock.swimmingLessons'),
        startTime: formatMockTime(locale, 15, 30),
        endTime: formatMockTime(locale, 16),
        timeDisplay: formatMockTime(locale, 15, 30),
        startDateTime: toIsoDate(currentDate, 3, 15, 30),
        endDateTime: toIsoDate(currentDate, 3, 16, 0),
        location: t('calendar.mock.swimmingPool'),
        type: 'event',
        color: 'bg-indigo-500',
        sortKey: toIsoDate(currentDate, 3, 15, 30),
      },
    ],
    [currentDate, locale, t]
  );

  const sourceEvents = useMemo(() => events ?? mockEvents, [events, mockEvents]);
  const groupedEvents = useMemo(() => groupEventsByDay(sourceEvents), [sourceEvents]);
  const nextEvent = useMemo(() => sourceEvents[0] ?? null, [sourceEvents]);
  const smallGroups = useMemo(() => groupedEvents, [groupedEvents]);
  const mediumGroups = useMemo(() => groupedEvents, [groupedEvents]);
  const largeGroups = useMemo(() => groupedEvents.slice(0, 4), [groupedEvents]);

  return {
    currentDate,
    sourceEvents,
    groupedEvents,
    nextEvent,
    smallGroups,
    mediumGroups,
    largeGroups,
    mockEvents,
  };
}
