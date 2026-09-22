/**
 * A countdown target is stored as local wall clock, never as an instant. "20 June" has to stay
 * 20 June on every screen in the house, and a dashboard exported from one device has to mean the
 * same day on the next one. Everything here therefore resolves against the host's own timezone
 * through the local Date constructor, so DST transitions are handled by the platform instead of
 * by arithmetic.
 *
 * Two readings of "days" live side by side on purpose:
 * - the `days` display shows the whole calendar-day difference, so the target day itself reads 0
 * - the `full` display shows the exact remaining duration floored into days/hours/minutes/seconds
 * At 23:00 the night before, the first says "1 day" and the second says "0d 01:00:00". Both are
 * correct; they answer different questions.
 */

export const COUNTDOWN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const COUNTDOWN_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The target is a whole day, or a day and a time of day. */
export type CountdownPrecision = 'date' | 'datetime';

/** The card shows whole days, or the full days/hours/minutes/seconds breakdown. */
export type CountdownDisplay = 'days' | 'full';

export type CountdownStatus = 'counting' | 'reached';

export interface CountdownTarget {
  date: string;
  /** Always set; a date-only target starts at local midnight. */
  time: string;
  precision: CountdownPrecision;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface CountdownState {
  status: CountdownStatus;
  /** Local instant the countdown runs out. */
  targetAt: number;
  /** Local midnight that ends the target's day, after which the card has nothing left to say. */
  expiresAt: number;
  /** Signed whole calendar days from today to the target day. Negative once the day has passed. */
  calendarDays: number;
  /** Remaining duration, floored and clamped at zero. */
  parts: CountdownParts;
}

export interface CountdownTargetInput {
  date?: unknown;
  time?: unknown;
  precision?: unknown;
}

/** Keeps a saved time around when the target is temporarily set back to a whole day. */
export function resolveCountdownPrecision(precision: unknown, time: unknown): CountdownPrecision {
  if (precision === 'datetime' || precision === 'date') {
    return precision;
  }

  return typeof time === 'string' && COUNTDOWN_TIME_PATTERN.test(time) ? 'datetime' : 'date';
}

export function isCountdownDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !COUNTDOWN_DATE_PATTERN.test(value)) {
    return false;
  }

  // Rejects 2026-02-30 and friends, which pass the pattern but roll over when constructed.
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function isCountdownTimeValue(value: unknown): value is string {
  return typeof value === 'string' && COUNTDOWN_TIME_PATTERN.test(value);
}

/** Returns null for an unset or unusable target rather than throwing, because it comes from storage. */
export function parseCountdownTarget(input: CountdownTargetInput): CountdownTarget | null {
  if (!isCountdownDateKey(input.date)) {
    return null;
  }

  const precision = resolveCountdownPrecision(input.precision, input.time);
  const time = precision === 'datetime' && isCountdownTimeValue(input.time) ? input.time : '00:00';

  return { date: input.date, time, precision };
}

export function formatLocalDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function toLocalInstant(dateKey: string, time: string, dayOffset = 0): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day + dayOffset, hour, minute, 0, 0).getTime();
}

function differenceInCalendarDays(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / MS_PER_DAY);
}

export function resolveCountdownState(target: CountdownTarget, now: Date): CountdownState {
  const targetAt = toLocalInstant(target.date, target.time);
  const expiresAt = toLocalInstant(target.date, '00:00', 1);
  const remaining = Math.max(0, targetAt - now.getTime());

  return {
    status: now.getTime() < targetAt ? 'counting' : 'reached',
    targetAt,
    expiresAt,
    calendarDays: differenceInCalendarDays(formatLocalDateKey(now), target.date),
    parts: {
      days: Math.floor(remaining / MS_PER_DAY),
      hours: Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR),
      minutes: Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE),
      seconds: Math.floor((remaining % MS_PER_MINUTE) / MS_PER_SECOND),
    },
  };
}

/** True once the target's own day is over, which is when the card has nothing left to count. */
export function isCountdownExpired(target: CountdownTarget, now: Date): boolean {
  return now.getTime() >= toLocalInstant(target.date, '00:00', 1);
}
