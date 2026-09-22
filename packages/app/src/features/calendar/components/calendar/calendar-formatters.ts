import { parseLocalDateKey } from '@navet/core/calendar-dates';
import type { CalendarEvent } from './types';

export function formatCalendarEventTimeLabel(event: CalendarEvent, allDayLabel = 'All day') {
  if (event.isAllDay) {
    return allDayLabel;
  }

  if (event.startTime !== '--' && event.endTime !== '--') {
    return `${event.startTime} - ${event.endTime}`;
  }

  return event.timeDisplay;
}

export function getCalendarDateParts(date: Date | null, locale?: string) {
  if (!date) {
    return {
      weekdayShort: '--',
      dayNumber: '--',
      monthShort: '--',
    };
  }

  return {
    weekdayShort: date.toLocaleDateString(locale ? [locale] : undefined, { weekday: 'short' }),
    dayNumber: date.getDate().toString(),
    monthShort: date.toLocaleDateString(locale ? [locale] : undefined, { month: 'short' }),
  };
}

export function formatCalendarGroupLabel(date: Date | null, locale?: string) {
  const { weekdayShort, dayNumber, monthShort } = getCalendarDateParts(date, locale);
  return `${weekdayShort}, ${dayNumber} ${monthShort}`;
}

/** A Sunday, so weekday offsets can be taken from it directly. */
const WEEKDAY_REFERENCE = new Date(2024, 0, 7);

export function formatCalendarWeekdayName(
  dateKey: string,
  locale?: string,
  width: 'long' | 'short' = 'long'
) {
  return parseLocalDateKey(dateKey).toLocaleDateString(locale ? [locale] : undefined, {
    weekday: width,
  });
}

export function formatCalendarDayAndMonth(dateKey: string, locale?: string) {
  return parseLocalDateKey(dateKey).toLocaleDateString(locale ? [locale] : undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/** Weekday column headers for a month grid, rotated to the locale's first weekday. */
export function formatCalendarWeekdayHeaders(locale: string | undefined, firstDayOfWeek: number) {
  return Array.from({ length: 7 }, (_unused, offset) => {
    const weekday = new Date(WEEKDAY_REFERENCE);
    weekday.setDate(WEEKDAY_REFERENCE.getDate() + ((firstDayOfWeek + offset) % 7));
    return weekday.toLocaleDateString(locale ? [locale] : undefined, { weekday: 'short' });
  });
}
