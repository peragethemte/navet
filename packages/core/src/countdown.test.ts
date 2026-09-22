import { describe, expect, it } from 'vitest';
import {
  formatLocalDateKey,
  isCountdownExpired,
  parseCountdownTarget,
  resolveCountdownPrecision,
  resolveCountdownState,
} from './countdown.ts';

// Built from local components so every assertion holds whatever timezone the suite runs in.
function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

describe('parseCountdownTarget', () => {
  it('returns null for a missing or malformed date', () => {
    expect(parseCountdownTarget({})).toBeNull();
    expect(parseCountdownTarget({ date: '20-06-2027' })).toBeNull();
    expect(parseCountdownTarget({ date: 42 })).toBeNull();
  });

  it('rejects a date that passes the pattern but does not exist', () => {
    expect(parseCountdownTarget({ date: '2027-02-30' })).toBeNull();
    expect(parseCountdownTarget({ date: '2027-13-01' })).toBeNull();
    expect(parseCountdownTarget({ date: '2028-02-29' })?.date).toBe('2028-02-29');
  });

  it('falls back to local midnight for a whole-day target', () => {
    expect(parseCountdownTarget({ date: '2027-06-20' })).toEqual({
      date: '2027-06-20',
      time: '00:00',
      precision: 'date',
    });
  });

  it('keeps a saved time out of the target while the precision is a whole day', () => {
    expect(parseCountdownTarget({ date: '2027-06-20', time: '09:30', precision: 'date' })).toEqual({
      date: '2027-06-20',
      time: '00:00',
      precision: 'date',
    });
  });

  it('uses the time once the precision says so', () => {
    expect(
      parseCountdownTarget({ date: '2027-06-20', time: '09:30', precision: 'datetime' })
    ).toEqual({ date: '2027-06-20', time: '09:30', precision: 'datetime' });
  });

  it('ignores an unusable time rather than dropping the target', () => {
    expect(
      parseCountdownTarget({ date: '2027-06-20', time: '25:00', precision: 'datetime' })?.time
    ).toBe('00:00');
  });
});

describe('resolveCountdownPrecision', () => {
  it('honours an explicit precision', () => {
    expect(resolveCountdownPrecision('date', '09:30')).toBe('date');
    expect(resolveCountdownPrecision('datetime', undefined)).toBe('datetime');
  });

  it('infers the precision from a stored time when none was saved', () => {
    expect(resolveCountdownPrecision(undefined, '09:30')).toBe('datetime');
    expect(resolveCountdownPrecision(undefined, undefined)).toBe('date');
    expect(resolveCountdownPrecision('weekly', '99:99')).toBe('date');
  });
});

describe('resolveCountdownState', () => {
  const wholeDay = parseCountdownTarget({ date: '2027-06-20' });
  const timed = parseCountdownTarget({
    date: '2027-06-20',
    time: '09:30',
    precision: 'datetime',
  });

  it('counts whole calendar days regardless of the time of day', () => {
    if (!wholeDay) throw new Error('target');
    expect(resolveCountdownState(wholeDay, localDate(2027, 6, 17, 6)).calendarDays).toBe(3);
    expect(resolveCountdownState(wholeDay, localDate(2027, 6, 17, 23, 59)).calendarDays).toBe(3);
  });

  it('reads zero calendar days on the day itself, whatever the target time', () => {
    if (!timed) throw new Error('target');
    expect(resolveCountdownState(timed, localDate(2027, 6, 20, 0, 1)).calendarDays).toBe(0);
    expect(resolveCountdownState(timed, localDate(2027, 6, 20, 23, 59)).calendarDays).toBe(0);
  });

  it('lets the two displays disagree the night before, which is the intended reading', () => {
    if (!wholeDay) throw new Error('target');
    const state = resolveCountdownState(wholeDay, localDate(2027, 6, 19, 23, 0));
    expect(state.calendarDays).toBe(1);
    expect(state.parts).toEqual({ days: 0, hours: 1, minutes: 0, seconds: 0 });
  });

  it('floors the remaining duration into days, hours, minutes and seconds', () => {
    if (!timed) throw new Error('target');
    const state = resolveCountdownState(timed, localDate(2027, 6, 17, 8, 15, 30));
    expect(state.parts).toEqual({ days: 3, hours: 1, minutes: 14, seconds: 30 });
    expect(state.status).toBe('counting');
  });

  it('flips to reached at the target and clamps the remaining duration at zero', () => {
    if (!timed) throw new Error('target');
    expect(resolveCountdownState(timed, localDate(2027, 6, 20, 9, 29, 59)).status).toBe('counting');

    const reached = resolveCountdownState(timed, localDate(2027, 6, 20, 9, 30));
    expect(reached.status).toBe('reached');
    expect(reached.parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('expires at the local midnight that ends the target day', () => {
    if (!timed) throw new Error('target');
    const state = resolveCountdownState(timed, localDate(2027, 6, 20, 9, 30));
    expect(state.expiresAt).toBe(localDate(2027, 6, 21).getTime());
    expect(state.targetAt).toBe(localDate(2027, 6, 20, 9, 30).getTime());
  });

  it('rolls the expiry across a month boundary', () => {
    const endOfMonth = parseCountdownTarget({ date: '2027-06-30' });
    if (!endOfMonth) throw new Error('target');
    expect(resolveCountdownState(endOfMonth, localDate(2027, 6, 1)).expiresAt).toBe(
      localDate(2027, 7, 1).getTime()
    );
  });

  it('reports negative calendar days once the day has passed', () => {
    if (!wholeDay) throw new Error('target');
    expect(resolveCountdownState(wholeDay, localDate(2027, 6, 23)).calendarDays).toBe(-3);
  });
});

describe('isCountdownExpired', () => {
  const target = parseCountdownTarget({ date: '2027-06-20', time: '23:30', precision: 'datetime' });

  it('stays unexpired for the rest of the target day', () => {
    if (!target) throw new Error('target');
    expect(isCountdownExpired(target, localDate(2027, 6, 20, 23, 30))).toBe(false);
    expect(isCountdownExpired(target, localDate(2027, 6, 20, 23, 59, 59))).toBe(false);
  });

  it('expires at the next local midnight', () => {
    if (!target) throw new Error('target');
    expect(isCountdownExpired(target, localDate(2027, 6, 21))).toBe(true);
  });
});

describe('formatLocalDateKey', () => {
  it('pads to a comparable key', () => {
    expect(formatLocalDateKey(localDate(2027, 6, 5))).toBe('2027-06-05');
    expect(formatLocalDateKey(localDate(2027, 12, 31, 23, 59))).toBe('2027-12-31');
  });
});
