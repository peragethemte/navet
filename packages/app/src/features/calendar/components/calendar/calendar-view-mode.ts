import {
  CALENDAR_DAY_COUNT_DEFAULT,
  clampCalendarDayCount,
  getMonthGridRange,
} from '@navet/core/calendar-agenda';
import { formatLocalDateKey, parseLocalDateKey } from '@navet/core/calendar-dates';

/**
 * How much of the calendar a card shows.
 *
 * `days` was called `week` before the day count became a setting, and that value is still on disk in
 * every existing profile. It is accepted on read and never written again, so nothing needs
 * migrating and a card configured before this change keeps showing the same seven days.
 */
export type CalendarViewMode = 'day' | 'days' | 'month';

export const CALENDAR_VIEW_MODES: readonly CalendarViewMode[] = ['day', 'days', 'month'];

export function normalizeCalendarViewMode(stored: unknown): CalendarViewMode {
  if (stored === 'day' || stored === 'days' || stored === 'month') {
    return stored;
  }

  return 'days';
}

export interface CalendarCardWindow {
  start: Date;
  end: Date;
  startDateKey: string;
  endDateKey: string;
  todayDateKey: string;
}

function endOfLocalDay(dateKey: string) {
  const date = parseLocalDateKey(dateKey);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * The span a card renders.
 *
 * Agenda views start at the current moment, so an appointment that is over drops off the card
 * rather than lingering until midnight. The month grid instead starts at the top-left cell, because
 * a grid with its first three weeks blanked out reads as broken rather than as tidy.
 */
export function resolveCalendarCardWindow(
  now: Date,
  viewMode: CalendarViewMode,
  dayCount: number,
  firstDayOfWeek: number
): CalendarCardWindow {
  const todayKey = formatLocalDateKey(now);

  if (viewMode === 'month') {
    const { startDateKey, endDateKey } = getMonthGridRange(todayKey, firstDayOfWeek);
    return {
      start: parseLocalDateKey(startDateKey),
      end: endOfLocalDay(endDateKey),
      startDateKey,
      endDateKey,
      todayDateKey: todayKey,
    };
  }

  const spanDays = viewMode === 'day' ? 1 : clampCalendarDayCount(dayCount);
  const lastDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + spanDays - 1);
  const endDateKey = formatLocalDateKey(lastDate);

  return {
    start: now,
    end: endOfLocalDay(endDateKey),
    startDateKey: todayKey,
    endDateKey,
    todayDateKey: todayKey,
  };
}

export { CALENDAR_DAY_COUNT_DEFAULT, clampCalendarDayCount };
