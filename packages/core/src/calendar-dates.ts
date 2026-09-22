/**
 * Calendar date keys.
 *
 * A date key is a plain `YYYY-MM-DD` string. Arithmetic on keys is pure string and integer math, so
 * it is correct in every timezone; the only place a timezone can leak in is when a `Date` is turned
 * into a key, which is why there are two of those and they are not interchangeable.
 *
 * These helpers started out private to `chore-calendar-policy.ts`, which schedules date-only chores
 * and therefore reads a `Date` in UTC. The calendar card needs the same key arithmetic but must
 * bucket timed events by the wall clock the household reads, so the local variant lives here too.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(dateKey: string) {
  if (!DATE_PATTERN.test(dateKey)) {
    throw new Error(`Invalid chore date: ${dateKey}`);
  }

  const parts = dateKey.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid chore date: ${dateKey}`);
  }

  return { year, month, day };
}

function toKey(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

/**
 * Read a `Date` in UTC. Correct for date-only values, which parse as UTC midnight, and for chore
 * scheduling, which has no time of day at all.
 */
export function formatDateKey(date: Date) {
  return toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Read a `Date` on the local wall clock. Correct for timed calendar events: an appointment at 00:30
 * in Oslo belongs to that morning, not to the previous day, which is what reading it in UTC gives.
 */
export function formatLocalDateKey(date: Date) {
  return toKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** A date key as a `Date` at local midnight, for comparing against event instants. */
export function parseLocalDateKey(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function addCalendarDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  const year = date.year;
  const month = date.month;
  const day = date.day;
  return formatDateKey(new Date(Date.UTC(year, month - 1, day + days)));
}

export function differenceInCalendarDays(left: string, right: string) {
  const leftDate = parseDateKey(left);
  const rightDate = parseDateKey(right);
  const leftTime = Date.UTC(leftDate.year, leftDate.month - 1, leftDate.day);
  const rightTime = Date.UTC(rightDate.year, rightDate.month - 1, rightDate.day);
  return Math.round((leftTime - rightTime) / 86_400_000);
}

export function getDayOfWeek(dateKey: string) {
  const date = parseDateKey(dateKey);
  const year = date.year;
  const month = date.month;
  const day = date.day;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getLastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

type LocaleWeekInfo = { firstDay?: number };
type LocaleWithWeekInfo = Intl.Locale & {
  weekInfo?: LocaleWeekInfo;
  getWeekInfo?: () => LocaleWeekInfo;
};

/**
 * First weekday for a locale as a `Date.getDay()` value, so 0 is Sunday.
 *
 * `Intl.Locale` reports it as 1..7 with 7 meaning Sunday. Engines expose it either as a property or
 * as a method depending on version, and older ones not at all, so every path is guarded and falls
 * back to Monday - the right default for the European locales Navet ships.
 */
export function getFirstDayOfWeek(locale?: string): number {
  if (!locale) {
    return 1;
  }

  try {
    const resolved = new Intl.Locale(locale) as LocaleWithWeekInfo;
    const info =
      typeof resolved.getWeekInfo === 'function' ? resolved.getWeekInfo() : resolved.weekInfo;
    const firstDay = info?.firstDay;
    if (typeof firstDay === 'number' && firstDay >= 1 && firstDay <= 7) {
      return firstDay === 7 ? 0 : firstDay;
    }
  } catch {
    // An unparseable locale tag is not worth failing a render over.
  }

  return 1;
}
