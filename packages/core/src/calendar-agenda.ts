/**
 * Calendar agenda shaping.
 *
 * Pure, provider-neutral logic behind the calendar card's multi-day agenda and month grid: which
 * days an event occupies, and which days a month grid is made of. Everything here works on date
 * keys (`YYYY-MM-DD`), which compare lexicographically in chronological order.
 */

import {
  addCalendarDays,
  differenceInCalendarDays,
  formatDateKey,
  formatLocalDateKey,
  getDayOfWeek,
  getLastDayOfMonth,
  parseDateKey,
} from './calendar-dates.ts';

export const CALENDAR_DAY_COUNT_MIN = 3;
export const CALENDAR_DAY_COUNT_MAX = 14;
export const CALENDAR_DAY_COUNT_DEFAULT = 7;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CalendarAgendaEvent {
  id: string;
  startDateTime?: string;
  endDateTime?: string;
  isAllDay?: boolean;
  sortKey?: string;
}

export interface CalendarDayOccurrence<TEvent extends CalendarAgendaEvent> {
  event: TEvent;
  dateKey: string;
  continuesFromPreviousDay: boolean;
  continuesIntoNextDay: boolean;
}

export interface CalendarMonthDay {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export function clampCalendarDayCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CALENDAR_DAY_COUNT_DEFAULT;
  }

  return Math.min(CALENDAR_DAY_COUNT_MAX, Math.max(CALENDAR_DAY_COUNT_MIN, Math.round(value)));
}

function parseInstant(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isLocalMidnight(date: Date) {
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

/**
 * The first and last day an event occupies.
 *
 * All-day and timed events are read differently on purpose. A date-only value such as `2026-08-22`
 * parses as UTC midnight, so reading it on the local clock files it a day early west of Greenwich;
 * an all-day event is therefore read in UTC. A timed event is the opposite: it belongs to the day
 * the household sees on the wall clock, so it is read locally.
 *
 * All-day end dates are also exclusive in iCal and CalDAV - an event covering 22 and 23 August is
 * published as `end: 2026-08-24` - so the final day is dropped rather than rendered as a third day.
 */
export function getCalendarEventDayRange(
  event: CalendarAgendaEvent
): { firstDateKey: string; lastDateKey: string } | null {
  const startValue = event.startDateTime ?? event.sortKey;
  const start = parseInstant(startValue);
  if (!start) {
    return null;
  }

  if (event.isAllDay) {
    const firstDateKey = formatDateKey(start);
    const end = parseInstant(event.endDateTime);
    if (!end) {
      return { firstDateKey, lastDateKey: firstDateKey };
    }

    const endKey = formatDateKey(end);
    const isExclusive =
      typeof event.endDateTime === 'string' && DATE_ONLY_PATTERN.test(event.endDateTime);
    const lastDateKey = isExclusive && endKey > firstDateKey ? addCalendarDays(endKey, -1) : endKey;

    return { firstDateKey, lastDateKey: lastDateKey < firstDateKey ? firstDateKey : lastDateKey };
  }

  const firstDateKey = formatLocalDateKey(start);
  const end = parseInstant(event.endDateTime);
  if (!end || end.getTime() <= start.getTime()) {
    return { firstDateKey, lastDateKey: firstDateKey };
  }

  // An event that ends exactly at midnight ends the evening before, not the next morning.
  const inclusiveEnd = isLocalMidnight(end) ? new Date(end.getTime() - 1) : end;
  const lastDateKey = formatLocalDateKey(inclusiveEnd);

  return { firstDateKey, lastDateKey: lastDateKey < firstDateKey ? firstDateKey : lastDateKey };
}

function compareOccurrences<TEvent extends CalendarAgendaEvent>(
  left: CalendarDayOccurrence<TEvent>,
  right: CalendarDayOccurrence<TEvent>
) {
  // All-day and carried-over events head the day: they are context for the timed events below them.
  const leftSpans = Boolean(left.event.isAllDay) || left.continuesFromPreviousDay;
  const rightSpans = Boolean(right.event.isAllDay) || right.continuesFromPreviousDay;
  if (leftSpans !== rightSpans) {
    return leftSpans ? -1 : 1;
  }

  const leftStart = parseInstant(left.event.startDateTime ?? left.event.sortKey)?.getTime();
  const rightStart = parseInstant(right.event.startDateTime ?? right.event.sortKey)?.getTime();
  if (leftStart !== rightStart) {
    return (leftStart ?? Number.MAX_SAFE_INTEGER) - (rightStart ?? Number.MAX_SAFE_INTEGER);
  }

  return left.event.id.localeCompare(right.event.id);
}

/**
 * Spread events across every day they cover, keyed by date.
 *
 * A multi-day event yields one occurrence per day, each flagged so the view can show that it
 * carries over. Days outside the requested range are dropped, but the flags still describe the
 * whole event, so an event running past the edge of the window still reads as continuing.
 */
export function expandCalendarEventsByDay<TEvent extends CalendarAgendaEvent>(
  events: readonly TEvent[],
  rangeStartDateKey: string,
  rangeEndDateKey: string
): Map<string, CalendarDayOccurrence<TEvent>[]> {
  const byDay = new Map<string, CalendarDayOccurrence<TEvent>[]>();
  if (differenceInCalendarDays(rangeEndDateKey, rangeStartDateKey) < 0) {
    return byDay;
  }

  for (const event of events) {
    const range = getCalendarEventDayRange(event);
    if (!range) {
      continue;
    }

    const { firstDateKey, lastDateKey } = range;
    if (lastDateKey < rangeStartDateKey || firstDateKey > rangeEndDateKey) {
      continue;
    }

    const lastVisibleKey = lastDateKey > rangeEndDateKey ? rangeEndDateKey : lastDateKey;
    let dateKey = firstDateKey < rangeStartDateKey ? rangeStartDateKey : firstDateKey;

    while (dateKey <= lastVisibleKey) {
      const occurrences = byDay.get(dateKey);
      const occurrence: CalendarDayOccurrence<TEvent> = {
        event,
        dateKey,
        continuesFromPreviousDay: dateKey > firstDateKey,
        continuesIntoNextDay: dateKey < lastDateKey,
      };

      if (occurrences) {
        occurrences.push(occurrence);
      } else {
        byDay.set(dateKey, [occurrence]);
      }

      dateKey = addCalendarDays(dateKey, 1);
    }
  }

  for (const occurrences of byDay.values()) {
    occurrences.sort(compareOccurrences);
  }

  return byDay;
}

export function buildAgendaDayKeys(startDateKey: string, dayCount: number): string[] {
  const total = Math.max(1, Math.round(dayCount));
  const keys: string[] = [];
  for (let offset = 0; offset < total; offset += 1) {
    keys.push(addCalendarDays(startDateKey, offset));
  }

  return keys;
}

function getFirstOfMonthKey(monthAnchorDateKey: string) {
  return addCalendarDays(monthAnchorDateKey, 1 - parseDateKey(monthAnchorDateKey).day);
}

/**
 * The span a month grid actually renders, including the leading and trailing days borrowed from the
 * neighbouring months to complete its weeks. Used to size the event window, so the grid is never
 * asked to render a day nothing was fetched for.
 */
export function getMonthGridRange(monthAnchorDateKey: string, firstDayOfWeek: number) {
  const firstOfMonth = getFirstOfMonthKey(monthAnchorDateKey);
  const { year, month } = parseDateKey(firstOfMonth);
  const leadingDays = (getDayOfWeek(firstOfMonth) - firstDayOfWeek + 7) % 7;
  const startDateKey = addCalendarDays(firstOfMonth, -leadingDays);
  const weekCount = Math.ceil((leadingDays + getLastDayOfMonth(year, month)) / 7);

  return {
    startDateKey,
    endDateKey: addCalendarDays(startDateKey, weekCount * 7 - 1),
    weekCount,
  };
}

/**
 * The month grid as weeks of days. Trailing empty weeks are not rendered, so a month that fits in
 * four or five rows does not leave a blank one at the bottom of the card.
 */
export function buildMonthGridWeeks(
  monthAnchorDateKey: string,
  todayDateKey: string,
  firstDayOfWeek: number
): CalendarMonthDay[][] {
  const { startDateKey, weekCount } = getMonthGridRange(monthAnchorDateKey, firstDayOfWeek);
  const anchorMonthPrefix = getFirstOfMonthKey(monthAnchorDateKey).slice(0, 7);
  const weeks: CalendarMonthDay[][] = [];

  let dateKey = startDateKey;
  for (let week = 0; week < weekCount; week += 1) {
    const days: CalendarMonthDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        dateKey,
        dayNumber: parseDateKey(dateKey).day,
        inCurrentMonth: dateKey.slice(0, 7) === anchorMonthPrefix,
        isToday: dateKey === todayDateKey,
        isPast: dateKey < todayDateKey,
      });
      dateKey = addCalendarDays(dateKey, 1);
    }

    weeks.push(days);
  }

  return weeks;
}
