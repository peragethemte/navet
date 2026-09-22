import { describe, expect, it } from 'vitest';
import {
  buildAgendaDayKeys,
  buildMonthGridWeeks,
  clampCalendarDayCount,
  expandCalendarEventsByDay,
  getCalendarEventDayRange,
  getMonthGridRange,
} from './calendar-agenda.ts';

// Timed events are built from local components so every assertion holds in whatever timezone the
// suite runs in. All-day events are written as the date-only strings providers actually send.
function timedIso(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function timedEvent(
  id: string,
  start: [number, number, number, number?, number?],
  end?: [number, number, number, number?, number?]
) {
  return {
    id,
    startDateTime: timedIso(...start),
    endDateTime: end ? timedIso(...end) : undefined,
    sortKey: timedIso(...start),
  };
}

function allDayEvent(id: string, start: string, end?: string) {
  return { id, startDateTime: start, endDateTime: end, isAllDay: true, sortKey: start };
}

describe('clampCalendarDayCount', () => {
  it('falls back to the default for anything that is not a usable number', () => {
    expect(clampCalendarDayCount(undefined)).toBe(7);
    expect(clampCalendarDayCount('7')).toBe(7);
    expect(clampCalendarDayCount(Number.NaN)).toBe(7);
  });

  it('clamps to the supported range and rounds', () => {
    expect(clampCalendarDayCount(1)).toBe(3);
    expect(clampCalendarDayCount(99)).toBe(14);
    expect(clampCalendarDayCount(5.4)).toBe(5);
  });
});

describe('getCalendarEventDayRange', () => {
  it('returns null when there is no usable start', () => {
    expect(getCalendarEventDayRange({ id: 'a' })).toBeNull();
    expect(getCalendarEventDayRange({ id: 'a', startDateTime: 'not-a-date' })).toBeNull();
  });

  it('keeps a timed event on its local day', () => {
    expect(getCalendarEventDayRange(timedEvent('a', [2026, 9, 22, 18], [2026, 9, 22, 20]))).toEqual(
      {
        firstDateKey: '2026-09-22',
        lastDateKey: '2026-09-22',
      }
    );
  });

  it('files a timed event just after midnight on the day the household reads, not the UTC day', () => {
    expect(getCalendarEventDayRange(timedEvent('a', [2026, 9, 22, 0, 30]))).toEqual({
      firstDateKey: '2026-09-22',
      lastDateKey: '2026-09-22',
    });
  });

  it('spans a timed event that runs past midnight', () => {
    expect(getCalendarEventDayRange(timedEvent('a', [2026, 9, 22, 22], [2026, 9, 23, 1]))).toEqual({
      firstDateKey: '2026-09-22',
      lastDateKey: '2026-09-23',
    });
  });

  it('ends an event finishing exactly at midnight on the evening before', () => {
    expect(getCalendarEventDayRange(timedEvent('a', [2026, 9, 22, 20], [2026, 9, 23, 0]))).toEqual({
      firstDateKey: '2026-09-22',
      lastDateKey: '2026-09-22',
    });
  });

  it('treats an all-day end date as exclusive', () => {
    // Two days, 22 and 23 August, published the way iCal and CalDAV publish it.
    expect(getCalendarEventDayRange(allDayEvent('a', '2026-08-22', '2026-08-24'))).toEqual({
      firstDateKey: '2026-08-22',
      lastDateKey: '2026-08-23',
    });
  });

  it('keeps a single all-day event on one day', () => {
    expect(getCalendarEventDayRange(allDayEvent('a', '2026-08-22', '2026-08-23'))).toEqual({
      firstDateKey: '2026-08-22',
      lastDateKey: '2026-08-22',
    });
    expect(getCalendarEventDayRange(allDayEvent('a', '2026-08-22'))).toEqual({
      firstDateKey: '2026-08-22',
      lastDateKey: '2026-08-22',
    });
  });
});

describe('expandCalendarEventsByDay', () => {
  it('puts a multi-day event on every day it covers, flagged as carrying over', () => {
    const byDay = expandCalendarEventsByDay(
      [allDayEvent('trip', '2026-08-22', '2026-08-25')],
      '2026-08-20',
      '2026-08-30'
    );

    expect([...byDay.keys()]).toEqual(['2026-08-22', '2026-08-23', '2026-08-24']);
    expect(byDay.get('2026-08-22')?.[0]).toMatchObject({
      continuesFromPreviousDay: false,
      continuesIntoNextDay: true,
    });
    expect(byDay.get('2026-08-23')?.[0]).toMatchObject({
      continuesFromPreviousDay: true,
      continuesIntoNextDay: true,
    });
    expect(byDay.get('2026-08-24')?.[0]).toMatchObject({
      continuesFromPreviousDay: true,
      continuesIntoNextDay: false,
    });
  });

  it('clips to the window but still reports that the event continues beyond it', () => {
    const byDay = expandCalendarEventsByDay(
      [allDayEvent('trip', '2026-08-20', '2026-08-30')],
      '2026-08-22',
      '2026-08-24'
    );

    expect([...byDay.keys()]).toEqual(['2026-08-22', '2026-08-23', '2026-08-24']);
    expect(byDay.get('2026-08-22')?.[0].continuesFromPreviousDay).toBe(true);
    expect(byDay.get('2026-08-24')?.[0].continuesIntoNextDay).toBe(true);
  });

  it('drops events outside the window', () => {
    const byDay = expandCalendarEventsByDay(
      [allDayEvent('past', '2026-08-01'), allDayEvent('future', '2026-09-30')],
      '2026-08-22',
      '2026-08-24'
    );

    expect(byDay.size).toBe(0);
  });

  it('heads each day with all-day and carried-over events, then orders by start time', () => {
    const byDay = expandCalendarEventsByDay(
      [
        timedEvent('evening', [2026, 9, 22, 18]),
        timedEvent('morning', [2026, 9, 22, 8]),
        allDayEvent('waste', '2026-09-22'),
      ],
      '2026-09-22',
      '2026-09-22'
    );

    expect(byDay.get('2026-09-22')?.map((occurrence) => occurrence.event.id)).toEqual([
      'waste',
      'morning',
      'evening',
    ]);
  });

  it('returns nothing for an inverted window', () => {
    expect(
      expandCalendarEventsByDay([allDayEvent('a', '2026-08-22')], '2026-08-24', '2026-08-22').size
    ).toBe(0);
  });
});

describe('buildAgendaDayKeys', () => {
  it('walks forward from the start day, crossing a month boundary', () => {
    expect(buildAgendaDayKeys('2026-08-30', 4)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });
});

describe('getMonthGridRange', () => {
  // 1 September 2026 is a Tuesday, so the grid borrows one leading day when weeks start on Monday
  // and two when they start on Sunday.
  it('completes the weeks around the month for a Monday-first locale', () => {
    expect(getMonthGridRange('2026-09-22', 1)).toEqual({
      startDateKey: '2026-08-31',
      endDateKey: '2026-10-04',
      weekCount: 5,
    });
  });

  it('completes the weeks around the month for a Sunday-first locale', () => {
    expect(getMonthGridRange('2026-09-22', 0)).toEqual({
      startDateKey: '2026-08-30',
      endDateKey: '2026-10-03',
      weekCount: 5,
    });
  });
});

describe('buildMonthGridWeeks', () => {
  it('lays the month out in whole weeks without a trailing empty row', () => {
    const weeks = buildMonthGridWeeks('2026-09-22', '2026-09-22', 1);

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].dateKey).toBe('2026-08-31');
    expect(weeks[4][6].dateKey).toBe('2026-10-04');
  });

  it('marks borrowed days, today and past days', () => {
    const weeks = buildMonthGridWeeks('2026-09-22', '2026-09-22', 1);
    const days = weeks.flat();
    const byKey = new Map(days.map((day) => [day.dateKey, day]));

    expect(byKey.get('2026-08-31')).toMatchObject({ inCurrentMonth: false, isPast: true });
    expect(byKey.get('2026-09-21')).toMatchObject({
      inCurrentMonth: true,
      isToday: false,
      isPast: true,
    });
    expect(byKey.get('2026-09-22')).toMatchObject({
      dayNumber: 22,
      inCurrentMonth: true,
      isToday: true,
      isPast: false,
    });
    expect(byKey.get('2026-10-04')).toMatchObject({ inCurrentMonth: false, isPast: false });
  });
});
